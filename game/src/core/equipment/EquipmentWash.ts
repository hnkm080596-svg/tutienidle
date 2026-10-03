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
  captureEquipmentInstanceSnapshot,
  equipmentInstanceMatchesSnapshot,
  type EquipmentInstanceSnapshot,
} from './EquipmentInstanceSnapshot'
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
 * TAY LUYEN (plan sec7.3) - reroll TOAN BO identity substat: so dong
 * trong tran Chat, identity tu pool hop le, tier weighted theo Chat.
 * Tach khoi EquipmentSystem (Task 8, phase7-gamemanager-split), hanh vi
 * giu NGUYEN 1:1, chi doi cho o.
 *
 * Wash van can vai manh state/API cua EquipmentSystem (cost discount,
 * ModifierSystem rieng) - nhan qua `WashDeps` do EquipmentSystem tu
 * bind (`this.X`) thay vi tach not cac phan do ra khoi class, dung
 * cach tiep can layered ma task brief de xuat.
 */
export interface WashDeps {
  tryGetTemplate: (registry: EquipmentRegistry, itemId: string) => Equipment | undefined

  getWashCost: (quality: ItemQuality) => { tinhHoa: number; spiritStone: number }

  spendItemRefinementPoints: (instance: EquipmentInstance, amount: number) => void

  /** Khong-op neu instance chua equipped - khop guard goc trong commitWashAffixes(). */
  refreshEquippedModifiers: (
    instance: EquipmentInstance,
    slotManager: EquipmentSlotManager,
    affixRegistry: AffixRegistry,
  ) => void

  /** R9 (AR-21) - instance-owned pending wash slot (see createWashPendingSlotAccessor). */
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
):
  | { ok: true; instance: EquipmentInstance; membershipGeneration: number; affixes: RolledAffix[] }
  | { ok: false; reason: string } {
  const instance = inventory.get(instanceId)

  if (!instance || !registry.has(instance.itemId)) {
    return { ok: false, reason: 'not_found' }
  }

  // Guard nhat quan voi Hoa Luyen (sec7.5) - item locked/favorite
  // khong duoc Tay Luyen.
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

  // T4-33 - honor BOTH ends of the quality's affix range. Every quality
  // has min 0 today, so this is contract-correctness, not a balance change.
  const range = ITEM_QUALITY_SUBSTATS_RANGE[instance.quality]
  const maxLines = Math.min(GLOBAL_MAX_AFFIXES - 1, range.max)
  const lineCount = range.min + Math.floor(random() * (maxLines - range.min + 1))
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

  // Reserve a compatible Tien Chat Exalted line before base rolls so
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

  // M2 (ARCH-011) - exact-object membership capability, captured before
  // payment (refine precedent): the lookup above already proved this is
  // the live object in the bag; the undefined guard keeps a misbehaving
  // EquipmentBag from charging resources for an unbindable ticket.
  const membershipGeneration = inventory.getMembershipGeneration(instance)

  if (membershipGeneration === undefined) {
    return { ok: false, reason: 'not_found' }
  }

  // Every failure path exits before this transaction mutates resources.
  // Preview pays here; commit only applies the already-paid roll.
  deps.spendItemRefinementPoints(instance, 1)

  materialBag.remove(LUYEN_KHI_TINH_HOA_ID, cost.tinhHoa)

  materialBag.remove(SPIRIT_STONE_MATERIAL_ID, cost.spiritStone)

  return { ok: true, instance, membershipGeneration, affixes: rolled }
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
 * R9 (AR-21) - domain-owned paid wash result. Preview returns a one-use
 * TICKET; the rolled affixes never leave the domain as authoritative
 * data. Modeled on the refine pending-preview precedent. A single
 * pending slot per wash flow: a new preview replaces (and thereby
 * invalidates) the previous ticket, mirroring the refine contract.
 *
 * The pending slot is INSTANCE STATE of the owning EquipmentSystem
 * (QA-R9-001: a module singleton survived restore and let a ticket
 * from a previous session be committed). The instance injects the
 * slot accessor through WashDeps.
 *
 * M2 (ARCH-011) - the ticket binds ONE item lifetime, not a string id:
 * the exact live object, its bag-membership generation, and a detached
 * issued-at snapshot. Commit revalidates all three plus current
 * locked/favorite eligibility, so a same-instanceId replacement, a
 * remove/re-add generation bump, or any item mutation voids the ticket.
 */
export interface PendingWashSlot {
  ticketId: string

  /** Exact object the paid roll was issued for (identity, not id). */
  instance: EquipmentInstance

  /** Bag membership generation captured at preview time. */
  membershipGeneration: number

  /** Detached issued-at item shape (id, quality/grade, affixes, flags). */
  snapshot: EquipmentInstanceSnapshot

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
 * M1 (ARCH-001) - unconditional invalidation for session restore: the
 * item set is being replaced wholesale, so whatever pending paid ticket
 * exists dies with the old set (its instanceId binding can silently
 * resolve to a different restored object). Distinct from
 * discardWashTicket(), which is the ticketId-scoped UI cancel path.
 */
export function invalidatePendingWashTicket(slot: WashPendingSlotAccessor): void {
  slot.set(null)
}

/**
 * Xem truoc Tay Luyen (UI "giu/bo") - roll + validate + TRU COST giong
 * het washAffixes(), nhung KHONG ghi affixes moi vao instance. Tra
 * TICKET cho UI; affixes hien thi doc qua getWashPreviewAffixes() -
 * nguoi choi bam lai (ticket cu bi thay + tra cost lan nua, roll moi)
 * hoac "Giu" (commitWashAffixes, khong ton them) de chot.
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

  // M2 (ARCH-011) - bind the paid roll to the exact item lifetime: the
  // live object, its current membership generation, and the post-payment
  // snapshot (same position as refine: forge spend already recorded).
  deps.washPendingSlot.set({
    ticketId,
    instance: result.instance,
    membershipGeneration: result.membershipGeneration,
    snapshot: captureEquipmentInstanceSnapshot(result.instance),
    affixes: result.affixes,
  })

  return { ok: true, ticketId }
}

/**
 * Chot ket qua da preview - KHONG kiem tra/tru cost lan nua. R9
 * (AR-21): moi commit attempt TIEU ticket (ke ca khi item da bien
 * mat); affixes ap vao instance la ban DOMAIN da giu, khong nhan
 * du lieu tu caller.
 *
 * M2 (ARCH-011) - commit revalidates against the CURRENT bag: the
 * ticket only authorizes the exact bound object while it still occupies
 * the same membership generation AND keeps its issued-at snapshot
 * (locked/favorite included). Current eligibility is re-checked so a
 * same-id replacement that is itself protected reports its real state.
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

  if (!pending || pending.ticketId !== ticketId || pending.snapshot.instanceId !== instanceId) {
    return { ok: false, reason: 'no_pending_wash' }
  }

  // Eligibility revalidation - flags flipped after preview must reject
  // instead of overwriting a protected item (preview vocabulary kept).
  if (instance.locked) {
    return { ok: false, reason: 'locked' }
  }

  if (instance.favorite) {
    return { ok: false, reason: 'favorite' }
  }

  // Item-lifetime binding: same exact object, same membership
  // generation (remove/re-add bumps it), unchanged issued-at shape.
  if (
    pending.instance !== instance ||
    inventory.getMembershipGeneration(instance) !== pending.membershipGeneration ||
    !equipmentInstanceMatchesSnapshot(instance, pending.snapshot)
  ) {
    return { ok: false, reason: 'no_pending_wash' }
  }

  instance.affixes = pending.affixes.map((affix) => ({ ...affix }))

  deps.refreshEquippedModifiers(instance, slotManager, affixRegistry)

  return { ok: true }
}
