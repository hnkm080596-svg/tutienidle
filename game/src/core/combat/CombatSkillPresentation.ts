import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill, SkillExecutionPolicy } from '../skill/Skill'
import type { SkillManager } from '../skill/SkillManager'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { getAttackIntervalSeconds } from './AttackTiming'
import { selectAttackableTarget } from '../battle/ActionTargetingSystem'
import { DEFAULT_COMBAT_AI_STRATEGY, type CombatAiStrategy } from '../battle/CombatAiStrategy'
import { KIEM_TRAN_SLOT_INDEX } from '../skill/SkillLoadoutSlots'

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

  return resourceCurrent >= (skill.cost ?? 0)
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
  aiStrategy: CombatAiStrategy = DEFAULT_COMBAT_AI_STRATEGY,
): CombatSkillPresentationState[] {
  const entries: CombatSkillPresentationState[] = []

  // Target trong tầm hiện tại của avatar — dùng CHUNG AI strategy với
  // scheduler runtime (caller truyền strategy thật của player, không còn
  // hard-code default) để trạng thái out_of_range khớp hành vi runtime.
  const hasTargetInRange = Boolean(
    battle.playerMaterialized && selectAttackableTarget(battle, aiStrategy),
  )

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
    // Final review fix (Important #7) — KIEM_TRAN_SLOT_INDEX (4) claims
    // to sit OUTSIDE the standard 0-4 range (SkillLoadoutSlots.ts's own
    // comment) but is actually inside it, so the realm-based unlock curve
    // rendered it 'locked' until Hợp Thể even though the scheduler has
    // no realm gate on which slots it iterates — the skill there fires
    // every cadence regardless, just invisible. Exempt this slot from
    // the realm lock; it should render unlocked once equipped, always.
    if (slotIndex >= unlockedSlotCount && slotIndex !== KIEM_TRAN_SLOT_INDEX) {
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
      // Slice 6 cutover: GameManager.getBattle() trả TurnBattle cast thành
      // Battle khi trận turn đang chạy — participant KHÔNG mang shape
      // real-time (stats.skillCadenceRemainingBySlot/castTime*) đầy đủ.
      // Guard optional-chain thay vì crash toàn ErrorBoundary (browser
      // smoke-test evidence 2026-09-04: "Cannot read properties of
      // undefined (reading 'speed')" tại watcher HUD sau Đánh Lại).
      cadenceRemaining: cadencePolicy ? Math.max(0, cadenceRemaining) : undefined,
      cadenceTotal: cadencePolicy
        ? getAttackIntervalSeconds(
            (battle.player.stats?.speed ?? 0) * (cadencePolicy.attackSpeedMultiplier ?? 1),
          )
        : undefined,
      castRemaining: isCasting ? battle.player.castTimeRemaining : undefined,
      castTotal: isCasting ? battle.player.castTimeTotal : undefined,
      resourceCurrent,
      resourceCost: skill.cost ?? 0,
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

// ---------------------------------------------------------------------------
// Slice 7 (Completion Task 10) — turn-based presentation
// ---------------------------------------------------------------------------
// Path MỚI cho turn combat: 3 slot role cố định (basic/special/ultimate,
// Slice 2 model), cooldown theo LƯỢT, không cadence/casting/out_of_range
// (real-time-only concepts). Path real-time ở trên GIỮ NGUYÊN cho HUD cũ
// (Battle shim vẫn tồn tại cho các HUD đang sống) — không gộp 2 path để
// tránh phá các consumer đang chạy.

export type TurnSkillPresentationStateKind =
  | 'ready'
  | 'not_your_turn'
  | 'cooldown'
  | 'blocked_resource'
  | 'locked'
  | 'empty'

export type TurnSkillRole = 'basic' | 'special' | 'ultimate'

export interface TurnSkillPresentationInput {
  entity: CombatEntity

  basic?: TurnSkillDefinition
  special?: TurnSkillDefinition
  ultimate?: TurnSkillDefinition

  specialRemainingCooldownTurns: number
  ultimateRemainingCooldownTurns: number

  /** Player đang pause chờ manual choice (peekNextActor đã trả player)? */
  isPlayersPausedTurn: boolean
}

export interface TurnSkillPresentationState {
  skillId: string

  role: TurnSkillRole

  cooldownRemaining: number

  cooldownTotal: number

  resourceCurrent: number

  resourceCost: number

  /** Bấm được CHÍNH LÚC NÀY? = ready && isPlayersPausedTurn (UI disables ineligible, spec Slice 7 §4). */
  isTappable: boolean

  state: TurnSkillPresentationStateKind
}

function turnResourceCurrentFor(skill: TurnSkillDefinition, entity: CombatEntity): number {
  switch (skill.resourceType) {
    case 'mana':
      return entity.currentMp

    case 'sword_intent':
      return entity.currentSwordIntent

    case 'momentum':
      return entity.currentMomentum

    default:
      return 0
  }
}

function turnSkillCost(skill: TurnSkillDefinition): number {
  if (!skill.resourceType || skill.resourceType === 'none') {
    return 0
  }

  return skill.resourceCost ?? 0
}

function turnHasEnoughResource(skill: TurnSkillDefinition, resourceCurrent: number): boolean {
  return resourceCurrent >= turnSkillCost(skill)
}

function deriveTurnState(input: {
  hasSkill: boolean
  cooldownRemaining: number
  isResourceBlocked: boolean
  isPlayersPausedTurn: boolean
}): TurnSkillPresentationStateKind {
  if (!input.hasSkill) {
    return 'empty'
  }

  if (input.cooldownRemaining > 0) {
    return 'cooldown'
  }

  if (input.isResourceBlocked) {
    return 'blocked_resource'
  }

  if (!input.isPlayersPausedTurn) {
    return 'not_your_turn'
  }

  return 'ready'
}

export function buildTurnSkillPresentation(
  input: TurnSkillPresentationInput,
): TurnSkillPresentationState[] {
  const slots: Array<{
    role: TurnSkillRole
    def?: TurnSkillDefinition
    cooldownRemaining: number
  }> = [
    { role: 'basic', def: input.basic, cooldownRemaining: 0 },
    { role: 'special', def: input.special, cooldownRemaining: input.specialRemainingCooldownTurns },
    { role: 'ultimate', def: input.ultimate, cooldownRemaining: input.ultimateRemainingCooldownTurns },
  ]

  return slots.map(({ role, def, cooldownRemaining }) => {
    const resourceCurrent = def ? turnResourceCurrentFor(def, input.entity) : 0
    const isResourceBlocked = def ? !turnHasEnoughResource(def, resourceCurrent) : false

    const state = deriveTurnState({
      hasSkill: def !== undefined,
      cooldownRemaining,
      isResourceBlocked,
      isPlayersPausedTurn: input.isPlayersPausedTurn,
    })

    return {
      skillId: def?.id ?? '',
      role,
      cooldownRemaining,
      cooldownTotal: def?.cooldownTurns ?? 0,
      resourceCurrent,
      resourceCost: def ? turnSkillCost(def) : 0,
      isTappable: state === 'ready',
      state,
    }
  })
}
