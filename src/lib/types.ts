import type { JwtPayload } from './auth'

export type Bindings = {
  DB: D1Database
  JWT_SECRET?: string
  /** Token de un solo uso para crear el primer ADMIN (bootstrap). Guardar como secreto: wrangler pages secret put ADMIN_BOOTSTRAP_TOKEN */
  ADMIN_BOOTSTRAP_TOKEN?: string
}

export type Variables = {
  user: JwtPayload
  permissions: string[]
}

export const JWT_SECRET_FALLBACK = 'yanapakuy-dev-secret-change-in-prod'

export function getSecret(env: Bindings): string {
  return env.JWT_SECRET || JWT_SECRET_FALLBACK
}
