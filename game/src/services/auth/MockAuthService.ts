import {
  isValidLoginId,
  isValidPassword,
  type AuthCredentials,
  type AuthLogoutOutcome,
  type AuthenticationMode,
  type AuthResult,
  type AuthService,
  type GuestUpgradeResult,
} from './AuthService'

export class MockAuthService implements AuthService {
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

  /** Mock sessions are synthetic - there is no stored credential to
   *  resume; the Continue path for them is a fresh guest session. */
  async resumeStoredSession(): Promise<AuthResult> {
    return { ok: true, session: { sessionId: crypto.randomUUID(), mode: 'guest' } }
  }

  /** Local mode has no real account to upgrade; report the honest code
   *  rather than fabricating a pending-confirm flow. */
  async upgradeGuest(): Promise<GuestUpgradeResult> {
    return { ok: false, code: 'not_guest', message: 'Chỉ tài khoản khách trực tuyến mới có thể nâng cấp.' }
  }

  async finalizeUpgrade(): Promise<GuestUpgradeResult> {
    return { ok: false, code: 'not_guest', message: 'Không có nâng cấp đang chờ.' }
  }

  async logout(): Promise<AuthLogoutOutcome> {
    return { serverRevoke: 'skipped', signout: 'skipped' }
  }
}

export const authService: AuthService = new MockAuthService()
