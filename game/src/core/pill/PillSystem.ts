import type { Pill } from './Pill'
import type { PillEffect } from './PillEffect'
import type { PlayerData } from '../player/Player'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import { MAIN_STAT_KEYS, type MainStatKey } from '../stats/StatTypes'
import { getEffectiveMainStatCap } from '../stats/StatCap'
import { addCultivation } from '../cultivation/CultivationSystem'
import { hasStaticPathCapability } from '../player/CultivationPathSystem'
import { getRequiredCultivation } from '../realm/realmSystem'
import type { BuffDefinition } from '../buff2/BuffDefinition'

/**
 * Nơi hiệu ứng pill thật sự ghi vào — do PillSystem không giữ
 * PlayerData/CombatEntity cụ thể (giống RewardSystem/RewardReceiver),
 * caller tự cung cấp adapter phù hợp với ngữ cảnh dùng pill
 * (ngoài trận: player store; trong trận: CombatEntity đang chiến đấu).
 */
export interface PillTarget {
  addCultivation(amount: number): void

  heal(amount: number): void

  // Unified Buff System (Task 13b) — trước đây PillSystem tự giữ 1
  // BuffSystem và gọi thẳng buffSystem.apply(effect.buff), nhưng
  // apply() giờ đòi hỏi (definition, source: CombatEntity, target:
  // CombatEntity, registry?) — PillSystem không giữ CombatEntity cụ
  // thể nào (đúng doc comment ở trên: "PillSystem không giữ
  // PlayerData/CombatEntity cụ thể"), nên adapter tự resolve entity
  // phù hợp ngữ cảnh của nó, giống addCultivation/heal.
  applyBuff(definition: BuffDefinition): void
}

export type PillUseReason = 'ok' | 'wrong_realm' | 'all_main_stats_capped' | 'requires_phap_tu' | 'cap'

export class PillSystem {
  /**
   * permanent_stat pills now write baseStats directly (ruling
   * 2026-09-29: only level-up allocation and pills may write baseStats,
   * so the hidden-lineage predicate - which reads baseStats only - can
   * actually be funded). The modifier bucket pill-permanent:<stat> is
   * retired; cap enforcement moved into canUseProfessionPill so both
   * pill stat channels share one bound (getEffectiveMainStatCap).
   */
  use(pill: Pill, target: PillTarget): void {
    // Gate lanes owned by usePillDetailed: a retired, material
    // (non-consumable) or realm-gated pill must never reach raw apply.
    // This method accepts only ungated legacy pills - every gated
    // family routes through the ops wrapper which evaluates the
    // retired/material/realm/battle gates first.
    if (pill.retired === true || pill.type === 'material' || pill.realmId !== undefined) {
      return
    }
    for (const effect of pill.effects) {
      this.applyEffect(effect, target)
    }
  }

  private applyEffect(effect: PillEffect, target: PillTarget, potencyMultiplier = 1): void {
    switch (effect.type) {
      case 'cultivation':
        target.addCultivation((effect.value ?? 0) * potencyMultiplier)

        return

      case 'heal':
        target.heal((effect.value ?? 0) * potencyMultiplier)

        return

      case 'buff':
        if (effect.buff) {
          target.applyBuff(effect.buff)
        }

        return

      default:
        return
    }
  }

  // =========================
  // PROFESSION PILLS (2026-08-24, resource-professions-rework sec.5) -
  // reason-gated, 4 MVP effects. Pills with realmId are gated to the
  // EXACT realm.
  // =========================

  canUseProfessionPill(pill: Pill, player: PlayerData): PillUseReason {
    // Exact-realm gate (plan sec.5.2) - only NEW pills carry realmId.
    // A defined-but-empty tag is authored-data drift, not an untagged
    // legacy pill - it must fail closed at every realm.
    if (pill.realmId !== undefined && pill.realmId !== player.realmId) {
      return 'wrong_realm'
    }

    // MP is a spell_pathway-only resource (maxMp = 0 on other paths) -
    // an MP-regen pill reports an error instead of silently wasting the
    // effect.
    const hasManaRegen = pill.effects.some(
      (effect) => effect.type === 'regen' && (effect.mpPerSecond ?? 0) > 0,
    )

    // M4 (R6): MP pills stay spell_pathway-only - P1 - the declared
    // 'spell.elemental_casting' capability is the check: it excludes
    // hidden_spell_pathway (which owns no element machinery) without a concrete
    // way predicate.
    if (hasManaRegen && !hasStaticPathCapability(player, 'spell.elemental_casting')) {
      return 'requires_phap_tu'
    }

    if (pill.effects.some((effect) => effect.type === 'random_main_stat')) {
      const cap = getEffectiveMainStatCap(player)
      const uncapped = MAIN_STAT_KEYS.filter((key) => (player.baseStats[key] ?? 0) < cap)

      if (uncapped.length === 0) {
        return 'all_main_stats_capped'
      }
    }

    // Cultivation% effects resolve getRequiredCultivation at apply
    // time - it throws on an incoherent realm, and the throw lands
    // mid-apply AFTER earlier effects (a permanent_stat grant) already
    // mutated. Preflight here keeps every throw ahead of any mutation,
    // so a failed use never leaves a partially-applied pill that could
    // re-grant on retry.
    if (
      pill.effects.some(
        (effect) => effect.type === 'cultivation' && effect.cultivationPercent !== undefined,
      )
    ) {
      getRequiredCultivation(player.realmId, player.realmLevel)
    }

    // permanent_stat writes baseStats now - same bound as every other
    // baseStats writer (level-up + pills share getEffectiveMainStatCap).
    // Accumulate per stat: two same-stat grants in one pill must not
    // each gate against the pre-use value and then evaporate on apply.
    const pendingByStat = new Map<string, number>()
    const mainCap = getEffectiveMainStatCap(player)
    for (const effect of pill.effects) {
      // Mirror apply's writability rule exactly: non-main/stat-less
      // targets and non-finite, non-integer or <=0 values never write,
      // so they must not gate the pill either (a skipped grant is not a
      // block). Stat grants are indivisible points - a fractional claim
      // is authored-data drift.
      if (
        effect.type !== 'permanent_stat' ||
        !effect.stat ||
        !(MAIN_STAT_KEYS as readonly string[]).includes(effect.stat) ||
        !Number.isFinite(effect.value ?? NaN) ||
        !Number.isInteger(effect.value ?? NaN) ||
        (effect.value ?? 0) <= 0
      ) {
        continue
      }

      const next = (pendingByStat.get(effect.stat) ?? 0) + (effect.value ?? 0)
      if ((player.baseStats[effect.stat] ?? 0) + next > mainCap) {
        return 'cap'
      }
      pendingByStat.set(effect.stat, next)
    }

    return 'ok'
  }

  /**
   * Apply a profession pill onto player (MUTATES player - the caller
   * consumes the bag entry AFTER success, atomic consumption plan
   * sec.5.2):
   * - permanent_stat: +N real points into the effect's Main Stat
   *   (baseStats - ruling 2026-09-29).
   * - random_main_stat: +1 real point into one UNCAPPED Main Stat
   *   (uniform roll over valid candidates, injected RNG for
   *   deterministic tests - plan sec.5.3).
   * - regen: builds a PersistentTimedEffect (absolute deadline, group
   *   'pill_regen' - GameManager.applyTimedEffect owns refresh policy).
   * - cultivation: % of the current tier's requirement through
   *   addCultivation (keeps the tier cap).
   * - skill_insight: adds skillInsight + totalSkillInsightGained in the
   *   same beat (Cam Ngo = skillInsight, plan sec.5.1).
   */
  useProfessionPill(
    pill: Pill,
    player: PlayerData,
    random: () => number = Math.random,
    // M3 (talent v4 sec.4.2) - Hoa Hau Thong Than: scales numeric pill
    // magnitudes (cultivation %, insight, regen rate). Indivisible grants
    // (a main-stat POINT) are not scaled.
    potencyMultiplier = 1,
    // Residual adapter for mixed-effect pills: an effect type outside
    // the profession vocabulary (heal/buff/flat-cultivation) is applied
    // through the same channel `use()` would use instead of silently
    // dropping it.
    target?: PillTarget,
  ): { mainStat?: MainStatKey; timedEffect?: PersistentTimedEffect } {
    let mainStat: MainStatKey | undefined
    let timedEffect: PersistentTimedEffect | undefined

    for (const effect of pill.effects) {
      if (effect.type === 'permanent_stat') {
        // Stat points granted by pills land in baseStats - the same
        // pool level-up writes (ruling 2026-09-29). Not scaled by
        // potency: indivisible stat grants keep parity with
        // random_main_stat (see comment block above). The min() keeps
        // the shared bound honest even if a future caller skips
        // canUseProfessionPill's cap gate.
        if (effect.stat) {
          if (
            !(MAIN_STAT_KEYS as readonly string[]).includes(effect.stat) ||
            !Number.isFinite(effect.value ?? NaN) ||
            !Number.isInteger(effect.value ?? NaN) ||
            (effect.value ?? 0) <= 0
          ) {
            // baseStats accepts every StatType, but the main-stat bound
            // only has meaning for MAIN_STAT_KEYS - and a grant value
            // must be a finite positive integer. Anything else is
            // authored-data drift, refuse the write.
            continue
          }
          const cap = getEffectiveMainStatCap(player)
          const base = player.baseStats[effect.stat] ?? 0
          // A base that is already non-finite or over-cap is not a
          // writable slot: `NaN ?? 0` is NaN, and clamping down would
          // silently DESTROY stat points the cap gate would have
          // refused to add to anyway (gate reads base >= cap). A
          // corrupted pool stays corrupted - the fold/restore layer
          // owns repair - it must not be laundered into a smaller
          // legal-looking value here.
          if (!Number.isFinite(base) || base >= cap) {
            continue
          }
          player.baseStats[effect.stat] = Math.min(cap, base + (effect.value ?? 0))
        }

        continue
      }

      if (effect.type === 'random_main_stat') {
        const cap = getEffectiveMainStatCap(player)
        const candidates = MAIN_STAT_KEYS.filter((key) => (player.baseStats[key] ?? 0) < cap)

        const stat = candidates[Math.floor(random() * candidates.length)] ?? candidates[0]

        if (stat) {
          // +1 REAL stat point into baseStats (plan sec.5.3).
          player.baseStats[stat] += 1
          mainStat = stat
        }

        continue
      }

      if (effect.type === 'regen') {
        const now = Date.now()

        timedEffect = {
          id: `pill-regen:${pill.id}:${now}`,

          sourceItemId: pill.id,

          effectGroup: effect.effectGroup ?? 'pill_regen',

          durationStackable: effect.stackable ?? false,

          appliedAtMs: now,

          expiresAtMs: now + (effect.durationSeconds ?? 0) * 1000,

          modifiers: [
            // Gameplay fixes (2026-09-05): removed the hpRegenPerTurn pill
            // modifier — drinking a pill for HP regen is meaningless under
            // the turn-based engine (user request). MP regen pill unaffected.
            {
              id: `pill-regen-mp:${pill.id}`,

              sourceId: pill.id,

              sourceType: 'pill',

              stat: 'manaRegenPerTurn',

              flat: (effect.mpPerSecond ?? 0) * potencyMultiplier,

              // Task 3 (D17): MP pool stat — spell credential so the
              // Task-7 domain gate keeps accepting this grant.
              domain: 'spell',
            },
          ],
        }

        continue
      }

      // Only the percent-of-tier form is profession vocabulary; a flat
      // {cultivation, value:N} is residual (legacy use() semantics) and
      // must fall through to the adapter below, not pay floor(x * 0)=0.
      if (effect.type === 'cultivation' && effect.cultivationPercent !== undefined) {
        // Tu Vi theo % yêu cầu tầng HIỆN TẠI lúc uống (plan §5.5), qua
        // addCultivation để giữ cap tầng.
        const required = getRequiredCultivation(player.realmId, player.realmLevel)

        addCultivation(player, Math.floor(required * effect.cultivationPercent * potencyMultiplier))

        continue
      }

      if (effect.type === 'skill_insight') {
        // Cảm Ngộ = skillInsight + lifetime counter, cùng transaction.
        // potency rounds to the nearest whole insight point.
        const amount = Math.round((effect.value ?? 0) * potencyMultiplier)

        player.skillInsight += amount
        player.totalSkillInsightGained += amount

        continue
      }

      // Residual vocabulary (heal/buff/flat-cultivation/...): apply via
      // the target adapter rather than dropping - a pill mixing a
      // profession effect with a legacy effect must pay both. Numeric
      // residuals scale with potency like every profession magnitude.
      if (target) {
        this.applyEffect(effect, target, potencyMultiplier)
      }
    }

    return { mainStat, timedEffect }
  }
}
