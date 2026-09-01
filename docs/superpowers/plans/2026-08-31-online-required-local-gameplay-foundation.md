# Online-Required Local-Gameplay Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an online-required TutienIdle startup and persistence foundation in which guest/account identity, canonical saves, server time, offline rewards, conflicts, and session ownership are server-authoritative while ordinary solo gameplay remains local.

**Architecture:** Replace the competing Main Menu/Auth boot conditions with one explicit boot coordinator. Use Supabase anonymous and registered users for identity, authenticated Edge/Database Functions for progress operations, revisioned idempotent checkpoints for canonical saves, a bounded local recovery cache for crash tolerance, and a server-owned offline settlement path. Keep local adapters as deterministic development/test doubles, not production authority.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vite, Vitest, Playwright, Phaser, Supabase Auth/Postgres/Edge Functions.

**Spec:** `docs/superpowers/specs/2026-08-31-online-required-local-gameplay-architecture-design.md`

## Global Constraints

- A server connection is mandatory; do not add a true offline mode.
- Backend selection is explicit and fail-closed: `mock` is allowed only for development/test, `local-supabase` targets loopback services, and `server` is mandatory for staging/production. A production build with missing/invalid server configuration must stop with a clear configuration error and must never fall back to mock state.
- Ordinary solo gameplay remains local and responsive; do not add per-tick server calls.
- Server time is the only authority for elapsed absence and offline rewards.
- Preserve **Play now** guest access, optional login/register, and later account linking.
- If guest and account progress both exist, show both summaries and let the player select exactly one; never merge resources or stats.
- Keep the unselected progress as a recoverable archive for 30 days.
- One player progress may have only one active write session at a time.
- Competitive tower logic, PvP, trading, guilds, and shared economy remain outside scope.
- Do not add dependencies unless a task proves the existing stack cannot provide the required behavior.
- Do not use `any`; keep network payloads as `unknown` until validated.
- Do not add save migrations for old development saves. Server payloads whose schema version differs from `CURRENT_SAVE_VERSION` must return `incompatible`.
- Before implementation, use `superpowers:using-git-worktrees` because this is a multi-file architectural change. Preserve the current uncommitted edits in `game/src/App.vue`, `game/src/components/menu/MainMenu.vue`, and the theme/component files; reconcile rather than overwrite them.
- Every UI task must invoke `ui-ux-pro-max` with Vue stack guidance before design or implementation decisions.
- Every feature/bugfix task follows `superpowers:test-driven-development`.
- Before completion, run `tutienidle-adversarial-qa` in quick mode and `superpowers:verification-before-completion`.
- Do not commit, merge, push, deploy, or apply Supabase migrations remotely. Each task ends with a review checkpoint; the user decides whether and when to commit or deploy.
- Initial operational constants: autosave `15_000ms`, reconnect grace period `90_000ms`, guest-link token lifetime `10 minutes`, progress archive retention `30 days`, offline reward cap `86_400 seconds`.

---

## File Structure Map

### Client boot and UI

- Create `game/src/services/serverStatus/MockServerStatusService.ts` — deterministic startup status fixtures with no network access.

- Modify `game/src/App.vue` — render exactly one top-level boot/game surface and delegate orchestration.
- Replace `game/src/composables/useBootFlow.ts` — typed boot state machine with guarded transitions.
- Modify `game/src/composables/useBootFlow.test.ts` — transition table and invalid-transition coverage.
- Create `game/src/components/onboarding/WelcomeAuthScreen.vue` — unified title, guest, login, register, settings, and exit surface.
- Create `game/src/components/onboarding/WelcomeAuthScreen.test.ts` — action/state/accessibility behavior.
- Create `game/src/components/onboarding/ProgressSelectionScreen.vue` — compare and confirm guest/account progress.
- Create `game/src/components/onboarding/ProgressSelectionScreen.test.ts` — explicit selection and confirmation behavior.
- Create `game/src/components/common/ConnectionGateScreen.vue` — connecting, retry, maintenance, update-required, and fatal startup states.
- Create `game/src/components/common/ReconnectOverlay.vue` — mid-session degradation, countdown, retry, and return-to-welcome actions.
- Create `game/src/services/serverStatus/ServerStatusService.ts` — unauthenticated startup health/version contract and Supabase adapter.
- Create `game/src/services/serverStatus/ServerStatusService.test.ts` — online, maintenance, update-required, timeout, and invalid-response tests.
- Modify `game/src/stores/saveIssue.ts` — distinguish recoverable local-save diagnostics from non-destructive canonical server-save failures.
- Modify `game/src/components/common/SaveIncompatibleScreen.vue` — never offer a local-only overwrite/delete action for a canonical server save.
- Modify `game/vite.config.ts` and `game/src/env.d.ts` — expose the package build version as a typed Vite constant.
- Reuse visual pieces from `game/src/components/menu/MenuBackground.vue`, `MenuLogo.vue`, and `MenuButton.vue`; remove the independent `MainMenu` render path only after the unified screen is covered.

### Client identity and transport

- Create `game/src/config/BackendMode.ts` — resolve and validate `mock|local-supabase|server` once at the application boundary.
- Create `game/src/config/BackendMode.test.ts` — environment/mode matrix, loopback validation, and production fail-closed tests.

- Modify `game/src/services/auth/AuthService.ts` — explicit restore, guest, login, register, link, logout contracts.
- Modify `game/src/services/auth/MockAuthService.ts` — deterministic local implementation.
- Modify `game/src/services/auth/SupabaseAuthService.ts` — anonymous sign-in, refresh restoration, registered login/register, and link preparation.
- Modify `game/src/services/auth/AuthServiceFactory.ts` — select adapters from the validated backend mode.
- Modify `game/src/services/auth/AuthService.test.ts` — contract/validation/session tests.
- Modify `game/src/services/supabase/SupabaseSession.ts` — durable refresh-backed session record and in-memory access token handling.
- Modify `game/src/services/supabase/SupabaseHttp.ts` — typed JSON parsing and normalized transport failures.
- Create `game/src/services/supabase/SupabaseEdge.ts` — authenticated Edge Function invocation wrapper.

### Client progress and synchronization

- Create `game/src/services/progress/ProgressService.ts` — progress load, summary, selection, checkpoint, offline claim contracts.
- Create `game/src/services/progress/LocalProgressService.ts` — development/test double implementing the same contract.
- Create `game/src/services/progress/SupabaseProgressService.ts` — server adapter.
- Create `game/src/services/progress/ProgressServiceFactory.ts` — production/local selection.
- Create `game/src/services/progress/ProgressPayloadValidation.ts` — runtime validation of server responses.
- Create `game/src/services/progress/RecoveryCache.ts` — bounded local pending-checkpoint cache.
- Create `game/src/services/progress/RecoveryCache.test.ts` — corrupt/mismatched/acknowledged cache behavior.
- Create `game/src/services/progress/ProgressSyncCoordinator.ts` — serialized checkpointing, retry, revision, and recovery.
- Create `game/src/services/progress/ProgressSyncCoordinator.test.ts` — idempotency, overlap, timeout, conflict, and recovery tests.
- Retire `game/src/services/cloudSave/*` only after all consumers move to `services/progress`; retain compatibility exports temporarily if needed during intermediate tasks.

### Client runtime and connectivity

- Create `game/src/services/connectivity/MockConnectivityTransport.ts` — deterministic no-network heartbeat/transfer controls for mock mode.
- Create `game/src/services/connectivity/MockConnectivityTransport.test.ts` — success, failure, recovery, and session-transfer fixtures without fetch.

- Create `game/src/core/game/createConfiguredGameManager.ts` — one production registry setup function extracted from `App.vue`.
- Create `game/src/composables/useGameRuntime.ts` — restore/create runtime, tick lifecycle, autosave hooks, and clean shutdown.
- Create `game/src/composables/useGameRuntime.test.ts` — fake-clock lifecycle and pause/resume tests.
- Modify `game/src/components/onboarding/CharacterCreationScreen.vue` — collect and emit a validated draft; do not create an empty canonical save from inside the component.
- Modify `game/src/services/character/CharacterCreationService.ts` — separate talent/name validation from atomic progress creation.
- Modify `game/src/services/character/SupabaseCharacterCreationService.ts` — retain server talent roll/name checks; route final creation through progress service.
- Create `game/src/stores/connectivity.ts` — one connection state and grace-period deadline.
- Create `game/src/services/connectivity/ConnectivityMonitor.ts` — heartbeat/retry policy using injected timers/fetcher.
- Create `game/src/services/connectivity/ConnectivityMonitor.test.ts` — degraded/recovered/expired behavior.
- Modify `game/src/stores/player.ts` — restore canonical player data without calculating offline time locally.
- Modify `game/src/core/game/GameManager.ts` — restore canonical subsystem state without settling offline against `Date.now()`.
- Modify `game/src/stores/offlineSummary.ts` and `game/src/components/common/OfflineSummaryModal.vue` — consume server-returned summary.

### Supabase server

- Create `game/supabase/migrations/202608310001_progress_foundation.sql` — progress metadata, idempotency, archive/link records, RLS, and transactional RPCs.
- Create `game/supabase/functions/progress-session/index.ts` — authenticated load/resume/checkpoint/select dispatcher.
- Create `game/supabase/functions/game-status/index.ts` — public read-only startup status/config endpoint.
- Create `game/supabase/functions/progress-session/deno.json` — isolated pinned Edge Function imports.
- Create `game/supabase/functions/_shared/progressTypes.ts` — server request/response contracts.
- Create `game/supabase/functions/_shared/saveVersion.ts` — deployed server save schema version accepted by the function.
- Create `game/supabase/functions/_shared/progressValidation.ts` — schema and foundational bounds.
- Create `game/supabase/functions/_shared/progressSummary.ts` — derive comparison metadata from validated canonical saves.
- Create `game/supabase/functions/_shared/contentManifest.json` — server-owned allowed IDs used by checkpoint validation.
- Create `game/supabase/functions/_shared/offlineRules.ts` — server-owned production/alchemy rule snapshots used for offline settlement.
- Create `game/supabase/functions/_shared/offlineSettlement.ts` — server-only offline reward settlement.
- Create `game/supabase/functions/tests/progress-validation-test.ts` — Deno unit tests.
- Create `game/supabase/functions/tests/offline-settlement-test.ts` — deterministic offline settlement tests.
- Create `game/supabase/functions/tests/progress-session-test.ts` — authenticated function integration tests against local Supabase.
- Create `game/src/data/serverContentParity.test.ts` — fail when client registries and deployed server manifest/rules drift.
- Modify `game/supabase/config.toml` if present after `supabase init`; keep `verify_jwt = true` for `progress-session`.

### End-to-end coverage and docs

- Modify `game/package.json` — explicit mock/local/server development and build scripts with release-safe defaults.

- Modify `game/tests/e2e/helpers.ts` — deterministic mock server/session helpers without secret access.
- Modify `game/tests/e2e/boot-fresh.spec.ts` — unified welcome and guest boot.
- Modify `game/tests/e2e/save-reload.spec.ts` — canonical server-style reload behavior.
- Create `game/tests/e2e/auth-progress-selection.spec.ts` — two-progress selection.
- Create `game/tests/e2e/reconnect.spec.ts` — degradation and recovery.
- Create `game/docs/online-session-and-save.md` — operations, local development, state diagram, and failure semantics.
- Modify `game/src/components/panels/SettingsPanel.vue` and its tests — account status, link/switch/logout entry points, and archived-progress recovery.

---

### Task 1: Establish Typed Boot State Machine Contracts

**Files:**
- Modify: `game/src/composables/useBootFlow.ts`
- Modify: `game/src/composables/useBootFlow.test.ts`
- Create: `game/src/services/progress/ProgressService.ts`

**Interfaces:**
- Produces: `BootStage`, `BootEvent`, `BootContext`, `useBootFlow()`, `ProgressSummary`, `ProgressLoadResult`, `OfflineSummaryData`, `SaveCheckpointRequest`, `SaveCheckpointResult`.
- Consumes: `GameSave`, `AuthSession`, `CURRENT_SAVE_VERSION`.

- [ ] **Step 1: Write failing transition-table tests**

```ts
import { describe, expect, it } from 'vitest'
import { useBootFlow } from './useBootFlow'

describe('useBootFlow', () => {
  it('follows the new guest startup path', () => {
    const flow = useBootFlow()
    expect(flow.stage.value).toBe('connecting')
    flow.send({ type: 'SERVER_READY' })
    flow.send({ type: 'PLAY_AS_GUEST' })
    flow.send({ type: 'AUTHENTICATED' })
    flow.send({ type: 'PROGRESS_EMPTY' })
    expect(flow.stage.value).toBe('character-creation')
  })

  it('rejects game entry before progress is loaded', () => {
    const flow = useBootFlow()
    expect(() => flow.send({ type: 'GAME_READY' })).toThrowError('Invalid boot transition')
  })
})
```

- [ ] **Step 2: Run the focused test and confirm the old flow fails**

Run: `npm.cmd run test -- src/composables/useBootFlow.test.ts`

Expected: FAIL because the old stage starts at `intro` and exposes imperative helpers instead of `send()`.

- [ ] **Step 3: Define exact progress contracts**

```ts
export interface ProgressSummary {
  progressId: string
  source: 'guest' | 'account'
  characterName: string
  realmLabel: string
  combatPower: number
  totalPlaySeconds: number
  updatedAt: string
}

export interface ProgressArchiveSummary extends ProgressSummary {
  archiveId: string
  archivedAt: string
  expiresAt: string
}

export interface OfflineSummaryData {
  elapsedSeconds: number
  cultivation: number
  materials: Array<{ materialId: string; amount: number }>
  pills: Array<{ pillId: string; amount: number }>
}

export interface ProgressEnvelope {
  progressId: string
  save: GameSave
  revision: number
  configVersion: number
  serverNow: string
  lastServerSeenAt: string
}

export type ProgressLoadResult =
  | { status: 'empty'; revision: 0; serverNow: string }
  | { status: 'ok'; envelope: ProgressEnvelope }
  | { status: 'incompatible'; foundVersion: number | undefined; supportId: string }
  | { status: 'corrupted'; supportId: string }
  | { status: 'unavailable'; message: string; retryable: boolean }

export type ProgressResumeResult =
  | { status: 'empty'; revision: 0; serverNow: string }
  | { status: 'ok'; envelope: ProgressEnvelope; offlineSummary: OfflineSummaryData | null }
  | Exclude<ProgressLoadResult, { status: 'empty' | 'ok' }>

export type ProgressSummariesResult =
  | { status: 'ok'; summaries: ProgressSummary[] }
  | { status: 'link-expired' }
  | { status: 'unavailable'; message: string; retryable: boolean }

export interface SaveCheckpointRequest {
  expectedRevision: number
  requestId: string
  sessionId: string
  configVersion: number
  snapshot: GameSave
}

export type SaveCheckpointResult =
  | { status: 'ok'; revision: number; requestId: string }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'incompatible'; expectedVersion: number }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string; retryable: boolean }

export interface RestoreArchiveRequest {
  archiveId: string
  expectedRevision: number
  requestId: string
}

export interface CreateCharacterRequest {
  draft: CharacterCreationDraft
  initialSave: GameSave
  requestId: string
}

export type CreateCharacterResult =
  | { status: 'ok'; characterId: string; progressId: string; revision: number }
  | { status: 'name-taken'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string; retryable: boolean }

export interface SelectProgressRequest {
  selectedProgressId: string
  guestLinkToken: string
  requestId: string
}

export type SelectProgressResult =
  | { status: 'ok'; envelope: ProgressEnvelope; archivedProgressId: string }
  | { status: 'conflict' | 'link-expired'; message: string }
  | { status: 'unavailable'; message: string; retryable: boolean }

export type RestoreArchiveResult =
  | { status: 'ok'; envelope: ProgressEnvelope; archivedCurrentProgressId: string }
  | { status: 'conflict'; currentRevision: number }
  | { status: 'expired' | 'not-found'; message: string }
  | { status: 'unavailable'; message: string; retryable: boolean }

export interface ProgressService {
  load(): Promise<ProgressLoadResult>
  resume(requestId: string): Promise<ProgressResumeResult>
  getSummaries(guestLinkToken?: string): Promise<ProgressSummariesResult>
  createCharacter(request: CreateCharacterRequest): Promise<CreateCharacterResult>
  checkpoint(request: SaveCheckpointRequest): Promise<SaveCheckpointResult>
  selectProgress(request: SelectProgressRequest): Promise<SelectProgressResult>
  listArchives(): Promise<ProgressArchiveSummary[]>
  restoreArchive(request: RestoreArchiveRequest): Promise<RestoreArchiveResult>
}
```

- [ ] **Step 4: Implement a guarded state reducer**

Use one transition map rather than independent booleans:

```ts
export type BootStage =
  | 'connecting'
  | 'welcome'
  | 'authenticating'
  | 'resolving-progress'
  | 'selecting-progress'
  | 'character-creation'
  | 'loading-game'
  | 'game'
  | 'reconnecting'
  | 'maintenance'
  | 'update-required'
  | 'save-incompatible'
  | 'error'

const transitions: Partial<Record<BootStage, Partial<Record<BootEvent['type'], BootStage>>>> = {
  connecting: { SERVER_READY: 'welcome', SERVER_MAINTENANCE: 'maintenance', UPDATE_REQUIRED: 'update-required', FAILED: 'error' },
  welcome: { PLAY_AS_GUEST: 'authenticating', LOGIN: 'authenticating', REGISTER: 'authenticating' },
  authenticating: { AUTHENTICATED: 'resolving-progress', FAILED: 'welcome' },
  'resolving-progress': { PROGRESS_EMPTY: 'character-creation', PROGRESS_READY: 'loading-game', MULTIPLE_PROGRESS: 'selecting-progress', SAVE_INCOMPATIBLE: 'save-incompatible', FAILED: 'error' },
  'selecting-progress': { PROGRESS_SELECTED: 'loading-game', BACK: 'welcome', FAILED: 'error' },
  'character-creation': { CHARACTER_CREATED: 'loading-game', BACK: 'welcome', FAILED: 'error' },
  'loading-game': { GAME_READY: 'game', SAVE_INCOMPATIBLE: 'save-incompatible', FAILED: 'error' },
  game: { CONNECTION_LOST: 'reconnecting', LOGOUT: 'welcome', FAILED: 'error' },
  reconnecting: { CONNECTION_RESTORED: 'game', RETURN_TO_WELCOME: 'welcome', FAILED: 'error' },
}
```

- [ ] **Step 5: Run focused tests and type-check**

Run: `npm.cmd run test -- src/composables/useBootFlow.test.ts`

Run: `npm.cmd run type-check`

Expected: both PASS.

- [ ] **Step 6: Review checkpoint**

Run: `git diff --check -- game/src/composables/useBootFlow.ts game/src/composables/useBootFlow.test.ts game/src/services/progress/ProgressService.ts`

Confirm no existing `App.vue` behavior has been changed yet.

---

### Task 2: Make Guest and Account Sessions Restorable

**Files:**
- Modify: `game/package.json`
- Modify: `game/vite.config.ts`
- Modify: `game/src/env.d.ts`
- Create: `game/src/config/BackendMode.ts`
- Create: `game/src/config/BackendMode.test.ts`
- Modify: `game/src/services/auth/AuthService.ts`
- Modify: `game/src/services/auth/MockAuthService.ts`
- Modify: `game/src/services/auth/SupabaseAuthService.ts`
- Modify: `game/src/services/auth/AuthService.test.ts`
- Modify: `game/src/services/supabase/SupabaseSession.ts`
- Modify: `game/src/services/supabase/SupabaseHttp.ts`
- Create: `game/src/services/supabase/SupabaseEdge.ts`

**Interfaces:**
- Produces: `BackendMode`, `resolveBackendMode()`, `BackendConfigurationError`, `AuthSession`, `SessionResult`, `AuthService.restoreSession()`, `playAsGuest()`, `login()`, `register()`, `prepareGuestLink()`, `logout()`.
- Consumes: `SupabaseConfig`, `requestSupabase()`.

- [ ] **Step 1: Write failing backend-mode matrix tests**

```ts
describe('resolveBackendMode', () => {
  it.each(['development', 'test'])('defaults %s to mock', (viteMode) => {
    expect(resolveBackendMode({ viteMode, requestedMode: undefined, supabaseConfig: null })).toBe('mock')
  })

  it('accepts local-supabase only with loopback configuration', () => {
    expect(resolveBackendMode({
      viteMode: 'development',
      requestedMode: 'local-supabase',
      supabaseConfig: { url: 'http://127.0.0.1:54321', publishableKey: 'test-key' },
    })).toBe('local-supabase')
  })

  it('rejects missing server configuration in production', () => {
    expect(() => resolveBackendMode({
      viteMode: 'production',
      requestedMode: 'server',
      supabaseConfig: null,
    })).toThrow(BackendConfigurationError)
  })

  it('rejects mock mode in production', () => {
    expect(() => resolveBackendMode({
      viteMode: 'production',
      requestedMode: 'mock',
      supabaseConfig: null,
    })).toThrow(BackendConfigurationError)
  })
})
```

- [ ] **Step 2: Implement one fail-closed backend-mode resolver**

```ts
export type BackendMode = 'mock' | 'local-supabase' | 'server'

export interface BackendModeInput {
  viteMode: string
  requestedMode?: string
  supabaseConfig: SupabaseConfig | null
}

export function resolveBackendMode(input: BackendModeInput): BackendMode {
  // test/development defaults to mock; explicit local-supabase requires
  // localhost, 127.0.0.1, or [::1]; production requires server config.
}
```

Throw `BackendConfigurationError` for unknown modes, non-loopback `local-supabase`, missing server configuration, any production request for `mock`, or a production `server` endpoint that is not HTTPS/non-loopback. Add matrix cases for `localhost`, `127.0.0.1`, `[::1]`, malformed URLs, and forbidden production loopback. Do not log URLs, keys, or raw environment values. Resolve the mode once during composition and inject it; feature services must not independently reinterpret environment variables.

Add cross-platform scripts using Vite modes rather than shell-specific environment assignment:

```json
{
  "dev": "npm run dev:mock",
  "dev:mock": "vite --mode mock",
  "dev:local": "vite --mode local-supabase",
  "dev:server": "vite --mode server",
  "build:mock": "run-p type-check build-only:mock",
  "build-only:mock": "vite build --mode mock"
}
```

Keep the existing `build` command as the release/server build and keep `dist:win` calling only `build`. The resolver treats Vite modes `mock` and `local-supabase` as explicit requests. Do not add a dependency solely to set environment variables.

At Vite configuration time, call `loadEnv(mode, process.cwd(), 'VITE_')`, build the public `SupabaseConfig` through the existing config parser, and pass it to the same pure resolver. This makes `vite build` fail before emitting release assets when server configuration is absent or invalid. Never print the loaded values. Type only `VITE_BACKEND_MODE` and the existing public Supabase fields in `env.d.ts`.

- [ ] **Step 3: Write failing auth contract tests**

```ts
it('restores a persisted guest with a refreshed access token', async () => {
  storage.setItem(SESSION_KEY, JSON.stringify({
    refreshToken: 'refresh-1',
    sessionId: 'session-1',
    playerId: 'player-1',
    identityKind: 'guest',
  }))
  transport.reply('/auth/v1/token?grant_type=refresh_token', {
    access_token: 'access-2',
    refresh_token: 'refresh-2',
    expires_in: 3600,
    user: { id: 'player-1', is_anonymous: true },
  })

  const result = await service.restoreSession()

  expect(result).toMatchObject({ ok: true, session: { playerId: 'player-1', identityKind: 'guest' } })
})

it('clears a rejected refresh credential', async () => {
  storage.setItem(SESSION_KEY, '{"refreshToken":"expired","sessionId":"s","playerId":"p","identityKind":"guest"}')
  transport.reject(401)
  expect(await service.restoreSession()).toEqual({ ok: false, code: 'session_expired' })
  expect(storage.getItem(SESSION_KEY)).toBeNull()
})
```

- [ ] **Step 4: Run tests and verify failure**

Run: `npm.cmd run test -- src/config/BackendMode.test.ts src/services/auth/AuthService.test.ts`

Expected: FAIL because backend-mode validation, `restoreSession()`, and durable session metadata do not exist.

- [ ] **Step 5: Replace the ambiguous authenticate-only contract**

```ts
export interface AuthSession {
  playerId: string
  sessionId: string
  identityKind: 'guest' | 'account'
  loginId?: string
  accessToken: string
  expiresAt: number
}

export interface AuthService {
  restoreSession(): Promise<SessionResult>
  playAsGuest(): Promise<AuthResult>
  login(credentials: AuthCredentials): Promise<AuthResult>
  register(credentials: AuthCredentials): Promise<AuthResult>
  prepareGuestLink(): Promise<GuestLinkPreparationResult>
  logout(): Promise<void>
}
```

Keep `authenticate()` only as a short-lived compatibility wrapper until `AuthEntryScreen` consumers migrate; delete it in Task 8.

- [ ] **Step 6: Persist only restorable session material**

```ts
export interface StoredSupabaseSession {
  refreshToken: string
  sessionId: string
  playerId: string
  identityKind: 'guest' | 'account'
  loginId?: string
}

const SESSION_KEY = 'tien-hiep-idle-auth-session-v2'
```

Store this record in `localStorage` so guest sessions survive application restart. Keep the short-lived access token in the returned in-memory `AuthSession`; rotate the stored refresh token after every successful refresh. Never store the password.

`SupabaseSession.ts` also exposes `setActiveSupabaseSession(session)`, `readActiveSupabaseSession()`, and `clearActiveSupabaseSession()` for the current process. The active record contains the access token; the durable record does not. Progress/character services obtain auth through `readActiveSupabaseSession()` rather than importing Auth UI state.

- [ ] **Step 7: Implement Supabase flows with current HTTP helper**

Use:

```text
Guest:    POST /auth/v1/signup with { data: { account_kind: 'guest' } }
Login:    POST /auth/v1/token?grant_type=password
Register: POST /auth/v1/signup with generated account email + password
Restore:  POST /auth/v1/token?grant_type=refresh_token with refresh_token
```

After every successful auth/refresh, call `claim_active_session` and normalize `user.is_anonymous` to `identityKind`.

- [ ] **Step 8: Add typed Edge invocation**

```ts
export async function requestSupabaseEdge<T>(
  config: SupabaseConfig,
  functionName: string,
  body: unknown,
  accessToken: string,
): Promise<T> {
  return requestSupabase<T>(config, `/functions/v1/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, accessToken)
}
```

Normalize invalid JSON and fetch rejection in `SupabaseHttp.ts` to typed `SupabaseHttpError` instances without exposing response secrets.

- [ ] **Step 9: Run focused auth tests and type-check**

Run: `npm.cmd run test -- src/config/BackendMode.test.ts src/services/auth/AuthService.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 10: Review checkpoint**

Verify the diff contains no passwords, service-role keys, `.env` contents, or logs of access/refresh tokens.

---

### Task 3: Add Server Progress Schema, Idempotency, and Archive Records

**Files:**
- Create: `game/supabase/migrations/202608310001_progress_foundation.sql`

**Interfaces:**
- Produces database relations `progress_requests`, `progress_archives`, `guest_link_tokens`; extends `character_saves`; produces RPCs `load_progress_envelope`, `save_progress_checkpoint`, `prepare_guest_link`, `get_progress_summaries`, `select_progress_source`.
- Consumes existing `profiles`, `account_sessions`, `characters`, `character_saves`, `assert_active_session()`.

- [ ] **Step 1: Write migration assertions before migration implementation**

Create SQL assertions at the bottom of the local verification script used for development:

```sql
begin;
select public.assert_active_session('00000000-0000-0000-0000-000000000000'::uuid);
rollback;
```

For automated integration, Task 13 will replace the fixed UUID with seeded users and assert unauthorized, duplicate request, conflict, and archive behavior through the local Supabase REST API.

- [ ] **Step 2: Extend canonical save metadata**

```sql
alter table public.character_saves
  add column if not exists config_version integer not null default 1,
  add column if not exists last_server_seen_at timestamptz not null default now();
```

Do not add migration logic for older `GameSave.version` payloads; the checkpoint/load functions reject mismatched schema versions.

- [ ] **Step 3: Add idempotency and archive tables**

```sql
create table public.progress_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_kind text not null check (request_kind in ('checkpoint','offline_claim','progress_select')),
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create table public.progress_archives (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null check (source_kind in ('guest','account')),
  character_snapshot jsonb not null,
  save_snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create table public.guest_link_tokens (
  token_hash text primary key,
  guest_user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz
);
```

- [ ] **Step 4: Add least-privilege RLS and function permissions**

Enable RLS on all three tables. Allow authenticated users to read only their own archive metadata. Do not create direct insert/update policies for `character_saves`, `progress_requests`, `progress_archives`, or link tokens. Mutations occur through restricted functions/Edge server credentials.

Every `security definer` function must use `set search_path = ''` and schema-qualified relation names. Revoke execution from `public` and `anon`; grant only the exact authenticated entry functions.

- [ ] **Step 5: Reconcile the existing one-talent client rule with the server schema**

The current client constant is `CHARACTER_CREATION_TALENT_COUNT = 1`, while the old migration requires three talents. Drop and replace the old `characters_three_talents` constraint and replace `create_character` validation so the server requires exactly one distinct talent from the active nine-talent roll:

```sql
alter table public.characters drop constraint if exists characters_three_talents;
alter table public.characters
  add constraint characters_one_talent check (cardinality(selected_talent_ids) = 1);
```

The replacement `create_character` function must also require `cardinality(p_talent_ids) = 1`. Add a local integration assertion that one selected rolled talent succeeds and zero, two, or forged talents fail.

- [ ] **Step 6: Add shape-validation SQL helper**

```sql
create or replace function public.is_valid_checkpoint_payload(p_payload jsonb, p_schema_version integer)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_payload) = 'object'
    and (p_payload->>'version')::integer = p_schema_version
    and jsonb_typeof(p_payload->'player') = 'object'
    and jsonb_typeof(p_payload->'materials') = 'array'
    and jsonb_typeof(p_payload->'equipment') = 'array'
    and coalesce((p_payload#>>'{player,cultivation}')::numeric, -1) >= 0
    and coalesce((p_payload#>>'{player,cultivationRequired}')::numeric, -1) > 0;
$$;
```

Use guarded casts in the final SQL (`jsonb_typeof` checks before numeric casts) so malformed JSON returns `false` rather than aborting the transaction.

- [ ] **Step 7: Add atomic checkpoint RPC**

The function must:

1. call `assert_active_session`;
2. return the recorded response for duplicate `(auth.uid(), request_id)`;
3. lock the active `character_saves` row `for update`;
4. compare `save_revision` to `p_expected_revision`;
5. validate schema/config/payload;
6. update payload, revision, and server timestamps;
7. insert the response into `progress_requests`;
8. return that response.

Use a JSON result with discriminated `status` values matching `SaveCheckpointResult`.

- [ ] **Step 8: Add guest-link preparation and progress-selection transaction**

`prepare_guest_link` stores only `digest(raw_token, 'sha256')`; the raw one-time token is returned once. `select_progress_source` consumes the token, locks both candidate saves, archives the unselected candidate, transfers/copies the selected character+save to the account owner, revokes the guest gameplay session, and records the idempotent response.

Add `list_progress_archives` and `restore_progress_archive` RPCs. Restore must lock the current canonical save, archive it first, restore the selected unexpired archive, mark the restored archive consumed, increment revision, and return an idempotent response. Expired archives are never restored.

- [ ] **Step 9: Validate migration locally without remote deployment**

Run, if the Supabase CLI and local Docker runtime are already available:

`supabase db reset --workdir game`

Expected: both migrations apply successfully and all functions are created.

If local Supabase is unavailable, run static SQL review now and record local integration verification as an explicit execution blocker for Tasks 6, 7, and 13; do not deploy remotely as a workaround.

- [ ] **Step 10: Review checkpoint**

Run: `git diff --check -- game/supabase/migrations/202608310001_progress_foundation.sql`

Verify every privileged function has explicit revoke/grant statements and fixed `search_path`.

---

### Task 4: Implement Progress Payload Validation and Adapters

**Files:**
- Create: `game/src/services/progress/ProgressPayloadValidation.ts`
- Create: `game/src/services/progress/ProgressPayloadValidation.test.ts`
- Create: `game/src/services/progress/LocalProgressService.ts`
- Create: `game/src/services/progress/LocalProgressService.test.ts`
- Create: `game/src/services/progress/SupabaseProgressService.ts`
- Create: `game/src/services/progress/ProgressServiceFactory.ts`
- Modify: `game/src/services/auth/AuthServiceFactory.ts`

**Interfaces:**
- Produces: `parseProgressEnvelope()`, `parseProgressSummaries()`, `parseProgressArchives()`, `LocalProgressService`, `SupabaseProgressService`, `progressService`.
- Consumes: Task 1 progress contracts; Task 2 auth session access; Task 3 server/RPC result shapes.

- [ ] **Step 1: Write failing runtime-validation tests**

```ts
it('rejects a successful envelope without a numeric revision', () => {
  expect(parseProgressEnvelope({ status: 'ok', revision: '7', save: {} })).toEqual({
    status: 'invalid-response',
    message: 'Progress response has an invalid revision.',
  })
})

it('accepts an empty progress response', () => {
  expect(parseProgressEnvelope({ status: 'empty', revision: 0, serverNow: '2026-08-31T00:00:00Z' }))
    .toMatchObject({ status: 'empty', revision: 0 })
})
```

- [ ] **Step 2: Run validation tests and verify failure**

Run: `npm.cmd run test -- src/services/progress/ProgressPayloadValidation.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Implement explicit unknown-to-domain parsing**

Use type guards for records, strings, finite safe integers, ISO timestamps, arrays, and `validateGameSaveShape()`. Do not cast a server payload directly to `GameSave`.

- [ ] **Step 4: Write LocalProgressService contract tests**

Cover:

- empty load;
- successful checkpoint increments revision;
- duplicate `requestId` returns the same revision;
- stale expected revision returns conflict;
- `claimOfflineProgress` uses an injected server clock, not `Date.now()`;
- progress selection returns two summaries without merging.

- [ ] **Step 5: Implement LocalProgressService as a development fake**

Constructor dependencies:

```ts
interface LocalProgressServiceOptions {
  storage: Storage
  now: () => number
}
```

Use versioned local keys ending in `-progress-v1`, `-requests-v1`, and `-session-v1`. This adapter mimics server revision/idempotency semantics but remains clearly named `LocalProgressService` and is never selected when valid Supabase configuration exists.

- [ ] **Step 6: Implement SupabaseProgressService**

Map methods to one authenticated Edge Function with an operation discriminator:

```ts
await requestSupabaseEdge<unknown>(config, 'progress-session', {
  operation: 'checkpoint',
  request,
}, session.accessToken)
```

Parse every response through Task 4 validators before returning it.

Implement `listArchives()` and `restoreArchive({ archiveId, expectedRevision, requestId })` on both adapters. The local adapter must reproduce the same 30-day expiry and archive-current-before-restore semantics as the server.

- [ ] **Step 7: Implement backend-mode factories**

```ts
const backendMode = resolveBackendMode({
  viteMode: import.meta.env.MODE,
  requestedMode: import.meta.env.VITE_BACKEND_MODE,
  supabaseConfig: config,
})

export const progressService: ProgressService = backendMode === 'mock'
  ? new LocalProgressService({ storage: localStorage, now: () => Date.now() })
  : new SupabaseProgressService(requireSupabaseConfig(config), readActiveSupabaseSession)
```

Use the same resolved `BackendMode` for Auth, Character Creation, Server Status, Progress, and Connectivity so one process cannot mix mock identity with real saves or real auth with mock heartbeats. `local-supabase` and `server` both use Supabase adapters; their difference is validated endpoint scope. Do not read or expose environment values outside the config/composition boundary.

- [ ] **Step 8: Run focused tests and type-check**

Run: `npm.cmd run test -- src/services/progress/ProgressPayloadValidation.test.ts src/services/progress/LocalProgressService.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 9: Review checkpoint**

Confirm `CloudSaveServiceFactory.ts` consumers have not yet been switched; this task introduces the new adapter safely before integration.

---

### Task 5: Build Recovery Cache and Serialized Sync Coordinator

**Files:**
- Create: `game/src/services/progress/RecoveryCache.ts`
- Create: `game/src/services/progress/RecoveryCache.test.ts`
- Create: `game/src/services/progress/ProgressSyncCoordinator.ts`
- Create: `game/src/services/progress/ProgressSyncCoordinator.test.ts`

**Interfaces:**
- Produces: `RecoveryCacheStore`, `ProgressSyncCoordinator.load()`, `checkpoint()`, `recoverPending()`, `getRevision()`, `resetForNewProgress()`.
- Consumes: `ProgressService`, `GameSave`, Task 1 checkpoint contracts.

- [ ] **Step 1: Write recovery-cache tests**

```ts
it('keeps pending data until the matching request is acknowledged', () => {
  cache.write({ baseRevision: 4, requestId: 'r-1', sessionId: 's-1', configVersion: 1, snapshot, savedAt: 100 })
  cache.acknowledge('r-2')
  expect(cache.read()).not.toBeNull()
  cache.acknowledge('r-1')
  expect(cache.read()).toBeNull()
})

it('discards malformed local cache without throwing', () => {
  storage.setItem(RECOVERY_CACHE_KEY, '{broken')
  expect(cache.read()).toBeNull()
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm.cmd run test -- src/services/progress/RecoveryCache.test.ts`

- [ ] **Step 3: Implement bounded cache**

Store exactly one pending full snapshot in the first release. Reject cache entries whose serialized size exceeds `2_000_000` bytes and return a typed diagnostic instead of filling local storage.

- [ ] **Step 4: Write sync concurrency/idempotency tests**

```ts
it('coalesces overlapping checkpoint calls into one in-flight write', async () => {
  const first = coordinator.checkpoint(snapshotA)
  const second = coordinator.checkpoint(snapshotB)
  service.resolveCheckpoint({ status: 'ok', revision: 8, requestId: service.lastRequestId })
  await Promise.all([first, second])
  expect(service.maxConcurrentWrites).toBe(1)
  expect(service.snapshots.at(-1)).toEqual(snapshotB)
})

it('does not auto-retry a revision conflict as last-writer-wins', async () => {
  service.nextCheckpoint = { status: 'conflict', currentRevision: 11 }
  expect(await coordinator.checkpoint(snapshotA)).toEqual({ status: 'conflict', currentRevision: 11 })
  expect(service.checkpointCalls).toBe(1)
})
```

- [ ] **Step 5: Implement serialized checkpointing**

Rules:

- generate one UUID `requestId` per logical checkpoint;
- persist recovery cache before network send;
- allow only one network write;
- coalesce later local changes into one follow-up checkpoint;
- retry `unavailable && retryable` with the same `requestId`;
- never auto-overwrite on conflict;
- clear only the acknowledged matching cache;
- expose conflict and unavailable results to boot/connectivity orchestration.

- [ ] **Step 6: Implement crash recovery**

`recoverPending()` first loads canonical revision. It resubmits the pending checkpoint only when `baseRevision` still matches. If the server is already at the recorded accepted revision for the same request, acknowledge and clear. If canonical revision diverged, return a conflict without applying local data.

- [ ] **Step 7: Run focused tests and type-check**

Run: `npm.cmd run test -- src/services/progress/RecoveryCache.test.ts src/services/progress/ProgressSyncCoordinator.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 8: Review checkpoint**

Verify that the existing `CloudSaveCoordinator` last-writer-wins retry behavior is not copied into the new coordinator.

---

### Task 6: Implement Authenticated Server Progress Function

**Files:**
- Create: `game/supabase/functions/progress-session/index.ts`
- Create: `game/supabase/functions/progress-session/deno.json`
- Create: `game/supabase/functions/_shared/progressTypes.ts`
- Create: `game/supabase/functions/_shared/saveVersion.ts`
- Create: `game/supabase/functions/_shared/progressValidation.ts`
- Create: `game/supabase/functions/_shared/progressSummary.ts`
- Create: `game/supabase/functions/_shared/contentManifest.json`
- Create: `game/supabase/functions/_shared/offlineRules.ts`
- Create: `game/supabase/functions/tests/progress-validation-test.ts`
- Create: `game/src/data/serverContentParity.test.ts`
- Modify/Create: `game/supabase/config.toml`

**Interfaces:**
- Produces Edge operations `load`, `summaries`, `checkpoint`, `prepare-guest-link`, `select-progress`, `list-archives`, `restore-archive`.
- Consumes Task 3 RPCs and Task 4 client payload shapes.

- [ ] **Step 1: Create pure validation tests**

```ts
Deno.test('checkpoint validation rejects a negative cultivation value', () => {
  const candidate = structuredClone(validSave)
  candidate.player.cultivation = -1
  assertEquals(validateCheckpoint(candidate, CURRENT_SERVER_SAVE_VERSION).ok, false)
})

Deno.test('checkpoint validation rejects unknown top-level array shapes', () => {
  const candidate = { ...validSave, materials: {} }
  assertEquals(validateCheckpoint(candidate, CURRENT_SERVER_SAVE_VERSION).ok, false)
})
```

- [ ] **Step 2: Run Deno tests and verify failure**

Run: `deno test game/supabase/functions/tests/progress-validation-test.ts --allow-env`

Expected: FAIL because shared validation is absent.

- [ ] **Step 3: Implement foundational server validation**

Validate:

- exact schema version;
- required top-level arrays/objects;
- finite non-negative cultivation/resources;
- cultivation not above `cultivationRequired`;
- realm level integer and positive;
- all stack amounts integer and non-negative;
- duplicate inventory instance IDs rejected;
- known identifier membership using server-owned content sets;
- bounded gain against the previously stored snapshot and server elapsed time.

Return `{ ok: false, code, message }`; never echo the entire rejected save to logs or responses.

Define `CURRENT_SERVER_SAVE_VERSION = 54` in `_shared/saveVersion.ts` for the initial function task and reject all other versions. Task 7 increments both the client `CURRENT_SAVE_VERSION` and server constant together when adding deterministic alchemy seeds. Add a verification test that imports both constants in local source and fails if they diverge before deployment.

Populate `contentManifest.json` with sorted allowed IDs for every save-backed registry validated in the first release: materials, equipment definitions, skills, techniques, pills, buildings, stages, zones, quests, progression nodes, talents, and recipes. `serverContentParity.test.ts` imports the manifest plus the real client data modules and compares sorted sets. Updating gameplay data without updating the server manifest must fail the normal Vitest suite.

Derive `ProgressSummary` from the validated canonical payload in `progressSummary.ts`. Character name, realm, play time, and update timestamp come from canonical fields/database metadata. Combat power is display-only here but must still be calculated server-side from the same bounded stat fields used by the client, not accepted as an arbitrary client summary value.

- [ ] **Step 4: Implement authenticated operation dispatch**

```ts
type ProgressOperation =
  | { operation: 'load'; sessionId: string }
  | { operation: 'summaries'; sessionId: string; guestLinkToken?: string }
  | { operation: 'checkpoint'; request: SaveCheckpointRequest }
  | { operation: 'prepare-guest-link'; sessionId: string }
  | { operation: 'select-progress'; request: SelectProgressRequest }
  | { operation: 'list-archives'; sessionId: string }
  | { operation: 'restore-archive'; request: RestoreArchiveRequest }
```

Use Supabase authenticated user context with JWT verification enabled. Reject unsupported methods and operations with 405/400. Do not accept public or publishable-only auth for progress operations.

- [ ] **Step 5: Call transactional database functions**

Use the RLS-scoped client for own-data reads and narrowly scoped RPCs for mutations. Convert database error codes to stable public result codes: `unauthorized`, `conflict`, `invalid`, `incompatible`, `unavailable`.

- [ ] **Step 6: Configure the function**

Ensure `game/supabase/config.toml` contains:

```toml
[functions.progress-session]
verify_jwt = true
```

Pin imports in the function-local `deno.json`; do not rely on a floating global import map.

- [ ] **Step 7: Run unit and local function checks**

Run: `deno fmt --check game/supabase/functions`

Run: `deno lint game/supabase/functions`

Run: `deno test game/supabase/functions/tests/progress-validation-test.ts --allow-env`

If local Supabase is available, run: `supabase functions serve progress-session --workdir game`

Expected: validation tests PASS and function starts with JWT verification enabled.

- [ ] **Step 8: Review checkpoint**

Inspect logs and responses to confirm they contain request IDs and stable codes but no access tokens, refresh tokens, passwords, service keys, or full save payloads.

---

### Task 7: Move Offline Settlement Behind Server Authority

**Files:**
- Create: `game/supabase/functions/_shared/offlineSettlement.ts`
- Modify: `game/supabase/functions/_shared/offlineRules.ts`
- Create: `game/supabase/functions/tests/offline-settlement-test.ts`
- Modify: `game/src/data/serverContentParity.test.ts`
- Modify: `game/supabase/functions/progress-session/index.ts`
- Modify: `game/src/stores/player.ts`
- Modify: `game/src/core/game/GameManager.ts`
- Modify: `game/src/stores/offlineSummary.ts`
- Modify: `game/src/components/common/OfflineSummaryModal.vue`
- Modify: relevant tests in `game/src/core/idle`, `game/src/core/production`, `game/src/core/alchemy`, and `game/src/stores/player*.test.ts`

**Interfaces:**
- Produces Edge operation `resume`; `settleOfflineProgress(save, lastServerSeenAt, serverNow)`; expanded `OfflineSummaryData`.
- Consumes canonical `GameSave`, server timestamp, production cycle seeds, alchemy job state, 24-hour cap.

- [ ] **Step 1: Write deterministic server offline tests**

Cover exact cases:

- 30 minutes grants cultivation once;
- 3 days clamps to 24 hours;
- negative/zero elapsed grants nothing;
- a completed seeded production cycle grants the same material on repeated calculation from the same input;
- worker cycles respect the shared 24-hour budget;
- completed alchemy jobs use deterministic saved job seed rather than `Math.random()`;
- retrying the same offline claim request returns the recorded response and does not grant twice.

Example:

```ts
Deno.test('offline settlement caps cultivation at 24 hours', () => {
  const result = settleOfflineProgress(saveAt(0, 2), 0, 72 * 60 * 60 * 1000)
  assertEquals(result.summary.elapsedSeconds, 86_400)
  assertEquals(result.summary.cultivation, 172_800)
})
```

- [ ] **Step 2: Run tests and verify failure**

Run: `deno test game/supabase/functions/tests/offline-settlement-test.ts`

- [ ] **Step 3: Make alchemy completion deterministic before moving authority**

Add a persisted `rollSeed` to active alchemy jobs at creation time and use the existing seeded PRNG (`alchemyMulberry32`) when settling. Because development saves need no migration, increment `CURRENT_SAVE_VERSION` and update save-shape tests instead of supporting jobs without a seed.

- [ ] **Step 4: Implement pure server settlement**

The server module accepts and returns plain JSON-compatible data only. It must not import Vue, Pinia, Phaser, DOM APIs, browser storage, or `Date.now()`. `serverNow` is an explicit argument.

It must settle:

1. cultivation using canonical `cultivationPerSecond` and cap at `cultivationRequired`;
2. production manual/worker cycles using persisted seeds and the 24-hour budget;
3. completed alchemy jobs using persisted seeds;
4. summary deltas for cultivation, materials, and pills;
5. `player.lastSavedAt` using the server timestamp solely as a compatibility field until later schema cleanup.

`offlineRules.ts` contains the exact production durations, seeded reward tables, offline caps, alchemy recipe completion inputs, and pill IDs needed by the server calculation. Extend `serverContentParity.test.ts` to compare these server rule snapshots against the client production/alchemy definitions so balance changes cannot silently diverge.

- [ ] **Step 5: Add atomic resume operation**

`resume` must lock the canonical save, calculate settlement from `last_server_seen_at` to database `now()`, write the settled save, update `last_server_seen_at`, increment revision, record the idempotent response, and return the new envelope plus summary in one transaction boundary.

The Edge Function may calculate the deterministic result, but the final compare-and-write must use expected revision and a database transaction/RPC so a concurrent checkpoint cannot interleave.

- [ ] **Step 6: Remove local offline grants**

Change `player.restoreFromSave(save)` to assign canonical state and normalize invariants only. It returns no locally calculated reward. Change `GameManager.restoreFromSave(save)` to restore production/alchemy state without calling `settleOffline()` or reading `Date.now()` for absence.

Do not delete the lower-level production/alchemy settlement methods until server parity tests pass; mark their client call sites unused and retain unit coverage for deterministic rules.

- [ ] **Step 7: Render server summary**

Expand the store/modal to show material and pill rows only when non-empty. Keep elapsed time and cultivation. The modal receives no clock and performs formatting only.

- [ ] **Step 8: Run focused client and server tests**

Run: `deno test game/supabase/functions/tests/offline-settlement-test.ts`

Run: `npm.cmd run test -- src/core/idle/OfflineProgressSystem.test.ts src/core/production/ProductionSystem.test.ts src/core/alchemy/AlchemySystem.test.ts src/services/save/SaveRoundTrip.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS; no production call site calculates absence with client `Date.now()`.

- [ ] **Step 9: Static authority audit**

Run: `rg -n "calculateOfflineTime|settleOffline\(|lastSavedAt.*Date\.now|Date\.now\(\).*lastSavedAt" game/src`

Expected: only pure tests, compatibility serialization, or explicit online timers remain; boot/restore paths contain no client-authoritative offline grant.

- [ ] **Step 10: Review checkpoint**

Confirm no offline reward is displayed before the server has persisted and acknowledged the settled canonical save.

---

### Task 8: Build Unified Welcome/Auth Screen and Remove Competing Main Menu Flow

**Files:**
- Create: `game/src/components/onboarding/WelcomeAuthScreen.vue`
- Create: `game/src/components/onboarding/WelcomeAuthScreen.test.ts`
- Create: `game/src/components/common/ConnectionGateScreen.vue`
- Create: `game/src/services/serverStatus/ServerStatusService.ts`
- Create: `game/src/services/serverStatus/ServerStatusService.test.ts`
- Create: `game/src/services/serverStatus/MockServerStatusService.ts`
- Create: `game/supabase/functions/game-status/index.ts`
- Modify: `game/vite.config.ts`
- Modify: `game/src/env.d.ts`
- Modify: `game/src/stores/saveIssue.ts`
- Modify: `game/src/components/common/SaveIncompatibleScreen.vue`
- Modify: `game/src/components/onboarding/AuthEntryScreen.vue` or replace its usage after extracting reusable form logic
- Modify: `game/src/components/menu/MenuBackground.vue`
- Modify: `game/src/components/menu/MenuLogo.vue`
- Modify: `game/src/components/menu/MenuButton.vue`
- Modify: `game/src/App.vue`
- Modify: `game/src/router/index.ts`

**Interfaces:**
- Produces emits `play-guest`, `login`, `register`, `continue`, `link-account`, `switch-account`, `settings`, `exit`, `retry`.
- Consumes `BootStage`, `AuthSession | null`, optional `ProgressSummary`, server status, application version.

- [ ] **Step 1: Invoke `ui-ux-pro-max` for the exact welcome/auth concern**

Run the smallest relevant UX search for authentication/navigation and Vue stack guidance. Record the selected guidance in the task notes: one visible primary action, complete keyboard navigation, visible labels, 44px minimum targets, no fixed overlay obscuring another top-level screen.

- [ ] **Step 2: Write failing server-status contract tests**

```ts
it('classifies a newer required client version before auth', async () => {
  transport.reply({ status: 'online', minimumClientVersion: '0.1.0', configVersion: 1, serverTime: '2026-08-31T00:00:00Z' })
  expect(await service.check('0.0.0')).toEqual({ status: 'update-required', minimumClientVersion: '0.1.0' })
})

it('returns unavailable for a timeout or malformed payload', async () => {
  transport.timeout()
  expect(await service.check('0.0.0')).toMatchObject({ status: 'unavailable', retryable: true })
})
```

- [ ] **Step 3: Implement the public read-only game-status endpoint**

Return only:

```ts
interface GameStatusPayload {
  status: 'online' | 'maintenance'
  minimumClientVersion: string
  configVersion: number
  serverTime: string
  maintenanceMessage?: string
}
```

The endpoint reads status/config values from server environment or a protected configuration table, exposes no user/save data, performs no mutation, and accepts only `GET`. Configure only this function with `verify_jwt = false`; keep `progress-session` JWT verification enabled.

Expose the application version through a typed `__APP_VERSION__` Vite define sourced from `game/package.json`; do not duplicate the version string in Vue components.

Add `MockServerStatusService` for `mock` mode. It returns deterministic online/maintenance/update fixtures from injected test controls and must never call `fetch`. The boot flow must therefore work with Wi-Fi disabled in mock mode. `local-supabase` and `server` use the real status adapter and fail closed when their configured endpoint is unavailable.

- [ ] **Step 4: Write failing component tests**

```ts
it('shows Play now as the primary action for a new device', () => {
  const wrapper = mount(WelcomeAuthScreen, { props: { identity: null, progress: null, serverStatus: 'online' } })
  expect(wrapper.get('[data-testid="welcome-play-guest"]').attributes('disabled')).toBeUndefined()
  expect(wrapper.find('[data-testid="welcome-continue"]').exists()).toBe(false)
})

it('shows Continue and Link account for a guest with progress', () => {
  const wrapper = mount(WelcomeAuthScreen, { props: { identity: guestSession, progress: summary, serverStatus: 'online' } })
  expect(wrapper.get('[data-testid="welcome-continue"]').text()).toContain(summary.characterName)
  expect(wrapper.get('[data-testid="welcome-link-account"]').isVisible()).toBe(true)
})
```

- [ ] **Step 5: Run tests and verify failure**

Run: `npm.cmd run test -- src/services/serverStatus/ServerStatusService.test.ts src/components/onboarding/WelcomeAuthScreen.test.ts`

- [ ] **Step 6: Implement semantic unified screen**

Use one `<main>` and one `<h1>`. Preserve visible login labels and `autocomplete="username"` / `autocomplete="current-password"`. Reuse the existing theme-aware background/logo/buttons but keep them inside the one rendered top-level surface.

Display the actual package/build version through a Vite-defined constant or imported package metadata, not `v1.2.3` literal.

- [ ] **Step 7: Replace App top-level conditions**

`App.vue` must call `ServerStatusService.check(currentBuildVersion)` before offering auth actions, then render by `bootFlow.stage` with no `showMainMenu` or fixed three-second timer. The menu background must not remain mounted when Auth, Character Creation, or Game is active.

Delete the empty-router warning source: either remove router registration if no routes remain, or add an intentional route strategy. Do not keep `routes: []` while installing a router that warns for `/`.

Map canonical server payload failures into a discriminated save issue. For a server-owned incompatible/corrupted save, show retry, diagnostic/support ID, and return-to-welcome actions. Do not show the existing local `deleteSave()` / `importSaveRaw()` overwrite path. Preserve those local tools only for an explicitly local-development save issue.

- [ ] **Step 8: Remove compatibility auth method and MainMenu integration**

After all actions use the new AuthService methods, remove `authenticate(mode)` compatibility API. Stop rendering `MainMenu.vue`; retain/delete the component only after confirming no other imports. Preserve reusable child visual components.

- [ ] **Step 9: Run component, boot, accessibility, and type checks**

Run: `npm.cmd run test -- src/services/serverStatus/ServerStatusService.test.ts src/components/onboarding/WelcomeAuthScreen.test.ts src/composables/useBootFlow.test.ts src/services/auth/AuthService.test.ts`

Run: `npm.cmd run type-check`

Run: `npm.cmd run build:mock`

Expected: PASS and no Vue Router warning for `/`.

- [ ] **Step 10: Manual viewport verification**

At 1600×900 and 390×844, verify the title, primary action, form, utility actions, focus ring, and error message remain visible without horizontal scrolling or fixed-background obstruction.

- [ ] **Step 11: Review checkpoint**

Inspect the final DOM runtime: the welcome surface bounding rectangle must begin at `y=0`, have viewport height, and contain the visible menu content.

---

### Task 9: Extract Game Runtime and Wire Canonical Progress Sync

**Files:**
- Create: `game/src/core/game/createConfiguredGameManager.ts`
- Create: `game/src/core/game/createConfiguredGameManager.test.ts`
- Create: `game/src/composables/useGameRuntime.ts`
- Create: `game/src/composables/useGameRuntime.test.ts`
- Modify: `game/src/components/onboarding/CharacterCreationScreen.vue`
- Modify: `game/src/services/character/CharacterCreationService.ts`
- Modify: `game/src/services/character/SupabaseCharacterCreationService.ts`
- Modify: `game/src/services/character/MockCharacterCreationService.ts`
- Modify: `game/src/services/character/CharacterCreationService.test.ts`
- Modify: `game/src/App.vue`
- Modify: `game/src/stores/player.ts`
- Modify: `game/src/services/cloudSave/*` consumers

**Interfaces:**
- Produces `createConfiguredGameManager()`, `useGameRuntime({ player, progressSync, onOfflineSummary })` with `initialize(save)`, `initializeNewCharacter(payload)`, `start()`, `pause()`, `resume()`, `shutdown()`.
- Consumes Task 5 coordinator and Task 7 canonical resume envelope.

- [ ] **Step 1: Write configured-manager registry test**

Assert the factory resolves representative material, skill, technique, stage, enemy, building, progression node, quest, pill, and recipe IDs used by starter initialization.

- [ ] **Step 2: Extract registry setup without behavior change**

Move only the `new GameManager()` plus `registerXxx()` sequence from `App.vue`. Do not change registries or starter grants in this step.

- [ ] **Step 3: Write runtime lifecycle tests with injected clock/timers**

Cover:

- `initialize(save)` restores player and manager once;
- `start()` creates one tick interval and one autosave interval;
- second `start()` is idempotent;
- `pause()` prevents tick progression and checkpoint creation;
- `shutdown()` removes intervals/listeners and performs at most one final checkpoint;
- HMR unmount does not create concurrent autosave loops.

- [ ] **Step 4: Implement useGameRuntime**

Dependencies must be injectable:

```ts
interface GameRuntimeDependencies {
  now: () => number
  setInterval: typeof window.setInterval
  clearInterval: typeof window.clearInterval
  progressSync: ProgressSyncCoordinator
}
```

Keep the existing cultivation/combat tick ordering, essence arrival handling, breakthrough checks, notification drain, Electron bridge, and starter character grants unchanged. This is extraction plus persistence rewiring, not a gameplay rewrite.

- [ ] **Step 5: Route all saves through ProgressSyncCoordinator**

Remove direct `player.save(gameManager)` / `cloudSaveCoordinator.save()` calls from App/runtime. Build the snapshot with `buildGameSave()` and submit through `progressSync.checkpoint()`.

Important events that already call save should request an immediate checkpoint; ordinary changes remain covered by the 15-second autosave.

- [ ] **Step 6: Make character creation atomically create its first canonical save**

The current component calls `characterCreationService.createCharacter(payload)` before `App.vue` has built the initialized `GameSave`, causing the existing Supabase RPC to store `{}` temporarily. Replace that split flow:

1. `CharacterCreationScreen` validates the draft and emits `complete(draft)`; it does not create the character row.
2. `useGameRuntime.initializeNewCharacter(draft)` applies the existing starter technique, skill, buildings, materials, production settings, talents, name, and attributes in memory.
3. Build the complete initial snapshot with `buildGameSave(player.$state, gameManager)`.
4. Call `progressService.createCharacter({ draft, initialSave, requestId })`.
5. The server validates the still-active talent roll, name, attributes, one selected talent, and full save payload, then inserts `characters` plus `character_saves` in one transaction.
6. Enter `game` only after the server returns the new character/progress ID and revision.
7. If creation fails, restore the pre-creation in-memory baseline and return the error to `CharacterCreationScreen`; do not leave a local-only character running.

Update the contract to make the atomic boundary explicit:

```ts
export interface CreateCharacterRequest {
  draft: CharacterCreationDraft
  initialSave: GameSave
  requestId: string
}

export type CreateCharacterResult =
  | { status: 'ok'; characterId: string; progressId: string; revision: number }
  | { status: 'name-taken'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'unavailable'; message: string; retryable: boolean }
```

Add a test proving the final server/mock create call receives a non-empty save with the selected name, exactly one talent, starter skill/technique, starter buildings/materials, and current schema version.

- [ ] **Step 7: Migrate App orchestration**

`App.vue` coordinates:

1. session restoration or welcome;
2. progress summaries/load/resume;
3. character creation;
4. runtime initialization;
5. state-machine transition to game.

It must no longer contain registry setup, interval handles, offline calculation, or cloud-save conflict retry logic.

- [ ] **Step 8: Retire old cloud save adapter safely**

After `rg` shows no production consumers, delete or convert `services/cloudSave` exports into deprecated re-exports for one task only. By Task 13, remove dead local revision keys and direct `LocalCloudSaveService` use.

- [ ] **Step 9: Run focused and regression tests**

Run: `npm.cmd run test -- src/core/game/createConfiguredGameManager.test.ts src/composables/useGameRuntime.test.ts src/services/character/CharacterCreationService.test.ts src/services/progress/ProgressSyncCoordinator.test.ts src/services/save/SaveRoundTrip.test.ts`

Run: `npm.cmd run type-check`

Run: `npm.cmd run build:mock`

Expected: PASS.

- [ ] **Step 10: Review checkpoint**

Run: `rg -n "cloudSaveCoordinator|LocalCloudSaveService|SAVE_REVISION_KEY|setInterval\(" game/src/App.vue game/src`

Expected: no old production coordinator use; intervals live only in the runtime/connectivity owners.

---

### Task 10: Implement Guest-to-Account Progress Comparison and Selection

**Files:**
- Create: `game/src/components/onboarding/ProgressSelectionScreen.vue`
- Create: `game/src/components/onboarding/ProgressSelectionScreen.test.ts`
- Modify: `game/src/components/panels/SettingsPanel.vue`
- Modify: `game/src/components/panels/SettingsPanel.test.ts`
- Modify: `game/src/components/onboarding/WelcomeAuthScreen.vue`
- Modify: `game/src/services/auth/SupabaseAuthService.ts`
- Modify: `game/src/services/progress/SupabaseProgressService.ts`
- Modify: `game/src/composables/useBootFlow.ts`
- Modify: `game/src/App.vue`

**Interfaces:**
- Produces UI selection `progressId`; service calls `prepareGuestLink()`, `getProgressSummaries(guestLinkToken)`, `selectProgress(request)`.
- Consumes Task 3 guest link token and selection transaction; Task 1 summaries.

- [ ] **Step 1: Invoke `ui-ux-pro-max` for comparison/confirmation UX**

Use focused guidance for destructive choice, clear labels, keyboard selection, and confirmation. The chosen design must show equivalent fields for both cards and must not preselect one silently.

- [ ] **Step 2: Write failing comparison tests**

```ts
it('renders both progress summaries with equivalent fields', () => {
  const wrapper = mount(ProgressSelectionScreen, { props: { summaries: [guestSummary, accountSummary], submitting: false } })
  expect(wrapper.findAll('[data-testid="progress-option"]')).toHaveLength(2)
  expect(wrapper.text()).toContain(guestSummary.realmLabel)
  expect(wrapper.text()).toContain(accountSummary.updatedAt)
})

it('requires a second confirmation before emitting selection', async () => {
  const wrapper = mount(ProgressSelectionScreen, { props: { summaries: [guestSummary, accountSummary], submitting: false } })
  await wrapper.get(`[data-progress-id="${guestSummary.progressId}"]`).trigger('click')
  expect(wrapper.emitted('select')).toBeUndefined()
  await wrapper.get('[data-testid="confirm-progress-selection"]').trigger('click')
  expect(wrapper.emitted('select')).toEqual([[guestSummary.progressId]])
})
```

- [ ] **Step 3: Implement the comparison screen**

Show character name, source label, realm, combat power, total play time, and server `updatedAt`. Confirmation copy must name the chosen character and state that the other progress will be archived for 30 days. No copy may say values are merged.

- [ ] **Step 4: Implement linking flow orchestration**

For an existing guest:

1. request one-time guest link token while guest session is valid;
2. authenticate the target account;
3. load both summaries with the link token;
4. if account has no progress, show ownership-transfer confirmation;
5. if both exist, enter `selecting-progress`;
6. submit selection with stable `requestId`;
7. reload canonical progress under account session;
8. clear the guest credential only after selection succeeds.

- [ ] **Step 5: Handle cancellation/failure without data loss**

Back returns to welcome with the account session intact and no selection mutation. Expired link token restarts preparation. Conflict reloads summaries. Network failure keeps the selection and confirmation state for retry but never assumes success.

- [ ] **Step 6: Add account actions and archive recovery to Settings**

For a guest, show **Link account** and the warning that cross-device recovery requires linking. For an account, show masked login ID, **Switch account**, **Log out**, and **Archived progress**.

`Archived progress` loads only unexpired archive metadata. Restoring requires a destructive confirmation that names both the archived character and the current character. The server archives the current progress before restoration, so the operation remains reversible within retention. Pause the runtime during link/switch/restore orchestration and resume only after the new canonical envelope is loaded.

Add component tests proving guest/account actions differ, expired archives are not actionable, restore requires confirmation, and no button claims that progress values will merge.

- [ ] **Step 7: Run focused tests and type-check**

Run: `npm.cmd run test -- src/components/onboarding/ProgressSelectionScreen.test.ts src/components/panels/SettingsPanel.test.ts src/services/auth/AuthService.test.ts src/services/progress/LocalProgressService.test.ts src/composables/useBootFlow.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 8: Review checkpoint**

Verify both outcomes preserve the non-selected save in `progress_archives`, archive recovery is explicit and reversible during retention, and no code sums balances, inventories, attributes, skills, or achievements.

---

### Task 11: Add Connectivity Monitor, Grace Period, and Reconnect UI

**Files:**
- Create: `game/src/stores/connectivity.ts`
- Create: `game/src/services/connectivity/ConnectivityMonitor.ts`
- Create: `game/src/services/connectivity/ConnectivityMonitor.test.ts`
- Create: `game/src/services/connectivity/MockConnectivityTransport.ts`
- Create: `game/src/services/connectivity/MockConnectivityTransport.test.ts`
- Create: `game/src/components/common/ReconnectOverlay.vue`
- Create: `game/src/components/common/ReconnectOverlay.test.ts`
- Modify: `game/src/composables/useGameRuntime.ts`
- Modify: `game/src/composables/useBootFlow.ts`
- Modify: `game/src/App.vue`

**Interfaces:**
- Produces connection states `connecting|online|degraded|reconnecting|offline`; `start()`, `stop()`, `retryNow()`; grace deadline; injectable heartbeat/session transport.
- Consumes authenticated heartbeat/session assertion endpoint, runtime `pause()/resume()`, boot events.

- [ ] **Step 1: Write fake-clock monitor tests**

```ts
it('enters degraded state after a heartbeat failure and offline after 90 seconds', async () => {
  monitor.start()
  heartbeat.rejectOnce()
  await clock.advanceAsync(15_000)
  expect(store.state).toBe('degraded')
  await clock.advanceAsync(90_000)
  expect(store.state).toBe('offline')
})

it('recovers without pausing when heartbeat succeeds inside grace period', async () => {
  heartbeat.rejectOnce()
  await clock.advanceAsync(15_000)
  heartbeat.resolveNext()
  await monitor.retryNow()
  expect(store.state).toBe('online')
  expect(runtime.pauseCalls).toBe(0)
})
```

- [ ] **Step 2: Implement heartbeat and retry policy**

Use authenticated `assert_active_session` or a lightweight authenticated Edge operation. Do not rely only on `navigator.onLine`; it may inform immediate UI but server heartbeat decides connectivity.

Use exponential retry delays capped within the fixed 90-second grace window. Reset backoff immediately after a successful heartbeat.

Implement `MockConnectivityTransport` without `fetch`. Its deterministic controls must simulate heartbeat success/failure/recovery and session transfer for unit/E2E tests. The `local-supabase` and `server` factories inject the real authenticated transport. Mock mode represents a connected fake server, not a player-facing offline mode.

- [ ] **Step 3: Integrate runtime behavior**

- `degraded/reconnecting`: local solo gameplay and autosave cache continue; network checkpoints queue.
- `offline` after 90 seconds: call `runtime.pause()`, stop progression ticks, retain recovery cache.
- `online` again: restore/verify session, call `recoverPending()`, then `runtime.resume()` only after canonical state is safe.

Server-dependent operations must query connectivity state and fail closed while degraded.

- [ ] **Step 4: Implement reconnect UI**

Show a non-blocking banner during grace period and blocking overlay after pause. Provide **Try again** and **Return to welcome**. Do not provide **Continue offline**.

Preserve keyboard focus inside the blocking overlay and restore focus after recovery.

- [ ] **Step 5: Run focused tests and type-check**

Run: `npm.cmd run test -- src/services/connectivity/ConnectivityMonitor.test.ts src/components/common/ReconnectOverlay.test.ts src/composables/useGameRuntime.test.ts src/composables/useBootFlow.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Verify progression stops after exactly 90 seconds of failed server contact and never resumes merely because `navigator.onLine` changes to true.

---

### Task 12: Enforce Active Session Transfer and Safe Logout

**Files:**
- Modify: `game/supabase/migrations/202608310001_progress_foundation.sql` only if not yet applied anywhere; otherwise create `game/supabase/migrations/202608310002_session_transfer.sql`
- Modify: `game/src/services/auth/AuthService.ts`
- Modify: `game/src/services/auth/SupabaseAuthService.ts`
- Modify: `game/src/services/connectivity/ConnectivityMonitor.ts`
- Create: `game/src/components/common/SessionTransferredScreen.vue`
- Create: `game/src/components/common/SessionTransferredScreen.test.ts`
- Modify: `game/src/composables/useBootFlow.ts`
- Modify: `game/src/App.vue`

**Interfaces:**
- Produces `SessionResult` code `session_transferred`; explicit `takeOverSession(deviceLabel)`.
- Consumes existing `account_sessions`, `claim_active_session`, `assert_active_session`.

- [ ] **Step 1: Write session transfer tests**

Cover:

- second session claim revokes the first;
- first session heartbeat returns `session_transferred`;
- revoked session cannot checkpoint;
- takeover does not delete or overwrite canonical progress;
- logout flushes one checkpoint before revoking when online;
- logout during disconnection leaves recovery cache and does not falsely report sync success.

- [ ] **Step 2: Make takeover explicit**

Change auth restoration so an active session on another device returns a conflict summary instead of silently revoking it. The Welcome/Auth UI asks the player whether to transfer the session. Only `takeOverSession()` revokes the previous session and creates the new lease.

- [ ] **Step 3: Handle server revocation while playing**

Heartbeat/checkpoint code maps session assertion failure to `session_transferred`, pauses runtime immediately, prevents further writes, and renders `SessionTransferredScreen` with **Return to welcome**.

- [ ] **Step 4: Implement safe logout ordering**

```text
pause runtime
-> checkpoint current snapshot if online
-> await accepted/conflict/unavailable result
-> revoke auth session
-> clear in-memory access token
-> retain recovery cache only when checkpoint was not acknowledged
-> return to welcome
```

- [ ] **Step 5: Run focused tests and type-check**

Run: `npm.cmd run test -- src/services/auth/AuthService.test.ts src/services/connectivity/ConnectivityMonitor.test.ts src/components/common/SessionTransferredScreen.test.ts src/composables/useGameRuntime.test.ts`

Run: `npm.cmd run type-check`

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Verify no path permits two valid session IDs to update one canonical save concurrently.

---

### Task 13: End-to-End Integration, Documentation, and Release-Readiness Verification

**Files:**
- Modify: `game/package.json`
- Modify: `game/tests/e2e/helpers.ts`
- Modify: `game/tests/e2e/boot-fresh.spec.ts`
- Modify: `game/tests/e2e/save-reload.spec.ts`
- Create: `game/tests/e2e/auth-progress-selection.spec.ts`
- Create: `game/tests/e2e/reconnect.spec.ts`
- Create: `game/docs/online-session-and-save.md`
- Modify: `game/README.md`
- Delete/retire: unused `game/src/components/menu/MainMenu.vue`, `game/src/services/cloudSave/*`, and obsolete local save revision code only after `rg` confirms no consumers.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified user journeys, operational documentation, and removal of superseded paths.

- [ ] **Step 1: Add deterministic E2E server controls**

Extend helpers with test-only browser init flags intercepted by the local/mock adapter:

```ts
export async function seedOnlineSession(page: Page, fixture: OnlineSessionFixture): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('tien-hiep-idle-e2e-session', JSON.stringify(value))
  }, fixture)
}
```

Never read `.env`, Supabase service keys, or real user credentials. Integration against local Supabase uses seeded local test users created by the test harness, not hard-coded production accounts.

- [ ] **Step 2: Update fresh boot E2E**

Assert:

```text
Welcome/Auth visible
-> click Play now
-> guest session resolves
-> character creation visible
-> complete creation
-> GameRoot visible
-> MainMenu/Auth not mounted behind GameRoot
```

- [ ] **Step 3: Add returning guest and canonical reload E2E**

Create progress, wait for server/mock checkpoint acknowledgment, reload, and assert the same character/revision loads. Do not manipulate the legacy local `SAVE_KEY` as the source of truth.

- [ ] **Step 4: Add two-progress selection E2E**

Seed guest and account summaries, log in, assert both cards show comparable fields, choose guest, confirm, then assert account progress loads and account candidate is archived. Repeat with cloud choice in a second test.

- [ ] **Step 5: Add reconnect E2E**

Simulate heartbeat failure, assert non-blocking banner, advance through 90-second grace with fake timers, assert blocking reconnect overlay and paused progression, restore server, retry, assert recovery checkpoint is accepted once and progression resumes.

- [ ] **Step 6: Document local operations and invariants**

`game/docs/online-session-and-save.md` must document:

- boot state diagram;
- guest vs account semantics;
- session storage and token rules;
- canonical save/revision/request ID protocol;
- server-time offline settlement;
- recovery cache lifecycle;
- conflict and two-device behavior;
- local Supabase commands;
- migration/function verification commands;
- explicit non-goals including tower competition.

Document the backend modes and exact commands:

```text
npm.cmd run dev:mock       # no Internet or local backend required
npm.cmd run dev:local      # local Supabase on loopback
npm.cmd run build:mock     # production-shape offline QA artifact; never distributable
npm.cmd run build          # release/server mode; fail closed without valid configuration
```

`dev` may alias `dev:mock` for convenient daily work. `build:mock` must show a persistent development marker in the UI and must not be reachable from `dist:win` or any release/package script. Every distribution/release script must force `server` mode.

Update README with only the entry points and commands; keep detailed behavior in the new document.

- [ ] **Step 7: Remove superseded code after coverage passes**

Run:

`rg -n "MainMenu|showMainMenu|cloudSaveCoordinator|LocalCloudSaveService|SAVE_REVISION_KEY|calculateOfflineTime" game/src game/tests`

For each hit, classify it as retained pure utility/test, intentional compatibility, or obsolete. Delete obsolete production paths; do not delete pure lower-level time/settlement tests still used by server-equivalent rules.

- [ ] **Step 8: Run focused E2E**

Run: `npm.cmd run test:e2e -- tests/e2e/boot-fresh.spec.ts tests/e2e/save-reload.spec.ts tests/e2e/auth-progress-selection.spec.ts tests/e2e/reconnect.spec.ts --reporter=line`

Expected: PASS.

- [ ] **Step 9: Prove daily development and E2E require no external network**

Install a test/E2E guard that fails any non-loopback `fetch`, WebSocket, or EventSource request, then run:

```text
npm.cmd run test
npm.cmd run build:mock
npm.cmd run test:e2e -- --reporter=line
```

Expected: all PASS with zero non-loopback network requests. Mock Auth, Server Status, Progress, Character Creation, and Connectivity must all use deterministic in-process/local-storage adapters.

- [ ] **Step 10: Run full client verification**

Run: `npm.cmd run test`

Run: `npm.cmd run type-check`

Run: `npm.cmd run build:mock`

Run: `npm.cmd run test:e2e -- --reporter=line`

Expected: all PASS without Internet. Then verify `npm.cmd run build` succeeds with a syntactically valid, non-secret HTTPS test configuration and intentionally fails with a clear `BackendConfigurationError` when configuration is absent. The release-build check validates configuration shape and never contacts that endpoint. The existing build chunk-size warning may remain if unchanged; any new warning caused by this work must be resolved.

- [ ] **Step 11: Run server verification**

When local Supabase/Deno is available:

```text
supabase db reset --workdir game
deno fmt --check game/supabase/functions
deno lint game/supabase/functions
deno test game/supabase/functions/tests --allow-env --allow-net
supabase functions serve progress-session --workdir game
```

Exercise authenticated guest/account load, checkpoint duplicate, revision conflict, offline resume duplicate, progress selection, and revoked-session cases against local services. Do not substitute a remote deployment for local verification.

- [ ] **Step 12: Run adversarial QA quick mode**

Invoke `tutienidle-adversarial-qa` in quick mode. Its scope is especially important here: boot lifecycle, save/cloud conflict, time/offline, economy/progression, Vue/Pinia lifecycle, and Phaser runtime teardown.

If quick mode finds materially broad save/cloud, time/offline, economy/progression, or lifecycle risk, escalate to deep mode as required by project rules before declaring readiness.

- [ ] **Step 13: Apply verification-before-completion**

Invoke `superpowers:verification-before-completion`, review the complete diff, and report:

- what changed;
- exact successful commands and their outputs/status;
- local Supabase/Deno verification status;
- any environment limitation;
- any remaining suspected risk or coverage gap;
- confirmation that no commit, push, deployment, or remote migration occurred.

- [ ] **Step 14: Final user review checkpoint**

Present the diff and evidence to the user. Do not commit or deploy. Suggest a commit breakdown only if the user asks.

---

## Cross-Task Acceptance Matrix

| Approved requirement | Implemented by | Verified by |
|---|---|---|
| Mandatory server connection | Tasks 1, 8, 11 | Boot/reconnect E2E |
| Daily development/test without Internet | Tasks 2, 4, 8, 11, 13 | Non-loopback network guard plus mock unit/E2E suite |
| Production never falls back to mock | Tasks 2, 4, 13 | Backend-mode matrix and missing-config build failure |
| Local solo gameplay | Tasks 9, 11 | Runtime fake-clock tests and existing gameplay suite |
| Server time for offline reward | Task 7 | Deno settlement tests and authority audit |
| Play now guest | Tasks 2, 8 | Auth unit and fresh-boot E2E |
| Optional login/register | Tasks 2, 8 | Auth unit and component tests |
| Login after guest play | Tasks 3, 10 | Selection integration/E2E |
| Show both saves and select one | Task 10 | Component and E2E tests |
| Never merge saves | Tasks 3, 10 | Database selection tests and archive assertions |
| Archive unselected save for 30 days | Tasks 3, 10 | Migration/integration assertions |
| Canonical server revision | Tasks 3-6, 9 | Coordinator and local Supabase tests |
| Idempotent retries | Tasks 3, 5-7 | Duplicate checkpoint/offline tests |
| Crash recovery cache | Task 5 | Recovery cache/coordinator tests |
| Brief network grace | Task 11 | Fake-clock and reconnect E2E |
| Single active device writer | Tasks 3, 12 | Session transfer integration tests |
| No independent MainMenu overlay | Task 8 | DOM/component/boot E2E |
| Tower deferred | Global constraints and docs | Scope review |

## Notes / Suggestions

1. **Initial grace period:** The approved design allowed 60-120 seconds. This plan selects 90 seconds as the first configurable value because it tolerates brief mobile/Wi-Fi interruptions without creating a long unverified play window.
2. **Supabase anonymous users:** Use real anonymous authenticated users rather than the publishable `anon` role. Supabase documents that anonymous sign-ins receive the authenticated role and can later link an identity; RLS must distinguish them through the anonymous JWT claim when restrictions differ.
3. **Existing login-ID scheme:** The current generated `@accounts.tien-hiep-idle.invalid` email bridge can remain initially to preserve the current ID/password UX. Account-linking to an already existing login still requires the explicit two-progress transfer flow; converting a guest directly to a brand-new credential may use identity linking when product email/verification decisions are finalized.
4. **Server offline settlement complexity:** Production and alchemy already have offline behavior. Moving only cultivation to the server would silently change the game and violate the approved authority model, so Task 7 moves all currently granted offline value before declaring the feature complete.
5. **No remote deployment in this plan:** Supabase migration/function deployment is an operational state change and is excluded unless the user explicitly requests it. Local Supabase verification is the completion target.
6. **Current dirty worktree:** `App.vue` and `MainMenu.vue` changed during the diagnostic/design conversation. The implementation worker must inspect and preserve those changes when creating the isolated worktree or reconciling the final patch.
7. **Network semantics:** “Online-required” describes the shipped `server` mode, not the developer toolchain. Daily coding, unit tests, mock builds, and mock E2E must run without Internet; local integration may use Supabase on loopback; staging/production requires a reachable real server at runtime. Installing Supabase/Docker tooling or pulling its images can require a one-time network download, but ordinary use after installation remains local. Mock mode is a test double for server contracts, never a player-facing offline mode.

## Primary Technical References

- Supabase anonymous sign-ins and identity linking: <https://supabase.com/docs/guides/auth/auth-anonymous>
- Supabase authenticated Edge Functions: <https://supabase.com/docs/guides/functions/auth>
- Supabase Edge Function shared-code structure: <https://supabase.com/docs/guides/functions/development-environment>
- Supabase Edge Function testing: <https://supabase.com/docs/guides/functions/unit-test>
- Supabase database function security: <https://supabase.com/docs/guides/database/functions>
