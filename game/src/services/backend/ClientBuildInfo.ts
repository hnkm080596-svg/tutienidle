// SEAM (PR3 of beta-final): PR1 ships src/shared/build/BuildIdentity.ts as
// the canonical BuildIdentity module (PR #55, not yet merged on this base).
// Per the plan, this is the minimal local build-id struct the remote
// adapter and session claim consume until then - PR5/PR7 rewire these
// fields onto PR1's BuildIdentity; do not grow it into a second authority.
//
// What the guarded RPC surface actually consumes today:
//   - buildId      -> claim_active_session(p_build_id) + write_character_save(p_build_id)
//   - saveSchemaVersion -> the payload `version` the server schema gate accepts
// Environment/channel fields ride along for later compatibility checks
// (get_backend_status minClientVersion enforcement is server-side).

export interface ClientBuildInfo {
  buildId: string
  appVersion: string
  releaseChannel: 'development' | 'staging' | 'beta' | 'production'
  saveSchemaVersion: number
}

export interface ClientBuildEnv {
  readonly [key: string]: unknown
  VITE_BUILD_ID?: string
  VITE_APP_VERSION?: string
  VITE_RELEASE_CHANNEL?: string
  PROD?: boolean
}

const MAX_BUILD_ID_CHARS = 64

export function resolveClientBuildInfo(env: ClientBuildEnv, saveSchemaVersion: number): ClientBuildInfo {
  const channel: ClientBuildInfo['releaseChannel'] =
    env.VITE_RELEASE_CHANNEL === 'staging' || env.VITE_RELEASE_CHANNEL === 'beta' || env.VITE_RELEASE_CHANNEL === 'production'
      ? env.VITE_RELEASE_CHANNEL
      : env.PROD === true
        ? 'production'
        : 'development'

  const buildId = (env.VITE_BUILD_ID?.trim() || `${channel}-dev`).slice(0, MAX_BUILD_ID_CHARS)

  return {
    buildId,
    appVersion: env.VITE_APP_VERSION?.trim() || '0.0.0-dev',
    releaseChannel: channel,
    saveSchemaVersion,
  }
}
