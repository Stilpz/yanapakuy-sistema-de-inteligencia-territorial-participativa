import { Hono } from 'hono'
import type { Bindings, Variables } from '../lib/types'

const pub = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// GET /api/layers — capas publicas del geovisor (GeoJSON)
pub.get('/layers', async (c) => {
  const { results } = await c.env.DB
    .prepare('SELECT code, name, source, color, z_index, geojson FROM map_layers WHERE is_public = 1 ORDER BY z_index')
    .all<any>()
  const data = (results || []).map((l) => ({
    code: l.code,
    name: l.name,
    source: l.source,
    color: l.color,
    z_index: l.z_index,
    geojson: l.geojson ? JSON.parse(l.geojson) : null,
  }))
  return c.json({ data })
})

// GET /api/indicators — indicadores + ultimo valor
pub.get('/indicators', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM indicators ORDER BY id').all<any>()
  const data = []
  for (const ind of results || []) {
    const latest = await c.env.DB
      .prepare('SELECT period, value, note FROM indicator_values WHERE indicator_id = ? ORDER BY period DESC LIMIT 1')
      .bind(ind.id)
      .first<any>()
    data.push({
      code: ind.code,
      name: ind.name,
      unit: ind.unit,
      source: ind.source,
      accent: ind.accent,
      description: ind.description,
      latest,
    })
  }
  return c.json({ data })
})

// GET /api/indicators/:code/series — serie temporal
pub.get('/indicators/:code/series', async (c) => {
  const code = c.req.param('code')
  const ind = await c.env.DB.prepare('SELECT id, name, unit FROM indicators WHERE code = ?').bind(code).first<any>()
  if (!ind) return c.json({ message: 'Indicador no encontrado.' }, 404)
  const { results } = await c.env.DB
    .prepare('SELECT period, value, note FROM indicator_values WHERE indicator_id = ? ORDER BY period')
    .bind(ind.id)
    .all<any>()
  return c.json({ indicator: { code, name: ind.name, unit: ind.unit }, data: results || [] })
})

// GET /api/scenarios — escenarios + proyecciones
pub.get('/scenarios', async (c) => {
  const { results: scenarios } = await c.env.DB.prepare('SELECT * FROM scenarios ORDER BY id').all<any>()
  const data = []
  for (const s of scenarios || []) {
    const { results: projections } = await c.env.DB
      .prepare('SELECT horizon_year, ssp, delta_temp_min, delta_temp_max, narrative FROM scenario_projections WHERE scenario_id = ? ORDER BY horizon_year')
      .bind(s.id)
      .all<any>()
    data.push({
      code: s.code,
      name: s.name,
      ssp: s.default_ssp,
      description: s.description,
      projections: (projections || []).map((p) => ({
        horizon: p.horizon_year,
        ssp: p.ssp,
        delta_temp: [p.delta_temp_min, p.delta_temp_max],
        narrative: p.narrative,
      })),
    })
  }
  return c.json({ data })
})

// GET /api/consent — texto de consentimiento vigente
pub.get('/consent', async (c) => {
  const consent = await c.env.DB
    .prepare('SELECT version, body FROM consents ORDER BY published_at DESC LIMIT 1')
    .first<any>()
  return c.json({ data: consent || null })
})

// POST /api/perception — encuesta ANONIMA POR DISEÑO.
// Aunque la peticion traiga token, NUNCA se toca la identidad del usuario.
pub.post('/perception', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const { consent, comuna, rango_edad, answers } = body

  if (consent !== true && consent !== 'true' && consent !== 1)
    return c.json({ message: 'El consentimiento informado es obligatorio.' }, 422)
  if (!answers || typeof answers !== 'object')
    return c.json({ message: 'Faltan respuestas.' }, 422)

  // Validacion de escalas Likert 1-5
  for (const k of Object.keys(answers)) {
    const v = answers[k]
    if (v !== null && v !== undefined && v !== '') {
      const n = Number(v)
      if (Number.isInteger(n) && (n < 1 || n > 5)) {
        // permitir texto abierto en campos no numericos
        if (k !== 'comentario') return c.json({ message: `Valor fuera de rango en ${k}.` }, 422)
      }
    }
  }

  const consentRow = await c.env.DB
    .prepare('SELECT version FROM consents ORDER BY published_at DESC LIMIT 1')
    .first<{ version: string }>()
  const version = consentRow?.version || 'v1-2026'

  // INVARIANTE: no se persiste user_id. La tabla no tiene la columna.
  await c.env.DB
    .prepare('INSERT INTO perception_responses (comuna, rango_edad, answers, consent_version) VALUES (?, ?, ?, ?)')
    .bind(comuna || null, rango_edad || null, JSON.stringify(answers), version)
    .run()

  return c.json({ message: 'Respuesta registrada de forma anonima.' }, 201)
})

// GET /api/perception/aggregate — resultados agregados (n minimo para evitar reidentificacion)
pub.get('/perception/aggregate', async (c) => {
  const total = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM perception_responses').first<{ n: number }>()
  const n = total?.n || 0

  const { results } = await c.env.DB.prepare('SELECT answers FROM perception_responses').all<{ answers: string }>()
  const acc: Record<string, { sum: number; count: number }> = {}
  for (const row of results || []) {
    try {
      const a = JSON.parse(row.answers)
      for (const k of Object.keys(a)) {
        const v = Number(a[k])
        if (Number.isFinite(v) && v >= 1 && v <= 5) {
          acc[k] = acc[k] || { sum: 0, count: 0 }
          acc[k].sum += v
          acc[k].count += 1
        }
      }
    } catch {}
  }
  const averages: Record<string, number> = {}
  for (const k of Object.keys(acc)) averages[k] = Math.round((acc[k].sum / acc[k].count) * 100) / 100

  // n minimo de 5 para publicar promedios
  return c.json({ data: { total: n, averages: n >= 5 ? averages : {}, n_minimo: 5, suficiente: n >= 5 } })
})

export default pub
