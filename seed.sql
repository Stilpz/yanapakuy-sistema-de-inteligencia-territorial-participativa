-- =============================================================================
--  SITP ZARZAL — Seed (datos base, re-ejecutable)
--  Matriz RBAC calcada de la propuesta + capas/indicadores/escenarios de Zarzal.
--  Cifras: poblacion DANE 2025; geometrias APROXIMADAS marcadas como simuladas.
-- =============================================================================

-- ---------- ROLES (ADMIN y ACTOR como nucleo; resto extensible) ----------
INSERT OR IGNORE INTO roles (code, name, description, is_system) VALUES
 ('INVITADO',             'Invitado',                'Visitante sin sesion. Solo consulta publica + encuesta anonima.', 1),
 ('ACTOR',                'Actor del territorio',    'Usuario registrado. Aporta datos de campo y deliberacion.', 1),
 ('MODERADOR',            'Moderador / Validador',   'Revisa y valida aportes antes de su publicacion.', 0),
 ('ANALISTA',             'Analista',                'Consulta avanzada, analitica y exportacion; no modera.', 0),
 ('GESTOR_INSTITUCIONAL', 'Gestor institucional',    'Publica indicadores/capas oficiales (Alcaldia, Gobernacion).', 0),
 ('ADMIN',                'Administrador',           'Gestion total: usuarios, roles, configuracion, auditoria.', 1);

-- ---------- PERMISOS (granularidad de accion) ----------
INSERT OR IGNORE INTO permissions (code, description) VALUES
 ('public.view',           'Ver mapas/indicadores/escenarios publicos'),
 ('perception.create',     'Responder encuesta de percepcion anonima'),
 ('field.create',          'Crear aporte de campo (Survey123)'),
 ('contributions.create',  'Comentar / proponer en deliberacion'),
 ('field.validate',        'Validar/rechazar aportes'),
 ('moderation.queue.view', 'Ver cola de moderacion'),
 ('data.export',           'Exportar datos / analitica avanzada'),
 ('indicators.publish',    'Publicar indicadores/capas oficiales'),
 ('users.manage',          'Gestionar usuarios y roles'),
 ('audit.view',            'Ver auditoria');

-- ---------- MATRIZ ROL x PERMISO (evita IDs hardcodeados) ----------
-- ACTOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='ACTOR' AND p.code IN ('public.view','perception.create','field.create','contributions.create');
-- MODERADOR
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='MODERADOR' AND p.code IN ('public.view','perception.create','field.create','contributions.create','field.validate','moderation.queue.view','data.export');
-- ANALISTA
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='ANALISTA' AND p.code IN ('public.view','perception.create','data.export');
-- GESTOR_INSTITUCIONAL
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='GESTOR_INSTITUCIONAL' AND p.code IN ('public.view','perception.create','field.create','contributions.create','data.export','indicators.publish');
-- ADMIN (todos)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p WHERE r.code='ADMIN';

-- ---------- ADMIN inicial ----------
-- (Opcion A) El primer ADMIN NO se crea aqui. Se crea via POST /api/auth/bootstrap
-- usando el secreto ADMIN_BOOTSTRAP_TOKEN. Asi ninguna credencial queda en el repositorio.
-- El email institucional sugerido es: admin@yanapakuy-zarzal.co
-- Ver guia: docs/CREACION_USUARIOS.md

-- ---------- CONSENTIMIENTO INFORMADO (Ley 1581/2012) ----------
INSERT OR IGNORE INTO consents (version, body, hash) VALUES
 ('v1-2026',
  'Esta encuesta hace parte del Sistema de Inteligencia Territorial Participativa de Zarzal (Universidad del Valle). Es anonima: no pedimos nombre, cedula ni datos de contacto. Tu participacion es voluntaria y puedes abandonarla en cualquier momento. La informacion se usa solo de forma agregada para la planificacion del municipio, conforme a la Ley 1581 de 2012. Al continuar, das tu consentimiento informado.',
  'sha256:v1-2026-zarzal-asc-univalle');

-- ---------- INDICADORES (Modulo 2/3) ----------
INSERT OR IGNORE INTO indicators (code, name, unit, source, accent, description) VALUES
 ('poblacion',     'Poblacion total',              'hab.',  'DANE 2025',  '#D8A23C', 'Proyeccion DANE 2025. 72,7% mayores de edad.'),
 ('san_autonomia', 'Autonomia alimentaria',        'dias',  'SITP/UMATA', '#7FB089', 'Dias estimados de abastecimiento local ante interrupcion externa (estimacion).'),
 ('cana_uso',      'Suelo en caña',                '%',     'IGAC/CVC',   '#D8A23C', 'Proporcion del suelo agricola en monocultivo cañero.'),
 ('riesgo_sismico','Exposicion sismica Romeral',   'indice','SGC',        '#CC5A41', 'Indice relativo de exposicion a la fuente Cauca-Romeral (cualitativo).'),
 ('malestar_urbano','Malestar urbano percibido',   'indice','SITP perc.', '#CC5A41', 'Indice agregado de ruido/aire/seguridad (encuesta de percepcion).'),
 ('hidrico_estres','Estres hidrico La Paila',      'indice','CVC/IDEAM',  '#5AA6AE', 'Nivel de presion sobre el rio La Paila (cualitativo).');

-- valores recientes
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 43252, 'DANE 2025' FROM indicators WHERE code='poblacion';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 48, 'Estimacion preliminar — vacio de informacion a capturar' FROM indicators WHERE code='san_autonomia';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 71, 'Predominio cañero sobre suelo agricola' FROM indicators WHERE code='cana_uso';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 3.4, 'Escala 1-5 (cualitativo)' FROM indicators WHERE code='riesgo_sismico';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 3.1, 'Escala 1-5 (percepcion)' FROM indicators WHERE code='malestar_urbano';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2025-01-01', 3.6, 'Escala 1-5 (cualitativo)' FROM indicators WHERE code='hidrico_estres';

-- series historicas para algunos indicadores
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2020-01-01', 41800, 'DANE proy.' FROM indicators WHERE code='poblacion';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2022-01-01', 42400, 'DANE proy.' FROM indicators WHERE code='poblacion';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2018-01-01', 65, 'IGAC' FROM indicators WHERE code='cana_uso';
INSERT OR IGNORE INTO indicator_values (indicator_id, period, value, note)
 SELECT id, '2022-01-01', 69, 'IGAC' FROM indicators WHERE code='cana_uso';

-- ---------- ESCENARIOS PROSPECTIVOS (Modulo 4 — CMIP6/IDEAM) ----------
INSERT OR IGNORE INTO scenarios (code, name, default_ssp, description) VALUES
 ('TEND', 'Tendencial', 'SSP2-4.5', 'El territorio sigue su inercia: caña dominante, expansion urbana sobre el nucleo, dependencia regional creciente.'),
 ('CRIT', 'Critico',    'SSP5-8.5', 'Convergencia de presiones: calor extremo, estres hidrico de La Paila, evento sismico Romeral sobre infraestructura no reforzada.'),
 ('DES',  'Deseable',   'SSP2-4.5', 'SITP en marcha: diversificacion agroecologica, rondas hidricas protegidas, sismorresistencia y gobernanza territorial activa.');

-- proyecciones por horizonte (deltas de temperatura sobre referencia, franja Valle 2-5C a 2100)
-- TENDENCIAL (SSP2-4.5)
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2038, 'SSP2-4.5', 0.8, 1.3, 'Aumento moderado de temperatura. La cabecera densifica; la caña mantiene su perimetro. La autonomia alimentaria sigue baja por dependencia de mercados externos (eje Tulua-Buga-Cali y Cartago).' FROM scenarios WHERE code='TEND';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2046, 'SSP2-4.5', 1.2, 1.9, 'Mayor variabilidad de lluvias presiona el rio La Paila en epoca seca. Las quemas de zafra impactan la calidad del aire urbano. La sentadilla geografica se intensifica sobre el nucleo institucional.' FROM scenarios WHERE code='TEND';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2056, 'SSP2-4.5', 1.7, 2.6, 'El modelo agrario no diversificado vuelve fragil la seguridad alimentaria ante choques climaticos. La flexion espacial se profundiza: mas funciones criticas dependen de afuera.' FROM scenarios WHERE code='TEND';
-- CRITICO (SSP5-8.5)
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2038, 'SSP5-8.5', 1.2, 1.8, 'Olas de calor mas frecuentes estresan agua y salud publica simultaneamente. Un evento sismico sobre Romeral encontraria edificaciones sin reforzamiento (mamposteria no confinada anterior a NSR-10).' FROM scenarios WHERE code='CRIT';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2046, 'SSP5-8.5', 2.0, 3.0, 'Caudal critico del rio La Paila en estiaje; conflicto agudo agua domestica vs. agroindustria cañera. Vias terciarias intransitables en temporada de lluvias aislan veredas.' FROM scenarios WHERE code='CRIT';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2056, 'SSP5-8.5', 3.0, 4.5, 'Escenario de fatiga del nucleo: las cuatro fuerzas (demografica, agroindustrial, climatica, sismica) se combinan. Sin diversificacion ni gobernanza, la capacidad de respuesta local colapsa hacia los nodos regionales.' FROM scenarios WHERE code='CRIT';
-- DESEABLE (SSP2-4.5 con accion)
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2038, 'SSP2-4.5', 0.7, 1.1, 'El SITP opera: huertas agroecologicas peri-urbanas suben la autonomia alimentaria. Microzonificacion sismica de la cabecera guia el reforzamiento prioritario.' FROM scenarios WHERE code='DES';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2046, 'SSP2-4.5', 1.0, 1.6, 'Rondas hidricas de La Paila y el Cauca protegidas y restauradas (NDVI recuperandose). La participacion comunitaria sostiene un monitoreo permanente del agua y el suelo.' FROM scenarios WHERE code='DES';
INSERT OR IGNORE INTO scenario_projections (scenario_id, horizon_year, ssp, delta_temp_min, delta_temp_max, narrative)
 SELECT id, 2056, 'SSP2-4.5', 1.4, 2.2, 'Territorio resiliente y diversificado: la dependencia regional es opcion, no condena. El POT como proceso vivo ha permitido ajustes permanentes basados en evidencia y saber popular.' FROM scenarios WHERE code='DES';

-- ---------- CAPAS DEL GEOVISOR (geometrias APROXIMADAS / SIMULADAS) ----------
-- Zarzal: ~4.39 N, -76.07 W. Coordenadas aproximadas con fines de prototipo.
INSERT OR IGNORE INTO map_layers (code, name, source, color, z_index, geojson) VALUES
 ('limite', 'Limite municipal', 'IGAC (aprox.)', '#ECE7D7', 1,
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Zarzal","area_km2":367.9},"geometry":{"type":"Polygon","coordinates":[[[-76.18,4.46],[-76.05,4.50],[-75.92,4.44],[-75.90,4.34],[-75.98,4.28],[-76.10,4.27],[-76.19,4.33],[-76.18,4.46]]]}}]}'),
 ('hidrico', 'Red hidrica (Cauca + La Paila)', 'CVC (aprox.)', '#5AA6AE', 3,
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Rio Cauca"},"geometry":{"type":"LineString","coordinates":[[-76.17,4.47],[-76.15,4.42],[-76.16,4.36],[-76.15,4.30],[-76.17,4.27]]}},{"type":"Feature","properties":{"name":"Rio La Paila"},"geometry":{"type":"LineString","coordinates":[[-75.93,4.43],[-75.99,4.40],[-76.05,4.38],[-76.10,4.39],[-76.15,4.40]]}}]}'),
 ('romeral', 'Traza Cauca-Romeral', 'SGC (aprox.)', '#CC5A41', 5,
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sistema de fallas Cauca-Romeral","tipo":"fuente sismogenica activa"},"geometry":{"type":"LineString","coordinates":[[-75.90,4.50],[-75.94,4.42],[-75.97,4.36],[-76.00,4.30],[-76.03,4.24]]}}]}'),
 ('cana', 'Cinturon cañero (Riopaila)', 'IGAC/CVC (aprox.)', '#D8A23C', 2,
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Cinturon cañero","epicentro":"La Paila"},"geometry":{"type":"Polygon","coordinates":[[[-76.02,4.42],[-75.94,4.43],[-75.91,4.38],[-75.95,4.32],[-76.03,4.33],[-76.04,4.38],[-76.02,4.42]]]}}]}'),
 ('cabecera', 'Cabecera urbana', 'IGAC (aprox.)', '#9CAC9E', 4,
  '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Cabecera de Zarzal","poblacion_aprox":31800},"geometry":{"type":"Point","coordinates":[-76.072,4.392]}}]}');
