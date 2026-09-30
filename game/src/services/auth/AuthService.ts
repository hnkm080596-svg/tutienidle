export type AuthenticationMode = 'guest' | 'login' | 'register'

export interface AuthCredentials {
  loginId: string
  password: string
}

export interface AuthSession {
  sessionId: string
  mode: AuthenticationMode
  loginId?: string
  /** Supabase auth.users id - absent for mock-auth sessions. */
  userId?: string
}

export type AuthErrorCode =
  | 'invalid_id'
  | 'weak_password'
  | 'invalid_credentials'
  | 'id_taken'
  | 'server_unavailable'
  /** B1.7 admission rejections (claim_active_session) - never collapsed
   *  into 'server_unavailable': maintenance is temporary, unsupported is
   *  a client-version problem, and they display different copy. */
  | 'maintenance'
  | 'unsupported_client'
  /** Upgrade/finalize requested on a session that is not a stored guest
   *  (registered account, synthetic local session, or nothing stored). */
  | 'not_guest'
  /** Resume/finalize requested with no stored session at all. */
  | 'no_stored_session'
  /** The server throttled the request (GoTrue email send rate limit) -
   *  retryable after a delay, distinct from an outage. */
  | 'rate_limited'

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: AuthErrorCode; message: string }

/** EXT-09 (LINKING_REQUIRES_CONFIRMATION_FLOW): guest -> registered is a
 *  same-uuid link that stays pending until the email-side confirmation
 *  lands server-side; 'finalized' is only the finalize_guest_upgrade
 *  verdict - never claimed on the client side before confirmation. */
export type GuestUpgradeResult =
  | { ok: true; status: 'pending-confirm' | 'finalized' }
  | { ok: false; code: AuthErrorCode; message: string }

/** B1.9 logout report: remote effects are honestly stated - an offline
 *  signout can never claim the server revoked anything. */
export interface AuthLogoutOutcome {
  /** 'confirmed' = revoke_current_session acked; 'unconfirmed' = the
   *  request never provably landed (offline/5xx); 'skipped' = no stored
   *  game session existed to revoke. */
  serverRevoke: 'confirmed' | 'unconfirmed' | 'skipped'
  /** 'confirmed' = GoTrue logout acked; 'local-only' = the credential was
   *  cleared locally but the signout request never reached the server. */
  signout: 'confirmed' | 'local-only' | 'skipped'
}

export interface AuthService {
  authenticate(mode: AuthenticationMode, credentials?: AuthCredentials): Promise<AuthResult>
  /** Continue with the stored session: refresh the credential, then
   *  claim a fresh active game session. This is the explicit take-back
   *  path after a game-session revocation (no auto-claim loop - only
   *  the user's Continue lands here). A pending guest upgrade retries
   *  its finalization from the authoritative Auth state. */
  resumeStoredSession(): Promise<AuthResult>
  /** Anonymous -> permanent link on the SAME auth.users uuid (EXT-09):
   *  initiates the link with an EMAIL-ONLY updateUser (GoTrue rejects a
   *  combined email+password PUT on anonymous users - the email_change
   *  flow targets the empty current address). Records the pending
   *  upgrade; the linked identity stays unusable until confirmation. */
  upgradeGuest(credentials: { loginId: string }): Promise<GuestUpgradeResult>
  /** Re-run the server-side finalize for a pending upgrade - idempotent,
   *  resumable after an interruption. 'finalized' keeps the guest session
   *  and the marker: the account is not usable as registered until the
   *  password step completes, so the durable credential survives until
   *  completeUpgrade lands it (never a registered-mode lockout). */
  finalizeUpgrade(): Promise<GuestUpgradeResult>
  /** Post-finalize password set on the email-bound session: sets the
   *  password via updateUser, THEN flips mode to registered and retires
   *  the durable guest credential + pending marker. The password is used
   *  for the call only and is never persisted. */
  completeUpgrade(credentials: { password: string }): Promise<GuestUpgradeResult>
  /** B1.9: revoke the active game session, sign out of GoTrue, then clear
   *  the stored credential (durable guest record included). Always
   *  resolves; remote effects are reported per-outcome. */
  logout(): Promise<AuthLogoutOutcome>
}

export function isValidLoginId(value: string): boolean {
  return /^[a-zA-Z0-9_]{4,20}$/.test(value)
}

export function isValidPassword(value: string): boolean {
  return value.length >= 6
}
