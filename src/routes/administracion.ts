import { Hono } from 'hono'
import type { Bindings, Variables } from '../lib/types'
import { requireAuth, requirePermission } from '../lib/middleware'

const administracion = new Hono<{ Bindings: Bindings; Variables: Variables }>()

administracion.use('/*', requireAuth)

// GET /api/administracion/users — listado (ADMIN)
administracion.get('/users', requirePermission('users.manage'), async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `SELECT u.uuid, u.name, u.email, u.status, u.created_at, r.code AS role,
              ap.mactor, ap.organization, ap.territory
       FROM users u JOIN roles r ON r.id = u.role_id
       LEFT JOIN actor_profiles ap ON ap.user_id = u.id
       ORDER BY u.created_at DESC`
    )
    .all<any>()
  return c.json({ data: results || [] })
})

// GET /api/administracion/roles — roles + permisos (ADMIN)
administracion.get('/roles', requirePermission('users.manage'), async (c) => {
  const { results: roles } = await c.env.DB.prepare('SELECT id, code, name, description, is_system FROM roles ORDER BY id').all<any>()
  const data = []
  for (const r of roles || []) {
    const { results: perms } = await c.env.DB
      .prepare('SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?')
      .bind(r.id)
      .all<any>()
    data.push({ ...r, permissions: (perms || []).map((p) => p.code) })
  }
  return c.json({ data })
})

// PATCH /api/administracion/users/:uuid/role — cambia el rol de un usuario (ADMIN)
administracion.patch('/users/:uuid/role', requirePermission('users.manage'), async (c) => {
  const uuid = c.req.param('uuid')
  const { role } = await c.req.json().catch(() => ({}))
  const roleRow = await c.env.DB.prepare('SELECT id FROM roles WHERE code = ?').bind(role).first<any>()
  if (!roleRow) return c.json({ message: 'Rol no existe.' }, 422)
  const res = await c.env.DB.prepare('UPDATE users SET role_id = ? WHERE uuid = ?').bind(roleRow.id, uuid).run()
  if (res.meta.changes === 0) return c.json({ message: 'Usuario no encontrado.' }, 404)
  return c.json({ message: 'Rol actualizado.', uuid, role })
})

// PATCH /api/administracion/users/:uuid/status — activar/suspender (ADMIN)
administracion.patch('/users/:uuid/status', requirePermission('users.manage'), async (c) => {
  const uuid = c.req.param('uuid')
  const { status } = await c.req.json().catch(() => ({}))
  if (!['pendiente', 'activo', 'suspendido'].includes(status)) return c.json({ message: 'Estado invalido.' }, 422)
  const res = await c.env.DB.prepare('UPDATE users SET status = ? WHERE uuid = ?').bind(status, uuid).run()
  if (res.meta.changes === 0) return c.json({ message: 'Usuario no encontrado.' }, 404)
  return c.json({ message: 'Estado actualizado.', uuid, status })
})

// POST /api/indicators — publicar valor oficial (GESTOR_INSTITUCIONAL / ADMIN)
administracion.post('/indicators', requirePermission('indicators.publish'), async (c) => {
  const { code, period, value, note } = await c.req.json().catch(() => ({}))
  const ind = await c.env.DB.prepare('SELECT id FROM indicators WHERE code = ?').bind(code).first<any>()
  if (!ind) return c.json({ message: 'Indicador no existe.' }, 422)
  if (!period) return c.json({ message: 'Periodo requerido (YYYY-MM-DD).' }, 422)

  await c.env.DB
    .prepare(
      `INSERT INTO indicator_values (indicator_id, period, value, note) VALUES (?, ?, ?, ?)
       ON CONFLICT(indicator_id, period) DO UPDATE SET value = excluded.value, note = excluded.note`
    )
    .bind(ind.id, period, value ?? null, note || null)
    .run()
  return c.json({ message: 'Indicador publicado.', code, period, value }, 201)
})

// GET /api/administracion/audit — auditoria (ADMIN)
administracion.get('/audit', requirePermission('audit.view'), async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `SELECT a.action, a.created_at, u.name AS user
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC LIMIT 100`
    )
    .all<any>()
  return c.json({ data: results || [] })
})

// GET /api/administracion/moderation-log — historial de moderacion (MODERADOR+)
administracion.get('/moderation-log', requirePermission('moderation.queue.view'), async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `SELECT m.entity_table, m.action, m.reason, m.created_at, u.name AS moderator
       FROM moderation_log m LEFT JOIN users u ON u.id = m.moderator_id
       ORDER BY m.created_at DESC LIMIT 100`
    )
    .all<any>()
  return c.json({ data: results || [] })
})

export default administracion
