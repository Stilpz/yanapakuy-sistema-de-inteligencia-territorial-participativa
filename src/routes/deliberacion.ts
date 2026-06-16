import { Hono } from 'hono'
import { uuidv4 } from '../lib/auth'
import type { Bindings, Variables } from '../lib/types'
import { requireAuth, requirePermission } from '../lib/middleware'

const deliberacion = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TYPES = ['propuesta', 'comentario', 'alerta']

deliberacion.use('/*', requireAuth)

// POST /api/contributions — propuesta/comentario/alerta en estado 'pendiente'
deliberacion.post('/', requirePermission('contributions.create'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { type, content, geometry } = body

  if (!TYPES.includes(type)) return c.json({ message: 'Tipo invalido (propuesta|comentario|alerta).' }, 422)
  if (!content || String(content).trim().length === 0) return c.json({ message: 'Contenido requerido.' }, 422)
  if (String(content).length > 4000) return c.json({ message: 'Contenido demasiado largo (max 4000).' }, 422)

  const uuid = uuidv4()
  await c.env.DB
    .prepare(
      `INSERT INTO contributions (uuid, user_id, type, content, geom, status)
       VALUES (?, ?, ?, ?, ?, 'pendiente')`
    )
    .bind(uuid, user.uid, type, content, geometry ? JSON.stringify(geometry) : null)
    .run()

  return c.json({ id: uuid, type, content, status: 'pendiente' }, 201)
})

// GET /api/contributions/mine
deliberacion.get('/mine', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB
    .prepare('SELECT uuid, type, content, status, created_at FROM contributions WHERE user_id = ? ORDER BY created_at DESC')
    .bind(user.uid)
    .all<any>()
  const data = (results || []).map((r) => ({
    id: r.uuid,
    type: r.type,
    content: r.content,
    status: r.status,
    created_at: r.created_at,
  }))
  return c.json({ data })
})

export default deliberacion
