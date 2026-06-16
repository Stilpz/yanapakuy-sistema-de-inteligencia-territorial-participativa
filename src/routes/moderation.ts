import { Hono } from 'hono'
import type { Bindings, Variables } from '../lib/types'
import { requireAuth, requirePermission } from '../lib/middleware'

const mod = new Hono<{ Bindings: Bindings; Variables: Variables }>()

mod.use('/*', requireAuth)

// GET /api/moderation/queue — cola de aportes + contribuciones pendientes
mod.get('/queue', requirePermission('moderation.queue.view'), async (c) => {
  const { results: submissions } = await c.env.DB
    .prepare(
      `SELECT fs.uuid, fs.category, fs.geom, fs.attributes, fs.photo_url, fs.created_at, u.name AS author
       FROM field_submissions fs JOIN users u ON u.id = fs.user_id
       WHERE fs.status = 'pendiente' ORDER BY fs.created_at`
    )
    .all<any>()

  const { results: contributions } = await c.env.DB
    .prepare(
      `SELECT ct.uuid, ct.type, ct.content, ct.created_at, u.name AS author
       FROM contributions ct JOIN users u ON u.id = ct.user_id
       WHERE ct.status = 'pendiente' ORDER BY ct.created_at`
    )
    .all<any>()

  return c.json({
    data: {
      field_submissions: (submissions || []).map((f) => ({
        id: f.uuid,
        category: f.category,
        geometry: f.geom ? JSON.parse(f.geom) : null,
        attributes: f.attributes ? JSON.parse(f.attributes) : {},
        photo_url: f.photo_url,
        author: f.author,
        created_at: f.created_at,
      })),
      contributions: (contributions || []).map((ct) => ({
        id: ct.uuid,
        type: ct.type,
        content: ct.content,
        author: ct.author,
        created_at: ct.created_at,
      })),
    },
  })
})

// PATCH /api/moderation/field-submissions/:uuid/validate
mod.patch('/field-submissions/:uuid/validate', requirePermission('field.validate'), async (c) => {
  const user = c.get('user')
  const uuid = c.req.param('uuid')
  const row = await c.env.DB.prepare('SELECT id FROM field_submissions WHERE uuid = ?').bind(uuid).first<any>()
  if (!row) return c.json({ message: 'Aporte no encontrado.' }, 404)

  await c.env.DB
    .prepare("UPDATE field_submissions SET status = 'validado', validated_by = ?, validated_at = datetime('now') WHERE id = ?")
    .bind(user.uid, row.id)
    .run()
  await c.env.DB
    .prepare("INSERT INTO moderation_log (entity_table, entity_id, moderator_id, action) VALUES ('field_submissions', ?, ?, 'validar')")
    .bind(row.id, user.uid)
    .run()

  return c.json({ message: 'Aporte validado y publicado.', id: uuid, status: 'validado' })
})

// PATCH /api/field-submissions/:uuid/reject
mod.patch('/field-submissions/:uuid/reject', requirePermission('field.validate'), async (c) => {
  const user = c.get('user')
  const uuid = c.req.param('uuid')
  const { reason } = await c.req.json().catch(() => ({}))
  if (!reason || String(reason).trim().length === 0) return c.json({ message: 'El motivo es obligatorio.' }, 422)

  const row = await c.env.DB.prepare('SELECT id FROM field_submissions WHERE uuid = ?').bind(uuid).first<any>()
  if (!row) return c.json({ message: 'Aporte no encontrado.' }, 404)

  await c.env.DB.prepare("UPDATE field_submissions SET status = 'rechazado' WHERE id = ?").bind(row.id).run()
  await c.env.DB
    .prepare("INSERT INTO moderation_log (entity_table, entity_id, moderator_id, action, reason) VALUES ('field_submissions', ?, ?, 'rechazar', ?)")
    .bind(row.id, user.uid, reason)
    .run()

  return c.json({ message: 'Aporte rechazado.', id: uuid, status: 'rechazado' })
})

// PATCH /api/contributions/:uuid/validate
mod.patch('/contributions/:uuid/validate', requirePermission('field.validate'), async (c) => {
  const user = c.get('user')
  const uuid = c.req.param('uuid')
  const row = await c.env.DB.prepare('SELECT id FROM contributions WHERE uuid = ?').bind(uuid).first<any>()
  if (!row) return c.json({ message: 'Contribucion no encontrada.' }, 404)
  await c.env.DB.prepare("UPDATE contributions SET status = 'validado' WHERE id = ?").bind(row.id).run()
  await c.env.DB
    .prepare("INSERT INTO moderation_log (entity_table, entity_id, moderator_id, action) VALUES ('contributions', ?, ?, 'validar')")
    .bind(row.id, user.uid)
    .run()
  return c.json({ message: 'Contribucion validada.', id: uuid, status: 'validado' })
})

// PATCH /api/contributions/:uuid/reject
mod.patch('/contributions/:uuid/reject', requirePermission('field.validate'), async (c) => {
  const user = c.get('user')
  const uuid = c.req.param('uuid')
  const { reason } = await c.req.json().catch(() => ({}))
  const row = await c.env.DB.prepare('SELECT id FROM contributions WHERE uuid = ?').bind(uuid).first<any>()
  if (!row) return c.json({ message: 'Contribucion no encontrada.' }, 404)
  await c.env.DB.prepare("UPDATE contributions SET status = 'rechazado' WHERE id = ?").bind(row.id).run()
  await c.env.DB
    .prepare("INSERT INTO moderation_log (entity_table, entity_id, moderator_id, action, reason) VALUES ('contributions', ?, ?, 'rechazar', ?)")
    .bind(row.id, user.uid, reason || null)
    .run()
  return c.json({ message: 'Contribucion rechazada.', id: uuid, status: 'rechazado' })
})

export default mod
