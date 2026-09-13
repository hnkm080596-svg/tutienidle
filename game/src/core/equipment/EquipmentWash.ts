import type { Equipment } from './Equipment'
import type { EquipmentInstance } from './EquipmentInstance'
import type { EquipmentBag } from './EquipmentBag'
import type { EquipmentRegistry } from './EquipmentRegistry'
import type { EquipmentSlotManager } from './EquipmentSlotManager'
import type { AffixRegistry } from './AffixRegistry'
import type { Affix, AffixKind } from './Affix'
import type { RolledAffix } from './RolledAffix'
import type { StatType } from '../stats/StatTypes'
import type { MaterialBag } from '../material/MaterialBag'
import type { ItemQuality } from '../item/ItemQuality'
import {
  ITEM_QUALITY_AFFIX_TIER,
  ITEM_QUALITY_EXALTED_AFFIX_CHANCE,
  ITEM_QUALITY_SUBSTATS_RANGE,
  ITEM_QUALITY_UNLOCKED_POOLS,
} from './ItemQualityBalance'
import {
  GLOBAL_MAX_AFFIXES,
  filterEligibleAffixes,
  rollAffixRange,
  rollEligibleAffixAtTier,
} from './EquipmentRollPrimitives'
import { rollWeightedIndex } from '../production/ProductionBalance'
import { WASH_TIER_WEIGHTS_BY_QUALITY } from './RefinementBalance'
import { LUYEN_KHI_TINH_HOA_ID } from './TinhHoaMaterial'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'

/**
 * TẦY LUYỆN (plan §7.3) — reroll TOÀN BỘ identity substat: số dòng
 * trong trần Chất, identity từ pool hợp lệ, tier weighted theo Chất.
 * Tách khỏi EquipmentSystem (Task 8, phase7-gamemanager-split), hành vi
 * giữ NGUYÊN 1:1, chỉ đổi chỗ ở.
 *
 * Wash vẫn cần vài mảnh state/API của EquipmentSystem (cost discount,
 * ModifierSystem riêng) — nhận qua `WashDeps` do EquipmentSystem tự
 * bind (`this.X`) thay vì tách nốt các phần đó ra khỏi class, đúng
 * cách tiếp cận layered mà task brief đề xuất.
 */
export interface WashDeps {
  tryGetTemplate: (registry: EquipmentRegistry, itemId: string) => Equipment | undefined

  getWashCost: (quality: ItemQuality) => { tinhHoa: number; spiritStone: number }

  spendItemRefinementPoints: (instance: EquipmentInstance, amount: number) => void

  /** Không-op nếu instance chưa equipped — khớp guard gốc trong commitWashAffixes(). */
  refreshEquippedModifiers: (
    instance: EquipmentInstance,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) => void

  /** R9 (AR-21) — instance-owned pending wash slot (see createWashPendingSlotAccessor). */
  washPendingSlot: WashPendingSlotAccessor
}

function rollWashAffixes(
  instanceId: string,
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  affixRegistry: AffixRegistry,
  deps: WashDeps,
  random: () => number = Math.random,
): { ok: true; affixes: RolledAffix[] } | { ok: false; reason: string } {
  const instance = inventory.get(instanceId)

  if (!instance || !registry.has(instance.itemId)) {
    return { ok: false, reason: 'not_found' }
  }

  // Guard nhất quán với Hóa Luyện (§7.5) — item locked/favorite
  // không được Tẩy Luyện.
  if (instance.locked) {
    return { ok: false, reason: 'locked' }
  }

  if (instance.favorite) {
    return { ok: false, reason: 'favorite' }
  }

  if (instance.forgeUsesRemaining <= 0) {
    return { ok: false, reason: 'no_forge_uses' }
  }

  const template = deps.tryGetTemplate(registry, instance.itemId)

  if (!template) {
    return { ok: false, reason: 'template_not_found' }
  }

  const cost = deps.getWashCost(instance.quality)

  if (!materialBag.has(LUYEN_KHI_TINH_HOA_ID, cost.tinhHoa)) {
    return { ok: false, reason: 'missing_tinh_hoa' }
  }

  if (!materialBag.has(SPIRIT_STONE_MATERIAL_ID, cost.spiritStone)) {
    return { ok: false, reason: 'missing_spirit_stone' }
  }

  const maxLines = Math.min(
    GLOBAL_MAX_AFFIXES - 1,
    ITEM_QUALITY_SUBSTATS_RANGE[instance.quality].max,
  )
  const lineCount = Math.floor(random() * (maxLines + 1))
  const maxTier = Math.min(
    ITEM_QUALITY_AFFIX_TIER[instance.quality],
    WASH_TIER_WEIGHTS_BY_QUALITY[instance.quality].length,
  )
  const unlockedPools = ITEM_QUALITY_UNLOCKED_POOLS[instance.quality]
  const prefixCount = Math.ceil(lineCount / 2)
  const suffixCount = Math.floor(lineCount / 2)
  const requestedKinds: AffixKind[] = [
    ...Array<AffixKind>(prefixCount).fill('prefix'),
    ...Array<AffixKind>(suffixCount).fill('suffix'),
  ]

  const excludeStats: StatType[] = [instance.mainStat.stat]

  const rolled: RolledAffix[] = []

  // Reserve a compatible Tiên Chất Exalted line before base rolls so
  // another affix cannot consume its stat.
  let exalted: RolledAffix | null = null
  if (instance.quality === 'tien' && random() < ITEM_QUALITY_EXALTED_AFFIX_CHANCE) {
    exalted = rollEligibleAffixAtTier(
      template,
      ITEM_QUALITY_AFFIX_TIER.tien,
      ['supreme'],
      excludeStats,
      affixRegistry,
      random,
    )

    if (exalted) {
      excludeStats.push(affixRegistry.get(exalted.affixId).stat)
    }
  }

  for (const kind of requestedKinds) {
    const hasEligibleTier = (candidate: Affix) =>
      candidate.tiers.some((tierDef) => tierDef.tier <= maxTier)

    const candidates = filterEligibleAffixes(
      affixRegistry.getByKind(kind),
      template,
      unlockedPools,
      excludeStats,
    ).filter(hasEligibleTier)

    const fallbackCandidates =
      candidates.length > 0
        ? candidates
        : filterEligibleAffixes(
            affixRegistry.getByKind(kind === 'prefix' ? 'suffix' : 'prefix'),
            template,
            unlockedPools,
            excludeStats,
          ).filter(hasEligibleTier)

    if (fallbackCandidates.length === 0) {
      break
    }

    const affix = fallbackCandidates[Math.floor(random() * fallbackCandidates.length)]!

    const eligibleTiers = affix.tiers.filter((tierDef) => tierDef.tier <= maxTier)

    if (eligibleTiers.length === 0) {
      break
    }

    const tierWeights = eligibleTiers.map(
      (tierDef) => WASH_TIER_WEIGHTS_BY_QUALITY[instance.quality][tierDef.tier - 1] ?? 0,
    )

    const chosenTier = eligibleTiers[rollWeightedIndex(tierWeights, random)]!

    rolled.push({
      affixId: affix.id,

      tier: chosenTier.tier,

      value: rollAffixRange(chosenTier.min, chosenTier.max, random),
    })

    excludeStats.push(affix.stat)
  }

  if (rolled.length !== lineCount) {
    return { ok: false, reason: 'no_eligible_affix' }
  }

  if (exalted) {
    rolled.push(exalted)
  }

  // Every failure path exits before this transaction mutates resources.
  // Preview pays here; commit only applies the already-paid roll.
  deps.spendItemRefinementPoints(instance, 1)

  materialBag.remove(LUYEN_KHI_TINH_HOA_ID, cost.tinhHoa)

  materialBag.remove(SPIRIT_STONE_MATERIAL_ID, cost.spiritStone)

  return { ok: true, affixes: rolled }
}

export function washAffixes(
  instanceId: string,
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  slotManager: EquipmentSlotManager,
  affixRegistry: AffixRegistry,
  deps: WashDeps,
  random: () => number = Math.random,
): { ok: boolean; reason?: string } {
  const preview = previewWashAffixes(
    instanceId, inventory, registry, materialBag, affixRegistry, deps, random,
  )

  if (!preview.ok || !preview.ticketId) {
    return preview
  }

  return commitWashAffixes(
    instanceId, preview.ticketId, inventory, slotManager, affixRegistry, deps,
  )
}

/**
 * R9 (AR-21) — domain-owned paid wash result. Preview returns a one-use
 * TICKET; the rolled affixes never leave the domain as authoritative
 * data. Modeled on the refine pending-preview precedent. A single
 * pending slot per wash flow: a new preview replaces (and thereby
 * invalidates) the previous ticket, mirroring the refine contract.
 *
 * The pending slot is INSTANCE STATE of the owning EquipmentSystem
 * (QA-R9-001: a module singleton survived restore and let a ticket
 * from a previous session be committed). The instance injects the
 * slot accessor through WashDeps.
 */
export interface PendingWashSlot {
  ticketId: string
  instanceId: string
  affixes: RolledAffix[]
}

export interface WashPendingSlotAccessor {
  get(): PendingWashSlot | null
  set(next: PendingWashSlot | null): void
  nextTicketId(): string
}

export function createWashPendingSlotAccessor(): WashPendingSlotAccessor {
  let slot: PendingWashSlot | null = null
  let counter = 0

  return {
    get(): PendingWashSlot | null {
      return slot
    },
    set(next: PendingWashSlot | null): void {
      slot = next
    },
    nextTicketId(): string {
      counter += 1
      return `wash-ticket-${counter}-${Math.floor(Math.random() * 1_000_000)}`
    },
  }
}

/** Display copy for the UI (never authoritative for commit). */
export function getWashPreviewAffixes(
  slot: WashPendingSlotAccessor,
  ticketId: string,
): { affixes: RolledAffix[] } | undefined {
  const pending = slot.get()

  if (!pending || pending.ticketId !== ticketId) {
    return undefined
  }

  return { affixes: pending.affixes.map((affix) => ({ ...affix })) }
}

/** Explicitly drop a pending ticket (UI "re-roll"/cancel path). */
export function discardWashTicket(
  slot: WashPendingSlotAccessor,
  ticketId: string,
): void {
  if (slot.get()?.ticketId === ticketId) {
    slot.set(null)
  }
}

/**
 * M1 (ARCH-001) — unconditional invalidation for session restore: the
 * item set is being replaced wholesale, so whatever pending paid ticket
 * exists dies with the old set (its instanceId binding can silently
 * resolve to a different restored object). Distinct from
 * discardWashTicket(), which is the ticketId-scoped UI cancel path.
 */
export function invalidatePendingWashTicket(slot: WashPendingSlotAccessor): void {
  slot.set(null)
}

/**
 * Xem trước Tẩy Luyện (UI "giữ/bỏ") — roll + validate + TRỪ COST giống
 * hệt washAffixes(), nhưng KHÔNG ghi affixes mới vào instance. Trả
 * TICKET cho UI; affixes hiển thị đọc qua getWashPreviewAffixes() —
 * người chơi bấm lại (ticket cũ bị thay + trả cost lần nữa, roll mới)
 * hoặc "Giữ" (commitWashAffixes, không tốn thêm) để chốt.
 */
export function previewWashAffixes(
  instanceId: string,
  inventory: EquipmentBag,
  registry: EquipmentRegistry,
  materialBag: MaterialBag,
  affixRegistry: AffixRegistry,
  deps: WashDeps,
  random: () => number = Math.random,
): { ok: boolean; reason?: string; ticketId?: string } {
  const result = rollWashAffixes(instanceId, inventory, registry, materialBag, affixRegistry, deps, random)

  if (!result.ok) {
    return result
  }

  const ticketId = deps.washPendingSlot.nextTicketId()
  deps.washPendingSlot.set({ ticketId, instanceId, affixes: result.affixes })

  return { ok: true, ticketId }
}

/**
 * Chốt kết quả đã preview — KHÔNG kiểm tra/trừ cost lần nữa. R9
 * (AR-21): mọi commit attempt TIÊU ticket (kể cả khi item đã biến
 * mất); affixes áp vào instance là bản DOMAIN đã giữ, không nhận
 * dữ liệu từ caller.
 */
export function commitWashAffixes(
  instanceId: string,
  ticketId: string,
  inventory: EquipmentBag,
  slotManager: EquipmentSlotManager,
  affixRegistry: AffixRegistry,
  deps: WashDeps,
): { ok: boolean; reason?: string } {
  const pending = deps.washPendingSlot.get()

  // Consume the capability on EVERY attempt, refine-style.
  deps.washPendingSlot.set(null)

  const instance = inventory.get(instanceId)

  if (!instance) {
    return { ok: false, reason: 'not_found' }
  }

  if (!pending || pending.ticketId !== ticketId || pending.instanceId !== instanceId) {
    return { ok: false, reason: 'no_pending_wash' }
  }

  instance.affixes = pending.affixes.map((affix) => ({ ...affix }))

  deps.refreshEquippedModifiers(instance, slotManager, affixRegistry)

  return { ok: true }
}
