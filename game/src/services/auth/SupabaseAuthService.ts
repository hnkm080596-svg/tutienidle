import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import { clearSupabaseSession, readSupabaseSession, storeSupabaseSession } from '../supabase/SupabaseSession'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { CLIENT_PROTOCOL_VERSION } from '../session/BackendStatus'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
import { isValidLoginId, isValidPassword, type AuthCredentials, type AuthenticationMode, type AuthResult, type AuthService } from './AuthService'

interface GoTrueResponse { access_token: string; refresh_token: string; expires_in?: number; user: { id: string } }

// PR2 claim contract (202609300001_beta_authority_prepare.sql): the
// versioned overload admits sessions carrying protocol + build metadata;
// sessions minted by the legacy 1-arg overload are rejected by every
// guarded operation (_assert_session_protocol), so this client MUST
// claim through the versioned form.
interface ClaimActiveSessionResponse {
  status?: string
  sessionId?: string
  protocolVersion?: number
  serverTimeUtc?: string
  code?: string
}

function accountEmail(loginId: string): string {
  return `${loginId.toLowerCase()}@accounts.tien-hiep-idle.invalid`
}

function claimRejection(code: string | undefined): AuthResult {
  switch (code) {
    case 'MAINTENANCE_MODE':
      return { ok: false, code: 'maintenance', message: 'Máy chủ đang bảo trì — thử lại sau.' }
    case 'PROTOCOL_UNSUPPORTED':
    case 'BUILD_ID_INVALID':
      return { ok: false, code: 'unsupported_client', message: 'Phiên bản ứng dụng không được hỗ trợ — hãy cập nhật.' }
    default:
      // DEVICE_LABEL_INVALID and anything unknown: the claim contract
      // itself failed, so the honest surface is unavailable.
      return { ok: false, code: 'server_unavailable', message: 'Máy chủ từ chối phiên đăng nhập.' }
  }
}

export class SupabaseAuthService implements AuthService {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly build: ClientBuildInfo,
  ) {}

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

      const claim = await requestSupabase<ClaimActiveSessionResponse>(this.config, '/rest/v1/rpc/claim_active_session', {
        method: 'POST',
        body: JSON.stringify({
          p_device_label: navigator.userAgent.slice(0, 160),
          p_protocol_version: CLIENT_PROTOCOL_VERSION,
          p_build_id: this.build.buildId,
        }),
      }, auth.access_token)

      if (claim.status !== 'ADMITTED' || typeof claim.sessionId !== 'string') {
        return claimRejection(claim.code)
      }

      const sessionId = claim.sessionId

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
      if (error instanceof SupabaseHttpError && error.status === 400) {
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
