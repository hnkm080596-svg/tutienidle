import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffSystem } from '../buff/BuffSystem'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { BuffDefinition } from '../buff/BuffDefinition'
import type { TurnBattle } from '../battle/turn/TurnBattleSystem'
import { HERO_LANE_INDEX } from '../battle/BattleLane'
import type { EquipmentBag } from '../equipment/EquipmentBag'
import type { EquipmentSlotManager } from '../equipment/EquipmentSlotManager'
import { EQUIPMENT_SLOTS } from '../equipment/EquipmentSlotState'
import type { MaterialBag } from '../material/MaterialBag'
import type { MaterialRegistry } from '../material/MaterialRegistry'
import {
  TU_LINH_TRAN_BUFF_PERCENT,
  TU_LINH_TRAN_DURATION_MS,
  TU_LINH_TRAN_EFFECT_GROUP,
  getTuLinhTranCost,
} from '../economy/TuLinhTranBalance'
import type { PlayerData } from '../player/Player'
import { playerToCombatEntity } from '../player/Player'
import type { PersistentTimedEffect } from '../player/PersistentTimedEffect'
import { getCultivationPathStatModifiers } from '../player/CultivationPathSystem'
import { getRouteStatModifiers } from '../phap-tu/PhapTuRoutes'
import type { NodeRegistry } from '../progression/NodeRegistry'
import { aggregateNodeStatModifiers } from '../progression/NodeSystem'
import type { SkillSystem } from '../skill/SkillSystem'
import type { Stats } from '../stats/StatBlock'
import { createBaseStats } from '../stats/StatBlock'
import type { StatModifier } from '../stats/StatCalculator'
import type { TechniqueManager } from '../technique/TechniqueManager'
import { getTechniqueInsightTotalRequired, getTechniqueTier } from '../technique/TechniqueTier'

/**
 * Persistent/live modifier authority: static aggregation (buff + equipped
 * technique + passive skills + node levels), timed effects
 * (PersistentTimedEffect on PlayerData), Tu Linh Tran, socket Phu/Tran
 * slot modifiers, and the out-of-combat persistent buff path.
 * Extracted from GameManager (large-file split); moved verbatim.
 *
 * Public access: `gameManager.effectOps.*` (no GameManager facade).
 */
export class GameManagerPersistentEffectOps {
  constructor(
    private readonly deps: {
      buffSystem: BuffSystem
      buffRegistry: BuffRegistry
      skillSystem: SkillSystem
      techniqueManager: TechniqueManager
      nodeRegistry: NodeRegistry
      equipmentBag: EquipmentBag
      equipmentSlotManager: EquipmentSlotManager
      materialRegistry: MaterialRegistry
      materialBag: MaterialBag
      getActivePlayer: () => PlayerData | undefined
      getTurnBattle: () => TurnBattle | null
    },
  ) {}

  /**
   * Aggregated modifiers from Buff + equipped Technique + equipped passive
   * Skills. PassiveSystem stacks passiveModifiers directly onto the Skill
   * object (see PassiveSystem.ts) so they can be read straight from
   * skillManager - no separate "merge" step like the old comment mentioned.
   *
   * This is the ONLY place in the game that aggregates modifiers in real
   * time. player.ts (store) just calls this each tick instead of merging
   * buffSystem/techniqueSystem/skillManager itself.
   *
   * `player` optional (defaults to skipping technique tier) - many legacy
   * call sites (test files, a few panel refreshes) call this WITHOUT a
   * PlayerData handy; the old signature stays valid. The real per-tick
   * call site (App.vue) ALWAYS passes player so the technique tier takes
   * effect - see getTechniqueTierModifiers().
   */
  getAggregatedModifiers(player?: PlayerData): StatModifier[] {
    // STATIC-ONLY (2026-08-24, plan §5.4): timed effects + Phu/Tran
    // sockets are LIVE modifiers - intentionally excluded here so the
    // finalStats callers pass into battle is a clean static snapshot
    // (no double-apply); combat recompute gets runtime modifiers via the
    // provider each tick, menus display via the store getter plus
    // getActiveRuntimeModifiers().
    return [
      ...this.deps.buffSystem.getActiveModifiers(),
      // Core Loop Foundation checklist (Muc SKILL) - via
      // getScaledPassiveModifiers() instead of reading
      // skill.passiveModifiers directly, so Specialization + level
      // scaling applies.
      ...this.deps.skillSystem.getScaledPassiveModifiers(),
      ...(player ? this.getTechniqueTierModifiers(player) : []),
      ...(player ? getCultivationPathStatModifiers(player) : []),
      // Phap Tu Reimagined Task 3 — route stat modifiers ride the
      // STATIC partition in BOTH aggregators (route can't change
      // mid-battle — never getLiveBattleModifiers).
      ...(player ? getRouteStatModifiers(player) : []),
      // Node levels (plan §6.8) - node modifiers derived from (registry,
      // nodeLevels), scaled by current level; no longer inside
      // player.modifiers.
      ...(player ? aggregateNodeStatModifiers(this.deps.nodeRegistry, player) : []),
      // combat-gate-teleport-autocast plan §9 - combatModifiers of the
      // EQUIPPED technique: fixed, tier-independent, only while equipped.
      // This is the ONLY aggregation path so it is never double-counted.
      // (No technique currently declares combatModifiers — the old +2
      // range grant retired with the attackRange stat in Task 3/D16.)
      ...this.getTechniqueCombatModifiers(),
    ]
  }

  /**
   * ARCH-002 (M7) — the STATIC partition of the aggregation: sources that
   * cannot change during a battle (technique tier, cultivation path, node
   * levels, equipped-technique combat modifiers). The battle entry ops
   * resolve the entity's baseStats from this list via
   * resolvePlayerFinalStats() — duration/stack-bound sources are excluded
   * on purpose so they reach combat ONLY through getLiveBattleModifiers()
   * (baking them into the resolved base would double-apply and re-leak
   * stale stacks between battles).
   */
  getBattleBaseModifiers(player: PlayerData): StatModifier[] {
    return [
      ...this.getTechniqueTierModifiers(player),
      ...getCultivationPathStatModifiers(player),
      ...getRouteStatModifiers(player),
      ...aggregateNodeStatModifiers(this.deps.nodeRegistry, player),
      ...this.getTechniqueCombatModifiers(),
    ]
  }

  /**
   * ARCH-002 (M7) — the LIVE partition: modifiers bound to runtime state
   * that can change mid-battle — the persistent buff pool (Kiep Thuong
   * debuffs et al), scaled passive-skill stacks (PassiveSystem mutates
   * stacks on combat events), timed effects and Phu/Tran sockets.
   * TurnBattleSystem reads this through its liveStatModifiers provider at
   * every effective-stat refresh; the menu mirror keeps showing the same
   * union via getAggregatedModifiers() + getActiveRuntimeModifiers().
   */
  getLiveBattleModifiers(player: PlayerData): StatModifier[] {
    return [
      ...this.deps.buffSystem.getActiveModifiers(),
      ...this.deps.skillSystem.getScaledPassiveModifiers(),
      ...this.getActiveRuntimeModifiers(player),
    ]
  }

  /** Fixed combat modifiers of the equipped technique (plan §9). */
  private getTechniqueCombatModifiers(): StatModifier[] {
    const technique = this.deps.techniqueManager.getEquipped()

    if (!technique?.equipped || !technique.combatModifiers) {
      return []
    }

    return [...technique.combatModifiers]
  }

  /**
   * PLAN HOAN CHINH §5 rework (2026-08-20) - stat effects of the EQUIPPED
   * technique at its CURRENT tier (getTechniqueTier(), now computed from
   * techniqueExperience - the technique's own XP bar, see
   * TechniqueTier.ts). manaRegenIncreasePercent deliberately maps into
   * percent OF the manaRegenPerTurn stat (standard Increased, see
   * StatCalculator.ts's runPipeline) instead of %maxMp - %maxMp would
   * create a dependency cycle (maxMp is not computed yet at this merge
   * step). Task 3 (D17): MP-pool modifiers carry domain:'phap_tu' so the
   * Task-7 gate accepts them once maxMp/manaRegenPerTurn are gated.
   */
  private getTechniqueTierModifiers(_player: PlayerData): StatModifier[] {
    const technique = this.deps.techniqueManager.getEquipped()

    const effect =
      technique?.tierEffects?.[
        getTechniqueTier(technique.insight ?? 0, getTechniqueInsightTotalRequired(technique))
      ]

    if (!effect) {
      return []
    }

    const modifiers: StatModifier[] = []

    if (effect.mightFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:might`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'might',
        flat: effect.mightFlat,
      })
    }

    if (effect.defenseFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:defense`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'defense',
        flat: effect.defenseFlat,
      })
    }

    if (effect.maxMpIncreasePercent !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:maxMp`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'maxMp',
        percent: effect.maxMpIncreasePercent,
        domain: 'phap_tu',
      })
    }

    if (effect.manaRegenIncreasePercent !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:manaRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'manaRegenPerTurn',
        percent: effect.manaRegenIncreasePercent,
        domain: 'phap_tu',
      })
    }

    // Requirement 2026-08-26 - default HP/turn & MP/turn of the technique: flat
    // directly onto the 2 per-turn regen stats, applied to EVERY
    // technique declaring tierEffects.
    if (effect.hpRegenFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:hpRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'hpRegenPerTurn',
        flat: effect.hpRegenFlat,
      })
    }

    if (effect.mpRegenFlat !== undefined) {
      modifiers.push({
        id: `technique-tier:${technique!.id}:mpRegen`,
        sourceId: technique!.id,
        sourceType: 'technique',
        stat: 'manaRegenPerTurn',
        flat: effect.mpRegenFlat,
        domain: 'phap_tu',
      })
    }

    return modifiers
  }

  getActiveTimedModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return player.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > now)
      .flatMap((effect) => effect.modifiers)
  }

  /**
   * ALL live modifiers of the player: timed effects + Phu/Tran sockets on
   * equipped slots. Battle recompute calls this via the provider each
   * tick - an effect expiring mid-fight simply drops out of the next
   * recompute.
   */
  getActiveRuntimeModifiers(player: PlayerData, now = Date.now()): StatModifier[] {
    return [...this.getActiveTimedModifiers(player, now), ...this.getSlotModifiers()]
  }

  /**
   * Stack policy MVP (plan §5.4): same effectGroup -> refresh deadline
   * (max) and keep the stronger value per-modifier; different group ->
   * append new.
   *
   * Merge key is the modifier's REAL identity: `stat` + `tag` (tag
   * distinguishes the Increased pool in runPipeline(), see
   * StatCalculator) - `percent` is NOT the key (audit bug P0-1: two
   * different percents of the same stat would not match and stack outside
   * policy). On match, pick the stronger value SEPARATELY for
   * flat/percent/multiplier so the weak and strong modifiers cannot
   * coexist.
   */
  applyTimedEffect(player: PlayerData, effect: PersistentTimedEffect) {
    const group = effect.effectGroup

    if (group) {
      const existing = player.persistentTimedEffects.find(
        (candidate) => candidate.effectGroup === group,
      )

      if (existing) {
        if (effect.durationStackable) {
          const duration = Math.max(0, effect.expiresAtMs - effect.appliedAtMs)
          existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
        } else {
          existing.expiresAtMs = Math.max(existing.expiresAtMs, effect.expiresAtMs)
        }

        for (const modifier of effect.modifiers) {
          const old = existing.modifiers.find(
            (candidate) => candidate.stat === modifier.stat && candidate.tag === modifier.tag,
          )

          if (!old) {
            existing.modifiers.push(modifier)

            continue
          }

          if ((modifier.flat ?? 0) > (old.flat ?? 0)) {
            old.flat = modifier.flat
          }

          if ((modifier.percent ?? 0) > (old.percent ?? 0)) {
            old.percent = modifier.percent
          }

          if ((modifier.multiplier ?? 1) > (old.multiplier ?? 1)) {
            old.multiplier = modifier.multiplier
          }
        }

        return
      }
    }

    player.persistentTimedEffects.push(effect)
  }

  /** Drops expired effects - returns the count dropped (debug/test). */
  tickTimedEffects(player: PlayerData, now = Date.now()): number {
    const before = player.persistentTimedEffects.length

    player.persistentTimedEffects = player.persistentTimedEffects.filter(
      (effect) => effect.expiresAtMs > now,
    )

    return before - player.persistentTimedEffects.length
  }

  /**
   * TU LINH TRAN (economy-fixes-sinks-plan §3.2 B1, 2026-08-29) - the
   * spirit-stone sink buying % cultivation speed for 24h. Cost scales
   * with the number of active effects in the SAME group (expiresAtMs >
   * now); only ONE effect of that group exists at a time
   * (applyTimedEffect's MVP stack policy refreshes the deadline). Atomic
   * transaction: insufficient spirit stones -> nothing is deducted.
   */
  activateTuLinhTran(player: PlayerData, now = Date.now()): { ok: boolean; reason?: string } {
    const activeStacks = player.persistentTimedEffects.filter(
      (effect) => effect.effectGroup === TU_LINH_TRAN_EFFECT_GROUP && effect.expiresAtMs > now,
    ).length

    const cost = getTuLinhTranCost(player.realmId, activeStacks)

    if (!this.deps.materialRegistry.has(cost.materialId) || !this.deps.materialBag.has(cost.materialId, cost.amount)) {
      return { ok: false, reason: 'missing_spirit_stone' }
    }

    this.deps.materialBag.remove(cost.materialId, cost.amount)

    this.applyTimedEffect(player, {
      id: 'tu_linh_tran',

      sourceItemId: 'tu_linh_tran',

      effectGroup: TU_LINH_TRAN_EFFECT_GROUP,

      appliedAtMs: now,

      expiresAtMs: now + TU_LINH_TRAN_DURATION_MS,

      modifiers: [],

      cultivationSpeedPercent: TU_LINH_TRAN_BUFF_PERCENT,
    })

    return { ok: true }
  }

  /**
   * SINGLE source aggregating the 2+2 Phu/Tran modifiers on slots that
   * currently hold equipment (plan §7.2). Socket modifiers keep
   * sourceId/sourceType stable for tooltip/debug tracing; they never go
   * into the baseStats snapshot.
   */
  getSlotModifiers(): StatModifier[] {
    const result: StatModifier[] = []

    for (const slot of EQUIPMENT_SLOTS) {
      if (!this.deps.equipmentBag.getEquippedInSlot(slot)) {
        continue
      }

      const state = this.deps.equipmentSlotManager.get(slot)

      if (state.socketedTalisman) {
        result.push(...state.socketedTalisman.modifiers)
      }

      if (state.socketedFormation) {
        result.push(...state.socketedFormation.modifiers)
      }
    }

    return result
  }

  /**
   * Applies a PERSISTENT (out-of-battle) buff/debuff to the player - used
   * for Kiep Thuong on a failed Tribulation (§13 of the `breakthrough`
   * spec). Same buffSystem/buffManager feeding getAggregatedModifiers()
   * each tick (same mechanism as PillSystem's 'buff' effect).
   */
  // Unified Buff System (Task 9b, fix round 2) - BuffSystem.apply() now
  // requires a real source/target CombatEntity (to read
  // ailmentResistPercent/ailmentDurationPercent for duration scaling),
  // even for a buff with no dot effect like KIEP_THUONG_DEBUFF.
  // `stats` (the caller's already-calculateStats()'d Stats, same
  // `player.finalStats` pattern startTribulation()/startBattleWithPlayer()
  // already use - see useTribulation.ts's resolveDefeat()) lets us build
  // the REAL player CombatEntity via playerToCombatEntity() (same helper
  // battle start uses), so this debuff's resist/duration correctly reads
  // the player's actual gear. Falls back to the in-battle entity if one
  // somehow exists, then to a fully-populated neutral ghost only if
  // neither is available (today: only reachable if a caller forgets to
  // pass `stats` - see resolvePersistentBuffEntity()).
  applyPersistentBuff(buff: BuffDefinition, stats?: Stats) {
    const entity = this.resolvePersistentBuffEntity(stats)

    this.deps.buffSystem.apply(buff, entity, entity, this.deps.buffRegistry)
  }

  // Shared entity resolution for applyPersistentBuff() and the per-tick
  // buffSystem.update() call in tick() - both need 1 CombatEntity to hand
  // BuffSystem, and neither has one implicitly guaranteed outside battle
  // (GameManager keeps no persistent player CombatEntity of its own; only
  // playerToCombatEntity() at battle start, which needs `Stats` already
  // calculateStats()'d by the Pinia store - GameManager deliberately
  // avoids calling calculateStats() itself to prevent 2 divergent call
  // sites, see startBattleWithPlayer()'s note). Preference order: real
  // in-battle entity > real player entity built from caller-supplied
  // `stats` (mirrors startBattleWithPlayer()'s own construction) > fully-
  // populated neutral ghost.
  private resolvePersistentBuffEntity(stats?: Stats): CombatEntity {
    // C1 (2026-09-08) - the live in-battle entity now comes from the
    // turn battle's player participant (was: the legacy mirror battle's
    // player).
    const activeBattle = this.deps.getTurnBattle()

    if (activeBattle) {
      return activeBattle.players[0]!.entity
    }

    const activePlayer = this.deps.getActivePlayer()

    if (stats && activePlayer) {
      return playerToCombatEntity(activePlayer, stats)
    }

    return this.createPersistentBuffGhostEntity()
  }

  // Fully-populated neutral placeholder CombatEntity (no gear, no active
  // buffs, every non-optional CombatEntity field explicitly set - NOT an
  // `as CombatEntity` cast papering over missing fields) used only when
  // resolvePersistentBuffEntity() has neither a real in-battle entity nor
  // caller-supplied Stats to build one from. Safe even for a future
  // persistent buff with a `dot` effect (combatSystem.applyDotDamage()
  // would read real currentHp/maxHp/alive, not undefined).
  private createPersistentBuffGhostEntity(): CombatEntity {
    const stats = createBaseStats()
    const activePlayer = this.deps.getActivePlayer()

    return {
      id: 'player',
      name: activePlayer?.name ?? 'player',
      type: 'player',
      baseStats: stats,
      stats,
      currentHp: stats.maxHp,
      maxHp: stats.maxHp,
      currentMp: stats.maxMp,
      currentMomentum: 0,
      currentWard: 0,
      turnsSinceLastHitLanded: Infinity,
      realmIndex: 0,
      x: 0,
      row: HERO_LANE_INDEX,
      alive: true,
    }
  }
}
