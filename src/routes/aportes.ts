import { Hono } from 'hono'
import { uuidv4 } from '../lib/auth'
import type { Bindings, Variables } from '../lib/types'
import { requireAuth, requirePermission } from '../lib/middleware'

const aportes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const CATEGORIES = ['sismo', 'via', 'hidrico']

// GET /api/aportes — PUBLICO: solo aportes validados (antes del auth middleware)
aportes.get('/', async (c) => {
  const { results } = await c.env.DB
    .prepare(
      `SELECT uuid, category, geom, attributes, photo_url, status, created_at
       FROM field_submissions WHERE status = 'validado' ORDER BY created_at DESC LIMIT 200`
    )
    .all<any>()
  const data = (results || []).map((f) => ({
    id: f.uuid,
    category: f.category,
    geometry: f.geom ? JSON.parse(f.geom) : null,
    attributes: f.attributes ? JSON.parse(f.attributes) : {},
    photo_url: f.photo_url,
    status: f.status,
    created_at: f.created_at,
  }))
  return c.json({ data })
})

// Todo lo demas requiere autenticacion
aportes.use('/*', requireAuth)

// POST /api/aportes — crea aporte en estado 'pendiente' (entra a moderacion)
aportes.post('/', requirePermission('field.create'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const { category, geometry, attributes, photo_url } = body

  if (!CATEGORIES.includes(category)) return c.json({ message: 'Categoria invalida (sismo|via|hidrico).' }, 422)
  if (!geometry || !geometry.type || !geometry.coordinates)
    return c.json({ message: 'Geometria GeoJSON requerida.' }, 422)

  const uuid = uuidv4()
  await c.env.DB
    .prepare(
      `INSERT INTO field_submissions (uuid, user_id, category, geom, attributes, photo_url, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`
    )
    .bind(uuid, user.uid, category, JSON.stringify(geometry), JSON.stringify(attributes || {}), photo_url || null)
    .run()

  return c.json(
    { id: uuid, category, geometry, attributes: attributes || {}, photo_url, status: 'pendiente' },
    201
  )
})

// GET /api/aportes/mine — mis aportes (cualquier estado)
aportes.get('/mine', async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB
    .prepare(
      `SELECT uuid, category, geom, attributes, photo_url, status, created_at, validated_at
       FROM field_submissions WHERE user_id = ? ORDER BY created_at DESC`
    )
    .bind(user.uid)
    .all<any>()
  const data = (results || []).map((f) => ({
    id: f.uuid,
    category: f.category,
    geometry: f.geom ? JSON.parse(f.geom) : null,
    attributes: f.attributes ? JSON.parse(f.attributes) : {},
    photo_url: f.photo_url,
    status: f.status,
    created_at: f.created_at,
    validated_at: f.validated_at,
  }))
  return c.json({ data })
})

// PATCH /api/aportes/:uuid — el dueño edita SOLO mientras siga 'pendiente'
// (moderador/admin con field.validate pueden editar siempre — Policy fina)
aportes.patch('/:uuid', requirePermission('field.create'), async (c) => {
  const user = c.get('user')
  const perms = c.get('permissions')
  const uuid = c.req.param('uuid')

  const row = await c.env.DB
    .prepare('SELECT id, user_id, status FROM field_submissions WHERE uuid = ?')
    .bind(uuid)
    .first<any>()
  if (!row) return c.json({ message: 'Aporte no encontrado.' }, 404)

  const canValidate = perms.includes('field.validate')
  const isOwnerEditable = row.user_id === user.uid && row.status === 'pendiente'
  if (!canValidate && !isOwnerEditable)
    return c.json({ message: 'No puedes editar este aporte (solo el dueño mientras este pendiente).' }, 403)

  const body = await c.req.json().catch(() => ({}))
  const { category, geometry, attributes, photo_url } = body
  if (category && !CATEGORIES.includes(category)) return c.json({ message: 'Categoria invalida.' }, 422)

  await c.env.DB
    .prepare(
      `UPDATE field_submissions SET
         category = COALESCE(?, category),
         geom = COALESCE(?, geom),
         attributes = COALESCE(?, attributes),
         photo_url = COALESCE(?, photo_url)
       WHERE id = ?`
    )
    .bind(
      category || null,
      geometry ? JSON.stringify(geometry) : null,
      attributes ? JSON.stringify(attributes) : null,
      photo_url || null,
      row.id
    )
    .run()

  return c.json({ message: 'Aporte actualizado.', id: uuid })
})

export default aportes
