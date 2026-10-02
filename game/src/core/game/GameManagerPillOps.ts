import type { PillBag } from '../pill/PillBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillSystem, PillTarget } from '../pill/PillSystem'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import type { PlayerData } from '../player/Player'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import type { MainStatKey } from '../stats/StatTypes'
import { scopeHiddenPillFamilyOfId } from '../betaScope'

/**
 * Pill consumption operations. Extracted from GameManager (large-file
 * split); moved verbatim.
 *
 * Public access: `gameManager.pillOps.*` (no GameManager facade).
 */
export class GameManagerPillOps {
  constructor(
    private readonly deps: {
      pillBag: PillBag
      pillRegistry: PillRegistry
      pillSystem: PillSystem
      applyTimedEffect: (player: PlayerData, effect: PersistentTimedEffect) => void
      // Same out-of-combat gate the other baseStats writer
      // (allocateAttributePoint) enforces - a running battle never reads
      // baseStats it did not mint, so mid-battle grants would be
      // battle-invisible; the pill stays in the bag instead.
      isTurnBattleInProgress: () => boolean
    },
  ) {}

  /**
   * Pill consumption (2026-08-24, plan S5.2) - ATOMIC: all validation +
   * apply succeed before the pill is removed from PillBag. Profession
   * pills (with realmId): exact-realm gate + 4 MVP effects; legacy pills
   * (no realmId) keep the old behavior. `random` injects the main-stat
   * roll.
   */
  usePillDetailed(
    pillId: string,
    target: PillTarget,
    player: PlayerData,
    random: () => number = Math.random,
  ): {
    ok: boolean
    reason?: 'not_found' | 'wrong_realm' | 'all_main_stats_capped' | 'requires_phap_tu' | 'cap' | 'retired' | 'material_pill' | 'in_battle' | 'scope_hidden'
    mainStat?: MainStatKey
  } {
    if (!this.deps.pillBag.has(pillId, 1)) {
      return { ok: false, reason: 'not_found' }
    }

    const pill = this.deps.pillRegistry.get(pillId)

    // M10 (ARCH-008) - retired families (Hoi Xuan Dan) are unavailable:
    // explicit rejection, pill stays in the bag. Retired trumps every
    // other gate so the player sees the real reason.
    if (pill.retired === true) {
      return { ok: false, reason: 'retired' }
    }

    // Mission E Task 2 (audit T1-10): type 'material' pills (Thong Mach
    // Dan / Truc Co Dan) are not consumables - their sinks live outside
    // this path (meridian chapter, breakthrough gate). Domain-side reject
    // so every caller inherits it (A2); the pill stays in the bag.
    if (pill.type === 'material') {
      return { ok: false, reason: 'material_pill' }
    }

    // BETA SCOPE LOCK v2 - a carried save's dormant-family pills stay
    // inert: consuming one would apply a scope-hidden effect into
    // live play (same seam class as the hostile-save flag readers).
    // Unknown/legacy ids return null - only authored dormant families
    // are rejected.
    if (scopeHiddenPillFamilyOfId(pillId) !== null) {
      return { ok: false, reason: 'scope_hidden' }
    }

    // Exact-realm gate for profession pills (plan S5.2). A defined-
    // but-empty tag is authored-data drift - fail closed at any realm.
    if (pill.realmId !== undefined && pill.realmId !== player.realmId) {
      return { ok: false, reason: 'wrong_realm' }
    }

    // permanent_stat joined the profession path 2026-09-29 (ruling:
    // pills write baseStats directly - the hidden predicate reads
    // baseStats only, so a modifier channel could never fund it).
    const isProfessionPill = pill.effects.some(
      (effect) =>
        effect.type === 'permanent_stat' ||
        effect.type === 'random_main_stat' ||
        effect.type === 'regen' ||
        effect.type === 'skill_insight' ||
        (effect.type === 'cultivation' && effect.cultivationPercent !== undefined),
    )

    // Out-of-combat gate for baseStats-writing effects - mirrors
    // allocateAttributePoint: a running battle minted its stats already,
    // so a mid-battle grant would be invisible until post-battle resync.
    // Only stat-granting pills are refused; heal/regen/buff keep working
    // mid-fight (their effects land on the live entity).
    if (
      this.deps.isTurnBattleInProgress() &&
      pill.effects.some((e) => e.type === 'permanent_stat' || e.type === 'random_main_stat')
    ) {
      return { ok: false, reason: 'in_battle' }
    }

    if (isProfessionPill) {
      const reason = this.deps.pillSystem.canUseProfessionPill(pill, player)

      if (reason !== 'ok') {
        return { ok: false, reason }
      }

      // Consume-on-throw: an apply that throws mid-way may already have
      // mutated (a permanent_stat grant before a later effect failed).
      // A retained pill would re-grant on retry - consumption is the
      // fail-closed direction even when the throw mutated nothing.
      let result: { mainStat?: MainStatKey; timedEffect?: PersistentTimedEffect }
      try {
        result = this.deps.pillSystem.useProfessionPill(
          pill,
          player,
          random,
          // M3 - Hoa Hau Thong Than: +50% effectiveness on crafted pills.
          getAlchemyDoublePill(player.selectedTalentIds, player.talentLevels)?.potencyMultiplier ?? 1,
          target,
        )
      } catch (error) {
        this.deps.pillBag.remove(pillId, 1)
        throw error
      }

      // Consume BEFORE the timed-effect side channel: if
      // applyTimedEffect throws, the stat grant is already applied -
      // a retained pill would double-grant on retry. Losing one timed
      // effect is strictly less harmful than a free extra grant.
      this.deps.pillBag.remove(pillId, 1)

      if (result.timedEffect) {
        this.deps.applyTimedEffect(player, result.timedEffect)
      }

      return { ok: true, mainStat: result.mainStat }
    }

    // Legacy path - heal/buff/flat-cultivation pills with no realmId.
    // Side effects run through the target adapter; nothing produces
    // StatModifier anymore (the pill-permanent bucket is retired).
    this.deps.pillSystem.use(pill, target)

    this.deps.pillBag.remove(pillId, 1)

    return { ok: true }
  }

  usePill(pillId: string, target: PillTarget, player: PlayerData): boolean {
    return this.usePillDetailed(pillId, target, player).ok
  }
}
