import type { SupabaseConfig } from '../supabase/SupabaseConfig'
import {
  clearDurableGuestCredential,
  clearSupabaseSession,
  readSupabaseSession,
  resolveSupabaseSession,
  storeSupabaseSession,
} from '../supabase/SupabaseSession'
import { requestSupabase, SupabaseHttpError } from '../supabase/SupabaseHttp'
import { CLIENT_PROTOCOL_VERSION } from '../session/BackendStatus'
import type { ClientBuildInfo } from '../backend/ClientBuildInfo'
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

interface GoTrueResponse { access_token: string; refresh_token: string; expires_in?: number; user: { id: string } }
interface GoTrueUserResponse { id: string }

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

// Forward finalize contract (202609300003_beta_guest_finalize.sql): the
// server derives registered status from auth.users alone - client
// metadata can never elevate account_kind or bind a login.
interface FinalizeGuestUpgradeResponse {
  status?: string
  code?: string
  loginId?: string
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

const SESSION_EXPIRED: AuthResult = {
  ok: false,
  code: 'invalid_credentials',
  message: 'Phiên đăng nhập đã hết hạn — đăng nhập lại.',
}
const UNAVAILABLE: AuthResult = {
  ok: false,
  code: 'server_unavailable',
  message: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
}
const UPGRADE_UNAVAILABLE: GuestUpgradeResult = {
  ok: false,
  code: 'server_unavailable',
  message: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
}
const RATE_LIMITED: GuestUpgradeResult = {
  ok: false,
  code: 'rate_limited',
  message: 'Máy chủ đang giới hạn gửi thư xác nhận — vui lòng thử lại sau ít phút.',
}
const ID_TAKEN: GuestUpgradeResult = {
  ok: false,
  code: 'id_taken',
  message: 'ID này đã được sử dụng.',
}

/** GoTrue reports a duplicate email as 422 email_exists on updateUser,
 *  and as a 400 whose payload carries the same code on some versions.
 *  Other 4xx (e.g. email_address_invalid) are NOT id collisions. */
function isEmailExistsError(error: SupabaseHttpError): boolean {
  if (error.status === 422) return true
  return /email_exists|already registered|already in use/i.test(
    JSON.stringify(error.payload ?? ''),
  )
}

export class SupabaseAuthService implements AuthService {
  constructor(
    private readonly config: SupabaseConfig,
    private readonly build: ClientBuildInfo,
  ) {}

  private async claim(accessToken: string): Promise<{ ok: true; sessionId: string } | { ok: false; result: AuthResult }> {
    const claim = await requestSupabase<ClaimActiveSessionResponse>(this.config, '/rest/v1/rpc/claim_active_session', {
      method: 'POST',
      body: JSON.stringify({
        p_device_label: navigator.userAgent.slice(0, 160),
        p_protocol_version: CLIENT_PROTOCOL_VERSION,
        p_build_id: this.build.buildId,
      }),
    }, accessToken)

    if (claim.status !== 'ADMITTED' || typeof claim.sessionId !== 'string') {
      return { ok: false, result: claimRejection(claim.code) }
    }
    return { ok: true, sessionId: claim.sessionId }
  }

  /** resolveSupabaseSession collapses three cases into null; distinguish
   *  them for the caller: still-stored = transient transport failure,
   *  cleared = proven terminal rejection, absent = nothing stored. */
  private resolveFailure(): AuthResult {
    return readSupabaseSession() ? UNAVAILABLE : SESSION_EXPIRED
  }

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

      const claim = await this.claim(auth.access_token)
      if (!claim.ok) return claim.result

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
      return UNAVAILABLE
    }
  }

  async resumeStoredSession(): Promise<AuthResult> {
    const stored = readSupabaseSession()
    if (!stored) {
      return { ok: false, code: 'no_stored_session', message: 'Không có phiên đăng nhập để tiếp tục.' }
    }

    try {
      const session = await resolveSupabaseSession(this.config)
      if (!session) return this.resolveFailure()

      const claim = await this.claim(session.accessToken)
      if (!claim.ok) return claim.result
      storeSupabaseSession({ ...session, sessionId: claim.sessionId })

      // Resumable finalization (B1.8): an interrupted guest upgrade
      // replays from the authoritative Auth state on the next entry.
      const pendingLoginId = session.pendingUpgrade?.loginId
      if (session.pendingUpgrade) {
        await this.finalizeUpgrade()
      }

      const current = readSupabaseSession() ?? { ...session, sessionId: claim.sessionId }
      return {
        ok: true,
        session: {
          sessionId: claim.sessionId,
          mode: current.mode ?? 'guest',
          userId: current.userId,
          loginId: current.pendingUpgrade?.loginId ?? pendingLoginId,
        },
      }
    } catch {
      return UNAVAILABLE
    }
  }

  async upgradeGuest(credentials: { loginId: string }): Promise<GuestUpgradeResult> {
    if (!isValidLoginId(credentials.loginId)) {
      return { ok: false, code: 'invalid_id', message: 'ID đăng nhập chưa đúng định dạng.' }
    }

    const stored = readSupabaseSession()
    if (!stored || stored.mode !== 'guest') {
      return { ok: false, code: 'not_guest', message: 'Chỉ tài khoản khách mới có thể nâng cấp.' }
    }
    const loginId = credentials.loginId.toLowerCase()

    try {
      const session = await resolveSupabaseSession(this.config)
      if (!session) {
        return readSupabaseSession() ? UPGRADE_UNAVAILABLE
          : { ok: false, code: 'invalid_credentials', message: 'Phiên đăng nhập đã hết hạn — đăng nhập lại.' }
      }

      // EXT-09 same-uuid link, EMAIL-ONLY: on a real GoTrue a combined
      // {email,password} PUT 400s with email_address_invalid - the
      // email_change flow then targets the anonymous user's CURRENT
      // (empty) address. The password is bound after confirmation by
      // completeUpgrade; it is never persisted here.
      const user = await requestSupabase<GoTrueUserResponse>(this.config, '/auth/v1/user', {
        method: 'PUT',
        body: JSON.stringify({ email: accountEmail(loginId) }),
      }, session.accessToken)

      // The upgrade contract is same-uuid by definition - a response for
      // any other user id is a fatal contract violation, never adopted.
      if (session.userId && user.id !== session.userId) {
        return { ok: false, code: 'server_unavailable', message: 'Phản hồi xác thực không khớp tài khoản.' }
      }

      storeSupabaseSession({ ...session, pendingUpgrade: { loginId } })
      return this.finalizeUpgrade()
    } catch (error) {
      if (error instanceof SupabaseHttpError) {
        if (isEmailExistsError(error)) return ID_TAKEN
        // GoTrue's email send rate limit: retryable, the pending marker
        // is untouched either way.
        if (error.status === 429) return RATE_LIMITED
      }
      return UPGRADE_UNAVAILABLE
    }
  }

  async finalizeUpgrade(): Promise<GuestUpgradeResult> {
    const stored = readSupabaseSession()
    if (!stored) {
      return { ok: false, code: 'no_stored_session', message: 'Không có phiên đăng nhập để hoàn tất.' }
    }
    if (!stored.pendingUpgrade) {
      return stored.mode !== 'guest'
        ? { ok: true, status: 'finalized' }
        : { ok: false, code: 'not_guest', message: 'Không có nâng cấp đang chờ.' }
    }

    const pendingLoginId = stored.pendingUpgrade.loginId

    try {
      const session = await resolveSupabaseSession(this.config)
      if (!session) {
        return readSupabaseSession() ? UPGRADE_UNAVAILABLE
          : { ok: false, code: 'invalid_credentials', message: 'Phiên đăng nhập đã hết hạn — đăng nhập lại.' }
      }

      const verdict = await requestSupabase<FinalizeGuestUpgradeResponse>(
        this.config,
        '/rest/v1/rpc/finalize_guest_upgrade',
        { method: 'POST', body: JSON.stringify({ p_login_id: pendingLoginId }) },
        session.accessToken,
      )

      if (verdict.status === 'FINALIZED' || verdict.code === 'ALREADY_REGISTERED') {
        // Confirmed server-side, but the account is NOT usable as
        // registered until a password is bound - keep the marker and the
        // guest session/durable credential alive so a restart here can
        // never lock the user out. completeUpgrade lands the flip.
        storeSupabaseSession({ ...session, pendingUpgrade: { loginId: pendingLoginId } })
        return { ok: true, status: 'finalized' }
      }
      if (verdict.status === 'PENDING_CONFIRMATION') {
        return { ok: true, status: 'pending-confirm' }
      }
      // A dead-end pending (id taken / invalid) is cleared so it cannot
      // wedge every future entry; the guest session itself stays live.
      storeSupabaseSession({ ...session, pendingUpgrade: undefined })
      return verdict.code === 'LOGIN_ID_TAKEN'
        ? { ok: false, code: 'id_taken', message: 'ID này đã được sử dụng.' }
        : { ok: false, code: 'invalid_credentials', message: 'Không thể hoàn tất nâng cấp với ID này.' }
    } catch {
      return UPGRADE_UNAVAILABLE
    }
  }

  /** Post-finalize: bind the password on the email-linked session, then
   *  flip to session-scoped registered and retire the durable guest
   *  credential. The marker survives every failure - a password step that
   *  never lands replays from the authoritative Auth state next entry. */
  async completeUpgrade(credentials: { password: string }): Promise<GuestUpgradeResult> {
    if (!isValidPassword(credentials.password)) {
      return { ok: false, code: 'weak_password', message: 'Mật khẩu cần tối thiểu 6 ký tự.' }
    }

    const stored = readSupabaseSession()
    if (!stored || stored.mode !== 'guest') {
      return { ok: false, code: 'not_guest', message: 'Chỉ tài khoản khách mới có thể nâng cấp.' }
    }
    const pendingLoginId = stored.pendingUpgrade?.loginId
    if (!pendingLoginId) {
      return { ok: false, code: 'no_stored_session', message: 'Không có nâng cấp đang chờ.' }
    }

    try {
      const session = await resolveSupabaseSession(this.config)
      if (!session) {
        return readSupabaseSession() ? UPGRADE_UNAVAILABLE
          : { ok: false, code: 'invalid_credentials', message: 'Phiên đăng nhập đã hết hạn — đăng nhập lại.' }
      }

      await requestSupabase<GoTrueUserResponse>(this.config, '/auth/v1/user', {
        method: 'PUT',
        body: JSON.stringify({ password: credentials.password }),
      }, session.accessToken)

      // Registered persistence is session-scoped (conservative beta
      // default): the durable guest record retires only now, with the
      // password bound - the account is genuinely sign-in-able.
      storeSupabaseSession({ ...session, mode: 'login', pendingUpgrade: undefined })
      clearDurableGuestCredential()
      return { ok: true, status: 'finalized' }
    } catch (error) {
      if (error instanceof SupabaseHttpError) {
        if (error.status === 400 || error.status === 422) {
          return { ok: false, code: 'weak_password', message: 'Mật khẩu cần tối thiểu 6 ký tự.' }
        }
        if (error.status === 429) return RATE_LIMITED
      }
      return UPGRADE_UNAVAILABLE
    }
  }

  async logout(): Promise<AuthLogoutOutcome> {
    const outcome: AuthLogoutOutcome = { serverRevoke: 'skipped', signout: 'skipped' }

    try {
      // A durable-restored guest may hold no live access token yet; try
      // to resolve one for the server-side revoke without ever blocking
      // the local clear (a transient failure still signs out locally).
      const session = (await resolveSupabaseSession(this.config)) ?? readSupabaseSession()
      if (session) {
        // B1.9 order: revoke the active game session BEFORE signout.
        try {
          await requestSupabase(this.config, '/rest/v1/rpc/revoke_current_session', {
            method: 'POST',
            body: JSON.stringify({ p_session_id: session.sessionId }),
          }, session.accessToken)
          outcome.serverRevoke = 'confirmed'
        } catch {
          // Offline/5xx: never claim the remote revoke happened.
          outcome.serverRevoke = 'unconfirmed'
        }
        try {
          await requestSupabase(this.config, '/auth/v1/logout', { method: 'POST' }, session.accessToken)
          outcome.signout = 'confirmed'
        } catch {
          outcome.signout = 'local-only'
        }
      }
    } catch {
      // resolveSupabaseSession only swallows transport errors already;
      // the local clear below runs regardless.
    } finally {
      clearSupabaseSession()
    }
    return outcome
  }
}
