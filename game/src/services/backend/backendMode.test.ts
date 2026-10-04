// Beta-final B1.2 (PR3 checkbox 1) - the explicit-mode composition
// contract. The resolver must be a pure function of the injected env so
// the full decision matrix is verifiable:
//   - absent mode/credentials in RELEASE can never instantiate mock
//   - explicit development mock keeps local behavior
//   - release admission stays BLOCKED until PR4-6 land
import { describe, expect, it } from 'vitest'
import { resolveBackendComposition } from './backendMode'
import { createBackendBundle } from './backendBundle'
import { MockAuthService } from '../auth/MockAuthService'
import { SupabaseAuthService } from '../auth/SupabaseAuthService'
import { MockCharacterCreationService } from '../character/MockCharacterCreationService'
import { SupabaseCharacterCreationService } from '../character/SupabaseCharacterCreationService'

const SUPABASE_ENV = {
  VITE_BACKEND_MODE: 'supabase',
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
} as const

describe('resolveBackendComposition - explicit mode matrix', () => {
  it('development without a mode declaration resolves the local mock bundle', () => {
    const composition = resolveBackendComposition({ PROD: false })

    expect(composition).toEqual({
      status: 'ready',
      mode: 'mock',
      runtime: 'development',
      admission: 'admitted',
      config: null,
    })
  })

  it('release without a mode declaration is FATAL - mock cannot be inferred', () => {
    const composition = resolveBackendComposition({ PROD: true })

    expect(composition.status).toBe('fatal')
    if (composition.status === 'fatal') {
      expect(composition.code).toBe('CONFIGURATION_ERROR')
      expect(composition.message).toContain('VITE_BACKEND_MODE')
    }
  })

  it('explicit development mock keeps local behavior (admitted, no config)', () => {
    const composition = resolveBackendComposition({ PROD: false, VITE_BACKEND_MODE: 'mock' })

    expect(composition).toEqual({
      status: 'ready',
      mode: 'mock',
      runtime: 'development',
      admission: 'admitted',
      config: null,
    })
  })

  it('VITE_BACKEND_MODE=mock in release is FATAL', () => {
    const composition = resolveBackendComposition({ PROD: true, VITE_BACKEND_MODE: 'mock' })

    expect(composition.status).toBe('fatal')
  })

  it('an unrecognized mode is FATAL in every runtime', () => {
    for (const prod of [false, true]) {
      const composition = resolveBackendComposition({ PROD: prod, VITE_BACKEND_MODE: 'sqlite' })
      expect(composition.status).toBe('fatal')
    }
  })

  it('supabase mode without credentials is FATAL - no partial authority', () => {
    expect(resolveBackendComposition({ PROD: false, VITE_BACKEND_MODE: 'supabase' }).status).toBe('fatal')
    expect(
      resolveBackendComposition({
        PROD: false,
        VITE_BACKEND_MODE: 'supabase',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
      }).status,
    ).toBe('fatal')
    // Release + missing credentials: same fatal composition, not a mock fallback.
    expect(resolveBackendComposition({ PROD: true, VITE_BACKEND_MODE: 'supabase' }).status).toBe('fatal')
  })

  it('development supabase with credentials resolves admitted', () => {
    const composition = resolveBackendComposition({ ...SUPABASE_ENV, PROD: false })

    expect(composition).toMatchObject({ status: 'ready', mode: 'supabase', admission: 'admitted' })
  })

  it('release supabase with credentials resolves but admission stays BLOCKED (unsealed infra)', () => {
    const composition = resolveBackendComposition({ ...SUPABASE_ENV, PROD: true })

    expect(composition).toMatchObject({
      status: 'ready',
      mode: 'supabase',
      runtime: 'release',
      admission: 'blocked',
    })
  })
})

describe('createBackendBundle - one compatible bundle per mode', () => {
  it('mock bundle: local services with local-only capability', () => {
    const composition = resolveBackendComposition({ PROD: false, VITE_BACKEND_MODE: 'mock' })
    const resolved = createBackendBundle(composition, {})

    expect(resolved.status).toBe('ready')
    if (resolved.status !== 'ready') return

    expect(resolved.bundle.mode).toBe('mock')
    expect(resolved.bundle.authService).toBeInstanceOf(MockAuthService)
    expect(resolved.bundle.characterCreationService).toBeInstanceOf(MockCharacterCreationService)
    expect(resolved.bundle.cloudSaveCoordinator.capability).toBe('local-only')
  })

  it('supabase bundle: remote-authoritative coordinator + supabase services', () => {
    const composition = resolveBackendComposition({ ...SUPABASE_ENV, PROD: false })
    const resolved = createBackendBundle(composition, {})

    expect(resolved.status).toBe('ready')
    if (resolved.status !== 'ready') return

    expect(resolved.bundle.mode).toBe('supabase')
    expect(resolved.bundle.authService).toBeInstanceOf(SupabaseAuthService)
    expect(resolved.bundle.characterCreationService).toBeInstanceOf(SupabaseCharacterCreationService)
    expect(resolved.bundle.cloudSaveCoordinator.capability).toBe('remote-authoritative')
    expect(resolved.bundle.buildInfo.saveSchemaVersion).toBeGreaterThan(0)
  })

  it('a fatal composition produces a fatal resolution, never a bundle', () => {
    const composition = resolveBackendComposition({ PROD: true, VITE_BACKEND_MODE: 'mock' })
    const resolved = createBackendBundle(composition, {})

    expect(resolved.status).toBe('fatal')
  })
})
