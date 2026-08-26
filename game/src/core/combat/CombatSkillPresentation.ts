import type { Battle } from '../battle/Battle'
import type { Skill, SkillExecutionPolicy } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import { getAttackIntervalSeconds } from './AttackTiming'
import { selectAttackableTarget } from '../battle/ActionTargetingSystem'
import { DEFAULT_COMBAT_AI_STRATEGY } from '../battle/CombatAiStrategy'

type CadencePolicy = Extract<
  SkillExecutionPolicy,
  { kind: 'attack_speed' | 'attack_speed_cast' }
>

/** Policy dùng cadence clock Attack Speed (không CDR) — undefined nếu không. */
function cadencePolicyOf(skill: Skill): CadencePolicy | undefined {
  return skill.execution?.kind === 'attack_speed' || skill.execution?.kind === 'attack_speed_cast'
    ? skill.execution
    : undefined
}

// skill-insight-and-auto-combat-hud-plan.md mục 9 + combat-gate-teleport-
// autocast plan §11.3 — snapshot CHỈ ĐỌC từ runtime thật (Battle/
// CombatEntity/SkillManager), KHÔNG chạy timer riêng trong Vue. Pause,
// fixed-step catch-up, Chromium throttle hay Electron KHÔNG được làm HUD
// lệch khỏi BattleSystem vì mọi giá trị ở đây đọc TRỰC TIẾP field runtime.
//
// Trạng thái THỐNG NHẤT cho mọi slot (plan §11.3) — không hard-code
// "basic" theo path:
// - ready / cadence / cooldown / casting / blocked_resource / out_of_range
// - kèm locked/empty/unreleased cho ô chưa mở/trống/chưa phát hành.
export type CombatSkillPresentationStateKind =
  | 'ready'
  | 'cadence'
  | 'cooldown'
  | 'casting'
  | 'blocked_resource'
  | 'out_of_range'
  | 'locked'
  | 'empty'
  | 'unreleased'

export interface CombatSkillPresentationState {
  skillId: string

  slotIndex?: number

  cooldownRemaining: number

  cooldownTotal: number

  /** Cadence Attack Speed còn lại (policy attack_speed/attack_speed_cast). */
  cadenceRemaining?: number

  cadenceTotal?: number

  castRemaining?: number

  castTotal?: number

  resourceCurrent: number

  resourceCost: number

  state: CombatSkillPresentationStateKind
}

function resourceCurrentFor(skill: Skill, battle: Battle): number {
  switch (skill.resourceType) {
    case 'mana':
      return battle.player.currentMp

    case 'rage':
      return battle.player.currentRage

    case 'sword_intent':
      return battle.player.currentSwordIntent

    case 'momentum':
      return battle.player.currentMomentum

    default:
      return 0
  }
}

function hasEnoughResource(skill: Skill, resourceCurrent: number): boolean {
  if (!skill.resourceType || skill.resourceType === 'none') {
    return true
  }

  return resourceCurrent >= skill.cost
}

/**
 * Dải Skill Loadout (0..slotCount-1) — LUÔN trả đủ `slotCount` phần tử
 * để renderer dựng đủ vị trí kể cả trống ('empty') hoặc chưa mở theo
 * cảnh giới ('locked', slotIndex >= unlockedSlotCount).
 */
export function buildLoadoutPresentation(
  battle: Battle,
  skillManager: SkillManager,
  slotCount: number,
  unlockedSlotCount: number,
): CombatSkillPresentationState[] {
  const entries: CombatSkillPresentationState[] = []

  // Target trong tầm hiện tại của avatar — dùng chung AI strategy default
  // với scheduler để trạng thái out_of_range khớp hành vi runtime.
  const hasTargetInRange = Boolean(
    battle.playerMaterialized && selectAttackableTarget(battle, DEFAULT_COMBAT_AI_STRATEGY),
  )

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    if (slotIndex >= unlockedSlotCount) {
      entries.push({
        skillId: '',
        slotIndex,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        resourceCurrent: 0,
        resourceCost: 0,
        state: 'locked',
      })
      continue
    }

    const skill = skillManager.getEquippedInSlot(slotIndex)

    if (!skill) {
      entries.push({
        skillId: '',
        slotIndex,
        cooldownRemaining: 0,
        cooldownTotal: 0,
        resourceCurrent: 0,
        resourceCost: 0,
        state: 'empty',
      })
      continue
    }

    const cooldownRemaining = skill.remainingCooldownBySlot?.[slotIndex] ?? 0
    const cadenceRemaining = battle.player.skillCadenceRemainingBySlot?.[slotIndex] ?? 0
    const isCasting = battle.player.castingSkillId === skill.id
    const resourceCurrent = resourceCurrentFor(skill, battle)
    const cadencePolicy = cadencePolicyOf(skill)

    entries.push({
      skillId: skill.id,
      slotIndex,
      cooldownRemaining,
      cooldownTotal: skill.cooldown,
      cadenceRemaining: cadencePolicy ? Math.max(0, cadenceRemaining) : undefined,
      cadenceTotal: cadencePolicy
        ? getAttackIntervalSeconds(
            battle.player.stats.attackSpeed * (cadencePolicy.attackSpeedMultiplier ?? 1),
          )
        : undefined,
      castRemaining: isCasting ? battle.player.castTimeRemaining : undefined,
      castTotal: isCasting ? battle.player.castTimeTotal : undefined,
      resourceCurrent,
      resourceCost: skill.cost,
      state: deriveState({
        skill,
        cooldownRemaining,
        cadenceRemaining,
        isCasting,
        resourceCurrent,
        hasTargetInRange,
      }),
    })
  }

  return entries
}

function deriveState(input: {
  skill: Skill
  cooldownRemaining: number
  cadenceRemaining: number
  isCasting: boolean
  resourceCurrent: number
  hasTargetInRange: boolean
}): CombatSkillPresentationStateKind {
  if (input.skill.unreleased) {
    return 'unreleased'
  }

  if (input.isCasting) {
    return 'casting'
  }

  // Cadence Attack Speed (policy attack_speed/attack_speed_cast) là clock
  // ĐỘC LẬP với cooldown CDR — cadence chạy trước trong derive vì policy
  // đó không bao giờ có slot cooldown.
  if (input.cadenceRemaining > 0) {
    return 'cadence'
  }

  if (input.cooldownRemaining > 0) {
    return 'cooldown'
  }

  if (!hasEnoughResource(input.skill, input.resourceCurrent)) {
    return 'blocked_resource'
  }

  if (!input.hasTargetInRange && input.skill.target !== 'self') {
    return 'out_of_range'
  }

  return 'ready'
}
