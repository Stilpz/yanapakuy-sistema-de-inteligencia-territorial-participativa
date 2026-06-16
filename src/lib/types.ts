import type { JwtPayload } from './auth'

export type Bindings = {
  DB: D1Database
  JWT_SECRET?: string
}

export type Variables = {
  user: JwtPayload
  permissions: string[]
}

export const JWT_SECRET_FALLBACK = 'sitp-zarzal-dev-secret-change-in-prod'

export function getSecret(env: Bindings): string {
  return env.JWT_SECRET || JWT_SECRET_FALLBACK
}
