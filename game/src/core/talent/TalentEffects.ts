import type { TalentEffect } from './Talent'
import { getTalentDefinition } from '@/data/talent/Talents'
import { getTalentEffectsAtLevel, getTalentLevel } from './TalentEntitlement'

// Getter tap trung theo kind effect (talent-direction-choice-plan.md S6).
// Moi noi tieu thu goi dung getter cua kind minh - KHONG noi nao tu lap
// vong lap doc effect. Id la trong save cu bi bo qua an toan
// (getTalentDefinition tra undefined).
//
// Catalog v4 (spec 2026-09-03 S3.2) dung 1 talent ca doi duoc
// SUPERSEDED boi M-F-TALENT: breakthrough transaction cho phep so huu
// nhieu talent (NEW grants them, UPGRADE nang level). collectTalentEffects
// gom effect cua MOI id dang so huu, doc theo level hien tai - stacking
// gio la hanh vi co chu dich, TalentsV4Wiring khoa lai.

export function collectTalentEffects(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): TalentEffect[] {
  const effects: TalentEffect[] = []

  for (const talentId of selectedTalentIds ?? []) {
    const talent = getTalentDefinition(talentId)

    if (talent) {
      effects.push(...getTalentEffectsAtLevel(talent, talentLevels?.[talentId] ?? 1))
    }
  }

  return effects
}

/** Talent v4 - helper dung chung: player co talent id nay khong. */
export function hasTalent(
  selectedTalentIds: readonly string[] | undefined,
  talentId: string,
): boolean {
  return (selectedTalentIds ?? []).includes(talentId)
}

/**
 * Talent v4 - id hidden passive skill (data/skill/TalentPassives.ts) cua
 * talent combat dang chon, undefined neu talent khong co/khong phai
 * combat. GameManager grant/revoke passive theo id nay khi vao game.
 */
export function getTalentCombatPassiveSkillId(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): string | undefined {
  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'combat_passive') {
      return effect.passiveSkillId
    }
  }

  return undefined
}

function sumPercent(
  selectedTalentIds: readonly string[] | undefined,
  kind: TalentEffect['kind'],
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let percent = 0

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === kind && 'percent' in effect) {
      percent += effect.percent
    }
  }

  return percent
}

export function getCultivationSpeedPercent(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return sumPercent(selectedTalentIds, 'cultivation_speed', talentLevels)
}

export function getCultivationSpeedMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  // Guard: Pham Cot (-75%) la percent am hop le duy nhat hien nay, nhung
  // multi-talent ownership + upgrade cung khong duoc keo multiplier <= 0.
  return Math.max(0.01, 1 + getCultivationSpeedPercent(selectedTalentIds, talentLevels))
}

export function getInsightGainMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return Math.max(0, 1 + sumPercent(selectedTalentIds, 'insight_gain', talentLevels))
}

// Ngo Dao - nguon Cam Ngo tu tu luyen. Tra ve nguong tu vi/diem Cam Ngo,
// undefined neu khong co thien phu nao cap. Nhieu nguon (multi-talent)
// lay nguong nho nhat - nguon co loi nhat thang, khong cong don hai nguong.
export function getInsightPerCultivation(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number | undefined {
  let threshold: number | undefined

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'insight_per_cultivation') {
      threshold = threshold === undefined ? effect.cultivationPerInsight : Math.min(threshold, effect.cultivationPerInsight)
    }
  }

  return threshold
}

export function getSpiritStoneGainMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return 1 + sumPercent(selectedTalentIds, 'spirit_stone_gain', talentLevels)
}

export function getEquipmentDropChanceMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return 1 + sumPercent(selectedTalentIds, 'equipment_drop_chance', talentLevels)
}

export function getBodyRefinementProgressMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return 1 + sumPercent(selectedTalentIds, 'body_refinement_progress', talentLevels)
}

export function getSurviveLethalUsesPerBattle(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let uses = 0

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'survive_lethal') {
      uses += effect.usesPerBattle
    }
  }

  return uses
}

export function getReactionKeepChance(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  return Math.min(1, sumPercent(selectedTalentIds, 'reaction_keep_chance', talentLevels))
}

export function getHealOnKillMaxHpPercent(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let percent = 0

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'heal_on_kill') {
      percent += effect.maxHpPercent
    }
  }

  return percent
}

// ==================== M2 - nhom tu luyen (spec S4.3) ====================

/** Hai Nap - cultivation overflow banks into cultivationOvercharge. */
export function hasCultivationOverflowBank(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): boolean {
  return collectTalentEffects(selectedTalentIds, talentLevels).some(
    (effect) => effect.kind === 'cultivation_overflow_bank',
  )
}

/**
 * Hau Tich Bat Phat - per-realm-level cultivation rate curve:
 * max(0.01, 1 + startOffset + perRealmLevel * (realmLevel - 1)).
 * Returns 1 (neutral) when the talent is absent.
 */
export function getCultivationRampMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  realmLevel: number,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let multiplier = 1

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'cultivation_ramp') {
      multiplier = Math.max(
        0.01,
        1 + effect.startOffset + effect.perRealmLevel * (realmLevel - 1),
      )
    }
  }

  return multiplier
}

/** Loi Kiep - lightning damage multiplier while the talent is held. */
export function getTribulationIntensityMultiplier(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let multiplier = 1

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'tribulation_challenge') {
      multiplier = Math.max(multiplier, effect.intensityMultiplier)
    }
  }

  return multiplier
}

/** Loi Kiep - permanent all-attribute percent granted per victory (0 when absent). */
export function getTribulationVictoryStatPercent(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let percent = 0

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'tribulation_challenge') {
      percent += effect.victoryAllStatsPercent
    }
  }

  return percent
}

/** Van Dao - chance a node purchase/upgrade waives its insight cost. */
export function getNodeCostFreeChance(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): number {
  let chance = 0

  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'node_cost_free_chance') {
      chance = Math.max(chance, effect.chance)
    }
  }

  return Math.min(1, chance)
}

// ==================== M3 - nhom san xuat (spec S4.2) ====================

/**
 * Hoa Hau Thong Than - alchemy double-pill rule pack: yield x2 at settle,
 * potency +50% at pill consumption, cost x2 (fuel wood + spirit stone) at
 * startJob. undefined when the talent is absent.
 */
export function getAlchemyDoublePill(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): { yieldMultiplier: number; potencyMultiplier: number; costMultiplier: number } | undefined {
  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'alchemy_double_pill') {
      return {
        yieldMultiplier: effect.yieldMultiplier,
        potencyMultiplier: effect.potencyMultiplier,
        costMultiplier: effect.costMultiplier,
      }
    }
  }

  return undefined
}

/**
 * Bach Luyen Thanh Khi - enhance always succeeds; each attempt pays
 * costMultiplier materials + spirit stone. undefined when absent.
 */
export function getEnhanceGuarantee(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): { costMultiplier: number } | undefined {
  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'enhance_guaranteed') {
      return { costMultiplier: effect.costMultiplier }
    }
  }

  return undefined
}

/** Pha Giap carry - the bound passive's stacks partially persist across battles. */
export function getPassiveStackCarry(
  selectedTalentIds: readonly string[] | undefined,
  talentLevels?: Readonly<Record<string, number>>,
): { passiveSkillId: string; fraction: number } | undefined {
  for (const effect of collectTalentEffects(selectedTalentIds, talentLevels)) {
    if (effect.kind === 'passive_stack_carry') {
      return { passiveSkillId: effect.passiveSkillId, fraction: effect.fraction }
    }
  }

  return undefined
}
