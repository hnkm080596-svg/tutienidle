// Turn-Based Combat Completion (Task 8) — cầu nối GameManager ↔ TurnBattle.
// Adapter chuyển CombatEntity (đã có từ playerToCombatEntity/
// enemyToCombatEntity) thành TurnBattleParticipant, đọc speed THẬT từ
// Stat System (stats.speed, đã rename ở conversion trước).
import type { CombatEntity } from '../combat/CombatEntity'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import type { TurnSkillDefinition, TurnSkillSlot } from '../battle/turn/TurnSkillAction'
import { CULTIVATION_PATH_STAT_DOMAINS, type StatDomain } from '../stats/StatDomain'
import { BuffPool } from '../buff/BuffPool'

/**
 * Kiem Tu Reimagined (Task 6) — the buildId special/ultimate maps were
 * removed: hien Kiem Pho has no special/ult (the preset IS the kit) and
 * ngu emblems arrive via resolvedSpecialUltimate (Task 9). The legacy
 * Bạt Kiếm/Kiếm Trận kit they pointed at retires in Task 12.
 */

export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
  buildId?: string,
  resolvedSpecialUltimate?: {
    special?: TurnSkillDefinition
    ultimate?: TurnSkillDefinition
    reactivePayloads?: Record<string, TurnSkillDefinition>
    /** Task 20 — the_tu_an proc-fuel cap (MAX_THE + node bonus); stamped
     * onto the entity here so every Thế transaction clamps via
     * `entity.maxThe ?? MAX_THE` (TheEconomy.theCap). */
    maxThe?: number
  },
): TurnBattleParticipant {
  const participant: TurnBattleParticipant = {
    id: entity.id,
    entity,
    // R2 (AR-05): participant.speed starts as a copy of effective speed
    // and is a READ-ONLY CACHE — the engine re-syncs it from
    // entity.stats.speed at every recompute/pacing step. Never write it
    // independently; effective combat stats own the speed value.
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
    // stat-system-reimagined review fix (2026-09-15) — buildId carries
    // the player's cultivationPath at the GameManager call site; the
    // explicit path->domains map declares which stat domains the
    // participant owns, scoping domain deltaDerivers (phap_tu
    // attunement->MP) in calculateEffectiveStats. Enemies/companions
    // pass no buildId -> no domain derivers ever run for them. A path
    // owning an existing domain (phap_tu_an -> phap_tu) maps here, NOT
    // into StatDomain.
    activeDomains:
      buildId !== undefined && CULTIVATION_PATH_STAT_DOMAINS[buildId] !== undefined
        ? new Set<StatDomain>(CULTIVATION_PATH_STAT_DOMAINS[buildId])
        : undefined,
    // Review fix (MED-3) — wuxing reaction initiation belongs to the
    // phap_tu stat domain (phap_tu + phap_tu_an both map to it; spec §6:
    // "the domain gate already permits" a future mixed-element hien).
    // Companions/enemies pass no buildId -> false.
    canInitiateWuxingReactions:
      buildId !== undefined &&
      (CULTIVATION_PATH_STAT_DOMAINS[buildId]?.includes('phap_tu') ?? false),
  }

  const special = resolvedSpecialUltimate?.special
  const ultimate = resolvedSpecialUltimate?.ultimate

  if (special) {
    participant.special = {
      skill: special,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  if (ultimate) {
    participant.ultimate = {
      skill: ultimate,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  // The Tu An (plan Task 16) — participant-local payload clones the
  // typed follow-up queue resolves for counter/follow-up procs.
  if (resolvedSpecialUltimate?.reactivePayloads !== undefined) {
    participant.reactivePayloads = resolvedSpecialUltimate.reactivePayloads
  }

  // Task 20 — participant-build cap authority: entity.maxThe persists
  // across auto-repeat resets (battle-scoped currentThe zeroes, the cap
  // is configuration, not battle state).
  if (resolvedSpecialUltimate?.maxThe !== undefined) {
    entity.maxThe = resolvedSpecialUltimate.maxThe
  }

  if (entity.bossTrigger) {
    participant.bossTrigger = {
      afterTurns: entity.bossTrigger.afterTurns,
      buffDefinitionId: entity.bossTrigger.buffDefinitionId,
      firedAlready: false,
    }
  }

  return participant
}
