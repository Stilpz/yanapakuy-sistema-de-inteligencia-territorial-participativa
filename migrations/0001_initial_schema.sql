-- =============================================================================
--  SITP ZARZAL — Esquema D1 (Cloudflare SQLite)
--  Sistema de Inteligencia Territorial Participativa · Universidad del Valle
--
--  Traduccion del esquema PostgreSQL/PostGIS original al runtime edge.
--  Decisiones de diseño PRESERVADAS del esquema PostGIS:
--   1. Geometrias se almacenan como GeoJSON en columnas TEXT (SRID 4326 / WGS84).
--      [Nota: D1/SQLite no tiene PostGIS; las operaciones metricas (buffers a
--       Romeral, areas) que en PostGIS usan ST_Transform a EPSG:9377 quedan
--       documentadas como trabajo de un microservicio geoespacial futuro.]
--   2. La encuesta de percepcion NO tiene vinculo de identidad: la tabla
--      perception_responses carece de columna user_id POR DISEÑO. El anonimato
--      es estructural, no una promesa de la aplicacion.
--   3. Todo aporte de la comunidad nace en estado 'pendiente' y solo se
--      publica tras validacion (moderacion).
--   4. RBAC en datos (roles/permissions en tablas), no en codigo.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  RBAC: roles, permisos y su pivote
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,          -- ADMIN, ACTOR, MODERADOR, ...
  name        TEXT NOT NULL,
  description TEXT,
  is_system   INTEGER NOT NULL DEFAULT 0     -- roles base no eliminables (1=true)
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,          -- 'field.create', 'users.manage', ...
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- -----------------------------------------------------------------------------
--  Usuarios y perfiles de actor (solo quienes aportan)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid              TEXT NOT NULL UNIQUE,          -- expuesto en API
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT NOT NULL,                 -- PBKDF2 (Web Crypto)
  role_id           INTEGER NOT NULL REFERENCES roles(id),
  status            TEXT NOT NULL DEFAULT 'activo', -- pendiente|activo|suspendido
  email_verified_at TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

CREATE TABLE IF NOT EXISTS actor_profiles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mactor       TEXT NOT NULL DEFAULT 'comunidad', -- institucion|gremio|comunidad|academia|otro
  organization TEXT,
  territory    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
--  Consentimiento informado (catalogo de versiones, desacoplado de identidad)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  version      TEXT NOT NULL UNIQUE,    -- 'v1-2026'
  body         TEXT NOT NULL,
  hash         TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
--  MÓDULO 1 — Captura
-- -----------------------------------------------------------------------------

-- Aportes de campo (tipo Survey123) — georreferenciados y moderados
CREATE TABLE IF NOT EXISTS field_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid         TEXT NOT NULL UNIQUE,
  user_id      INTEGER NOT NULL REFERENCES users(id),   -- aporte SIEMPRE con identidad
  category     TEXT NOT NULL,                            -- sismo|via|hidrico
  geom         TEXT NOT NULL,                            -- GeoJSON (SRID 4326)
  attributes   TEXT NOT NULL DEFAULT '{}',               -- JSON con dominios del XLSForm
  photo_url    TEXT,
  status       TEXT NOT NULL DEFAULT 'pendiente',        -- pendiente|validado|rechazado
  validated_by INTEGER REFERENCES users(id),
  validated_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fs_status ON field_submissions(status);
CREATE INDEX IF NOT EXISTS idx_fs_cat    ON field_submissions(category);

-- Encuesta de percepcion — ANONIMA POR DISEÑO (no existe columna user_id)
-- PROHIBIDO agregar user_id o cualquier FK a users.
-- Publicar solo agregados con n minimo por comuna para evitar reidentificacion.
CREATE TABLE IF NOT EXISTS perception_responses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  comuna          TEXT,                 -- zona, nunca direccion exacta
  rango_edad      TEXT,
  answers         TEXT NOT NULL,        -- JSON: ruido, seguridad, arraigo, etc.
  consent_version TEXT NOT NULL REFERENCES consents(version),
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
--  MÓDULO 2/3 — Inteligencia y decision (capas, indicadores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS map_layers (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  code      TEXT NOT NULL UNIQUE,       -- limite, hidrico, romeral, cana, aportes
  name      TEXT NOT NULL,
  source    TEXT,                       -- IGAC, CVC, SGC, NASA, SITP
  geojson   TEXT,                       -- GeoJSON FeatureCollection
  color     TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  z_index   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS indicators (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  unit        TEXT,
  source      TEXT,
  accent      TEXT,                      -- color de acento UI
  description TEXT
);

CREATE TABLE IF NOT EXISTS indicator_values (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  indicator_id INTEGER NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period       TEXT NOT NULL,            -- YYYY-MM-DD
  value        REAL,
  note         TEXT,
  UNIQUE (indicator_id, period)
);
CREATE INDEX IF NOT EXISTS idx_ival_indicator ON indicator_values(indicator_id);

-- -----------------------------------------------------------------------------
--  MÓDULO 4 — Prospectiva (escenarios y proyecciones por horizonte)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scenarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,      -- TEND, CRIT, DES
  name        TEXT NOT NULL,
  default_ssp TEXT,                      -- SSP2-4.5 / SSP5-8.5
  description TEXT
);

CREATE TABLE IF NOT EXISTS scenario_projections (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id    INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  horizon_year   INTEGER NOT NULL,       -- 2038, 2046, 2056
  ssp            TEXT NOT NULL,
  delta_temp_min REAL,                   -- °C sobre referencia
  delta_temp_max REAL,
  narrative      TEXT,
  UNIQUE (scenario_id, horizon_year)
);

-- -----------------------------------------------------------------------------
--  Participacion deliberativa (moderada)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid       TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL,              -- propuesta|comentario|alerta
  content    TEXT NOT NULL,
  geom       TEXT,                       -- GeoJSON opcional
  status     TEXT NOT NULL DEFAULT 'pendiente',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contrib_status ON contributions(status);

-- -----------------------------------------------------------------------------
--  Trazabilidad: moderacion y auditoria
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_table TEXT NOT NULL,
  entity_id    INTEGER NOT NULL,
  moderator_id INTEGER NOT NULL REFERENCES users(id),
  action       TEXT NOT NULL,            -- validar|rechazar|editar|ocultar
  reason       TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
