import type { AuthService } from '../auth/AuthService'
import { MockAuthService } from '../auth/MockAuthService'
import { SupabaseAuthService } from '../auth/SupabaseAuthService'
import type { CharacterCreationService } from '../character/CharacterCreationService'
import { MockCharacterCreationService } from '../character/MockCharacterCreationService'
import { SupabaseCharacterCreationService } from '../character/SupabaseCharacterCreationService'
import { CloudSaveCoordinator } from '../cloudSave/CloudSaveCoordinator'
import { LocalCloudSaveService } from '../cloudSave/LocalCloudSaveService'
import { SupabaseCloudSaveService } from '../cloudSave/SupabaseCloudSaveService'
import type { CloudSaveLoadResult, CloudSaveWriteResult } from '../cloudSave/CloudSaveService'
import type { CloudSaveService } from '../cloudSave/CloudSaveService'
import { CURRENT_SAVE_VERSION } from '../save/SaveSystem'
import { resolveClientBuildInfo, type ClientBuildEnv, type ClientBuildInfo } from './ClientBuildInfo'
import { resolveBackendComposition, type BackendComposition, type BackendMode, type BackendRuntime, type BackendAdmission } from './backendMode'

// Beta-final B1.2 - the single composition root. Both modes produce ONE
// compatible bundle shape; consumers never branch on mode themselves -
// capability lives on the coordinator/service, mode lives on the bundle.

export interface BackendBundle {
  mode: BackendMode
  runtime: BackendRuntime
  /** 'blocked' on a release supabase build until PR4-6 seal the
   *  admission/journal/identity surface - testable, not launchable. */
  admission: BackendAdmission
  authService: AuthService
  characterCreationService: CharacterCreationService
  cloudSaveCoordinator: CloudSaveCoordinator
  buildInfo: ClientBuildInfo
}

export type BackendBundleResolution =
  | { status: 'ready'; bundle: BackendBundle }
  | Extract<BackendComposition, { status: 'fatal' }>

export function createBackendBundle(
  composition: BackendComposition,
  env: ClientBuildEnv = import.meta.env,
): BackendBundleResolution {
  if (composition.status === 'fatal') {
    return composition
  }

  const buildInfo = resolveClientBuildInfo(env, CURRENT_SAVE_VERSION)

  if (composition.mode === 'supabase' && composition.config) {
    return {
      status: 'ready',
      bundle: {
        mode: 'supabase',
        runtime: composition.runtime,
        admission: composition.admission,
        authService: new SupabaseAuthService(composition.config, buildInfo),
        characterCreationService: new SupabaseCharacterCreationService(composition.config),
        cloudSaveCoordinator: new CloudSaveCoordinator(
          new SupabaseCloudSaveService(composition.config, buildInfo),
        ),
        buildInfo,
      },
    }
  }

  return {
    status: 'ready',
    bundle: {
      mode: 'mock',
      runtime: composition.runtime,
      admission: composition.admission,
      authService: new MockAuthService(),
      characterCreationService: new MockCharacterCreationService(),
      cloudSaveCoordinator: new CloudSaveCoordinator(new LocalCloudSaveService()),
      buildInfo,
    },
  }
}

/** Fail-closed services for a fatal composition: every call surfaces the
 *  configuration error instead of silently fabricating a local authority. */
class UnavailableCloudSaveService implements CloudSaveService {
  readonly capability = 'local-only' as const

  constructor(private readonly message: string) {}

  async load(): Promise<CloudSaveLoadResult> {
    return { status: 'unavailable', code: 'CONFIGURATION_ERROR', message: this.message, retryable: false }
  }

  async save(): Promise<CloudSaveWriteResult> {
    return { status: 'unavailable', code: 'CONFIGURATION_ERROR', message: this.message, retryable: false }
  }
}

export function createUnavailableBackendBundle(message: string, mode: BackendMode = 'mock'): BackendBundle {
  return {
    mode,
    runtime: import.meta.env.PROD === true ? 'release' : 'development',
    admission: 'blocked',
    authService: {
      async authenticate() {
        return { ok: false, code: 'server_unavailable' as const, message }
      },
      async logout() {},
    },
    characterCreationService: {
      async rollTalents() {
        return []
      },
      async checkNameAvailable() {
        return false
      },
      validateDraft() {
        return { ok: false as const, code: 'server_unavailable' as const, message }
      },
      async createCharacter() {
        return { ok: false as const, code: 'server_unavailable' as const, message }
      },
    },
    cloudSaveCoordinator: new CloudSaveCoordinator(new UnavailableCloudSaveService(message)),
    buildInfo: resolveClientBuildInfo(import.meta.env, CURRENT_SAVE_VERSION),
  }
}

/** The resolved composition for this build, evaluated once at module
 *  init. `fatal` compositions still produce a (fail-closed) bundle so
 *  every consumer typechecks and App can render the configuration screen
 *  instead of crashing at import time. */
export const backendComposition = resolveBackendComposition(import.meta.env)

const resolved = createBackendBundle(backendComposition)

export const backendBundle: BackendBundle =
  resolved.status === 'ready'
    ? resolved.bundle
    : createUnavailableBackendBundle(
      resolved.message,
      import.meta.env.VITE_BACKEND_MODE === 'supabase' ? 'supabase' : 'mock',
    )

/** Non-null exactly when the composition is fatal - App.vue renders the
 *  fatal configuration surface before auth on it. */
export const backendFatal: { code: 'CONFIGURATION_ERROR'; message: string } | null =
  resolved.status === 'fatal' ? { code: 'CONFIGURATION_ERROR', message: resolved.message } : null
