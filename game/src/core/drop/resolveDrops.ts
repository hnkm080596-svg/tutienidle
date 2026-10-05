import {
  currencyMultiplierFor,
  qualityBonusStepsFor,
  totalExtraRolls,
  type DropModifier,
} from './DropModifier'
import type {
  AmountRange,
  DropEntry,
  DropKind,
  FamilyDropTable,
  SignatureDrop,
  StageDropTable,
  WeightedDropEntry,
} from './DropTable'

export type DropChannel = 'active' | 'idle'

export interface ResolvedDropItem {
  kind: DropKind
  itemId?: string
  amount: number
}

export interface DropResult {
  items: ResolvedDropItem[]

  /** Already multiplied by currencyMultiplier. */
  spiritStone: number

  /**
   * Already multiplied. skillInsight is NOT returned here: BattleLootSystem
   * derives it from this value through the existing getSkillInsightReward(),
   * so it inherits the same multiplier without a second code path (spec E12).
   */
  techniqueMastery: number

  currencyMultiplier: number

  /** Steps to add on top of EquipmentSystem's own quality roll (spec E5). */
  qualityBonusSteps: number
}

export interface ResolveDropsInput {
  modifiers: readonly DropModifier[]
  channel: DropChannel
  stageTable?: StageDropTable
  familyTable?: FamilyDropTable
  signatureDrops?: readonly SignatureDrop[]

  /** Injectable so the economy guards can run a repeatable large sample. */
  rng?: () => number
}

function rollAmount(range: AmountRange | undefined, rng: () => number): number {
  if (!range) {
    return 1
  }

  const low = Math.ceil(range.min)
  const high = Math.floor(range.max)

  return Math.floor(rng() * (high - low + 1)) + low
}

function toResolved(entry: DropEntry, rng: () => number): ResolvedDropItem {
  return {
    kind: entry.kind,
    itemId: entry.itemId,
    amount: entry.kind === 'equipment' || entry.kind === 'equipment_any' ? 1 : rollAmount(entry.amount, rng),
  }
}

function drawFromPool(
  pool: readonly WeightedDropEntry[],
  rng: () => number,
  missWeight = 0,
): WeightedDropEntry | undefined {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)

  if (total <= 0) {
    return undefined
  }

  let roll = rng() * (total + missWeight)

  for (const entry of pool) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry
    }
  }

  // The roll passed every entry: on a gated table it landed in the
  // reserved miss band and the draw yields nothing. On an ungated table
  // (missWeight 0) keep the historical float-error fallback of paying the
  // last entry so the documented "every draw hits" contract is unchanged.
  return missWeight > 0 ? undefined : pool[pool.length - 1]
}

/**
 * Weight reserved for the "miss" outcome so each draw hits at
 * `poolDrawChance` of the MERGED bag (stage + family entries together).
 * Absent means ungated; <= 0 reserves an unmissable miss band
 * (Infinity keeps the arithmetic honest without a special case); 1
 * degenerates to hitWeight*0 = ungated. Values outside [0,1] (incl.
 * NaN) are invalid authored data - fail closed instead of silently
 * ungating (r10-AUT contract hole).
 */
function poolMissWeight(
  pool: readonly WeightedDropEntry[],
  poolDrawChance: number | undefined,
): number {
  if (poolDrawChance === undefined) {
    return 0
  }

  if (!(poolDrawChance >= 0 && poolDrawChance <= 1)) {
    throw new Error(`poolDrawChance must be in [0, 1] (got ${poolDrawChance})`)
  }

  const hitWeight = pool.reduce((sum, entry) => sum + entry.weight, 0)

  if (hitWeight <= 0) {
    return 0
  }

  if (poolDrawChance <= 0) {
    return Number.POSITIVE_INFINITY
  }

  return hitWeight * (1 / poolDrawChance - 1)
}

export function resolveDrops(input: ResolveDropsInput): DropResult {
  const rng = input.rng ?? Math.random
  const modifiers = input.modifiers
  const modifierIds = new Set(modifiers.map((modifier) => modifier.id))

  const items: ResolvedDropItem[] = []

  // rng() consumption order, in full, since callers script a fixed replay
  // sequence and any change here silently shifts every downstream draw:
  //   1. One rng() per guaranteed line (stage then family), for its chance
  //      check, in declaration order.
  //   2. One rng() per signature drop line that passes its modifier/channel
  //      gate, for its chance check, in declaration order.
  //   3. One rng() per pool draw (1 + extraRolls total), for which weighted
  //      entry is selected. A gated stage table (poolDrawChance < 1) folds
  //      its miss outcome into THIS same roll, so the count stays one
  //      rng() per draw and no downstream call shifts position.
  //   4. One rng() for the spiritStone amount, then one for the
  //      techniqueMastery amount.
  // On top of that base order: ANY entry above that carries an `amount`
  // range (guaranteed, signature, or pool) consumes one EXTRA rng() call
  // inline, immediately after its own selection roll and before the next
  // line/draw is processed (see toResolved -> rollAmount). Adding an
  // `amount` range to an entry that did not have one before will shift
  // every rng() call that comes after it in this order.

  // 1. Guaranteed compartments of both layers - independent chance per line,
  //    unaffected by extra rolls.
  const guaranteed = [
    ...(input.stageTable?.guaranteed ?? []),
    ...(input.familyTable?.guaranteed ?? []),
  ]

  for (const entry of guaranteed) {
    if (rng() < entry.chance) {
      items.push(toResolved(entry, rng))
    }
  }

  // 2. Signature drops. Idle keeps only the certain lines (spec E11) so the
  //    Foundation Establishment gate stays a reward for playing, not for
  //    leaving the game running.
  for (const entry of input.signatureDrops ?? []) {
    if (entry.requiresModifier && !modifierIds.has(entry.requiresModifier)) {
      continue
    }

    if (input.channel === 'idle' && entry.chance < 1) {
      continue
    }

    if (rng() < entry.chance) {
      items.push(toResolved(entry, rng))
    }
  }

  // 3. One merged weighted bag, drawn 1 + extraRolls times. The stage
  //    band may gate the draw itself: poolDrawChance < 1 reserves a "miss"
  //    band inside the same roll, so stage and family lines share the
  //    gate and the per-draw rng cost stays one call (no extra roll -
  //    a separate gate roll would shift every downstream draw).
  const pool = [...(input.stageTable?.pool ?? []), ...(input.familyTable?.pool ?? [])]
  const rolls = 1 + totalExtraRolls(modifiers)
  const missWeight = poolMissWeight(pool, input.stageTable?.poolDrawChance)

  for (let index = 0; index < rolls; index++) {
    const drawn = drawFromPool(pool, rng, missWeight)

    if (drawn) {
      items.push(toResolved(drawn, rng))
    }
  }

  const currencyMultiplier = currencyMultiplierFor(modifiers)
  const currency = input.stageTable?.currency

  return {
    items,

    spiritStone: currency ? Math.floor(rollAmount(currency.spiritStone, rng) * currencyMultiplier) : 0,

    techniqueMastery: currency
      ? Math.floor(rollAmount(currency.techniqueMastery, rng) * currencyMultiplier)
      : 0,

    currencyMultiplier,

    qualityBonusSteps: qualityBonusStepsFor(modifiers),
  }
}
