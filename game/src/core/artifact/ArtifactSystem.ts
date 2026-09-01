// Bản Mệnh Pháp Bảo — combat "subgun" (doc §8-11). Action nền + 3
// hướng Công/Thủ/Khống, đọc/ghi qua Battle.artifactRuntime. Không tự
// giữ state ngoài Battle (runtime-only, xem ArtifactRuntime.ts).
import type { Battle } from '../battle/Battle'
import type { CombatEntity } from '../combat/CombatEntity'
import type { ActionImpactSystem, ActionDamageInfo } from '../battle/ActionImpactSystem'
import type { BuffPool } from '../buff/BuffPool'
import type { BuffRegistry } from '../buff/BuffRegistry'
import type { CombatAiStrategy } from '../battle/CombatAiStrategy'
import { selectAttackableTarget } from '../battle/ActionTargetingSystem'
import { BuffSystem } from '../buff/BuffSystem'
import { vfxPresetForElement } from '../battle/CombatAction'
import type { ElementType } from '../element/ElementType'
import type { ArtifactPath } from './Artifact'
import { getArtifactGradeMultiplier } from './ArtifactProgression'

export interface ArtifactSystemDeps {
  actionImpact: ActionImpactSystem
  buffRegistry: BuffRegistry
  getBuffsFor: (battle: Battle, entity: CombatEntity) => BuffPool
  aiStrategy: () => CombatAiStrategy
}

// ---- Cấu hình action nền (doc §8.1/§9) ----
const ARTIFACT_BASE_CYCLE_SECONDS = 3.0
const ARTIFACT_MIN_CYCLE_SECONDS = 1.5
const ARTIFACT_WINDUP_SECONDS = 0.25
/** "45% Power của hành mỗi phát" — ratio của SkillDamageComponent, KHÔNG phải multiplier tổng. */
const ARTIFACT_BASE_DAMAGE_RATIO = 0.45

const NGU_HANH_ROTATION_ORDER: ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']

const PATH_BASE_DAMAGE_MULTIPLIER: Record<ArtifactPath, number> = {
  attack: 1.0,
  defense: 0.70,
  control: 0.80,
}

// ---- Công — Ngũ Hành Liên Châu (doc §8.2) ----
const CONG_T3_DAMAGE_BONUS_PERCENT = 0.15
const CONG_T6_LEVEL = 6
const CONG_T6_EXTRA_HIT_RATIO = 0.55
const CONG_T12_LEVEL = 12
const CONG_T12_CYCLE_REDUCTION_PERCENT = 0.10
const CONG_T18_LEVEL = 18
const CONG_T18_TOTAL_DAMAGE_CAP_MULTIPLIER = 1.5

// ---- Thủ — Ngũ Hành Hộ Thể (doc §8.3) ----
const THU_T3_LEVEL = 3
const THU_T3_WARD_RATIO_OF_POWER = 0.5
const THU_T6_LEVEL = 6
const THU_T6_BUFF_DURATION_SECONDS = ARTIFACT_BASE_CYCLE_SECONDS + 0.5
const THU_T6_FINAL_DAMAGE_REDUCTION_PERCENT = 0.06
const THU_T12_LEVEL = 12
const THU_T12_WARD_BREAK_RECOVERY_PERCENT_OF_MAX_HP = 0.05
const THU_T12_WARD_BREAK_RECOVERY_ICD_SECONDS = 8
const THU_T18_LEVEL = 18
const THU_T18_BARRIER_DURATION_SECONDS = 3
const THU_T18_AILMENT_RESIST_PERCENT = 0.30
const THU_T18_CRITICAL_AVOIDANCE_FLAT = 20

// ---- Khống — Ngũ Hành Trấn Linh (doc §8.4) ----
const KHONG_T3_LEVEL = 3
const KHONG_T6_LEVEL = 6
const KHONG_T6_WINDOW_SECONDS = 4
const KHONG_T6_HITS_REQUIRED = 3
const KHONG_T6_REAPPLY_ICD_SECONDS = 6
const KHONG_T12_LEVEL = 12
const KHONG_T12_ATTACK_SPEED_DEBUFF_PERCENT = 0.20
const KHONG_T12_ATTACK_SPEED_DEBUFF_DURATION_SECONDS = 2
const KHONG_T18_LEVEL = 18
const KHONG_T18_AREA_ROW_RADIUS = 1

const FIFTH_ACTIVATION_INTERVAL = 5

function getRotationElements(equippedElements: ElementType[]): ElementType[] {
  return NGU_HANH_ROTATION_ORDER.filter((element) => equippedElements.includes(element))
}

/** Lọc equippedElements xuống đúng 5 hành Ngũ Hành (bỏ Phong/Lôi/Hỗn Nguyên) — dùng khi snapshot ArtifactRuntime lúc battle bắt đầu. */
export function filterNguHanhElements(equippedElements: ElementType[]): ElementType[] {
  return getRotationElements(equippedElements)
}

const CONG_T3_LEVEL = 3

function getArtifactHitMultiplier(path: ArtifactPath | undefined, level: number, gradeMultiplier: number): number {
  const levelMultiplier = 1 + 0.025 * (level - 1)
  const pathBase = path ? PATH_BASE_DAMAGE_MULTIPLIER[path] : PATH_BASE_DAMAGE_MULTIPLIER.attack
  const pathBonusPercent = path === 'attack' && level >= CONG_T3_LEVEL ? CONG_T3_DAMAGE_BONUS_PERCENT : 0

  return levelMultiplier * gradeMultiplier * pathBase * (1 + pathBonusPercent)
}

/** element undefined (không hành nào equip) -> damage/VFX trung tính (physical), không tự mở hành. */
function buildArtifactDamage(element: ElementType | undefined, multiplier: number): ActionDamageInfo {
  if (!element) {
    return { kind: 'physical', multiplier }
  }

  return {
    kind: 'elemental',
    components: [{ kind: 'element', element, ratio: ARTIFACT_BASE_DAMAGE_RATIO }],
    multiplier,
  }
}

/** Export cho UI (ArtifactCombatPresentation.ts) — cùng công thức tick dùng nội bộ. */
export function getArtifactCycleSeconds(runtime: Battle['artifactRuntime']): number {
  if (!runtime) {
    return ARTIFACT_BASE_CYCLE_SECONDS
  }

  const reduced = ARTIFACT_BASE_CYCLE_SECONDS * (1 - runtime.pendingCycleReductionPercent)

  return Math.max(ARTIFACT_MIN_CYCLE_SECONDS, reduced)
}

/**
 * Tick chính — gọi mỗi fixed-step TRONG battle 'fighting', ĐỘC LẬP
 * isIncapacitated() (player bị CC KHÔNG được dừng artifact, doc §11
 * điểm 3 + acceptance §15.3).
 */
export function updateArtifactActivation(battle: Battle, deltaSeconds: number, deps: ArtifactSystemDeps): void {
  const runtime = battle.artifactRuntime

  if (!runtime) {
    return
  }

  if (!battle.playerMaterialized || !battle.player.alive || battle.state !== 'fighting') {
    return
  }

  tickPerTargetControlIcd(runtime, deltaSeconds)

  if (runtime.snapshot.path === 'defense' && runtime.snapshot.level >= THU_T12_LEVEL) {
    tickWardBreakRecovery(battle, runtime, deltaSeconds)
  }

  runtime.activationTimer -= deltaSeconds

  if (runtime.activationTimer > 0) {
    return
  }

  const target = selectAttackableTarget(battle, deps.aiStrategy())

  const cycleSeconds = getArtifactCycleSeconds(runtime)

  runtime.activationTimer += cycleSeconds
  runtime.pendingCycleReductionPercent = 0
  runtime.currentActivationHits = []
  runtime.crossElementBonusAppliedThisActivation = false

  if (!target) {
    // Không có mục tiêu hợp lệ trong tầm lúc activation tới hạn — bỏ
    // qua activation này, chờ chu kỳ kế (không dồn/không target quái
    // pending-spawn/ngoài range, acceptance §15.3).
    return
  }

  runtime.activationCount += 1

  const { path, level, grade, artifactId, equippedElements } = runtime.snapshot
  const rotation = getRotationElements(equippedElements)
  const gradeMultiplier = getArtifactGradeMultiplier(grade)

  const mainElement = rotation.length > 0 ? rotation[runtime.elementCursor % rotation.length] : undefined

  if (rotation.length > 0) {
    runtime.elementCursor = (runtime.elementCursor + 1) % rotation.length
  }

  const mainMultiplier = getArtifactHitMultiplier(path, level, gradeMultiplier)

  deps.actionImpact.scheduleBasic({
    actionId: 'artifact:ngu_hanh_chau',
    sourceId: battle.player.id,
    targetId: target.id,
    damage: buildArtifactDamage(mainElement, mainMultiplier),
    presetId: vfxPresetForElement(mainElement),
    windupSeconds: ARTIFACT_WINDUP_SECONDS,
    origin: { kind: 'artifact', artifactId },
  })

  // Công tầng 6 "Liên Châu" — +1 hit 55% dùng hành KẾ trong vòng xoay
  // (đã advance elementCursor ở trên, nên rotation[cursor] chính là
  // "hành kế").
  if (path === 'attack' && level >= CONG_T6_LEVEL && rotation.length > 0) {
    const extraElement = rotation[runtime.elementCursor % rotation.length]

    deps.actionImpact.scheduleBasic({
      actionId: 'artifact:ngu_hanh_chau:lien_chau',
      sourceId: battle.player.id,
      targetId: target.id,
      damage: buildArtifactDamage(extraElement, mainMultiplier * CONG_T6_EXTRA_HIT_RATIO),
      presetId: vfxPresetForElement(extraElement),
      windupSeconds: ARTIFACT_WINDUP_SECONDS,
      origin: { kind: 'artifact', artifactId },
    })
  }

  const isFifthActivation = runtime.activationCount % FIFTH_ACTIVATION_INTERVAL === 0

  // Công tầng 18 "Vạn Tượng Quy Nhất" — activation thứ 5 phóng MỌI
  // hành đang equip vào primary target, tổng damage cap theo số hành.
  if (path === 'attack' && level >= CONG_T18_LEVEL && isFifthActivation && rotation.length > 1) {
    const perElementMultiplier = (mainMultiplier * CONG_T18_TOTAL_DAMAGE_CAP_MULTIPLIER) / rotation.length

    for (const element of rotation) {
      deps.actionImpact.scheduleBasic({
        actionId: 'artifact:ngu_hanh_chau:van_tuong',
        sourceId: battle.player.id,
        targetId: target.id,
        damage: buildArtifactDamage(element, perElementMultiplier),
        presetId: vfxPresetForElement(element),
        windupSeconds: ARTIFACT_WINDUP_SECONDS,
        origin: { kind: 'artifact', artifactId },
      })
    }
  }

  if (isFifthActivation && level >= THU_T18_LEVEL && path === 'defense') {
    applyThuBarrier(battle, deps)
  }

  if (isFifthActivation && level >= KHONG_T18_LEVEL && path === 'control') {
    applyKhongAreaSlow(battle, target, deps)
  }
}

function tickPerTargetControlIcd(runtime: NonNullable<Battle['artifactRuntime']>, deltaSeconds: number): void {
  for (const state of Object.values(runtime.perTargetControl)) {
    state.windowRemainingSeconds = Math.max(0, state.windowRemainingSeconds - deltaSeconds)
    state.reapplyCooldownRemainingSeconds = Math.max(0, state.reapplyCooldownRemainingSeconds - deltaSeconds)
  }
}

function tickWardBreakRecovery(battle: Battle, runtime: NonNullable<Battle['artifactRuntime']>, deltaSeconds: number): void {
  const player = battle.player

  runtime.wardBreakRecoveryCooldownRemainingSeconds = Math.max(
    0,
    runtime.wardBreakRecoveryCooldownRemainingSeconds - deltaSeconds,
  )

  const justBroke = runtime.lastObservedPlayerWard > 0 && player.currentWard <= 0

  if (justBroke && runtime.wardBreakRecoveryCooldownRemainingSeconds <= 0 && player.alive) {
    player.currentWard = Math.min(
      player.maxHp,
      player.currentWard + player.maxHp * THU_T12_WARD_BREAK_RECOVERY_PERCENT_OF_MAX_HP,
    )
    runtime.wardBreakRecoveryCooldownRemainingSeconds = THU_T12_WARD_BREAK_RECOVERY_ICD_SECONDS
  }

  runtime.lastObservedPlayerWard = player.currentWard
}

/**
 * Gọi từ BattleSystem.applyActionHit() khi options.origin?.kind ===
 * 'artifact' — dispatch hiệu ứng milestone theo hướng đang active.
 * `element` là hành của CHÍNH hit vừa resolve (undefined nếu action
 * nền dùng physical trung tính).
 */
export function onArtifactHitResolved(
  battle: Battle,
  source: CombatEntity,
  target: CombatEntity,
  landed: boolean,
  element: ElementType | undefined,
  deps: ArtifactSystemDeps,
): void {
  const runtime = battle.artifactRuntime

  if (!runtime || !landed) {
    return
  }

  const { path, level } = runtime.snapshot

  if (element) {
    trackCrossElementBonus(runtime, target.id, element)
  }

  if (path === 'defense') {
    applyThuOnHitEffects(battle, source, element, level, deps)
  } else if (path === 'control') {
    applyKhongOnHitEffects(battle, source, target, level, deps)
  }
}

function trackCrossElementBonus(
  runtime: NonNullable<Battle['artifactRuntime']>,
  targetId: string,
  element: ElementType,
): void {
  const { path, level } = runtime.snapshot

  const hasCrossElementPair = runtime.currentActivationHits.some(
    (hit) => hit.targetId === targetId && hit.element !== element,
  )

  runtime.currentActivationHits.push({ targetId, element })

  if (
    path === 'attack' &&
    level >= CONG_T12_LEVEL &&
    !runtime.crossElementBonusAppliedThisActivation &&
    hasCrossElementPair
  ) {
    runtime.pendingCycleReductionPercent = CONG_T12_CYCLE_REDUCTION_PERCENT
    runtime.crossElementBonusAppliedThisActivation = true
  }
}

function applyThuOnHitEffects(
  battle: Battle,
  source: CombatEntity,
  element: ElementType | undefined,
  level: number,
  deps: ArtifactSystemDeps,
): void {
  if (level >= THU_T3_LEVEL && element) {
    const power = source.stats[`${element}Power`]

    source.currentWard = Math.min(source.maxHp, source.currentWard + power * THU_T3_WARD_RATIO_OF_POWER)
  }

  if (level >= THU_T6_LEVEL) {
    new BuffSystem(deps.getBuffsFor(battle, source)).apply(
      {
        id: 'artifact_ngu_khi_tuan_hoan',
        name: 'Ngũ Khí Tuần Hoàn',
        polarity: 'buff',
        duration: THU_T6_BUFF_DURATION_SECONDS,
        stackMode: 'refresh',
        effects: [
          {
            type: 'statModifier',
            stat: 'finalDamageReductionPercent',
            percent: THU_T6_FINAL_DAMAGE_REDUCTION_PERCENT,
          },
        ],
      },
      source,
      source,
    )
  }
}

function applyThuBarrier(battle: Battle, deps: ArtifactSystemDeps): void {
  new BuffSystem(deps.getBuffsFor(battle, battle.player)).apply(
    {
      id: 'artifact_ngu_hanh_ho_gioi',
      name: 'Ngũ Hành Hộ Giới',
      polarity: 'buff',
      duration: THU_T18_BARRIER_DURATION_SECONDS,
      stackMode: 'refresh',
      effects: [
        {
          type: 'statModifier',
          stat: 'ailmentResistPercent',
          percent: THU_T18_AILMENT_RESIST_PERCENT,
        },
        {
          type: 'statModifier',
          stat: 'criticalAvoidance',
          flat: THU_T18_CRITICAL_AVOIDANCE_FLAT,
        },
      ],
    },
    battle.player,
    battle.player,
  )
}

function applyKhongOnHitEffects(
  battle: Battle,
  source: CombatEntity,
  target: CombatEntity,
  level: number,
  deps: ArtifactSystemDeps,
): void {
  if (level < KHONG_T3_LEVEL || !target.alive) {
    return
  }

  const targetBuffs = new BuffSystem(deps.getBuffsFor(battle, target))

  // Trệ Khí (tầng 3) — hit áp lam_cham ngắn, dùng đúng duration đã
  // khai trong BuffRegistry (không override thủ công ở đây).
  targetBuffs.apply(deps.buffRegistry.get('lam_cham'), source, target, deps.buffRegistry)

  if (level < KHONG_T6_LEVEL) {
    return
  }

  const runtime = battle.artifactRuntime!
  const state = runtime.perTargetControl[target.id] ?? {
    hitsInWindow: 0,
    windowRemainingSeconds: 0,
    reapplyCooldownRemainingSeconds: 0,
  }

  if (state.windowRemainingSeconds <= 0) {
    state.hitsInWindow = 0
  }

  state.hitsInWindow += 1
  state.windowRemainingSeconds = KHONG_T6_WINDOW_SECONDS
  runtime.perTargetControl[target.id] = state

  if (state.hitsInWindow < KHONG_T6_HITS_REQUIRED || state.reapplyCooldownRemainingSeconds > 0) {
    return
  }

  // Ngũ Hành Phược (tầng 6) — đủ 3 hit trong cửa sổ, per-target ICD
  // chặn root-lock (acceptance §15.3).
  targetBuffs.apply(deps.buffRegistry.get('troi_chan'), source, target, deps.buffRegistry)
  state.hitsInWindow = 0
  state.reapplyCooldownRemainingSeconds = KHONG_T6_REAPPLY_ICD_SECONDS

  if (level >= KHONG_T12_LEVEL) {
    // Trấn Mạch (tầng 12) — target ĐANG root nhận debuff attack speed ngắn.
    // source = artifact owner (kẻ vừa đánh trúng), target = quái bị root —
    // đây KHÔNG phải self-buff (khác với 2 site còn lại trong file này).
    new BuffSystem(deps.getBuffsFor(battle, target)).apply(
      {
        id: 'artifact_tran_mach',
        name: 'Trấn Mạch',
        polarity: 'debuff',
        duration: KHONG_T12_ATTACK_SPEED_DEBUFF_DURATION_SECONDS,
        stackMode: 'refresh',
        effects: [
          {
            type: 'statModifier',
            stat: 'attackSpeed',
            percent: -KHONG_T12_ATTACK_SPEED_DEBUFF_PERCENT,
          },
        ],
      },
      source,
      target,
    )
  }
}

function applyKhongAreaSlow(battle: Battle, primaryTarget: CombatEntity, deps: ArtifactSystemDeps): void {
  // Ngũ Châu Trấn Vực (tầng 18) — activation thứ 5, vùng nhỏ quanh
  // primary target (bán kính 1 hàng) áp slow; root (Ngũ Hành Phược)
  // chỉ xét primary target, KHÔNG lan theo vùng này.
  const nearby = battle.enemies.filter(
    (battleEnemy) =>
      battleEnemy.entity.alive &&
      Math.abs(battleEnemy.entity.row - primaryTarget.row) <= KHONG_T18_AREA_ROW_RADIUS,
  )

  for (const battleEnemy of nearby) {
    new BuffSystem(deps.getBuffsFor(battle, battleEnemy.entity)).apply(
      deps.buffRegistry.get('lam_cham'),
      battle.player,
      battleEnemy.entity,
      deps.buffRegistry,
    )
  }
}
