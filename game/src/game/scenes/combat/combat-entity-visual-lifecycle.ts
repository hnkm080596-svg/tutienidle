// Entity Visual Lifecycle (roadmap "CombatScene rule" mechanism) - the one
// owner of whether a combatant's whole sprite (body, label, shadow, health
// bar) is on screen. Lifecycle: pending (pre-combat gating, hidden) ->
// materializing (telegraph ended, fade-in on next reconcile) -> visible.
// The legacy real-time player path keeps its single materialized flag here.
// Decides visibility only; CombatGridView.setSpriteVisible applies it.
import type { CombatScene } from '../CombatScene'
import type { EntitySprite } from './combatTypes'

export class CombatEntityVisualLifecycle {
  private pendingSet = new Set<string>()
  private materializingSet = new Set<string>()
  private playerMaterializedFlag = true

  constructor(private readonly scene: CombatScene) {}

  get pending(): ReadonlySet<string> {
    return this.pendingSet
  }

  get materializing(): ReadonlySet<string> {
    return this.materializingSet
  }

  get playerMaterialized(): boolean {
    return this.playerMaterializedFlag
  }

  /** Pre-combat gating: ids stay hidden until revealPending(). */
  markPending(ids: Iterable<string>): void {
    for (const id of ids) {
      this.pendingSet.add(id)
    }
  }

  isPending(id: string): boolean {
    return this.pendingSet.has(id)
  }

  /** Apply gating to a sprite that was just created: visible iff not pending. */
  applyGating(id: string, sprite: EntitySprite): void {
    this.scene.gridView.setSpriteVisible(sprite, !this.pendingSet.has(id))
  }

  /** Countdown-end flush: reveal union of pending ids + `aliveIds`, then clear pending. Only existing sprites are touched. */
  revealPending(aliveIds: Iterable<string>): void {
    const revealedIds = new Set(this.pendingSet)

    for (const id of aliveIds) {
      revealedIds.add(id)
    }

    for (const id of revealedIds) {
      const sprite = this.scene.sprites.get(id)

      if (sprite) {
        this.scene.gridView.setSpriteVisible(sprite, true)
      }
    }

    this.pendingSet.clear()
  }

  /** Wave telegraph ended for id: fade-in when its sprite next reconciles. */
  markMaterializing(id: string): void {
    this.materializingSet.add(id)
  }

  /** If id is materializing: consume the mark and play scene.playMaterializeFadeIn(sprite). Returns true if consumed. */
  consumeMaterializing(id: string, sprite: EntitySprite): boolean {
    if (!this.materializingSet.delete(id)) {
      return false
    }

    this.scene.playMaterializeFadeIn(sprite)

    return true
  }

  /** Legacy real-time player telegraph: hide sprite (if any) and mark not materialized. */
  hidePlayer(sprite: EntitySprite | undefined): void {
    if (sprite) {
      this.scene.gridView.setSpriteVisible(sprite, false)
    }

    this.playerMaterializedFlag = false
  }

  /** Legacy real-time player materialize: if not yet materialized and sprite exists, show + fade-in. Marks materialized either way. */
  materializePlayer(sprite: EntitySprite | undefined): void {
    if (!this.playerMaterializedFlag && sprite) {
      this.scene.gridView.setSpriteVisible(sprite, true)
      this.scene.playMaterializeFadeIn(sprite)
    }

    this.playerMaterializedFlag = true
  }

  /** Mark player materialized without touching a sprite (sprite 'create' reconcile / shutdown reset). */
  markPlayerMaterialized(): void {
    this.playerMaterializedFlag = true
  }

  /** Drop pending + materializing marks (battle start / scene shutdown). Does NOT touch the player flag - callers order that explicitly, as today. */
  clear(): void {
    this.pendingSet.clear()
    this.materializingSet.clear()
  }
}
