import type { Battle } from '../battle/Battle'
import type { Skill } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import { AilmentSystem } from '../ailment/AilmentSystem'
import { getAttackIntervalSeconds } from './AttackTiming'

// skill-insight-and-auto-combat-hud-plan.md mục 9 — snapshot CHỈ ĐỌC
// từ runtime thật (Battle/CombatEntity/SkillManager), KHÔNG chạy timer
// riêng trong Vue. Pause, fixed-step catch-up, Chromium throttle hay
// Electron KHÔNG được làm HUD lệch khỏi BattleSystem vì mọi giá trị ở
// đây đọc TRỰC TIẾP field runtime, không tự nội suy/đếm ngược riêng.
export type CombatSkillPresentationStateKind =
  | 'ready'
  | 'cooldown'
  | 'casting'
  | 'insufficient_resource'
  | 'locked'
  | 'empty'
  | 'unreleased'

export interface CombatSkillPresentationState {
  skillId: string

  slotIndex?: number

  cooldownRemaining: number

  cooldownTotal: number

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

function deriveState(
  skill: Skill,
  cooldownRemaining: number,
  isCasting: boolean,
  resourceCurrent: number,
): CombatSkillPresentationStateKind {
  if (skill.unreleased) {
    return 'unreleased'
  }

  if (isCasting) {
    return 'casting'
  }

  if (cooldownRemaining > 0) {
    return 'cooldown'
  }

  if (!hasEnoughResource(skill, resourceCurrent)) {
    return 'insufficient_resource'
  }

  return 'ready'
}

/**
 * electron-combat-timing-smoothing-plan.md mục 7 — Trảm (đòn cơ bản,
 * Skill.isBasicAttack) chạy theo NHỊP ĐÁNH (battle.playerAttackTimer,
 * reset bởi attackSpeed qua getAttackIntervalSeconds() trong
 * BattleSystem.updatePlayerAttack()), KHÔNG PHẢI Skill.cooldown — cố ý
 * KHÔNG tái sử dụng CombatSkillPresentationState (field
 * cooldownRemaining/cooldownTotal đó dành riêng cho active skill loadout
 * thật sự có cooldown) để không thể nhầm lẫn 2 khái niệm ở tầng type.
 */
export interface BasicAttackPresentationState {
  kind: 'basic_attack'

  skillId: string

  cadenceRemaining: number

  cadenceTotal: number

  // false khi pause (do Vue layer AND thêm — xem
  // useCombatSkillPresentation.ts), battle không ở state 'fighting',
  // đang Choáng/Đóng Băng, hoặc không còn quái nào sống để đánh — nhịp
  // đánh KHÔNG thật sự trôi trong những trường hợp này dù
  // cadenceRemaining vẫn còn giá trị cũ.
  isAdvancing: boolean
}

/**
 * null khi chưa equip skill isBasicAttack nào (Pháp Tu không có basic
 * attack, xem BattleSystem.updatePlayerAttack()'s ghi chú).
 */
export function buildBasicAttackPresentation(
  battle: Battle,
  skillManager: SkillManager,
): BasicAttackPresentationState | null {
  const skill = skillManager.getBasicAttackSkill()

  if (!skill) {
    return null
  }

  const cadenceTotal = getAttackIntervalSeconds(battle.player.stats.attackSpeed)
  const cadenceRemaining = Math.max(0, Math.min(battle.playerAttackTimer, cadenceTotal))

  const incapacitated = new AilmentSystem(battle.playerAilments).isStunned() || new AilmentSystem(battle.playerAilments).isFrozen()
  const hasAliveTarget = battle.enemies.some(battleEnemy => battleEnemy.entity.alive)

  return {
    kind: 'basic_attack',
    skillId: skill.id,
    cadenceRemaining,
    cadenceTotal,
    isAdvancing: battle.state === 'fighting' && !incapacitated && hasAliveTarget,
  }
}

/**
 * Dải Skill Loadout (0..slotCount-1) — LUÔN trả đủ `slotCount` phần
 * tử để renderer dựng đủ vị trí kể cả trống ('empty') hoặc chưa mở
 * theo cảnh giới ('locked', slotIndex >= unlockedSlotCount).
 */
export function buildLoadoutPresentation(
  battle: Battle,
  skillManager: SkillManager,
  slotCount: number,
  unlockedSlotCount: number,
): CombatSkillPresentationState[] {
  const entries: CombatSkillPresentationState[] = []

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
    const isCasting = battle.player.castingSkillId === skill.id
    const resourceCurrent = resourceCurrentFor(skill, battle)

    entries.push({
      skillId: skill.id,
      slotIndex,
      cooldownRemaining,
      cooldownTotal: skill.cooldown,
      castRemaining: isCasting ? battle.player.castTimeRemaining : undefined,
      castTotal: isCasting ? battle.player.castTimeTotal : undefined,
      resourceCurrent,
      resourceCost: skill.cost,
      state: deriveState(skill, cooldownRemaining, isCasting, resourceCurrent),
    })
  }

  return entries
}
