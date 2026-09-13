import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentBag } from './EquipmentBag'
import type { EquipmentRegistry } from './EquipmentRegistry'
import type { EquipmentSlotManager } from './EquipmentSlotManager'
import type { AffixRegistry } from './AffixRegistry'
import type { EquipmentSlot } from './EquipmentTypes'
import type { MaterialBag } from '../material/MaterialBag'
import type { StatModifier } from '../stats/StatCalculator'
import {
  REFINE_INCREASE_MAX,
  REFINE_INCREASE_MIN,
  REFINE_MAX_LOCKS,
  REFINE_SPIRIT_STONE_PER_UNIT,
  REFINE_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'

/**
 * TINH LUYỆN (plan §7.4) — tách khỏi EquipmentSystem (large-file-split,
 * cùng pattern Task 8 EquipmentWash.ts): hành vi giữ NGUYÊN 1:1, chỉ đổi
 * chỗ ở. Refine vẫn cần vài mảnh của EquipmentSystem (cost discount,
 * forge-use points, ModifierSystem riêng, pending-preview slot) — nhận
 * qua `RefineDeps` do EquipmentSystem tự bind (`this.X`).
 */
export interface RefineDeps {
  applyCostDiscount: (amount: number) => number

  itemRefinementPoints: (instance: EquipmentInstance) => number

  spendItemRefinementPoints: (instance: EquipmentInstance, amount: number) => void

  /** No-op nếu instance chưa equipped — khớp guard gốc trong commitRefineValues(). */
  refreshEquippedModifiers: (
    instance: EquipmentInstance,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) => void

  /** Instance-owned pending slot (precedent R9/AR-21: slot chết cùng system instance). */
  refinePendingSlot: RefinePendingSlotAccessor
}

export interface RefineValueEntry {
  index: number

  value: number
}

interface RefineAffixSnapshot {
  affixId: string

  tier: number

  value: number
}

interface RefineInstanceSnapshot {
  instanceId: string

  itemId: string

  slot: EquipmentSlot

  equipped: boolean

  locked: boolean | undefined

  favorite: boolean | undefined

  grade: EquipmentInstance['grade']

  quality: EquipmentInstance['quality']

  realmLevel: number | undefined

  zoneId: string | undefined

  icon: string | undefined

  forgeUsesTotal: number

  forgeUsesRemaining: number

  mainStat: StatModifier

  affixes: RefineAffixSnapshot[]
}

interface PendingRefinePreview {
  instance: EquipmentInstance

  membershipGeneration: number

  snapshot: RefineInstanceSnapshot

  values: RefineValueEntry[]
}

function cloneRefineMainStat(mainStat: StatModifier): StatModifier {
  return {
    id: mainStat.id,
    sourceId: mainStat.sourceId,
    sourceType: mainStat.sourceType,
    stat: mainStat.stat,
    tag: mainStat.tag,
    flat: mainStat.flat,
    percent: mainStat.percent,
    multiplier: mainStat.multiplier,
    stacks: mainStat.stacks,
    maxStacks: mainStat.maxStacks,
    perLevelFlat: mainStat.perLevelFlat,
    perLevelPercent: mainStat.perLevelPercent,
  }
}

function refineMainStatMatches(current: StatModifier, expected: StatModifier): boolean {
  return (
    current.id === expected.id &&
    current.sourceId === expected.sourceId &&
    current.sourceType === expected.sourceType &&
    current.stat === expected.stat &&
    current.tag === expected.tag &&
    current.flat === expected.flat &&
    current.percent === expected.percent &&
    current.multiplier === expected.multiplier &&
    current.stacks === expected.stacks &&
    current.maxStacks === expected.maxStacks &&
    current.perLevelFlat === expected.perLevelFlat &&
    current.perLevelPercent === expected.perLevelPercent
  )
}

function isExactRefineValueEntry(value: unknown): value is RefineValueEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate = value as Record<string, unknown>
  const keys = Object.keys(candidate)

  return (
    keys.length === 2 &&
    keys.includes('index') &&
    keys.includes('value') &&
    typeof candidate.index === 'number' &&
    Number.isInteger(candidate.index) &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value)
  )
}

export interface RefinePendingSlotAccessor {
  get(): PendingRefinePreview | null
  set(next: PendingRefinePreview | null): void
}

/** Khí Đường chỉ hiển thị một Refine preview tại một thời điểm. */
export function createRefinePendingSlotAccessor(): RefinePendingSlotAccessor {
  let slot: PendingRefinePreview | null = null

  return {
    get(): PendingRefinePreview | null {
      return slot
    },
    set(next: PendingRefinePreview | null): void {
      slot = next
    },
  }
}

/**
 * TINH LUYỆN (2026-08-25, resource-professions-rework plan §7.4) —
 * giữ NGUYÊN identity của mọi substat, tăng GIÁ TRỊ từng dòng
 * KHÔNG khóa trong khoảng 5–20% (clamp trong min/max hợp lệ của
 * tier). Khóa L dòng → cost Linh Thạch hệ số N + L; KHÔNG
 * cho khóa toàn bộ.
 *
 * Chi phí bắt buộc: 1 lượt Rèn + Luyện Khí Tinh Hoa theo Chất
 * + Linh Thạch phổ thông (đơn giá × N + L).
 */
export function refineAffixValues(
  instanceId: string,
  lockedIndices: readonly number[],
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  slotManager: EquipmentSlotManager,
  affixRegistry: AffixRegistry,
  deps: RefineDeps,
  _random: () => number = Math.random,
): { ok: boolean; reason?: string } {
  const result = rollRefineValues(
    instanceId,
    lockedIndices,
    inventory,
    registry,
    materialBag,
    affixRegistry,
    deps,
    _random,
  )

  if (!result.ok) {
    return result
  }

  return commitRefineValues(instanceId, result.values, inventory, slotManager, affixRegistry, deps)
}

/**
 * Xem trước Tinh Luyện (2026-08-30, UI "giữ/bỏ") — cùng cơ chế preview/
 * commit với previewWashAffixes/commitWashAffixes: roll + validate + TRỪ
 * COST giống refineAffixValues() nhưng KHÔNG ghi value mới vào instance.
 */
export function previewRefineValues(
  instanceId: string,
  lockedIndices: readonly number[],
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  affixRegistry: AffixRegistry,
  deps: RefineDeps,
  random: () => number = Math.random,
): { ok: boolean; reason?: string; values?: RefineValueEntry[] } {
  return rollRefineValues(
    instanceId,
    lockedIndices,
    inventory,
    registry,
    materialBag,
    affixRegistry,
    deps,
    random,
  )
}

/** Hủy capability Refine đang chờ; UI gọi khi người chơi bấm Bỏ/đổi context. */
export function discardRefinePreview(
  deps: RefineDeps,
  instanceId?: string,
): void {
  const pending = deps.refinePendingSlot.get()

  if (instanceId === undefined || pending?.instance.instanceId === instanceId) {
    deps.refinePendingSlot.set(null)
  }
}

/** Chốt đúng một lần payload do previewRefineValues/refineAffixValues vừa tạo. */
export function commitRefineValues(
  instanceId: string,
  values: readonly RefineValueEntry[],
  inventory: EquipmentBag,
  slotManager: EquipmentSlotManager,
  affixRegistry: AffixRegistry,
  deps: RefineDeps,
): { ok: boolean; reason?: string } {
  const pending = deps.refinePendingSlot.get()

  // Một commit attempt luôn tiêu capability nội bộ, kể cả item đã biến mất.
  deps.refinePendingSlot.set(null)

  const instance = inventory.get(instanceId)

  if (!instance) {
    return { ok: false, reason: 'not_found' }
  }

  if (!pending) {
    return { ok: false, reason: 'invalid_refine_preview' }
  }

  const snapshot = pending.snapshot
  const snapshotMatches =
    pending.instance === instance &&
    inventory.getMembershipGeneration(instance) === pending.membershipGeneration &&
    instance.instanceId === snapshot.instanceId &&
    instance.itemId === snapshot.itemId &&
    instance.slot === snapshot.slot &&
    instance.equipped === snapshot.equipped &&
    instance.locked === snapshot.locked &&
    instance.favorite === snapshot.favorite &&
    instance.grade === snapshot.grade &&
    instance.quality === snapshot.quality &&
    instance.realmLevel === snapshot.realmLevel &&
    instance.zoneId === snapshot.zoneId &&
    instance.icon === snapshot.icon &&
    instance.forgeUsesTotal === snapshot.forgeUsesTotal &&
    instance.forgeUsesRemaining === snapshot.forgeUsesRemaining &&
    refineMainStatMatches(instance.mainStat, snapshot.mainStat) &&
    instance.affixes.length === snapshot.affixes.length &&
    instance.affixes.every((affix, index) => {
      const expected = snapshot.affixes[index]

      return (
        expected !== undefined &&
        affix.affixId === expected.affixId &&
        affix.tier === expected.tier &&
        affix.value === expected.value
      )
    })

  const payloadMatches =
    Array.isArray(values) &&
    values.length === pending.values.length &&
    values.every((entry, index) => {
      const expected = pending.values[index]

      return (
        expected !== undefined &&
        isExactRefineValueEntry(entry) &&
        entry.index === expected.index &&
        entry.value === expected.value
      )
    })

  if (!snapshotMatches || !payloadMatches) {
    return { ok: false, reason: 'invalid_refine_preview' }
  }

  for (const entry of values) {
    if (instance.affixes[entry.index]) {
      instance.affixes[entry.index]!.value = entry.value
    }
  }

  deps.refreshEquippedModifiers(instance, slotManager, affixRegistry)

  return { ok: true }
}

function rollRefineValues(
  instanceId: string,
  lockedIndices: readonly number[],
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  affixRegistry: AffixRegistry,
  deps: RefineDeps,
  _random: () => number = Math.random,
): { ok: true; values: RefineValueEntry[] } | { ok: false; reason: string } {
  // Mọi attempt mới thay thế capability cũ, kể cả attempt này bị từ chối.
  // Vì vậy preview lỗi không thể làm sống lại một payload đã trả phí trước đó.
  deps.refinePendingSlot.set(null)

  const instance = inventory.get(instanceId)

  if (!instance || !registry.has(instance.itemId)) {
    return { ok: false, reason: 'not_found' }
  }

  // Guard nhất quán với Hóa Luyện (§7.5) — item locked/favorite
  // không được Tinh Luyện.
  if (instance.locked) {
    return { ok: false, reason: 'locked' }
  }

  if (instance.favorite) {
    return { ok: false, reason: 'favorite' }
  }

  const lineCount = instance.affixes.length

  if (lineCount === 0) {
    return { ok: false, reason: 'no_affixes' }
  }

  // Validate locks: unique, in-range, ≤ max, và không được khóa toàn bộ.
  const uniqueLocks = Array.from(new Set(lockedIndices)).filter(
    (index) => Number.isInteger(index) && index >= 0 && index < lineCount,
  )

  if (uniqueLocks.length !== lockedIndices.length) {
    return { ok: false, reason: 'invalid_lock' }
  }

  if (uniqueLocks.length > REFINE_MAX_LOCKS) {
    return { ok: false, reason: 'too_many_locks' }
  }

  if (uniqueLocks.length >= lineCount) {
    return { ok: false, reason: 'cannot_lock_all' }
  }

  if (instance.affixes.some((rolled) => !Number.isFinite(rolled.value))) {
    return { ok: false, reason: 'invalid_affix_value' }
  }

  if (deps.itemRefinementPoints(instance) <= 0) {
    return { ok: false, reason: 'no_forge_uses' }
  }

  const eligibleLines: Array<{
    index: number
    current: number
    tierMin: number
    tierMax: number
  }> = []

  for (let index = 0; index < lineCount; index++) {
    if (uniqueLocks.includes(index)) {
      continue
    }

    const rolled = instance.affixes[index]!
    const affix = affixRegistry.get(rolled.affixId)
    const tierDef = affix.tiers.find((candidate) => candidate.tier === rolled.tier)

    if (!tierDef) {
      continue
    }

    const current = rolled.value

    if (current >= tierDef.max) {
      continue
    }

    eligibleLines.push({
      index,
      current,
      tierMin: tierDef.min,
      tierMax: tierDef.max,
    })
  }

  if (eligibleLines.length === 0) {
    return { ok: false, reason: 'no_eligible_affix' }
  }

  const essenceUnits = deps.applyCostDiscount(
    REFINE_TINH_HOA_COST_BY_QUALITY[instance.quality],
  )

  if (!materialBag.has(LUYEN_KHI_TINH_HOA_ID, essenceUnits)) {
    return { ok: false, reason: 'missing_essence' }
  }

  const spiritStoneCost = deps.applyCostDiscount(
    (lineCount + uniqueLocks.length) * REFINE_SPIRIT_STONE_PER_UNIT,
  )

  if (!materialBag.has(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)) {
    return { ok: false, reason: 'missing_spirit_stone' }
  }

  // Roll giá trị mới cho từng dòng eligible KHÔNG khóa. Mỗi dòng
  // tăng 5–20% từ giá trị hiệu lực riêng rồi clamp theo tier.
  const newValues = new Map<number, number>()

  for (const { index, current, tierMin, tierMax } of eligibleLines) {
    const roll = _random()

    if (!Number.isFinite(roll) || roll < 0 || roll > 1) {
      return { ok: false, reason: 'invalid_random_roll' }
    }

    const increase = REFINE_INCREASE_MIN + roll * (REFINE_INCREASE_MAX - REFINE_INCREASE_MIN)
    const increased = current * (1 + increase)
    const value = Math.min(tierMax, Math.max(tierMin, increased))

    newValues.set(index, value)
  }

  const membershipGeneration = inventory.getMembershipGeneration(instance)

  // Lookup đã chứng minh instance đang là exact live object trong bag. Guard
  // này nằm trước transaction để một EquipmentBag sai contract vẫn không
  // thể làm mất tài nguyên.
  if (membershipGeneration === undefined) {
    return { ok: false, reason: 'not_found' }
  }

  // Trừ cost NGAY (mỗi lần roll/preview đều trả phí, xem ghi chú
  // previewRefineValues) — KHÔNG ghi value vào instance ở đây nữa,
  // commitRefineValues() làm việc đó khi người chơi bấm "Giữ". Cost
  // Tinh Hoa leo thang theo Chất; lượt Rèn luôn trừ đúng 1.
  deps.spendItemRefinementPoints(instance, 1)

  materialBag.remove(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)

  materialBag.remove(LUYEN_KHI_TINH_HOA_ID, essenceUnits)

  const values = Array.from(newValues, ([index, value]) => ({ index, value }))

  deps.refinePendingSlot.set({
    instance,
    membershipGeneration,
    snapshot: {
      instanceId: instance.instanceId,
      itemId: instance.itemId,
      slot: instance.slot,
      equipped: instance.equipped,
      locked: instance.locked,
      favorite: instance.favorite,
      grade: instance.grade,
      quality: instance.quality,
      realmLevel: instance.realmLevel,
      zoneId: instance.zoneId,
      icon: instance.icon,
      forgeUsesTotal: instance.forgeUsesTotal,
      forgeUsesRemaining: instance.forgeUsesRemaining,
      mainStat: cloneRefineMainStat(instance.mainStat),
      affixes: instance.affixes.map(({ affixId, tier, value }) => ({ affixId, tier, value })),
    },
    values: values.map(({ index, value }) => ({ index, value })),
  })

  return { ok: true, values }
}
