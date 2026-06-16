import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings, Variables } from './lib/types'
import authRoutes from './routes/auth'
import consultaRoutes from './routes/consulta'
import perfilRoutes from './routes/perfil'
import aportesRoutes from './routes/aportes'
import deliberacionRoutes from './routes/deliberacion'
import moderacionRoutes from './routes/moderacion'
import administracionRoutes from './routes/administracion'
import { html } from './page'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('/api/*', cors())
app.use('/api/*', logger())

// ---------- API ----------
const api = new Hono<{ Bindings: Bindings; Variables: Variables }>()

api.get('/health', (c) => c.json({ status: 'ok', service: 'Yanapakuy (SITP Zarzal)', ts: new Date().toISOString() }))

api.route('/auth', authRoutes)            // autenticacion (registro / login / logout)
api.route('/perfil', perfilRoutes)        // perfil del usuario en sesion
api.route('/aportes', aportesRoutes)      // aportes de campo georreferenciados
api.route('/deliberacion', deliberacionRoutes) // comentarios y propuestas
api.route('/moderacion', moderacionRoutes)     // cola de validacion del moderador
api.route('/administracion', administracionRoutes) // gestion usuarios / roles / indicadores
// consulta publica (capas, indicadores, escenarios, percepcion) va al final para no chocar
api.route('/', consultaRoutes)

app.route('/api', api)

// ---------- Frontend (SPA en un solo documento, servido en el edge) ----------
app.get('/', (c) => c.html(html))
app.get('/portal', (c) => c.html(html))
app.get('/app', (c) => c.html(html))

export default app
