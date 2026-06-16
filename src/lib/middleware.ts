import type { Context, Next } from 'hono'
import { verifyJwt } from './auth'
import { getSecret, type Bindings, type Variables } from './types'

type Env = { Bindings: Bindings; Variables: Variables }

// Carga los permisos de un rol (RBAC en BD)
export async function loadPermissions(db: D1Database, roleCode: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.code = ?`
    )
    .bind(roleCode)
    .all<{ code: string }>()
  return (results || []).map((r) => r.code)
}

// Requiere token Sanctum-equivalente (JWT) valido
export async function requireAuth(c: Context<Env>, next: Next) {
  const header = c.req.header('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return c.json({ message: 'No autenticado.' }, 401)

  const payload = await verifyJwt(token, getSecret(c.env))
  if (!payload) return c.json({ message: 'Token invalido o expirado.' }, 401)

  c.set('user', payload)
  const perms = await loadPermissions(c.env.DB, payload.role)
  c.set('permissions', perms)
  await next()
}

// Requiere un permiso especifico (equivalente a middleware permission: de spatie)
export function requirePermission(permission: string) {
  return async (c: Context<Env>, next: Next) => {
    const perms = c.get('permissions') || []
    if (!perms.includes(permission)) {
      return c.json({ message: `Permiso requerido: ${permission}` }, 403)
    }
    await next()
  }
}
