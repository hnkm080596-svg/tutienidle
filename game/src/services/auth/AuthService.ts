export type AuthenticationMode = 'guest' | 'login' | 'register'

export interface AuthCredentials {
  loginId: string
  password: string
}

export interface AuthSession {
  sessionId: string
  mode: AuthenticationMode
  loginId?: string
}

export type AuthErrorCode = 'invalid_id' | 'weak_password' | 'invalid_credentials' | 'id_taken' | 'server_unavailable'

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: AuthErrorCode; message: string }

export interface AuthService {
  authenticate(mode: AuthenticationMode, credentials?: AuthCredentials): Promise<AuthResult>
  logout(): Promise<void>
}

export function isValidLoginId(value: string): boolean {
  return /^[a-zA-Z0-9_]{4,20}$/.test(value)
}

export function isValidPassword(value: string): boolean {
  return value.length >= 6
}
