// =============================================================================
//  SITP Zarzal — Frontend SPA (vanilla JS modular)
//  Consulta abierta | Aporte autenticado | Percepcion anonima
// =============================================================================

const api = axios.create({ baseURL: '/api' })

const State = {
  user: null,        // { id, name, email, roles[], permissions[], actor }
  token: localStorage.getItem('sitp_token') || null,
  view: 'portal',    // portal | dashboard
  layers: [], indicators: [], scenarios: [], submissions: [],
}

if (State.token) api.defaults.headers.common['Authorization'] = 'Bearer ' + State.token

function setToken(t) {
  State.token = t
  if (t) { localStorage.setItem('sitp_token', t); api.defaults.headers.common['Authorization'] = 'Bearer ' + t }
  else { localStorage.removeItem('sitp_token'); delete api.defaults.headers.common['Authorization'] }
}

function can(perm) { return State.user && State.user.permissions && State.user.permissions.includes(perm) }
function hasRole(r) { return State.user && State.user.roles && State.user.roles.includes(r) }

// ---------- Toast ----------
function toast(msg, type = '') {
  const root = document.getElementById('toast-root')
  const el = document.createElement('div')
  el.className = 'toast ' + type
  el.textContent = msg
  root.appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300) }, 3800)
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) }

// ---------- Bootstrap ----------
async function boot() {
  if (State.token) {
    try { const { data } = await api.get('/perfil'); State.user = data } catch { setToken(null) }
  }
  render()
}

function render() {
  const app = document.getElementById('app')
  app.innerHTML = renderHeader() + (State.view === 'dashboard' ? renderDashboard() : renderPortal()) + renderFooter()
  bindHeader()
  if (State.view === 'portal') initPortal()
  else initDashboard()
}

// ===========================================================================
//  HEADER
// ===========================================================================
function renderHeader() {
  const userArea = State.user
    ? `<div class="nav-right">
         <span class="pill-mini">${esc(State.user.roles[0] || 'ACTOR')}</span>
         <button class="btn btn-ghost btn-sm" id="nav-dash"><i class="fas fa-table-columns"></i> Mi panel</button>
         <button class="btn btn-ghost btn-sm" id="nav-logout">Salir</button>
       </div>`
    : `<div class="nav-right">
         <button class="btn btn-ghost btn-sm" id="nav-login">Iniciar sesion</button>
         <button class="btn btn-gold btn-sm" id="nav-register">Crear perfil</button>
       </div>`
  return `
  <div class="register"><div class="wrap">
    <span><b>YANAPAKUY</b> · SITP ZARZAL</span>
    <span>LAT <b>4.39 N</b></span><span>LON <b>76.07 W</b></span>
    <span>ALT <b>916 m</b></span><span>AREA <b>367.9 km2</b></span>
    <span>POB <b>43.252</b> (DANE 2025)</span>
    <span><span class="dot"></span> FUENTE ROMERAL: <b>ACTIVA</b></span>
    <span>CRS <b>EPSG:4326</b></span>
  </div></div>
  <header class="nav"><div class="wrap">
    <div class="brand" id="brand">
      <div class="glyph">Y</div>
      <div>Yanapakuy<small>SISTEMA DE INTELIGENCIA TERRITORIAL PARTICIPATIVA</small></div>
    </div>
    <button class="menu-toggle" id="menu-toggle"><i class="fas fa-bars"></i></button>
    <nav class="links" id="nav-links">
      <a data-go="mapa">Geovisor</a>
      <a data-go="indicadores">Indicadores</a>
      <a data-go="escenarios">Escenarios</a>
      <a data-go="participar">Participar</a>
      <a data-go="rbac">Roles</a>
    </nav>
    ${userArea}
  </div></header>`
}

function bindHeader() {
  const go = (id) => { State.view = 'portal'; render(); setTimeout(() => { const el = document.getElementById('sec-' + id); if (el) el.scrollIntoView({ behavior: 'smooth' }) }, 60) }
  document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => go(a.getAttribute('data-go'))))
  const brand = document.getElementById('brand'); if (brand) brand.addEventListener('click', () => { State.view = 'portal'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }) })
  const mt = document.getElementById('menu-toggle'); if (mt) mt.addEventListener('click', () => document.getElementById('nav-links').classList.toggle('open'))
  const login = document.getElementById('nav-login'); if (login) login.addEventListener('click', () => openAuth('login'))
  const reg = document.getElementById('nav-register'); if (reg) reg.addEventListener('click', () => openAuth('register'))
  const dash = document.getElementById('nav-dash'); if (dash) dash.addEventListener('click', () => { State.view = 'dashboard'; render(); window.scrollTo(0, 0) })
  const logout = document.getElementById('nav-logout'); if (logout) logout.addEventListener('click', doLogout)
}

async function doLogout() {
  try { await api.post('/auth/logout') } catch {}
  setToken(null); State.user = null; State.view = 'portal'; render(); toast('Sesion cerrada.', 'ok')
}

function renderFooter() {
  return `<footer><div class="wrap">
    <div>
      <div class="serif" style="font-size:18px;color:var(--cal)">Yanapakuy</div>
      <p style="max-width:46ch;margin-top:8px">Sistema de Inteligencia Territorial Participativa de Zarzal, Valle del Cauca. Une la evidencia cientifica con el saber popular para gestionar el riesgo, el agua y el alimento. Programa de Apropiacion Social del Conocimiento — Universidad del Valle. Datos de prototipo: cifras y geometrias aproximadas, no oficiales.</p>
    </div>
    <div class="mono">
      FUENTES: IGAC · DANE · IDEAM · NASA · SGC · CVC<br>
      MARCO LEGAL: Ley 1581/2012 (habeas data)<br>
      MARCO CONCEPTUAL: Fals Borda · Luhmann · R. Garcia<br>
      "El PBOT no es un contrato, es un proceso."
    </div>
  </div></footer>`
}

window.addEventListener('DOMContentLoaded', boot)

// ===========================================================================
//  PORTAL PUBLICO
// ===========================================================================
function renderPortal() {
  return `
  <section class="hero" id="sec-top"><div class="wrap">
    <div class="eyebrow">Observatorio geoterritorial · Zarzal, Valle del Cauca</div>
    <h1>El territorio que se <em>piensa a si mismo</em>.</h1>
    <p class="lead"><b>Yanapakuy</b> une la evidencia cientifica (IGAC, DANE, IDEAM, NASA) con el saber popular de Zarzal para gestionar el <b>riesgo</b>, el <b>agua</b> y el <b>alimento</b>. Un sistema vivo, no un documento estatico.</p>
    <div class="consigna">"El PBOT no es un contrato, es un proceso."</div>
    <p class="hero-note">El SITP permite ajustes permanentes: cada aporte, cada dato satelital y cada decision retroalimentan el ciclo. Inspirado en <b>Fals Borda</b> (IAP), <b>Luhmann</b> (sistemas sociales) y <b>Garcia</b> (sistemas complejos).</p>
    <div class="hero-cta">
      <button class="btn btn-gold" data-go="mapa"><i class="fas fa-map-location-dot"></i> Explorar el geovisor</button>
      <button class="btn btn-ghost" data-go="participar"><i class="fas fa-comments"></i> Participar</button>
    </div>
  </div></section>

  <section id="sec-mapa"><div class="wrap">
    <div class="sec-head"><span class="sec-num">M01</span><h2>Geovisor de Zarzal</h2></div>
    <p class="sec-sub">Capas conmutables del territorio: limite municipal, red hidrica (Cauca + La Paila), traza Cauca-Romeral, cinturon cañero y aportes de campo validados por la comunidad.</p>
    <div class="map-shell">
      <div id="map"></div>
      <div class="map-side">
        <div class="layer-card">
          <h4>Capas</h4>
          <div id="layer-list"><div class="loading">Cargando capas…</div></div>
        </div>
        <div class="layer-card">
          <h4>Nota tecnica</h4>
          <div class="map-note">Geometrias APROXIMADAS, marcadas como simuladas. SRID 4326 (WGS84). Las operaciones metricas (buffers a Romeral, areas) requieren transformar a EPSG:9377 (MAGNA-SIRGAS/CTM12, oficial IGAC).</div>
        </div>
      </div>
    </div>
  </div></section>

  <section id="sec-indicadores"><div class="wrap">
    <div class="sec-head"><span class="sec-num">M02/03</span><h2>Indicadores territoriales</h2></div>
    <p class="sec-sub">Tablero de inteligencia y decision: poblacion, seguridad alimentaria (SAN), uso del suelo cañero, riesgo sismico y percepcion ciudadana. Donde no hay cifra verificada, se marca como vacio a capturar.</p>
    <div class="kpi-grid" id="kpi-grid"><div class="loading">Cargando indicadores…</div></div>
    <div class="chart-grid">
      <div class="chart-card">
        <h3>La paradoja del suelo</h3>
        <p class="cap">Evolucion del % de suelo agricola en monocultivo cañero (IGAC, aprox.).</p>
        <div class="chart-box"><canvas id="chart-cana"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Percepcion ciudadana</h3>
        <p class="cap">Promedios agregados (escala 1-5) de la encuesta de percepcion. Solo se muestran con n >= 5.</p>
        <div class="chart-box"><canvas id="chart-perc"></canvas></div>
      </div>
    </div>
  </div></section>

  <section id="sec-escenarios"><div class="wrap">
    <div class="sec-head"><span class="sec-num">M04</span><h2>Escenarios prospectivos CMIP6</h2></div>
    <p class="sec-sub">Tres futuros (Tendencial / Critico / Deseable) cruzados con horizontes 2038 / 2046 / 2056, usando escenarios IDEAM 2024 (SSP2-4.5 y SSP5-8.5) para el Valle del Cauca.</p>
    <div id="scenarios-block"><div class="loading">Cargando escenarios…</div></div>
  </div></section>

  <section id="sec-participar"><div class="wrap">
    <div class="sec-head"><span class="sec-num">P</span><h2>Participar</h2></div>
    <p class="sec-sub">Dos modos. La <b>encuesta de percepcion es anonima incluso con sesion iniciada</b> (el anonimato esta protegido por arquitectura). El <b>aporte de campo</b> requiere perfil y pasa por moderacion antes de publicarse.</p>
    <div class="grid-2">
      <div class="card">
        <h3><i class="fas fa-user-secret" style="color:var(--paila)"></i> Encuesta de percepcion <span class="chip">ANONIMA</span></h3>
        <p>Mide bienestar y malestar urbano: ruido, seguridad, calidad del aire, arraigo. No pedimos nombre ni cedula. Funciona sin iniciar sesion.</p>
        <button class="btn btn-gold" id="btn-perception" style="margin-top:16px"><i class="fas fa-clipboard-question"></i> Responder encuesta</button>
      </div>
      <div class="card">
        <h3><i class="fas fa-location-crosshairs" style="color:var(--cana)"></i> Aporte de campo <span class="chip">CON PERFIL</span></h3>
        <p>Registra variables fisicas georreferenciadas (riesgo sismico Romeral, estado de vias, inventario hidrico). Equivale a Survey123. Entra como <span class="chip pendiente">pendiente</span> y un moderador lo valida.</p>
        <button class="btn btn-campo" id="btn-field" style="margin-top:16px"><i class="fas fa-plus"></i> Crear aporte</button>
      </div>
    </div>
  </div></section>

  <section id="sec-rbac"><div class="wrap">
    <div class="sec-head"><span class="sec-num">RBAC</span><h2>Roles y permisos</h2></div>
    <p class="sec-sub">ADMIN y ACTOR como nucleo; MODERADOR, ANALISTA y GESTOR_INSTITUCIONAL como roles extensibles mapeados a los actores del MACTOR. La autorizacion se valida siempre en el servidor.</p>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Accion</th><th class="center">INVITADO</th><th class="center">ACTOR</th><th class="center">MODERADOR</th><th class="center">ANALISTA</th><th class="center">GESTOR</th><th class="center">ADMIN</th></tr></thead>
      <tbody>
        ${rbacRow('Ver mapas/indicadores/escenarios', [1,1,1,1,1,1])}
        ${rbacRow('Responder percepcion (anonima)', [1,1,1,1,1,1])}
        ${rbacRow('Crear aporte de campo', [0,1,1,0,1,1])}
        ${rbacRow('Comentar / proponer', [0,1,1,0,1,1])}
        ${rbacRow('Validar / rechazar aportes', [0,0,1,0,0,1])}
        ${rbacRow('Exportar / analitica', [0,0,1,1,1,1])}
        ${rbacRow('Publicar indicadores oficiales', [0,0,0,0,1,1])}
        ${rbacRow('Gestionar usuarios y roles', [0,0,0,0,0,1])}
      </tbody>
    </table></div>
  </div></section>`
}

function rbacRow(label, cells) {
  const c = cells.map((v) => `<td class="center">${v ? '<i class="fas fa-check" style="color:var(--campo)"></i>' : '<span class="muted">—</span>'}</td>`).join('')
  return `<tr><td>${label}</td>${c}</tr>`
}

// ---------- Portal: data + interactividad ----------
let mapInstance = null
let layerGroups = {}
let charts = {}

async function initPortal() {
  initMap()
  loadIndicators()
  loadScenarios()
  const bp = document.getElementById('btn-perception'); if (bp) bp.addEventListener('click', openPerception)
  const bf = document.getElementById('btn-field'); if (bf) bf.addEventListener('click', () => {
    if (!State.user) { openAuth('login', 'Inicia sesion para crear un aporte de campo.'); return }
    if (!can('field.create')) { toast('Tu rol no permite crear aportes.', 'err'); return }
    openFieldForm()
  })
}

function initMap() {
  const el = document.getElementById('map'); if (!el || typeof L === 'undefined') return
  if (mapInstance) { mapInstance.remove(); mapInstance = null; layerGroups = {} }
  mapInstance = L.map('map', { zoomControl: true }).setView([4.39, -76.05], 11)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19,
  }).addTo(mapInstance)
  loadLayers()
  loadSubmissionsLayer()
}

async function loadLayers() {
  try {
    const { data } = await api.get('/layers')
    State.layers = data.data
    const list = document.getElementById('layer-list'); if (!list) return
    list.innerHTML = ''
    data.data.forEach((layer) => {
      const grp = L.geoJSON(layer.geojson, {
        style: { color: layer.color, weight: layer.code === 'romeral' ? 3 : 2, fillColor: layer.color, fillOpacity: layer.code === 'limite' ? 0.04 : 0.18, dashArray: layer.code === 'romeral' ? '6 5' : null },
        pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 7, color: layer.color, fillColor: layer.color, fillOpacity: .7, weight: 2 }),
        onEachFeature: (f, lyr) => {
          const p = f.properties || {}
          let html = '<b>' + esc(layer.name) + '</b><br>' + esc(p.name || '')
          if (p.area_km2) html += '<br>Area: ' + p.area_km2 + ' km2'
          if (p.poblacion_aprox) html += '<br>Pob. aprox: ' + p.poblacion_aprox.toLocaleString('es')
          if (p.tipo) html += '<br>' + esc(p.tipo)
          lyr.bindPopup(html)
        },
      })
      grp.addTo(mapInstance)
      layerGroups[layer.code] = grp
      const row = document.createElement('label')
      row.className = 'lyr'
      row.innerHTML = `<input type="checkbox" checked> <span class="swatch" style="background:${layer.color}"></span><span class="lbl">${esc(layer.name)}</span><small>${esc(layer.source || '')}</small>`
      row.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) grp.addTo(mapInstance); else mapInstance.removeLayer(grp)
      })
      list.appendChild(row)
    })
    // capa de aportes (toggle)
    const row = document.createElement('label')
    row.className = 'lyr'
    row.innerHTML = `<input type="checkbox" checked> <span class="swatch" style="background:#fff"></span><span class="lbl">Aportes de campo</span><small>SITP (validados)</small>`
    row.querySelector('input').addEventListener('change', (e) => {
      if (!layerGroups._aportes) return
      if (e.target.checked) layerGroups._aportes.addTo(mapInstance); else mapInstance.removeLayer(layerGroups._aportes)
    })
    list.appendChild(row)
  } catch (e) { console.error(e) }
}

const CAT_COLOR = { sismo: '#CC5A41', via: '#D8A23C', hidrico: '#5AA6AE' }
const CAT_LABEL = { sismo: 'Riesgo sismico (Romeral)', via: 'Estado de via', hidrico: 'Inventario hidrico' }

async function loadSubmissionsLayer() {
  try {
    const { data } = await api.get('/aportes')
    State.submissions = data.data
    const grp = L.geoJSON({ type: 'FeatureCollection', features: data.data.map((s) => ({ type: 'Feature', geometry: s.geometry, properties: { ...s } })) }, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 6, color: CAT_COLOR[f.properties.category] || '#fff', fillColor: CAT_COLOR[f.properties.category] || '#fff', fillOpacity: .85, weight: 2 }),
      onEachFeature: (f, lyr) => {
        const p = f.properties
        const attrs = Object.entries(p.attributes || {}).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join('<br>')
        lyr.bindPopup(`<b>${esc(CAT_LABEL[p.category] || p.category)}</b><br>${attrs || '<i>sin atributos</i>'}<br><small style="color:var(--cal-faint)">validado · ${esc((p.created_at || '').slice(0, 10))}</small>`)
      },
    })
    if (mapInstance) grp.addTo(mapInstance)
    layerGroups._aportes = grp
  } catch (e) { console.error(e) }
}

async function loadIndicators() {
  try {
    const { data } = await api.get('/indicators')
    State.indicators = data.data
    const grid = document.getElementById('kpi-grid'); if (!grid) return
    grid.innerHTML = ''
    data.data.forEach((ind) => {
      const v = ind.latest ? ind.latest.value : null
      const valTxt = v == null ? '<span class="muted">s/d</span>' : Number(v).toLocaleString('es')
      const kpi = document.createElement('div')
      kpi.className = 'kpi'
      kpi.style.setProperty('--accent', ind.accent || 'var(--cana)')
      kpi.innerHTML = `<div class="lbl">${esc(ind.name)}</div>
        <div class="val">${valTxt} <u>${esc(ind.unit || '')}</u></div>
        <div class="note">${esc(ind.description || '')}</div>
        <div class="src">FUENTE: ${esc(ind.source || '—')}</div>`
      grid.appendChild(kpi)
    })
    drawCanaChart()
    drawPerceptionChart()
  } catch (e) { console.error(e) }
}

async function drawCanaChart() {
  try {
    const { data } = await api.get('/indicators/cana_uso/series')
    const ctx = document.getElementById('chart-cana'); if (!ctx) return
    if (charts.cana) charts.cana.destroy()
    charts.cana = new Chart(ctx, {
      type: 'line',
      data: { labels: data.data.map((d) => d.period.slice(0, 4)), datasets: [{ label: '% suelo en caña', data: data.data.map((d) => d.value), borderColor: '#D8A23C', backgroundColor: 'rgba(216,162,60,.15)', fill: true, tension: .3, pointBackgroundColor: '#D8A23C' }] },
      options: chartOpts('%'),
    })
  } catch (e) { console.error(e) }
}

async function drawPerceptionChart() {
  try {
    const { data } = await api.get('/perception/aggregate')
    const ctx = document.getElementById('chart-perc'); if (!ctx) return
    const avg = data.data.averages || {}
    const labels = Object.keys(avg)
    if (charts.perc) charts.perc.destroy()
    if (!data.data.suficiente || labels.length === 0) {
      ctx.parentElement.innerHTML = `<div class="empty"><i class="fas fa-chart-simple"></i><div>Aun no hay suficientes respuestas (n &lt; ${data.data.n_minimo}).<br>Responde la encuesta para alimentar este grafico.</div></div>`
      return
    }
    const labelMap = { ruido: 'Ruido', seguridad: 'Seguridad', aire: 'Calidad aire', arraigo: 'Arraigo', satisfaccion: 'Satisfaccion', agua: 'Calidad agua' }
    charts.perc = new Chart(ctx, {
      type: 'radar',
      data: { labels: labels.map((l) => labelMap[l] || l), datasets: [{ label: 'Promedio (1-5)', data: labels.map((l) => avg[l]), borderColor: '#5AA6AE', backgroundColor: 'rgba(90,166,174,.2)', pointBackgroundColor: '#5AA6AE' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 5, ticks: { color: '#69786C', backdropColor: 'transparent' }, grid: { color: '#2F4137' }, angleLines: { color: '#2F4137' }, pointLabels: { color: '#9CAC9E', font: { family: 'Public Sans' } } } }, plugins: { legend: { labels: { color: '#9CAC9E' } } } },
    })
  } catch (e) { console.error(e) }
}

function chartOpts(unit) {
  return { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#69786C' }, grid: { color: '#2F4137' }, title: { display: !!unit, text: unit, color: '#69786C' } }, x: { ticks: { color: '#9CAC9E' }, grid: { color: '#27362D' } } }, plugins: { legend: { labels: { color: '#9CAC9E' } } } }
}

// ---------- Escenarios interactivos ----------
let scState = { code: 'TEND', horizon: 2038 }

async function loadScenarios() {
  try {
    const { data } = await api.get('/scenarios')
    State.scenarios = data.data
    renderScenarios()
  } catch (e) { console.error(e) }
}

function renderScenarios() {
  const block = document.getElementById('scenarios-block'); if (!block) return
  if (!State.scenarios.length) { block.innerHTML = '<div class="empty">Sin escenarios.</div>'; return }
  const horizons = [2038, 2046, 2056]
  block.innerHTML = `
    <div class="sc-controls">
      <div class="seg"><label>Futuro</label><div class="pills" id="sc-future">
        <button class="pill" data-sc="TEND">Tendencial</button>
        <button class="pill crit" data-sc="CRIT">Critico</button>
        <button class="pill des" data-sc="DES">Deseable</button>
      </div></div>
      <div class="seg"><label>Horizonte</label><div class="pills" id="sc-horizon">
        ${horizons.map((h) => `<button class="pill" data-h="${h}">${h}</button>`).join('')}
      </div></div>
    </div>
    <div class="sc-body">
      <div class="sc-text" id="sc-text"></div>
      <div class="sc-chart"><div class="chart-box"><canvas id="chart-scenario"></canvas></div></div>
    </div>`
  block.querySelectorAll('[data-sc]').forEach((b) => b.addEventListener('click', () => { scState.code = b.getAttribute('data-sc'); updateScenario() }))
  block.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { scState.horizon = parseInt(b.getAttribute('data-h')); updateScenario() }))
  updateScenario()
}

function updateScenario() {
  document.querySelectorAll('#sc-future .pill').forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-sc') === scState.code))
  document.querySelectorAll('#sc-horizon .pill').forEach((b) => b.setAttribute('aria-pressed', parseInt(b.getAttribute('data-h')) === scState.horizon))
  const sc = State.scenarios.find((s) => s.code === scState.code); if (!sc) return
  const proj = sc.projections.find((p) => p.horizon === scState.horizon) || sc.projections[0]
  const tag = scState.code === 'CRIT' ? 'var(--romeral)' : scState.code === 'DES' ? 'var(--campo)' : 'var(--cana)'
  document.getElementById('sc-text').innerHTML = `
    <span class="tag" style="border-color:${tag};color:${tag}">${esc(sc.name).toUpperCase()} · ${esc(proj.ssp)}</span>
    <h3>${esc(sc.name)} — ${proj.horizon}</h3>
    <div class="delta">ΔT proyectada: +${proj.delta_temp[0]} a +${proj.delta_temp[1]} °C sobre referencia</div>
    <p>${esc(proj.narrative)}</p>`
  drawScenarioChart(sc)
}

function drawScenarioChart(sc) {
  const ctx = document.getElementById('chart-scenario'); if (!ctx) return
  if (charts.scenario) charts.scenario.destroy()
  const color = sc.code === 'CRIT' ? '#CC5A41' : sc.code === 'DES' ? '#7FB089' : '#D8A23C'
  charts.scenario = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sc.projections.map((p) => p.horizon),
      datasets: [
        { label: 'ΔT min (°C)', data: sc.projections.map((p) => p.delta_temp[0]), backgroundColor: color + '88', borderColor: color, borderWidth: 1 },
        { label: 'ΔT max (°C)', data: sc.projections.map((p) => p.delta_temp[1]), backgroundColor: color + 'cc', borderColor: color, borderWidth: 1 },
      ],
    },
    options: chartOpts('°C'),
  })
}

// ===========================================================================
//  MODAL helpers
// ===========================================================================
function openModal(innerHtml) {
  const root = document.getElementById('modal-root')
  root.innerHTML = `<div class="modal-overlay" id="ov"><div class="modal"><button class="close" id="mclose">&times;</button>${innerHtml}</div></div>`
  document.getElementById('mclose').addEventListener('click', closeModal)
  document.getElementById('ov').addEventListener('click', (e) => { if (e.target.id === 'ov') closeModal() })
}
function closeModal() { document.getElementById('modal-root').innerHTML = '' }

// ---------- AUTH modal ----------
function openAuth(mode, note) {
  const isLogin = mode === 'login'
  openModal(`
    <h3>${isLogin ? 'Iniciar sesion' : 'Crear perfil'}</h3>
    <div class="sub">${isLogin ? 'Accede para aportar a Yanapakuy.' : 'Tu rol inicial sera ACTOR. La consulta no requiere cuenta.'}</div>
    ${note ? `<div class="alert ok">${esc(note)}</div>` : ''}
    <div id="auth-err"></div>
    <form class="form-grid" id="auth-form">
      ${isLogin ? '' : `<div class="field"><label>Nombre <span class="req">*</span></label><input name="name" required></div>`}
      <div class="field"><label>Email <span class="req">*</span></label><input name="email" type="email" required></div>
      <div class="field"><label>Contraseña <span class="req">*</span></label><input name="password" type="password" minlength="8" required></div>
      ${isLogin ? '' : `
      <div class="field"><label>Contraseña (confirmar) <span class="req">*</span></label><input name="password_confirmation" type="password" minlength="8" required></div>
      <div class="field"><label>Tipo de actor (MACTOR)</label><select name="mactor">
        <option value="comunidad">Comunidad / sociedad civil</option>
        <option value="institucion">Institucion</option>
        <option value="gremio">Gremio</option>
        <option value="academia">Academia</option>
        <option value="otro">Otro</option>
      </select></div>
      <div class="field"><label>Organizacion</label><input name="organization" placeholder="JAC, CVC, Univalle…"></div>
      <div class="field"><label>Territorio (comuna/vereda)</label><input name="territory"></div>`}
      <button class="btn btn-gold" type="submit">${isLogin ? 'Entrar' : 'Crear cuenta'}</button>
    </form>
    <div class="switch">${isLogin ? '¿No tienes cuenta? <a id="to-reg">Crear perfil</a>' : '¿Ya tienes cuenta? <a id="to-login">Iniciar sesion</a>'}</div>`)
  const tr = document.getElementById('to-reg'); if (tr) tr.addEventListener('click', () => openAuth('register'))
  const tl = document.getElementById('to-login'); if (tl) tl.addEventListener('click', () => openAuth('login'))
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = Object.fromEntries(new FormData(e.target).entries())
    const errBox = document.getElementById('auth-err')
    try {
      const { data } = await api.post(isLogin ? '/auth/login' : '/auth/register', fd)
      setToken(data.token); State.user = data
      closeModal(); render(); toast(isLogin ? 'Bienvenido de nuevo.' : 'Perfil creado. Rol: ACTOR.', 'ok')
    } catch (err) {
      errBox.innerHTML = `<div class="alert error">${esc(err.response?.data?.message || 'Error de autenticacion.')}</div>`
    }
  })
}

// ---------- PERCEPCION (anonima) ----------
let percAnswers = {}
async function openPerception() {
  percAnswers = {}
  let consentText = 'Esta encuesta es anonima conforme a la Ley 1581 de 2012.'
  try { const { data } = await api.get('/consent'); if (data.data) consentText = data.data.body } catch {}
  const likert = (key, label, hint) => `
    <div class="field"><label>${label}${hint ? ` <small>(${hint})</small>` : ''}</label>
      <div class="likert" data-likert="${key}">${[1,2,3,4,5].map((n) => `<button type="button" data-v="${n}">${n}</button>`).join('')}</div>
    </div>`
  openModal(`
    <h3>Encuesta de percepcion <span class="chip">ANONIMA</span></h3>
    <div class="sub">Bienestar y malestar urbano en Zarzal. No se guarda tu identidad.</div>
    <div class="consent-box">${esc(consentText)}</div>
    <div id="perc-err" style="margin-top:10px"></div>
    <form class="form-grid" id="perc-form" style="margin-top:14px">
      <div class="field"><label>Comuna / barrio o corregimiento</label>
        <select name="comuna"><option value="">— Prefiero no decir —</option>
          <option>Cabecera urbana</option><option>La Paila</option><option>Vallejuelo</option>
          <option>Limones</option><option>Quebradanueva</option><option>Rural disperso</option></select></div>
      <div class="field"><label>Rango de edad</label>
        <select name="rango_edad"><option value="">—</option><option>18-25</option><option>26-40</option><option>41-60</option><option>60+</option></select></div>
      ${likert('satisfaccion', 'Satisfaccion con el barrio', '1 nada – 5 total')}
      ${likert('agua', 'Calidad del agua que recibe')}
      ${likert('ruido', 'Nivel de ruido', 'invertido: 1 bajo – 5 alto')}
      ${likert('aire', 'Calidad del aire (polvo, quemas de caña)')}
      ${likert('seguridad', 'Seguridad percibida')}
      ${likert('arraigo', 'Me siento parte de Zarzal')}
      <div class="field"><label>¿Que deberiamos cuidar o cambiar? <small>(opcional)</small></label>
        <textarea name="comentario" maxlength="500"></textarea></div>
      <label class="consent-check"><input type="checkbox" id="perc-consent"> He leido y acepto participar (consentimiento informado).</label>
      <button class="btn btn-gold" type="submit" id="perc-submit" disabled>Enviar respuesta anonima</button>
    </form>`)
  document.querySelectorAll('[data-likert]').forEach((grp) => {
    const key = grp.getAttribute('data-likert')
    grp.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      grp.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'))
      b.setAttribute('aria-pressed', 'true'); percAnswers[key] = parseInt(b.getAttribute('data-v'))
    }))
  })
  const chk = document.getElementById('perc-consent')
  chk.addEventListener('change', () => { document.getElementById('perc-submit').disabled = !chk.checked })
  document.getElementById('perc-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = Object.fromEntries(new FormData(e.target).entries())
    const answers = { ...percAnswers }
    if (fd.comentario) answers.comentario = fd.comentario
    try {
      await api.post('/perception', { consent: true, comuna: fd.comuna || null, rango_edad: fd.rango_edad || null, answers })
      closeModal(); toast('Respuesta registrada de forma anonima. Gracias.', 'ok')
      if (State.view === 'portal') drawPerceptionChart()
    } catch (err) {
      document.getElementById('perc-err').innerHTML = `<div class="alert error">${esc(err.response?.data?.message || 'Error al enviar.')}</div>`
    }
  })
}

// ---------- APORTE DE CAMPO (con perfil) ----------
function openFieldForm() {
  const fieldsByCat = {
    sismo: [
      ['grietas_estructura', 'Grietas en estructura', ['no', 'leve', 'moderada', 'severa']],
      ['tipo_construccion', 'Tipo de construccion', ['mamposteria confinada', 'mamposteria no confinada', 'concreto', 'bahareque', 'prefabricado']],
      ['anio_construccion', 'Año de construccion', ['<1984', '1984-2010', '>2010']],
      ['suelo_aparente', 'Suelo aparente', ['firme', 'blando', 'relleno', 'ribera']],
    ],
    via: [
      ['tipo_via', 'Tipo de via', ['primaria', 'secundaria', 'terciaria', 'urbana']],
      ['superficie', 'Superficie', ['pavimento', 'afirmado', 'destapado']],
      ['estado', 'Estado', ['bueno', 'regular', 'malo', 'intransitable']],
      ['conectividad_vereda', 'Conectividad', ['permanente', 'intermitente', 'aislada']],
    ],
    hidrico: [
      ['tipo_fuente', 'Tipo de fuente', ['rio', 'quebrada', 'acequia', 'pozo', 'aljibe', 'reservorio', 'acueducto']],
      ['nombre_fuente', 'Nombre', ['rio La Paila', 'rio Cauca', 'quebrada', 'otra']],
      ['caudal_percibido', 'Caudal percibido', ['alto', 'medio', 'bajo', 'seco']],
      ['estado_ronda', 'Estado de ronda', ['protegida', 'intervenida', 'deforestada']],
    ],
  }
  const renderCatFields = (cat) => fieldsByCat[cat].map(([name, label, opts]) =>
    `<div class="field"><label>${label}</label><select name="attr_${name}"><option value="">—</option>${opts.map((o) => `<option>${o}</option>`).join('')}</select></div>`).join('')
  openModal(`
    <h3>Crear aporte de campo</h3>
    <div class="sub">Equivale a Survey123. Entra como <span class="chip pendiente">pendiente</span> hasta moderacion.</div>
    <div id="field-err"></div>
    <form class="form-grid" id="field-form">
      <div class="field"><label>Categoria <span class="req">*</span></label>
        <select name="category" id="fld-cat" required>
          <option value="sismo">A · Riesgo sismico (Romeral)</option>
          <option value="via">B · Estado de via</option>
          <option value="hidrico">C · Inventario hidrico</option>
        </select></div>
      <div class="grid-2" style="gap:12px">
        <div class="field"><label>Latitud <span class="req">*</span></label><input name="lat" type="number" step="any" value="4.392" required></div>
        <div class="field"><label>Longitud <span class="req">*</span></label><input name="lng" type="number" step="any" value="-76.072" required></div>
      </div>
      <small class="muted" style="margin-top:-6px">Coordenadas en WGS84 (EPSG:4326). Por defecto: cabecera de Zarzal.</small>
      <div id="cat-fields">${renderCatFields('sismo')}</div>
      <div class="field"><label>Foto (URL, opcional)</label><input name="photo_url" type="url" placeholder="https://…"></div>
      <button class="btn btn-campo" type="submit"><i class="fas fa-paper-plane"></i> Enviar aporte</button>
    </form>`)
  document.getElementById('fld-cat').addEventListener('change', (e) => { document.getElementById('cat-fields').innerHTML = renderCatFields(e.target.value) })
  document.getElementById('field-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const category = fd.get('category')
    const attributes = {}
    for (const [k, v] of fd.entries()) if (k.startsWith('attr_') && v) attributes[k.slice(5)] = v
    const geometry = { type: 'Point', coordinates: [parseFloat(fd.get('lng')), parseFloat(fd.get('lat'))] }
    try {
      await api.post('/aportes', { category, geometry, attributes, photo_url: fd.get('photo_url') || null })
      closeModal(); toast('Aporte enviado. Quedo pendiente de moderacion.', 'ok')
      if (State.view === 'dashboard') initDashboard()
    } catch (err) {
      document.getElementById('field-err').innerHTML = `<div class="alert error">${esc(err.response?.data?.message || 'Error al enviar.')}</div>`
    }
  })
}

// ===========================================================================
//  DASHBOARD (app autenticada)
// ===========================================================================
let dashTab = 'mine'

function renderDashboard() {
  if (!State.user) return '<section><div class="wrap"><div class="empty">Inicia sesion para ver tu panel.</div></div></section>'
  const tabs = [['mine', 'Mis aportes', 'fa-location-dot']]
  tabs.push(['deliberar', 'Deliberar', 'fa-comments'])
  if (can('moderation.queue.view')) tabs.push(['moderacion', 'Moderacion', 'fa-gavel'])
  if (can('indicators.publish')) tabs.push(['publicar', 'Publicar indicadores', 'fa-chart-line'])
  if (can('users.manage')) tabs.push(['usuarios', 'Usuarios', 'fa-users-gear'])
  if (can('audit.view')) tabs.push(['auditoria', 'Auditoria', 'fa-clipboard-list'])
  if (!tabs.find((t) => t[0] === dashTab)) dashTab = 'mine'

  return `
  <section><div class="wrap">
    <div class="flex-between" style="margin-bottom:8px">
      <div class="sec-head" style="margin:0"><span class="sec-num">PANEL</span><h2>${esc(State.user.name)}</h2></div>
      <div><span class="pill-mini">${esc(State.user.roles[0])}</span> ${State.user.actor?.mactor ? `<span class="chip">${esc(State.user.actor.mactor)}</span>` : ''}</div>
    </div>
    <p class="sec-sub">Tu rol determina lo que puedes hacer. La autorizacion se valida en el servidor (RBAC).</p>
    <div class="dash-tabs">
      ${tabs.map((t) => `<button class="dash-tab ${dashTab === t[0] ? 'active' : ''}" data-tab="${t[0]}"><i class="fas ${t[2]}"></i> ${t[1]}</button>`).join('')}
    </div>
    <div id="dash-content"><div class="loading">Cargando…</div></div>
  </div></section>`
}

function initDashboard() {
  if (!State.user) return
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { dashTab = b.getAttribute('data-tab'); render() }))
  const content = document.getElementById('dash-content'); if (!content) return
  if (dashTab === 'mine') loadMine(content)
  else if (dashTab === 'deliberar') loadDeliberar(content)
  else if (dashTab === 'moderacion') loadModeration(content)
  else if (dashTab === 'publicar') loadPublish(content)
  else if (dashTab === 'usuarios') loadUsers(content)
  else if (dashTab === 'auditoria') loadAudit(content)
}

async function loadMine(content) {
  try {
    const { data } = await api.get('/aportes/mine')
    let html = `<div class="flex-between" style="margin-bottom:16px"><p class="muted">Tus aportes de campo y su estado de moderacion.</p>
      <button class="btn btn-campo btn-sm" id="dash-new-field"><i class="fas fa-plus"></i> Nuevo aporte</button></div>`
    if (!data.data.length) html += `<div class="empty"><i class="fas fa-location-dot"></i><div>Aun no has creado aportes.</div></div>`
    else html += data.data.map((s) => `
      <div class="queue-item">
        <div class="meta"><span>${esc(CAT_LABEL[s.category] || s.category)}</span><span>${esc((s.created_at || '').slice(0, 16))}</span><span class="chip ${s.status}">${s.status}</span></div>
        <div>${Object.entries(s.attributes || {}).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · ') || '<span class="muted">sin atributos</span>'}</div>
      </div>`).join('')
    content.innerHTML = html
    const nb = document.getElementById('dash-new-field'); if (nb) nb.addEventListener('click', openFieldForm)
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}

async function loadDeliberar(content) {
  try {
    const { data } = await api.get('/deliberacion/mine')
    let html = `<div class="card" style="margin-bottom:18px">
      <h3>Nueva contribucion</h3>
      <form class="form-grid" id="contrib-form" style="max-width:100%">
        <div class="field"><label>Tipo</label><select name="type"><option value="propuesta">Propuesta</option><option value="comentario">Comentario</option><option value="alerta">Alerta</option></select></div>
        <div class="field"><label>Contenido</label><textarea name="content" maxlength="4000" required placeholder="Tu propuesta, comentario o alerta para el territorio…"></textarea></div>
        <button class="btn btn-gold" type="submit">Enviar (entra a moderacion)</button>
      </form></div>
      <h3 class="serif" style="margin-bottom:12px">Mis contribuciones</h3>`
    if (!data.data.length) html += `<div class="empty"><i class="fas fa-comments"></i><div>Aun no has aportado a la deliberacion.</div></div>`
    else html += data.data.map((c) => `<div class="queue-item"><div class="meta"><span>${esc(c.type)}</span><span>${esc((c.created_at || '').slice(0, 16))}</span><span class="chip ${c.status}">${c.status}</span></div><div>${esc(c.content)}</div></div>`).join('')
    content.innerHTML = html
    document.getElementById('contrib-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = Object.fromEntries(new FormData(e.target).entries())
      try { await api.post('/deliberacion', fd); toast('Contribucion enviada (pendiente).', 'ok'); loadDeliberar(content) }
      catch (err) { toast(err.response?.data?.message || 'Error.', 'err') }
    })
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}

async function loadModeration(content) {
  try {
    const { data } = await api.get('/moderacion/queue')
    const fs = data.data.field_submissions, ct = data.data.contributions
    let html = `<p class="muted" style="margin-bottom:16px">Cola de moderacion: aportes y contribuciones pendientes. Validar publica; rechazar exige motivo (trazable).</p>`
    if (!fs.length && !ct.length) html += `<div class="empty"><i class="fas fa-circle-check"></i><div>No hay nada pendiente. Todo al dia.</div></div>`
    html += fs.map((s) => `
      <div class="queue-item">
        <div class="meta"><span class="chip">APORTE</span><span>${esc(CAT_LABEL[s.category] || s.category)}</span><span>por ${esc(s.author)}</span><span>${esc((s.created_at || '').slice(0, 16))}</span></div>
        <div>${Object.entries(s.attributes || {}).map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join(' · ') || '<span class="muted">sin atributos</span>'}</div>
        <div class="actions">
          <button class="btn btn-campo btn-sm" data-validate-fs="${s.id}"><i class="fas fa-check"></i> Validar</button>
          <button class="btn btn-danger btn-sm" data-reject-fs="${s.id}"><i class="fas fa-xmark"></i> Rechazar</button>
        </div>
      </div>`).join('')
    html += ct.map((c) => `
      <div class="queue-item">
        <div class="meta"><span class="chip">${esc(c.type).toUpperCase()}</span><span>por ${esc(c.author)}</span><span>${esc((c.created_at || '').slice(0, 16))}</span></div>
        <div>${esc(c.content)}</div>
        <div class="actions">
          <button class="btn btn-campo btn-sm" data-validate-ct="${c.id}"><i class="fas fa-check"></i> Validar</button>
          <button class="btn btn-danger btn-sm" data-reject-ct="${c.id}"><i class="fas fa-xmark"></i> Rechazar</button>
        </div>
      </div>`).join('')
    content.innerHTML = html
    const reload = () => loadModeration(content)
    content.querySelectorAll('[data-validate-fs]').forEach((b) => b.addEventListener('click', async () => { await api.patch(`/moderacion/aportes/${b.dataset.validateFs}/validate`); toast('Aporte validado y publicado.', 'ok'); reload() }))
    content.querySelectorAll('[data-reject-fs]').forEach((b) => b.addEventListener('click', async () => { const reason = prompt('Motivo del rechazo:'); if (!reason) return; await api.patch(`/moderacion/aportes/${b.dataset.rejectFs}/reject`, { reason }); toast('Aporte rechazado.', 'ok'); reload() }))
    content.querySelectorAll('[data-validate-ct]').forEach((b) => b.addEventListener('click', async () => { await api.patch(`/moderacion/deliberacion/${b.dataset.validateCt}/validate`); toast('Contribucion validada.', 'ok'); reload() }))
    content.querySelectorAll('[data-reject-ct]').forEach((b) => b.addEventListener('click', async () => { const reason = prompt('Motivo del rechazo:'); if (!reason) return; await api.patch(`/moderacion/deliberacion/${b.dataset.rejectCt}/reject`, { reason }); toast('Contribucion rechazada.', 'ok'); reload() }))
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}

async function loadPublish(content) {
  try {
    const { data } = await api.get('/indicators')
    content.innerHTML = `<div class="card"><h3>Publicar valor de indicador oficial</h3>
      <p class="muted" style="margin-bottom:14px">Solo GESTOR_INSTITUCIONAL / ADMIN. Equivale a POST /api/administracion/indicators.</p>
      <form class="form-grid" id="pub-form" style="max-width:100%">
        <div class="field"><label>Indicador</label><select name="code">${data.data.map((i) => `<option value="${i.code}">${esc(i.name)} (${esc(i.unit || '')})</option>`).join('')}</select></div>
        <div class="grid-2" style="gap:12px">
          <div class="field"><label>Periodo</label><input name="period" type="date" required></div>
          <div class="field"><label>Valor</label><input name="value" type="number" step="any"></div>
        </div>
        <div class="field"><label>Nota / fuente</label><input name="note"></div>
        <button class="btn btn-gold" type="submit">Publicar</button>
      </form></div>`
    document.getElementById('pub-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = Object.fromEntries(new FormData(e.target).entries())
      try { await api.post('/administracion/indicators', fd); toast('Indicador publicado.', 'ok') }
      catch (err) { toast(err.response?.data?.message || 'Error.', 'err') }
    })
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}

async function loadUsers(content) {
  try {
    const [usersRes, rolesRes] = await Promise.all([api.get('/administracion/users'), api.get('/administracion/roles')])
    const roles = rolesRes.data.data.map((r) => r.code)
    let html = `<p class="muted" style="margin-bottom:16px">Gestion de usuarios y roles (RBAC extensible en BD).</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Email</th><th>MACTOR</th><th>Rol</th><th>Estado</th></tr></thead><tbody>`
    html += usersRes.data.data.map((u) => `
      <tr>
        <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.mactor || '—')}</td>
        <td><select data-role-uuid="${u.uuid}">${roles.map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
        <td><select data-status-uuid="${u.uuid}">${['activo', 'pendiente', 'suspendido'].map((s) => `<option ${s === u.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      </tr>`).join('')
    html += '</tbody></table></div>'
    content.innerHTML = html
    content.querySelectorAll('[data-role-uuid]').forEach((sel) => sel.addEventListener('change', async () => {
      try { await api.patch(`/administracion/users/${sel.dataset.roleUuid}/role`, { role: sel.value }); toast('Rol actualizado.', 'ok') } catch (e) { toast('Error.', 'err') }
    }))
    content.querySelectorAll('[data-status-uuid]').forEach((sel) => sel.addEventListener('change', async () => {
      try { await api.patch(`/administracion/users/${sel.dataset.statusUuid}/status`, { status: sel.value }); toast('Estado actualizado.', 'ok') } catch (e) { toast('Error.', 'err') }
    }))
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}

async function loadAudit(content) {
  try {
    const [auditRes, modRes] = await Promise.all([api.get('/administracion/audit'), api.get('/administracion/moderation-log')])
    let html = `<h3 class="serif" style="margin-bottom:10px">Registro de moderacion</h3>`
    html += modRes.data.data.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Entidad</th><th>Accion</th><th>Motivo</th><th>Moderador</th><th>Fecha</th></tr></thead><tbody>` +
      modRes.data.data.map((m) => `<tr><td>${esc(m.entity_table)}</td><td><span class="chip ${m.action === 'validar' ? 'validado' : 'rechazado'}">${esc(m.action)}</span></td><td>${esc(m.reason || '—')}</td><td>${esc(m.moderator || '—')}</td><td>${esc((m.created_at || '').slice(0, 16))}</td></tr>`).join('') +
      '</tbody></table></div>' : '<div class="empty muted">Sin registros de moderacion.</div>'
    html += `<h3 class="serif" style="margin:24px 0 10px">Auditoria de acceso (habeas data)</h3>`
    html += auditRes.data.data.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Usuario</th><th>Accion</th><th>Fecha</th></tr></thead><tbody>` +
      auditRes.data.data.map((a) => `<tr><td>${esc(a.user || '—')}</td><td>${esc(a.action)}</td><td>${esc((a.created_at || '').slice(0, 16))}</td></tr>`).join('') +
      '</tbody></table></div>' : '<div class="empty muted">Sin registros.</div>'
    content.innerHTML = html
  } catch (e) { content.innerHTML = '<div class="empty">Error al cargar.</div>' }
}
