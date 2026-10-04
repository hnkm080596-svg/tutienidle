import { getSupabaseConfig, type SupabaseConfig } from '../supabase/SupabaseConfig'

// Beta-final B1.2 - the backend bundle is composed from ONE explicit
// mode declaration, never inferred: `VITE_BACKEND_MODE = mock | supabase`.
// A release build without the declaration, with the mock bundle, or with
// supabase mode but missing credentials fails closed instead of silently
// falling back to the local adapter. This module is deliberately a pure
// resolver over an injected env shape so the whole decision matrix is
// unit-testable without touching import.meta.env.

export type BackendMode = 'mock' | 'supabase'
export type BackendRuntime = 'development' | 'release'

// 'blocked' marks infrastructure that is wired but not yet sealed for
// launch: the supabase bundle resolves, but release admission stays
// blocked until the durable journal (PR4), online admission/reconnect
// (PR5) and identity flows (PR6) land. Testable, not launchable.
export type BackendAdmission = 'admitted' | 'blocked'

export type BackendComposition =
  | {
      status: 'ready'
      mode: BackendMode
      runtime: BackendRuntime
      admission: BackendAdmission
      /** supabase mode only; absent under mock. */
      config: SupabaseConfig | null
    }
  | {
      status: 'fatal'
      code: 'CONFIGURATION_ERROR'
      message: string
    }

export interface BackendEnv {
  readonly [key: string]: unknown
  VITE_BACKEND_MODE?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
  /** Vite sets PROD only on production builds; everything else (dev
   *  server, vitest, preview of a dev build) resolves as development. */
  PROD?: boolean
}

function fatal(message: string): BackendComposition {
  return { status: 'fatal', code: 'CONFIGURATION_ERROR', message }
}

export function resolveBackendComposition(env: BackendEnv): BackendComposition {
  const runtime: BackendRuntime = env.PROD === true ? 'release' : 'development'
  const declared = env.VITE_BACKEND_MODE?.trim()

  if (!declared) {
    return runtime === 'release'
      ? fatal('VITE_BACKEND_MODE is not set — a release build must declare the backend mode explicitly.')
      : { status: 'ready', mode: 'mock', runtime, admission: 'admitted', config: null }
  }

  if (declared !== 'mock' && declared !== 'supabase') {
    return fatal(`VITE_BACKEND_MODE="${declared}" is not a supported backend mode (mock | supabase).`)
  }

  if (declared === 'mock') {
    return runtime === 'release'
      ? fatal('VITE_BACKEND_MODE=mock cannot produce a release build — the mock bundle is local-authority only.')
      : { status: 'ready', mode: 'mock', runtime, admission: 'admitted', config: null }
  }

  const config = getSupabaseConfig(env)

  if (!config) {
    return fatal('VITE_BACKEND_MODE=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  return {
    status: 'ready',
    mode: 'supabase',
    runtime,
    admission: runtime === 'release' ? 'blocked' : 'admitted',
    config,
  }
}
