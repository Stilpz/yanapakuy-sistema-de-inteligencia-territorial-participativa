# Guía de creación de usuarios — Yanapakuy (SITP Zarzal)

Esta guía explica **cómo se crea cada tipo de usuario**, qué puede hacer cada rol y el
flujo de seguridad detrás de cada caso. El modelo de acceso de Yanapakuy es:

> **Consultar = abierto (sin cuenta). Aportar = requiere perfil + sesión.**
> Todo aporte nace en estado `pendiente` y un moderador lo valida antes de publicarse.

La autorización **siempre** se valida en el servidor mediante **RBAC en base de datos**
(tablas `roles`, `permissions`, `role_permissions`). Crear o cambiar un rol = insertar/editar
filas, no recompilar.

---

## 1. Mapa de roles y permisos

| Rol | Cómo se obtiene | Permisos |
|---|---|---|
| **INVITADO** | Automático (sin sesión) | `public.view`, `perception.create` (encuesta anónima) |
| **ACTOR** | Auto-registro público (`POST /api/auth/register`) | `public.view`, `perception.create`, `field.create`, `contributions.create` |
| **MODERADOR** | Promovido por un ADMIN | ACTOR + `field.validate`, `moderation.queue.view`, `data.export` |
| **ANALISTA** | Promovido por un ADMIN | `public.view`, `perception.create`, `data.export` |
| **GESTOR_INSTITUCIONAL** | Promovido por un ADMIN | ACTOR + `data.export`, `indicators.publish` |
| **ADMIN** | **Bootstrap** (el 1.º) → luego promoción por otro ADMIN | **Todos** los permisos |

> `INSTITUCION`, `MODERADOR`, `ANALISTA`, `GESTOR_INSTITUCIONAL` son **roles extensibles**
> (`is_system = 0`). Puedes añadir más sin tocar código (ver §6).

**Cadena de confianza:** `bootstrap (ADMIN raíz) → ese ADMIN promueve a los demás → RBAC en BD`.
Nadie puede auto-asignarse un rol elevado desde la API pública: `POST /register` **siempre**
asigna `ACTOR`.

---

## 2. Crear el PRIMER ADMIN — Bootstrap (Opción A)

El primer administrador **no** está en el código ni en el seed (ninguna credencial vive en el
repositorio). Se crea una sola vez con un **token secreto** y el endpoint se **autodesactiva**
en cuanto exista un ADMIN.

### 2.1 Reglas de seguridad del endpoint `POST /api/auth/bootstrap`
1. Si `ADMIN_BOOTSTRAP_TOKEN` no está configurado (o < 16 caracteres) → `503` (bootstrap deshabilitado).
2. Si **ya existe** un ADMIN → `409` (autodesactivación permanente).
3. Si el `token` enviado no coincide con el secreto → `403` (comparación en tiempo constante).
4. Contraseña del ADMIN: **mínimo 12 caracteres**.
5. Éxito → `201`, se registra `admin.bootstrap` en `audit_log`.

### 2.2 Configurar el secreto

**Local (desarrollo)** — archivo `.dev.vars` (NO se commitea):
```
JWT_SECRET=dev-local-jwt-secret-cambiar-en-produccion-0a1b2c3d4e5f
ADMIN_BOOTSTRAP_TOKEN=dev-bootstrap-token-local-1234567890
```

**Producción (Cloudflare Pages)** — como secreto cifrado:
```bash
# Genera un token aleatorio fuerte:
openssl rand -hex 32
# Cárgalo como secreto del proyecto (no queda en el repo):
npx wrangler pages secret put ADMIN_BOOTSTRAP_TOKEN --project-name yanapakuy
npx wrangler pages secret put JWT_SECRET --project-name yanapakuy
```

### 2.3 Crear el ADMIN inicial
```bash
curl -X POST https://<tu-dominio>/api/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "<EL_VALOR_DE_ADMIN_BOOTSTRAP_TOKEN>",
    "name": "Administrador Yanapakuy",
    "email": "admin@yanapakuy-zarzal.co",
    "password": "<CONTRASEÑA_FUERTE_MIN_12>"
  }'
```
Respuesta esperada:
```json
{ "message": "ADMIN inicial creado. El bootstrap queda deshabilitado.",
  "id": "…", "email": "admin@yanapakuy-zarzal.co", "role": "ADMIN" }
```

### 2.4 Después del bootstrap (recomendado)
- **Rota el token**: vuelve a ejecutar `wrangler pages secret put ADMIN_BOOTSTRAP_TOKEN`
  con otro valor (o elimínalo). Aunque el endpoint ya está bloqueado por el `409`, rotar
  el secreto es defensa en profundidad.
- Inicia sesión y verifica el panel de administración.

---

## 3. Crear un ACTOR — Auto-registro público

Cualquier persona crea su propio perfil ACTOR. Es el único rol que se obtiene sin intervención
de un administrador.

### 3.1 Desde la interfaz
1. Botón **«Crear perfil»** en el encabezado.
2. Completar: nombre, email, contraseña (mín. 8), y **MACTOR** (tipo de actor):
   `institucion`, `gremio`, `comunidad`, `academia`, `otro`.
3. Al registrarse queda con sesión iniciada y rol **ACTOR** (`status = activo`).

### 3.2 Vía API
```bash
curl -X POST https://<tu-dominio>/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "María Pérez",
    "email": "maria@correo.co",
    "password": "ClaveSegura8+",
    "password_confirmation": "ClaveSegura8+",
    "mactor": "comunidad",
    "organization": "JAC Vereda La Paila",
    "territory": "Corregimiento La Paila"
  }'
```
> El campo `mactor` clasifica al actor según el análisis MACTOR (institución, gremio,
> comunidad, academia). No otorga permisos: el rol sigue siendo ACTOR.

---

## 4. Crear MODERADOR / ANALISTA / GESTOR_INSTITUCIONAL — Promoción por ADMIN

Estos roles **no** se auto-asignan. El flujo es: **la persona se registra como ACTOR** (§3) y
luego **un ADMIN la promueve**.

### 4.1 Desde la interfaz (panel ADMIN)
1. Iniciar sesión como ADMIN → **Mi panel** → pestaña **Usuarios**.
2. Localizar al usuario en la tabla.
3. Cambiar el desplegable **Rol** al rol deseado (`MODERADOR`, `ANALISTA`, `GESTOR_INSTITUCIONAL`, …).
4. (Opcional) Cambiar **Estado**: `activo` / `pendiente` / `suspendido`.
   - Un usuario `suspendido` o `pendiente` **no puede iniciar sesión**.

### 4.2 Vía API
```bash
# 1) Login ADMIN -> obtener token
TOKEN=$(curl -s -X POST https://<tu-dominio>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yanapakuy-zarzal.co","password":"<clave>"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 2) Listar usuarios y roles disponibles
curl -s https://<tu-dominio>/api/administracion/users -H "Authorization: Bearer $TOKEN"
curl -s https://<tu-dominio>/api/administracion/roles -H "Authorization: Bearer $TOKEN"

# 3) Promover por UUID
curl -X PATCH https://<tu-dominio>/api/administracion/users/<UUID>/role \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"MODERADOR"}'

# 4) (Opcional) Cambiar estado
curl -X PATCH https://<tu-dominio>/api/administracion/users/<UUID>/status \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"activo"}'
```
Requiere permiso `users.manage` (solo ADMIN por defecto).

### 4.3 Cuándo usar cada rol
- **MODERADOR**: vecinos/líderes de confianza que revisan la cola de aportes y validan/rechazan
  (con motivo trazable). Es el rol clave del flujo participativo.
- **ANALISTA**: investigadores/técnicos que necesitan exportar y analizar, pero **no** moderan
  ni publican datos oficiales.
- **GESTOR_INSTITUCIONAL**: funcionarios de Alcaldía/Gobernación/CVC que publican indicadores
  y capas **oficiales**.

---

## 5. Crear un ADMIN adicional

Solo un ADMIN existente puede crear otro ADMIN (no hay segundo bootstrap):
1. La persona se registra como ACTOR (§3).
2. Un ADMIN la promueve a `ADMIN` (igual que §4, con `"role":"ADMIN"`).

> Recomendación: mantener **pocos** ADMIN y preferir roles específicos (MODERADOR/GESTOR) para
> el día a día. Principio de mínimo privilegio.

---

## 6. Crear un ROL NUEVO (RBAC extensible)

Como el RBAC vive en BD, añadir un rol = insertar filas. No requiere recompilar ni redeploy.

```sql
-- 1) Crear el rol (is_system=0 => extensible/eliminable)
INSERT INTO roles (code, name, description, is_system)
VALUES ('VEEDOR', 'Veedor ciudadano', 'Seguimiento y exportación, sin moderar.', 0);

-- 2) Asignarle permisos existentes (matriz rol x permiso)
INSERT INTO role_permissions (role_id, permission_id)
 SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code='VEEDOR' AND p.code IN ('public.view','perception.create','data.export');
```
Ejecutar en local / producción:
```bash
npx wrangler d1 execute yanapakuy-production --local --command="…"   # local
npx wrangler d1 execute yanapakuy-production --command="…"           # producción
```
A partir de ese momento el nuevo rol aparece en el desplegable de **Usuarios** del panel ADMIN
y un administrador puede asignarlo.

**Permisos disponibles** (tabla `permissions`):
`public.view`, `perception.create`, `field.create`, `contributions.create`, `field.validate`,
`moderation.queue.view`, `data.export`, `indicators.publish`, `users.manage`, `audit.view`.

---

## 7. Resumen del flujo (quién crea a quién)

```
                ┌─────────────────────────────────────────────┐
   Bootstrap →  │ 1.er ADMIN  (token secreto, una sola vez)    │
                └───────────────┬─────────────────────────────┘
                                │ promueve (users.manage)
        ┌───────────────────────┼───────────────────────┬───────────────┐
        ▼                       ▼                       ▼               ▼
   MODERADOR              ANALISTA          GESTOR_INSTITUCIONAL    otro ADMIN
        ▲                       ▲                       ▲
        └───────── todos parten de ACTOR (auto-registro público) ──────────┘

   INVITADO  =  sin cuenta  (solo consulta pública + encuesta anónima)
```

---

## 8. Notas de seguridad

- **Contraseñas**: PBKDF2-SHA256, 100 000 iteraciones, sal por usuario (Web Crypto).
- **Sesión**: JWT HS256 firmado con `JWT_SECRET` (configúralo como secreto en producción).
- **Sin credenciales en el repo**: el ADMIN se crea por bootstrap; el seed solo trae estructura RBAC.
- **Anonimato de percepción**: la tabla `perception_responses` **no** tiene `user_id`, ni siquiera
  con sesión activa (Ley 1581/2012). Crear usuarios no afecta esta garantía.
- **Trazabilidad**: `audit_log` registra `login`, `admin.bootstrap`, etc.; `moderation_log`
  registra validaciones/rechazos con motivo.
