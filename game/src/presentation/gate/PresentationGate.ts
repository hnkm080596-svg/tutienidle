// The typed presentation gate.
//
// Mechanism 1 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md §4.
//
// Phaser's `registry` stays the transport. What changes is that the keys and
// their types are declared ONCE, here, instead of being restated as an
// `as { … }` cast at each of the reads. Measured before this module existed:
// 22 reads across 8 keys, 11 of them carrying a cast. A rename on the domain
// side produced no type error anywhere; it failed at runtime, inside a scene,
// usually as a silently missing visual.
import type { BattlePositionsEvent } from '@/core/battle/BattleEvents'
import type { ResumePlayback } from '@/core/battle/turn/CombatAnimationRuntime'
import type { TurnBattleEntitySnapshotEvent } from '@/core/battle/turn/TurnActionPresentationEvents'
import type { EventBus } from '@/core/events/EventBus'
import type { BattlefieldGeometrySnapshot } from '@/presentation/geometry/BattleGridProjection'
import type { PlayerVisualProfileId } from '@/presentation/art/PlayerVisualProfiles'
import type { KiemBarReader } from '@/presentation/bridges/kiemBarBridge'
import type { TheBarReader } from '@/presentation/bridges/theBarBridge'
import type { HoTheReader } from '@/presentation/bridges/hoTheBridge'

/**
 * What the dynamic layer may ask of the domain. Under §3.4 this list is
 * CLOSED: five members, three of which are the R5 acknowledgment triple.
 *
 * Adding a member is a three-part edit, deliberately inconvenient in proportion
 * to what it permits — see §4.3 of the spec. In short: edit this interface,
 * record the addition in §4.3 with the reason the existing members could not
 * carry it, and confirm the new member REPORTS rather than decides. A member
 * that selects an outcome, picks a target, or gates progression is refused.
 */
export interface DomainCommandPort {
  /** The visual step that leads a turn has finished playing. */
  acknowledgeTurnReady(token: string): void
  /** The action's impact frame has been reached. */
  acknowledgeActionImpact(token: string): void
  /** The action's playback, including its VFX, has fully finished. */
  acknowledgeActionComplete(token: string): void

  /** The token the domain currently expects; the scene echoes it back. */
  getPendingPlaybackToken(): string | null

  /** Whether a renderer is attached and drawing. Not a decision, a fact. */
  setPresentationActive?(active: boolean): void
}

/**
 * Queries a scene makes to rebuild its own view after attaching late or
 * resuming — distinct from `DomainCommandPort` on purpose.
 *
 * Found by measurement, not by design: §4.1 of the spec listed `gameManager` as
 * carrying `DomainCommandPort` alone, and the tree disagreed. `CombatScene`
 * also reads `getCombatPresentationSnapshot` and `preparePresentationResume`.
 * Rather than widen a port whose name says "command" — and quietly reopen the
 * closed list — the queries are named separately. The gate key carries both.
 */
export interface DomainSnapshotPort {
  getCombatPresentationSnapshot?(sessionId: number): {
    sessionId: number
    entities: TurnBattleEntitySnapshotEvent
  } | null

  preparePresentationResume?(): ResumePlayback | null
}

/**
 * The half of `PhaserSceneAdapter` a scene actually calls.
 *
 * Also a correction to §4.1, which said this key carries `RendererPort`. It
 * does not: `RendererPort` is `{ prepare, deactivate }` and a scene calls
 * neither. What the registry holds is the adapter itself; what a scene uses of
 * it is the one method below.
 */
export interface SceneReadyPort {
/**
   * Identity ack for the pending transition waiter. All three fields must
   * echo the adapter's start/rebind payload exactly: transitionId, the
   * session id (absent only for non-session routes like home), and the game
   * host generation. A missing field never matches - the waiter stays pending.
 */
  reportReady(context: { transitionId: number; sessionId?: number; gameGeneration: number }): boolean
}

/**
 * The half of the bundle manager `AssetLoaderScene` calls. Same correction as
 * above: §4.1 said `AssetPort` (`{ ensureFor }`), which no scene calls.
 */
export interface AssetLoaderHostPort {
  setLoaderScene(scene: unknown): void
}

/**
 * The latest `positions` event, with the time it arrived. A bare
 * `BattlePositionsEvent` would lose the timestamp, and the timestamp is what
 * `CombatScene` uses to reject a stale snapshot from a finished battle.
 */
export interface PositionsSnapshotEntry {
  event: BattlePositionsEvent
  at: number
}

/** Every key the registry carries, with the type it carries. */
export interface PresentationGateContents {
  gameManager: DomainCommandPort & DomainSnapshotPort
  eventBus: EventBus
  sceneAdapter: SceneReadyPort
  bundleManager: AssetLoaderHostPort
  playerVisualProfileId: PlayerVisualProfileId
  lastBattlePositionsSnapshot: PositionsSnapshotEntry | null
  battlefieldGeometry: BattlefieldGeometrySnapshot
  kiemBarReader: KiemBarReader
  theBarReader: TheBarReader
  // Phap Tu Reimagine (F13) -- live Ho The DR read for status tooltips.
  hoTheReader: HoTheReader
}

export type GateKey = keyof PresentationGateContents

/**
 * Keys whose absence is a WIRING BUG rather than a runtime condition.
 *
 * Narrower than §4.1's table, and the difference is measured rather than
 * chosen: the host seeds `sceneAdapter` and `bundleManager` conditionally
 * (`if (sceneAdapter)` at PhaserCanvas.vue), so a region can legitimately run
 * without them and demanding them would turn a supported configuration into a
 * crash. `battlefieldGeometry` is published BY a scene, so it is absent until
 * the first layout pass.
 */
export const REQUIRED_GATE_KEYS = ['gameManager', 'eventBus'] as const

export type RequiredGateKey = (typeof REQUIRED_GATE_KEYS)[number]

/** The minimum a `registry` must offer. Keeps this module free of Phaser. */
export interface GateRegistry {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

export class GateNotSeededError extends Error {
  constructor(key: RequiredGateKey) {
    super(
      `[PresentationGate] required key '${key}' is missing. The region was ` +
        `constructed without being seeded; this is a wiring bug at the host, ` +
        `not a runtime condition.`,
    )
    this.name = 'GateNotSeededError'
  }
}

/**
 * Read a key whose absence means the region was never wired. Throws.
 *
 * Throwing is the point (§4.2): a single accessor returning `T | undefined`
 * forces every caller to handle absence, which converts a seed-time wiring bug
 * into a slow, silent read-time failure — the exact class of defect this gate
 * exists to kill.
 */
export function readRequiredGate<K extends RequiredGateKey>(
  registry: GateRegistry,
  key: K,
): PresentationGateContents[K] {
  const value = registry.get(key)

  if (value === undefined || value === null) {
    throw new GateNotSeededError(key)
  }

  return value as PresentationGateContents[K]
}

/**
 * Read a key tolerantly. `undefined` when it is absent.
 *
 * Accepts EVERY key, including the required ones, and that is an amendment to
 * §4.2 forced by measurement rather than a softening of it. §4.2 read as though
 * the required/optional split partitioned *readers*. It does not — it partitions
 * what the HOST must seed. Scenes in this tree are deliberately written to
 * degrade instead of crash when a key is missing, and that tolerance is itself a
 * guarded regression: `CombatScene.hudWiring.test.ts` has a test named "scene
 * KHÔNG có registry (stub) → ẩn bar, không throw". Forcing those reads to throw
 * would trade a supported configuration for a crash.
 *
 * The wiring bug §4.2 wanted to catch is still caught, once, at the host —
 * see `assertGateSeeded`. That is a better place for it than a read three
 * frames into a battle.
 */
export function readOptionalGate<K extends GateKey>(
  registry: GateRegistry,
  key: K,
): PresentationGateContents[K] | undefined {
  return (registry.get(key) ?? undefined) as PresentationGateContents[K] | undefined
}

export function writeGate<K extends GateKey>(
  registry: GateRegistry,
  key: K,
  value: PresentationGateContents[K] | undefined,
): void {
  registry.set(key, value)
}

/**
 * Assert every required key is present, at the moment the host finishes
 * seeding.
 *
 * This is where §4.2's "seed-time validation" actually happens, and it is why
 * `readRequiredGate` exists even though every read site downstream tolerates
 * absence: the failure surfaces at the host, naming the key, rather than three
 * frames later as a missing sprite.
 */
export function assertGateSeeded(registry: GateRegistry): void {
  for (const key of REQUIRED_GATE_KEYS) {
    readRequiredGate(registry, key)
  }
}
