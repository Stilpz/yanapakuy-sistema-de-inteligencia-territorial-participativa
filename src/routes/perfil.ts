import { Hono } from 'hono'
import type { Bindings, Variables } from '../lib/types'
import { requireAuth } from '../lib/middleware'

const perfil = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /api/perfil — perfil + roles + permisos
perfil.get('/', requireAuth, async (c) => {
  const u = c.get('user')
  const perms = c.get('permissions')
  const user = await c.env.DB
    .prepare(
      `SELECT u.uuid, u.name, u.email, r.code AS role, ap.mactor, ap.organization, ap.territory
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN actor_profiles ap ON ap.user_id = u.id WHERE u.uuid = ?`
    )
    .bind(u.sub)
    .first<any>()
  if (!user) return c.json({ message: 'Usuario no encontrado.' }, 404)

  return c.json({
    id: user.uuid,
    name: user.name,
    email: user.email,
    roles: [user.role],
    permissions: perms,
    actor: { mactor: user.mactor, organization: user.organization, territory: user.territory },
  })
})

export default perfil
