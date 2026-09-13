import type { EquipmentInstance } from './EquipmentInstance'
import type { StatModifier } from '../stats/StatCalculator'

/**
 * M2 (ARCH-011) — detached issued-at shape of one EquipmentInstance.
 *
 * A paid generated operation (Tinh Luyen values, Tay Luyen affixes) is
 * bound to ONE item lifetime: the exact live object in the bag, its
 * membership generation (EquipmentBag.getMembershipGeneration — the
 * exact-object capability), and this snapshot of every field the commit
 * path observes. If anything between preview and commit mutates the
 * item (affix/grade/quality/lock/favorite/forge budget/...) or swaps
 * the object behind the same instanceId, the bound ticket no longer
 * authorizes the commit.
 *
 * Extracted from EquipmentRefine's pending-preview guard so wash and
 * refine share ONE implementation of the item-lifetime check (A9).
 */
export interface EquipmentInstanceSnapshot {
  instanceId: string

  itemId: string

  slot: EquipmentInstance['slot']

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

  affixes: EquipmentSnapshotAffix[]
}

export interface EquipmentSnapshotAffix {
  affixId: string

  tier: number

  value: number
}

function cloneSnapshotMainStat(mainStat: StatModifier): StatModifier {
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

function snapshotMainStatMatches(current: StatModifier, expected: StatModifier): boolean {
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

/** Detached copy of every instance field a pending-op commit observes. */
export function captureEquipmentInstanceSnapshot(
  instance: EquipmentInstance,
): EquipmentInstanceSnapshot {
  return {
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
    mainStat: cloneSnapshotMainStat(instance.mainStat),
    affixes: instance.affixes.map(({ affixId, tier, value }) => ({ affixId, tier, value })),
  }
}

/**
 * True when `instance` still matches the issued-at snapshot field for
 * field. Identity/generation are NOT checked here — callers compare
 * `pending.instance === instance` and the bag membership generation
 * separately (the snapshot is a value; identity is a capability).
 */
export function equipmentInstanceMatchesSnapshot(
  instance: EquipmentInstance,
  snapshot: EquipmentInstanceSnapshot,
): boolean {
  return (
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
    snapshotMainStatMatches(instance.mainStat, snapshot.mainStat) &&
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
  )
}
