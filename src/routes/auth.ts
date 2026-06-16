import { Hono } from 'hono'
import { hashPassword, verifyPassword, signJwt, uuidv4 } from '../lib/auth'
import { getSecret, type Bindings, type Variables } from '../lib/types'
import { loadPermissions, requireAuth } from '../lib/middleware'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const MACTOR = ['institucion', 'gremio', 'comunidad', 'academia', 'otro']

/** Comparacion en tiempo constante para evitar timing attacks sobre el token. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// POST /api/auth/bootstrap — crea el PRIMER ADMIN (Opcion A: token secreto + auto-desactivacion).
// Se desactiva solo cuando ya existe al menos un usuario ADMIN. La credencial nunca vive en el repo.
auth.post('/bootstrap', async (c) => {
  const secret = c.env.ADMIN_BOOTSTRAP_TOKEN
  // 1) Si no hay token configurado, no se permite bootstrap (evita un endpoint abierto por descuido).
  if (!secret || secret.length < 16)
    return c.json({ message: 'Bootstrap no disponible: ADMIN_BOOTSTRAP_TOKEN no configurado.' }, 503)

  // 2) Auto-desactivacion: si ya existe un ADMIN, el endpoint queda cerrado para siempre.
  const adminExists = await c.env.DB
    .prepare("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'ADMIN' LIMIT 1")
    .first()
  if (adminExists) return c.json({ message: 'Ya existe un ADMIN. El bootstrap esta deshabilitado.' }, 409)

  const body = await c.req.json().catch(() => ({}))
  const { token, name, email, password } = body

  // 3) Validacion del token secreto (tiempo constante).
  if (!token || !safeEqual(String(token), secret)) return c.json({ message: 'Token de bootstrap invalido.' }, 403)

  // 4) Validacion de datos del primer administrador.
  if (!name || !email || !password) return c.json({ message: 'Nombre, email y contraseña son obligatorios.' }, 422)
  if (String(password).length < 12)
    return c.json({ message: 'La contraseña del ADMIN debe tener al menos 12 caracteres.' }, 422)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ message: 'Email invalido.' }, 422)

  const role = await c.env.DB.prepare("SELECT id FROM roles WHERE code = 'ADMIN'").first<{ id: number }>()
  if (!role) return c.json({ message: 'Rol ADMIN no configurado. Aplica el seed de estructura RBAC.' }, 500)

  const uuid = uuidv4()
  const hash = await hashPassword(password)
  const res = await c.env.DB
    .prepare(
      `INSERT INTO users (uuid, name, email, password_hash, role_id, status, email_verified_at)
       VALUES (?, ?, ?, ?, ?, 'activo', datetime('now'))`
    )
    .bind(uuid, name, email, hash, role.id)
    .run()

  const userId = res.meta.last_row_id as number
  await c.env.DB
    .prepare('INSERT INTO actor_profiles (user_id, mactor, organization) VALUES (?, ?, ?)')
    .bind(userId, 'institucion', 'Yanapakuy — Administracion')
    .run()
  await c.env.DB
    .prepare("INSERT INTO audit_log (user_id, action) VALUES (?, 'admin.bootstrap')")
    .bind(userId)
    .run()

  return c.json({ message: 'ADMIN inicial creado. El bootstrap queda deshabilitado.', id: uuid, email, role: 'ADMIN' }, 201)
})

// POST /api/auth/register — crea usuario con rol ACTOR por defecto + perfil
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { name, email, password, password_confirmation, mactor, organization, territory } = body

  if (!name || !email || !password) return c.json({ message: 'Nombre, email y contraseña son obligatorios.' }, 422)
  if (String(password).length < 8) return c.json({ message: 'La contraseña debe tener al menos 8 caracteres.' }, 422)
  if (password_confirmation !== undefined && password !== password_confirmation)
    return c.json({ message: 'Las contraseñas no coinciden.' }, 422)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ message: 'Email invalido.' }, 422)

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return c.json({ message: 'Ese email ya esta registrado.' }, 422)

  const role = await c.env.DB.prepare("SELECT id FROM roles WHERE code = 'ACTOR'").first<{ id: number }>()
  if (!role) return c.json({ message: 'Rol ACTOR no configurado.' }, 500)

  const uuid = uuidv4()
  const hash = await hashPassword(password)
  const res = await c.env.DB
    .prepare(
      `INSERT INTO users (uuid, name, email, password_hash, role_id, status, email_verified_at)
       VALUES (?, ?, ?, ?, ?, 'activo', datetime('now'))`
    )
    .bind(uuid, name, email, hash, role.id)
    .run()

  const userId = res.meta.last_row_id as number
  const m = MACTOR.includes(mactor) ? mactor : 'comunidad'
  await c.env.DB
    .prepare('INSERT INTO actor_profiles (user_id, mactor, organization, territory) VALUES (?, ?, ?, ?)')
    .bind(userId, m, organization || null, territory || null)
    .run()

  const token = await signJwt(
    { sub: uuid, uid: userId, role: 'ACTOR', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    getSecret(c.env)
  )
  const permissions = await loadPermissions(c.env.DB, 'ACTOR')

  return c.json(
    { id: uuid, name, email, roles: ['ACTOR'], permissions, actor: { mactor: m, organization, territory }, token },
    201
  )
})

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json().catch(() => ({}))
  if (!email || !password) return c.json({ message: 'Email y contraseña son obligatorios.' }, 422)

  const user = await c.env.DB
    .prepare(
      `SELECT u.id, u.uuid, u.name, u.email, u.password_hash, u.status, r.code AS role
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`
    )
    .bind(email)
    .first<any>()

  if (!user || !(await verifyPassword(password, user.password_hash)))
    return c.json({ message: 'Credenciales invalidas.' }, 422)
  if (user.status !== 'activo') return c.json({ message: 'La cuenta no esta activa.' }, 422)

  const token = await signJwt(
    { sub: user.uuid, uid: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    getSecret(c.env)
  )
  const permissions = await loadPermissions(c.env.DB, user.role)

  await c.env.DB.prepare("INSERT INTO audit_log (user_id, action) VALUES (?, 'login')").bind(user.id).run()

  return c.json({ id: user.uuid, name: user.name, email: user.email, roles: [user.role], permissions, token })
})

// POST /api/auth/logout (stateless JWT — cliente descarta token)
auth.post('/logout', requireAuth, async (c) => {
  return c.json({ message: 'Sesion cerrada.' })
})

export default auth
