/// <reference types="vite/client" />

// Beta-final B1.2 - explicit backend-mode declarations consumed by
// src/services/backend/. Missing values are `undefined` at runtime, so the
// resolver treats them as absent (never silently defaulted).
interface ImportMetaEnv {
  readonly VITE_BACKEND_MODE?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_BUILD_ID?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_RELEASE_CHANNEL?: string
  readonly VITE_PRESENTATION_DEADLINE_SCALE?: string
}

interface Window {
  __tutienPhaserGame?: import('phaser').Game
}
