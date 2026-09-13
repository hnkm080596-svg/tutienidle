import type { PillBag } from '../pill/PillBag'
import type { PillRegistry } from '../pill/PillRegistry'
import type { PillSystem, PillTarget } from '../pill/PillSystem'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import type { PlayerData } from '../player/Player'
import { getCurrentRealm } from '../realm/realmSystem'
import { getAlchemyDoublePill } from '../talent/TalentEffects'
import type { MainStatKey } from '../stats/StatTypes'

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
    },
  ) {}

  /**
   * Pill consumption (2026-08-24, plan §5.2) - ATOMIC: all validation +
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
    reason?: 'not_found' | 'wrong_realm' | 'all_main_stats_capped' | 'requires_phap_tu' | 'cap'
    mainStat?: MainStatKey
  } {
    if (!this.deps.pillBag.has(pillId, 1)) {
      return { ok: false, reason: 'not_found' }
    }

    const pill = this.deps.pillRegistry.get(pillId)

    // Exact-realm gate for profession pills (plan §5.2).
    if (pill.realmId && pill.realmId !== player.realmId) {
      return { ok: false, reason: 'wrong_realm' }
    }

    const isProfessionPill = pill.effects.some(
      (effect) =>
        effect.type === 'random_main_stat' ||
        effect.type === 'regen' ||
        effect.type === 'skill_insight' ||
        (effect.type === 'cultivation' && effect.cultivationPercent !== undefined),
    )

    if (isProfessionPill) {
      const reason = this.deps.pillSystem.canUseProfessionPill(pill, player)

      if (reason !== 'ok') {
        return { ok: false, reason }
      }

      const result = this.deps.pillSystem.useProfessionPill(
        pill,
        player,
        random,
        // M3 — Hoa Hau Thong Than: +50% effectiveness on crafted pills.
        getAlchemyDoublePill(player.selectedTalentIds)?.potencyMultiplier ?? 1,
      )

      if (result.timedEffect) {
        this.deps.applyTimedEffect(player, result.timedEffect)
      }

      this.deps.pillBag.remove(pillId, 1)

      return { ok: true, mainStat: result.mainStat }
    }

    // Legacy path - unchanged old behavior (permanent_stat cap + heal/
    // buff/flat cultivation).
    const cap = getCurrentRealm(player.realmId).attributeCap

    if (!this.deps.pillSystem.canUse(pill, player, cap)) {
      return { ok: false, reason: 'cap' }
    }

    const permanentModifiers = this.deps.pillSystem.use(pill, target)

    for (const modifier of permanentModifiers) {
      const existing = player.modifiers.find((candidate) => candidate.id === modifier.id)

      if (existing) {
        existing.flat = (existing.flat ?? 0) + (modifier.flat ?? 0)
      } else {
        player.modifiers.push(modifier)
      }
    }

    this.deps.pillBag.remove(pillId, 1)

    return { ok: true }
  }

  usePill(pillId: string, target: PillTarget, player: PlayerData): boolean {
    return this.usePillDetailed(pillId, target, player).ok
  }
}
