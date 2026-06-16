import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './lib/types'
import authRoutes from './routes/auth'
import publicRoutes from './routes/public'
import meRoutes from './routes/me'
import submissionRoutes from './routes/submissions'
import contributionRoutes from './routes/contributions'
import moderationRoutes from './routes/moderation'
import adminRoutes from './routes/admin'
import { html } from './page'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('/api/*', cors())
app.use('/api/*', logger())

// ---------- API ----------
const api = new Hono<{ Bindings: Bindings; Variables: Variables }>()

api.get('/health', (c) => c.json({ status: 'ok', service: 'Yanapakuy (SITP Zarzal)', ts: new Date().toISOString() }))

api.route('/auth', authRoutes)
api.route('/me', meRoutes)
api.route('/field-submissions', submissionRoutes)
api.route('/contributions', contributionRoutes)
api.route('/moderation', moderationRoutes)
api.route('/admin', adminRoutes)
// rutas publicas (capas, indicadores, escenarios, percepcion) van al final para no chocar
api.route('/', publicRoutes)

app.route('/api', api)

// ---------- Frontend (SPA en un solo documento, servido en el edge) ----------
app.get('/', (c) => c.html(html))
app.get('/portal', (c) => c.html(html))
app.get('/app', (c) => c.html(html))

export default app
