import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { clearSupabaseSession, readSupabaseSession, storeSupabaseSession } from '../supabase/SupabaseSession'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { isValidLoginId, isValidPassword, type AuthCredentials, type AuthenticationMode, type AuthResult, type AuthService } from './AuthService'

interface GoTrueResponse { access_token: string; refresh_token: string; expires_in?: number; user: { id: string } }

function accountEmail(loginId: string): string {
  return `${loginId.toLowerCase()}@accounts.tien-hiep-idle.invalid`
}

export class SupabaseAuthService implements AuthService {
  constructor(private readonly config: SupabaseConfig) {}

  async authenticate(mode: AuthenticationMode, credentials?: AuthCredentials): Promise<AuthResult> {
    if (mode !== 'guest' && (!credentials || !isValidLoginId(credentials.loginId))) {
      return { ok: false, code: 'invalid_id', message: 'ID đăng nhập chưa đúng định dạng.' }
    }
    if (mode !== 'guest' && (!credentials || !isValidPassword(credentials.password))) {
      return { ok: false, code: 'weak_password', message: 'Mật khẩu cần tối thiểu 6 ký tự.' }
    }

    try {
      const auth = mode === 'login'
        ? await requestSupabase<GoTrueResponse>(this.config, '/auth/v1/token?grant_type=password', {
            method: 'POST', body: JSON.stringify({ email: accountEmail(credentials!.loginId), password: credentials!.password }),
          })
        : await requestSupabase<GoTrueResponse>(this.config, '/auth/v1/signup', {
            method: 'POST',
            body: JSON.stringify(mode === 'guest'
              ? { data: { account_kind: 'guest' } }
              : { email: accountEmail(credentials!.loginId), password: credentials!.password, data: { login_id: credentials!.loginId.toLowerCase(), account_kind: 'registered' } }),
          })

      // F-BX-73: GoTrue duplicate signup can answer a fake-200 stub user
      // with NO access_token (anti-enumeration). For register that shape
      // means the id is taken; for other modes a tokenless 200 is simply
      // an unreachable backend answer - fail as server_unavailable, and
      // never call claim_active_session with an undefined bearer.
      if (!auth.access_token) {
        return mode === 'register'
          ? { ok: false, code: 'id_taken', message: 'ID này đã được sử dụng.' }
          : { ok: false, code: 'server_unavailable', message: 'Không thể kết nối máy chủ. Vui lòng thử lại.' }
      }

      const sessionId = await requestSupabase<string>(this.config, '/rest/v1/rpc/claim_active_session', {
        method: 'POST', body: JSON.stringify({ p_device_label: navigator.userAgent.slice(0, 160) }),
      }, auth.access_token)

      storeSupabaseSession({
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        sessionId,
        userId: auth.user.id,
        mode,
        expiresAtMs: auth.expires_in ? Date.now() + auth.expires_in * 1000 : undefined,
      })
      return { ok: true, session: { sessionId, mode, loginId: credentials?.loginId.toLowerCase(), userId: auth.user.id } }
    } catch (error) {
      // F-BX-73: GoTrue answers a duplicate signup either as 400 or as
      // 422 {error_code: 'user_already_exists'} - both mean the login id
      // is taken for register mode.
      if (error instanceof SupabaseHttpError && (error.status === 400 || (mode === 'register' && error.status === 422))) {
        return { ok: false, code: mode === 'register' ? 'id_taken' : 'invalid_credentials', message: mode === 'register' ? 'ID này đã được sử dụng.' : 'ID hoặc mật khẩu không chính xác.' }
      }
      return { ok: false, code: 'server_unavailable', message: 'Không thể kết nối máy chủ. Vui lòng thử lại.' }
    }
  }

  async logout(): Promise<void> {
    const session = readSupabaseSession()
    try {
      if (session) await requestSupabase(this.config, '/auth/v1/logout', { method: 'POST' }, session.accessToken)
    } finally {
      clearSupabaseSession()
    }
  }
}
