import {
  isValidLoginId,
  isValidPassword,
  type AuthCredentials,
  type AuthenticationMode,
  type AuthResult,
  type AuthService,
} from './AuthService'

class MockAuthService implements AuthService {
  async authenticate(mode: AuthenticationMode, credentials?: AuthCredentials): Promise<AuthResult> {
    await new Promise(resolve => window.setTimeout(resolve, 250))

    if (mode === 'guest') {
      return { ok: true, session: { sessionId: crypto.randomUUID(), mode } }
    }

    if (!credentials || !isValidLoginId(credentials.loginId)) {
      return { ok: false, code: 'invalid_id', message: 'ID đăng nhập chưa đúng định dạng.' }
    }

    if (!isValidPassword(credentials.password)) {
      return { ok: false, code: 'weak_password', message: 'Mật khẩu cần tối thiểu 6 ký tự.' }
    }

    return {
      ok: true,
      session: { sessionId: crypto.randomUUID(), mode, loginId: credentials.loginId.toLowerCase() },
    }
  }

  async logout(): Promise<void> {}
}

export const authService: AuthService = new MockAuthService()
