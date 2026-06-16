# Yanapakuy — Sistema de Inteligencia Territorial Participativa (SITP)

## Resumen del proyecto
- **Nombre**: **Yanapakuy** · Sistema de Inteligencia Territorial Participativa de Zarzal, Valle del Cauca (Universidad del Valle — Apropiación Social del Conocimiento)
- **Idea fuerza**: *El territorio que se piensa a sí mismo.* Yanapakuy une la evidencia científica (IGAC, DANE, IDEAM, NASA) con el saber popular de Zarzal para gestionar el **riesgo**, el **agua** y el **alimento**. Un sistema vivo, no un documento estático.
- **Objetivo**: Convertir la metodología del SITP en un **aplicativo web en línea, permanente y bidireccional**: cualquier persona del planeta **consulta** el estado del territorio de Zarzal (mapas, indicadores, escenarios) y los actores registrados **aportan** datos, evidencia y deliberación. El SITP permite ajustes permanentes: cada aporte, cada dato satelital y cada decisión retroalimentan el ciclo.
- **Marco conceptual**: Fals Borda (IAP), Luhmann (sistemas sociales), R. García (sistemas complejos).
- **Consigna**: *"El PBOT no es un contrato, es un proceso."*

## Adaptación arquitectónica (importante)
La propuesta original recomienda **Laravel + PostgreSQL/PostGIS + Vue/Nuxt**. Este aplicativo despliega en **Cloudflare Pages (edge serverless)**, que no permite PHP/PostgreSQL. Se **tradujo fielmente** esa arquitectura preservando **todas las decisiones de diseño validadas**:

| Propuesta original | Implementación edge | Decisión preservada |
|---|---|---|
| Laravel API REST | **Hono** (rutas `/api/*` idénticas) | ✅ Misma superficie de endpoints |
| Sanctum (tokens) | **JWT HS256** (Web Crypto) | ✅ Auth por Bearer token |
| `spatie/laravel-permission` | **RBAC en tablas D1** | ✅ Roles/permisos en BD, extensibles |
| PostgreSQL/PostGIS | **Cloudflare D1 (SQLite)** + GeoJSON en TEXT | ✅ Persistencia real; geometría GeoJSON |
| Policies | Lógica de autorización en servidor | ✅ Dueño edita solo si `pendiente` |
| Anonimato estructural | Tabla `perception_responses` **sin user_id** | ✅ Invariante forzado por estructura |
| Moderación | Aporte nace `pendiente` → validación | ✅ Flujo intacto |

> **Nota técnica:** D1/SQLite no tiene PostGIS. Las operaciones métricas (buffers a Romeral, áreas) que en PostGIS usan `ST_Transform` a EPSG:9377 quedan documentadas como trabajo de un microservicio geoespacial futuro (equivalente al "Go opcional" de la Fase 3 de la propuesta).

## URLs
- **Local (sandbox)**: https://3000-iansb6gubs54m5rqim487-ad490db5.sandbox.novita.ai
- **API health**: `/api/health`
- **Producción**: pendiente de despliegue a Cloudflare Pages

## Funcionalidades completadas
- **Portal público (sin login)**: geovisor Leaflet (mapa oscuro) con capas conmutables (límite municipal, red hídrica Cauca + La Paila, traza Cauca-Romeral, cinturón cañero, cabecera, aportes validados); tablero de indicadores con KPIs animados y 2 gráficos (paradoja del suelo cañero; percepción ciudadana radar); escenarios prospectivos CMIP6 interactivos (Tendencial/Crítico/Deseable × 2038/2046/2056, SSP2-4.5/SSP5-8.5).
- **Encuesta de percepción anónima** (funciona con o sin sesión; consentimiento Ley 1581/2012; promedios agregados con n≥5).
- **Auth + RBAC**: registro (rol ACTOR por defecto + perfil MACTOR), login, JWT. Roles: INVITADO, ACTOR, MODERADOR, ANALISTA, GESTOR_INSTITUCIONAL, ADMIN.
- **Aporte de campo (Survey123-like)**: categorías sismo/vía/hídrico con dominios cerrados; entra `pendiente`.
- **Deliberación**: propuesta/comentario/alerta moderada.
- **Panel autenticado**: Mis aportes, Deliberar, Moderación (validar/rechazar con motivo), Publicar indicadores (GESTOR/ADMIN), Usuarios y roles (ADMIN), Auditoría/log de moderación.

## URIs funcionales (API)
> **Convención:** rutas en español alineadas al vocabulario del dominio para reducir carga cognitiva.
> `consulta` (público) · `auth` · `perfil` · `aportes` · `deliberacion` · `moderacion` · `administracion`.

**Público (sin login):** `GET /api/layers` · `GET /api/indicators` · `GET /api/indicators/:code/series` · `GET /api/scenarios` · `GET /api/aportes` (validados) · `GET /api/consent` · `POST /api/perception` (anónima) · `GET /api/perception/aggregate` · `POST /api/auth/register|login`

**Autenticado (Bearer):** `GET /api/perfil` · `POST /api/aportes` (`field.create`) · `GET /api/aportes/mine` · `PATCH /api/aportes/:uuid` · `POST/GET /api/deliberacion` · `GET /api/moderacion/queue` · `PATCH /api/moderacion/aportes/:uuid/validate|reject` · `PATCH /api/moderacion/deliberacion/:uuid/validate|reject` · `POST /api/administracion/indicators` · `GET/PATCH /api/administracion/users` · `GET /api/administracion/roles|audit|moderation-log`

### Mapa de renombrado (antes → ahora)
| Antes (EN) | Ahora (ES) | Concepto |
|---|---|---|
| `/field-submissions` | `/aportes` | Aportes de campo georreferenciados |
| `/contributions` | `/deliberacion` | Comentarios y propuestas |
| `/moderation` | `/moderacion` | Cola de validación del moderador |
| `/admin` | `/administracion` | Gestión usuarios / roles / indicadores |
| `/me` | `/perfil` | Perfil del usuario en sesión |
| `public.ts` | `consulta.ts` | Acceso público sin login |

## Arquitectura de datos
- **Modelos**: roles, permissions, role_permissions, users, actor_profiles, consents, field_submissions, perception_responses, map_layers, indicators, indicator_values, scenarios, scenario_projections, contributions, moderation_log, audit_log.
- **Almacenamiento**: Cloudflare D1 (SQLite). GeoJSON SRID 4326 en columnas TEXT.
- **Flujo de datos**: consulta directa de tablas públicas; aporte → `pendiente` → moderación → `validado` (visible) / `rechazado` (con motivo).

## Guía de uso
1. **Consultar**: abre el sitio, navega geovisor / indicadores / escenarios sin cuenta.
2. **Responder percepción**: botón "Responder encuesta" — anónimo, requiere marcar consentimiento.
3. **Aportar**: "Crear perfil" → login → "Crear aporte" o pestaña Deliberar.
4. **Moderar/Administrar**: el primer ADMIN se crea con `POST /api/auth/bootstrap` (token secreto `ADMIN_BOOTSTRAP_TOKEN`). Email institucional sugerido: **admin@yanapakuy-zarzal.co**. Después: login → panel con pestañas según rol. Ver guía: [`docs/CREACION_USUARIOS.md`](docs/CREACION_USUARIOS.md).

## Desarrollo
```bash
npm run build                    # compilar
npm run db:migrate:local         # migraciones D1 local
npm run db:seed                  # datos base + admin
pm2 start ecosystem.config.cjs   # servir en :3000
```

## Despliegue
- **Plataforma**: Cloudflare Pages + D1
- **Estado**: ✅ Activo en sandbox · ⏳ Pendiente producción
- **Stack**: Hono + TypeScript + D1 + Leaflet + Chart.js + Vanilla JS (SPA) + Tailwindless CSS propio
- **Última actualización**: 2026-06-16

## Próximos pasos recomendados
1. Desplegar a Cloudflare Pages (crear D1 de producción, aplicar migraciones, `wrangler pages deploy`).
2. Cargar geometrías oficiales reales (IGAC/SGC/CVC) en lugar de las aproximadas.
3. Microservicio geoespacial (Go/Workers) para operaciones métricas EPSG:9377 (buffers Romeral, áreas).
4. ETL con Survey123 (importar el XLSForm `SITP_Zarzal_Survey123.xlsx`), i18n, PWA offline.
