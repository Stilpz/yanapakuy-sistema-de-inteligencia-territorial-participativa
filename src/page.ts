// HTML shell del aplicativo SITP Zarzal. El CSS y JS viven en /static.
export const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SITP Zarzal — Inteligencia Territorial Participativa</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23D8A23C'/%3E%3Ctext x='16' y='22' font-family='monospace' font-size='15' font-weight='bold' text-anchor='middle' fill='%23241803'%3ESZ%3C/text%3E%3C/svg%3E">
<meta name="description" content="Sistema de Inteligencia Territorial Participativa del municipio de Zarzal, Valle del Cauca. Geovisor, indicadores, escenarios climaticos CMIP6 y participacion ciudadana. El POT no es un contrato, es un proceso.">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Spectral:wght@300;400;500;600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.1/css/all.min.css" rel="stylesheet">
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<div id="app"></div>
<div id="modal-root"></div>
<div id="toast-root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/axios@1.6.7/dist/axios.min.js"></script>
<script src="/static/app.js" type="module"></script>
</body>
</html>`
