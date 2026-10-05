import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentBag } from './EquipmentBag'
import type { EquipmentRegistry } from './EquipmentRegistry'
import type { EquipmentSlotManager } from './EquipmentSlotManager'
import type { AffixRegistry } from './AffixRegistry'
import type { MaterialBag } from '../material/MaterialBag'
import {
  captureEquipmentInstanceSnapshot,
  equipmentInstanceMatchesSnapshot,
  type EquipmentInstanceSnapshot,
} from './EquipmentInstanceSnapshot'
import {
  REFINE_INCREASE_MAX,
  REFINE_INCREASE_MIN,
  REFINE_MAX_LOCKS,
  REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY,
  REFINE_TINH_HOA_COST_BY_QUALITY,
} from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'

/**
 * TINH LUYEN (plan sec7.4) - tach khoi EquipmentSystem (large-file-split,
 * cung pattern Task 8 EquipmentWash.ts): hanh vi giu NGUYEN 1:1, chi doi
 * cho o. Refine van can vai manh cua EquipmentSystem (cost discount,
 * forge-use points, ModifierSystem rieng, pending-preview slot) - nhan
 * qua `RefineDeps` do EquipmentSystem tu bind (`this.X`).
 */
export interface RefineDeps {
  applyCostDiscount: (amount: number) => number

  itemRefinementPoints: (instance: EquipmentInstance) => number

  spendItemRefinementPoints: (instance: EquipmentInstance, amount: number) => void

  /** No-op neu instance chua equipped - khop guard goc trong commitRefineValues(). */
  refreshEquippedModifiers: (
    instance: EquipmentInstance,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) => void

  /** Instance-owned pending slot (precedent R9/AR-21: slot chet cung system instance). */
  refinePendingSlot: RefinePendingSlotAccessor
}

export interface RefineValueEntry {
  index: number

  value: number
}

interface PendingRefinePreview {
  instance: EquipmentInstance

  membershipGeneration: number

  snapshot: EquipmentInstanceSnapshot

  values: RefineValueEntry[]
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

/** Khi Duong chi hien thi mot Refine preview tai mot thoi diem. */
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
 * TINH LUYEN (2026-08-25, resource-professions-rework plan sec7.4) -
 * giu NGUYEN identity cua moi substat, tang GIA TRI tung dong
 * KHONG khoa trong khoang 5-20% (clamp trong min/max hop le cua
 * tier). Khoa L dong -> cost Linh Thach he so N + L; KHONG
 * cho khoa toan bo.
 *
 * Chi phi bat buoc: 1 luot Ren + Luyen Khi Tinh Hoa theo Chat
 * + Linh Thach pho thong (don gia x N + L).
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
 * Xem truoc Tinh Luyen (2026-08-30, UI "giu/bo") - cung co che preview/
 * commit voi previewWashAffixes/commitWashAffixes: roll + validate + TRU
 * COST giong refineAffixValues() nhung KHONG ghi value moi vao instance.
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

/** Huy capability Refine dang cho; UI goi khi nguoi choi bam Bo/doi context. */
export function discardRefinePreview(
  deps: RefineDeps,
  instanceId?: string,
): void {
  const pending = deps.refinePendingSlot.get()

  if (instanceId === undefined || pending?.instance.instanceId === instanceId) {
    deps.refinePendingSlot.set(null)
  }
}

/**
 * M1 (ARCH-001) - unconditional invalidation for session restore: the
 * item set is being replaced wholesale, so whatever pending paid preview
 * exists dies with the old set (its instance binding can silently
 * resolve to a different restored object). Distinct from
 * discardRefinePreview(), which is the instanceId-scoped UI cancel path.
 */
export function invalidatePendingRefinePreview(deps: RefineDeps): void {
  deps.refinePendingSlot.set(null)
}

/** Chot dung mot lan payload do previewRefineValues/refineAffixValues vua tao. */
export function commitRefineValues(
  instanceId: string,
  values: readonly RefineValueEntry[],
  inventory: EquipmentBag,
  slotManager: EquipmentSlotManager,
  affixRegistry: AffixRegistry,
  deps: RefineDeps,
): { ok: boolean; reason?: string } {
  const pending = deps.refinePendingSlot.get()

  // Mot commit attempt luon tieu capability noi bo, ke ca item da bien mat.
  deps.refinePendingSlot.set(null)

  const instance = inventory.get(instanceId)

  if (!instance) {
    return { ok: false, reason: 'not_found' }
  }

  if (!pending) {
    return { ok: false, reason: 'invalid_refine_preview' }
  }

  const snapshotMatches =
    pending.instance === instance &&
    inventory.getMembershipGeneration(instance) === pending.membershipGeneration &&
    equipmentInstanceMatchesSnapshot(instance, pending.snapshot)

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
  // Moi attempt moi thay the capability cu, ke ca attempt nay bi tu choi.
  // Vi vay preview loi khong the lam song lai mot payload da tra phi truoc do.
  deps.refinePendingSlot.set(null)

  const instance = inventory.get(instanceId)

  if (!instance || !registry.has(instance.itemId)) {
    return { ok: false, reason: 'not_found' }
  }

  // Guard nhat quan voi Hoa Luyen (sec7.5) - item locked/favorite
  // khong duoc Tinh Luyen.
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

  // Validate locks: unique, in-range, <= max, va khong duoc khoa toan bo.
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
    (lineCount + uniqueLocks.length) * REFINE_SPIRIT_STONE_PER_UNIT_BY_QUALITY[instance.quality],
  )

  if (!materialBag.has(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)) {
    return { ok: false, reason: 'missing_spirit_stone' }
  }

  // Roll gia tri moi cho tung dong eligible KHONG khoa. Moi dong
  // tang 5-20% tu gia tri hieu luc rieng roi clamp theo tier.
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

  // Lookup da chung minh instance dang la exact live object trong bag. Guard
  // nay nam truoc transaction de mot EquipmentBag sai contract van khong
  // the lam mat tai nguyen.
  if (membershipGeneration === undefined) {
    return { ok: false, reason: 'not_found' }
  }

  // Tru cost NGAY (moi lan roll/preview deu tra phi, xem ghi chu
  // previewRefineValues) - KHONG ghi value vao instance o day nua,
  // commitRefineValues() lam viec do khi nguoi choi bam "Giu". Cost
  // Tinh Hoa leo thang theo Chat; luot Ren luon tru dung 1.
  deps.spendItemRefinementPoints(instance, 1)

  materialBag.remove(SPIRIT_STONE_MATERIAL_ID, spiritStoneCost)

  materialBag.remove(LUYEN_KHI_TINH_HOA_ID, essenceUnits)

  const values = Array.from(newValues, ([index, value]) => ({ index, value }))

  deps.refinePendingSlot.set({
    instance,
    membershipGeneration,
    snapshot: captureEquipmentInstanceSnapshot(instance),
    values: values.map(({ index, value }) => ({ index, value })),
  })

  return { ok: true, values }
}
