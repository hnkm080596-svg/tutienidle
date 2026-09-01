# Online-Required, Local-Gameplay Architecture Design

**Date:** 2026-08-31  
**Status:** Approved in conversation; awaiting document review  
**Project:** TutienIdle  
**Application root:** `game/`

## 1. Purpose

TutienIdle will require a live server connection to enter and remain in the game, while most moment-to-moment solo gameplay runs locally on the player's device. The server owns identity, canonical progression, time, save revisions, offline rewards, and other data that must remain trustworthy. The client owns presentation and responsive local simulation.

This design replaces the current competing Main Menu and Auth boot paths with one explicit application state machine. It also defines guest play, optional later login, save selection, server synchronization, brief network interruption handling, and recovery after crashes.

## 2. Approved Product Decisions

1. A server connection is mandatory. TutienIdle does not provide a true offline play mode.
2. Solo gameplay and combat run locally for low latency and modest server cost.
3. Server time is authoritative. The client clock never determines offline duration or offline rewards.
4. Players may use the current authentication model:
   - play immediately as a guest for quick playtesting;
   - log in or register if they want;
   - link or switch to an account after playing as a guest.
5. A guest is still a server-side identity. Guest mode means "not linked to a durable login", not "offline".
6. If a guest progression and an account progression both exist, show both summaries and let the player choose one.
7. Never automatically merge the two progressions.
8. Preserve the progression that was not selected as a recoverable archive for a limited period.
9. PvP is not planned. A possible future tower race is explicitly deferred and is not part of the foundational implementation.

## 3. Goals

- Let a new tester reach character creation quickly through **Play now**.
- Keep gameplay responsive by avoiding a server request for every combat tick or UI action.
- Make the server the canonical owner of durable progression.
- Prevent device-clock manipulation from changing offline rewards.
- Prevent accidental cloud overwrite, duplicate reward grants, and silent save merging.
- Recover safely from short disconnections, duplicate requests, crashes, and stale revisions.
- Keep the design compatible with the existing Vue 3, Pinia, TypeScript, Phaser, and Supabase-oriented structure.
- Establish boundaries that can support stronger verification for a future competitive feature without imposing that cost now.

## 4. Non-Goals

- PvP, trading, guilds, shared economy, or competitive tower implementation.
- Full server-side simulation of ordinary combat.
- Invasive client anti-cheat, process scanning, kernel drivers, or heavy obfuscation.
- Automatic semantic merging of two independently progressed saves.
- True offline gameplay.
- Save migration support during the current development phase.

## 5. Terminology

- **Guest identity:** A server-created player identity authenticated by a device-held credential but not linked to normal login credentials.
- **Account identity:** A player identity linked to supported login credentials.
- **Canonical save:** The progression snapshot and revision accepted by the server.
- **Recovery cache:** A local, non-authoritative copy of a pending checkpoint used after a crash or brief disconnection.
- **Checkpoint:** A client request proposing an updated progression snapshot against an expected server revision.
- **Offline reward:** Progress granted for the time the application was not running. It is calculated by the server; it does not imply offline play.
- **Grace period:** A short interval during which local solo simulation may continue while the client reconnects.

## 6. High-Level Authority Model

| Concern | Client responsibility | Server authority |
|---|---|---|
| Guest/login UI | Render forms and retain session credential securely | Create identity, authenticate, refresh and revoke sessions |
| Ordinary combat | Simulate combat, AI, animation and feedback | Validate durable progression at checkpoint boundaries |
| Cultivation | Update immediate local presentation | Accept only plausible, structurally valid saved progression |
| Save | Keep working state and recovery cache | Store canonical snapshot and monotonically increasing revision |
| Time | Display timers based on server time offset | Define current time and elapsed absence |
| Offline reward | Render the summary | Calculate, grant and persist reward atomically |
| Content data | Load the approved client bundle/config | Declare accepted `configVersion` values |
| UI preferences | Store theme, graphics, language, volume and UI scale locally | No server involvement required initially |
| Premium or external grants | Render purchase/reward UI | Validate transaction and grant value atomically |

The server must not accept arbitrary assignments such as setting a currency balance. High-value mutations should eventually be expressed as validated commands. Ordinary solo progress may initially use bounded snapshot validation to keep implementation proportional to current risk.

## 7. Top-Level Application State Machine

Only one top-level screen may be active at a time:

```text
connecting
  -> welcome
  -> authenticating
  -> resolving-progress
  -> selecting-progress
  -> character-creation
  -> loading-game
  -> game
  -> reconnecting
  -> error
```

Additional terminal or gated views include:

- `maintenance`
- `update-required`
- `save-incompatible`

The state machine replaces the current combination of `showMainMenu`, boot stage, and `isBooted` conditions. `App.vue` becomes a renderer/composition boundary rather than the owner of auth, progress, clock, sync, and menu behavior.

## 8. Entry and Authentication UX

### 8.1 Startup

```text
Short splash
  -> check connectivity, server status and client version
     -> maintenance screen
     -> update-required screen
     -> connection-error screen
     -> welcome/auth screen
```

The splash must be condition-driven. It must not wait a fixed three seconds when startup work has already completed.

### 8.2 Unified Welcome/Auth Screen

The existing Main Menu and Auth Screen are combined into one entry surface. Existing menu background, logo, and button visuals may be reused, but `MainMenu` must not remain a separate overlay running over the boot flow.

Available actions vary by identity state:

**New device**

- Primary: **Play now**
- Secondary: **Log in**, **Register**
- Utility: **Settings**, **Exit**

**Restorable guest session**

- Primary: **Continue with _character name_**
- Secondary: **Link account**, **Log in to another account**
- Utility: **Settings**, **Exit**

**Restorable account session**

- Primary: **Continue with _character name_**
- Secondary: **Switch account**
- Utility: **Settings**, **Exit**

The screen also shows server status and the actual application version. The version must not be hard-coded independently of build metadata.

### 8.3 Guest Play

Choosing **Play now** requests a guest identity from the server. The returned session proceeds through progress resolution exactly like an account session. A new guest with no save enters character creation.

Inside the game, Account Settings presents a low-friction reminder that the guest progression should be linked to use it on another device. The reminder must not repeatedly interrupt gameplay.

## 9. Progress Resolution and Account Linking

After authentication, the server returns available progress summaries.

```text
No progression       -> character creation
One active progress  -> loading game
Guest + account      -> progress comparison
```

A progress summary includes at least:

```ts
interface ProgressSummary {
  progressId: string
  source: 'guest' | 'account'
  characterName: string
  realmLabel: string
  combatPower: number
  totalPlaySeconds: number
  updatedAt: string
}
```

The comparison screen displays the two summaries side by side or as two clearly separated cards. The player selects one progression, then confirms a second time after reading which progression becomes canonical.

Selection rules:

1. The selected progression becomes the active canonical progression for the account.
2. The unselected progression is archived, not deleted.
3. The archive is recoverable for a configured period, initially proposed as 30 days.
4. No currencies, items, stats, or achievements are merged.
5. The selection request is idempotent and transactionally updates ownership/state.

If the account has no existing progression, linking a guest progression requires a single explicit ownership-transfer confirmation rather than a two-save comparison.

## 10. Client Components and Services

### 10.1 Boot Coordinator

Owns the application state machine and coordinates startup checks, authentication, progress resolution, offline reward claim, and game entry. It exposes state and actions; it does not render UI.

### 10.2 Auth Service

The current auth contract is extended conceptually to support:

```ts
interface AuthService {
  restoreSession(): Promise<SessionResult>
  playAsGuest(): Promise<AuthResult>
  login(credentials: AuthCredentials): Promise<AuthResult>
  register(credentials: AuthCredentials): Promise<AuthResult>
  linkGuest(credentials: AuthCredentials): Promise<LinkResult>
  logout(): Promise<void>
}
```

### 10.3 Progress Service

The production adapter calls server endpoints. `LocalCloudSaveService` remains useful as a development fake or test adapter but must not be the production authority.

```ts
interface ProgressService {
  loadProgress(): Promise<LoadProgressResult>
  getProgressSummaries(): Promise<ProgressSummaryResult>
  selectProgress(request: SelectProgressRequest): Promise<SelectProgressResult>
  createCharacter(payload: CharacterCreationPayload): Promise<CreateProgressResult>
  saveCheckpoint(request: SaveCheckpointRequest): Promise<SaveCheckpointResult>
  claimOfflineProgress(): Promise<OfflineClaimResult>
}
```

### 10.4 Sync Coordinator

Owns:

- current server revision;
- autosave scheduling;
- important-event checkpoints;
- one in-flight checkpoint at a time;
- idempotent retry;
- recovery-cache lifecycle;
- conflict/reload signals;
- graceful reaction to connectivity changes.

It does not independently decide whether a progression is valid.

### 10.5 Connectivity Store

Provides one shared connection state:

```ts
type ConnectionState =
  | 'connecting'
  | 'online'
  | 'degraded'
  | 'reconnecting'
  | 'offline'
```

Individual components must not implement their own competing network-state logic.

## 11. Server Responsibilities and Minimal API

The existing Supabase direction may be retained through Supabase Auth, database functions, and/or Edge Functions. No new dependency is required by this design.

Minimal logical API:

```text
POST /session/guest
GET  /session/restore

GET  /progress
GET  /progress/summaries
POST /progress/select
PUT  /progress/checkpoint
POST /progress/create-character
POST /progress/offline-claim
```

The server must enforce access control so a client can access only its authenticated player's data. Cross-player or protected data changes must occur through trusted server logic rather than a service credential exposed to the client.

## 12. Core Data Contracts

```ts
type IdentityKind = 'guest' | 'account'

interface PlayerSession {
  playerId: string
  sessionId: string
  identityKind: IdentityKind
  expiresAt: string
}

interface ServerProgressEnvelope {
  playerId: string
  progressId: string
  save: GameSave
  revision: number
  updatedAt: string
  lastServerSeenAt: string
  configVersion: number
}

interface SaveCheckpointRequest {
  expectedRevision: number
  requestId: string
  sessionId: string
  configVersion: number
  snapshot: GameSave
}

interface RecoveryCache {
  baseRevision: number
  sessionId: string
  requestId: string
  snapshot: GameSave
  savedAt: string
}
```

Access tokens and credentials must not be embedded in `GameSave`.

## 13. Checkpoint and Revision Protocol

The client saves at three kinds of boundaries:

- periodic autosave, initially 15-30 seconds;
- important progression events, such as character creation, breakthrough, rare reward, or equipment change;
- page hide/application close when a connection remains available.

Protocol:

1. Client updates local gameplay state immediately.
2. Client writes a recovery cache for the pending checkpoint.
3. Client sends `expectedRevision`, stable `requestId`, session/config identifiers, and snapshot.
4. Server validates session, idempotency, revision, shape, known IDs, and foundational bounds.
5. Server stores the snapshot and increments revision atomically.
6. Server records `requestId` as processed.
7. Client receives the new revision and only then deletes the matching recovery cache.

Duplicate delivery of the same `requestId` returns the original accepted result and must not apply a reward or save twice.

A stale revision is never resolved by silently overwriting the canonical save. The client stops checkpointing, loads current metadata, and enters the appropriate progress/session conflict flow.

## 14. Local Storage Boundaries

Local data is separated into:

**Preferences**

- theme;
- volume;
- graphics;
- language;
- UI scale;
- other device-specific UI settings.

**Session credentials**

- restorable guest/account credential;
- never plaintext password;
- never server service key.

**Recovery cache**

- one pending checkpoint or a bounded pending journal;
- base revision and stable request identifier;
- never treated as canonical without server acceptance.

## 15. Offline Reward Protocol

Offline reward is server-only:

```text
elapsed = serverNow - canonical.lastServerSeenAt
boundedElapsed = min(elapsed, configuredOfflineCap)
reward = calculate(canonicalSave, boundedElapsed, acceptedConfigVersion)
persist reward + new lastServerSeenAt + new revision atomically
return updated save + OfflineSummary
```

The client does not submit elapsed offline seconds or directly apply the reward. If the claim request is retried, its idempotency key prevents a second grant.

## 16. Connectivity and Reconnection

### 16.1 Startup Failure

Without a server connection, the player remains at a connection-error screen with retry. There is no continue-offline action.

### 16.2 Brief Mid-Session Failure

```text
online
  -> degraded/reconnecting banner
  -> local solo gameplay continues for a short grace period
     -> reconnect and submit pending checkpoint
     -> grace period expires and gameplay pauses
```

The initial grace period is proposed as 60-120 seconds and should be configurable. During it, client-only presentation continues, but server-dependent actions are unavailable. When the grace period expires, a reconnect overlay pauses progression until the session is restored or the player returns to the welcome screen.

### 16.3 Crash Recovery

On restart:

1. Load the server's canonical progress.
2. Detect an unacknowledged recovery cache.
3. Resubmit it using its original `requestId` and `baseRevision`.
4. Accept the server result or discard/reconcile through explicit conflict handling.
5. Never replace the server snapshot solely because the local cache has a later device timestamp.

### 16.4 Two Devices

Only one active gameplay session may write a progression. A second device may request a session transfer. The server revokes the previous gameplay lease; the previous device transitions to a "session opened elsewhere" screen. The system does not merge two simultaneous gameplay sessions.

## 17. Foundational Validation and Security

The server validates at least:

- valid and active session;
- player ownership;
- accepted config version;
- exact expected revision;
- idempotent request identity;
- valid save shape;
- known item, skill, building, stage, and progression identifiers;
- non-negative/capped values where applicable;
- valid realm/progression ordering;
- plausible gains against server-observed elapsed time and known caps.

This validation protects canonical progress from obvious tampering without simulating every solo combat action. High-value future systems may move from snapshots to explicit server-validated commands. Competitive tower verification remains outside this design.

## 18. Error Handling Matrix

| Condition | Required behavior |
|---|---|
| No network at startup | Connection error with retry; no gameplay entry |
| Maintenance | Dedicated maintenance screen |
| Client version rejected | Update-required screen |
| Session expired | Attempt refresh; return to welcome/auth if refresh fails |
| Checkpoint timeout | Keep recovery cache and retry with the same request ID |
| Revision conflict | Stop writes and resolve against server metadata |
| Both guest and account progress exist | Show comparison and explicit selection |
| Invalid snapshot | Reject checkpoint and reload canonical state; retain diagnostic context |
| Corrupted server save | Non-destructive error screen and support/recovery path |
| Short mid-session outage | Banner plus grace period |
| Grace period exhausted | Pause and show reconnect overlay |
| Session transferred | Previous device stops writing and returns to a session-ended view |

## 19. Testing Strategy

### Unit Tests

- Every valid and invalid top-level boot-state transition.
- Guest creation and session restoration.
- Autosaves never overlap.
- Retried checkpoint preserves `requestId`.
- Duplicate request is applied once.
- Revision conflict never silently overwrites canonical progress.
- Recovery cache is deleted only after acknowledgment.
- Offline reward uses server time and respects its cap.
- Guest/account progress is never automatically merged.
- Connection grace period pauses gameplay when exhausted.

### Integration Tests

- New guest -> character creation -> canonical server save.
- Returning guest -> same progression.
- Guest links to an empty account -> ownership transfer.
- Guest logs into an account with progress -> compare -> select -> archive loser.
- Connection drops during autosave -> reconnect -> accepted retry.
- Crash after local cache but before acknowledgment -> idempotent recovery.
- Second device takes over -> old session loses write authority.
- Offline claim retry -> one grant.

### End-to-End Tests

- Launch -> Play now -> create character -> enter game.
- Relaunch -> continue guest character.
- Guest -> login -> compare two progressions -> select one.
- Startup connection failure -> retry -> recover.
- Mid-session disconnection -> reconnect overlay -> recover.
- Maintenance and update-required gates.

## 20. Implementation Sequencing Constraints

The implementation plan should preserve playable increments in this order:

1. Replace competing Main Menu/Auth rendering with the boot state machine and unified welcome surface.
2. Establish guest/account session restoration.
3. Introduce production server progress adapter while keeping the local adapter as a test/development fake.
4. Add revisioned idempotent checkpoint sync and recovery cache.
5. Move offline reward authority to the server.
6. Add progress comparison, selection, and archival.
7. Add connection grace period, reconnect overlay, and active-session transfer handling.
8. Harden validation and complete integration/E2E coverage.

Exact file changes and milestones belong in the subsequent implementation plan, not this design.

## 21. Deferred Extension: Tower Competition

Tower competition remains an acknowledged future direction, not an untracked omission. It may later require server-issued run tickets, frozen loadout snapshots, deterministic replay or bounded result verification, and server-only leaderboard updates. None of those mechanisms are required for the foundational online architecture approved here.

## 22. References

- Unity Cloud Save overview: <https://docs.unity.com/en-us/cloud-save/_index>
- Unity Cloud Save through trusted Cloud Code: <https://docs.unity.com/en-us/cloud-save/tutorials/cloud-code>
- Microsoft PlayFab offline game-save behavior: <https://learn.microsoft.com/en-us/gaming/playfab/player-progression/game-saves/offline>
