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
  techniqueInsight: number

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

function drawFromPool(pool: readonly WeightedDropEntry[], rng: () => number): WeightedDropEntry | undefined {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0)

  if (total <= 0) {
    return undefined
  }

  let roll = rng() * total

  for (const entry of pool) {
    roll -= entry.weight

    if (roll <= 0) {
      return entry
    }
  }

  return pool[pool.length - 1]
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
  //      entry is selected.
  //   4. One rng() for the spiritStone amount, then one for the
  //      techniqueInsight amount.
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

  // 3. One merged weighted bag, drawn 1 + extraRolls times.
  const pool = [...(input.stageTable?.pool ?? []), ...(input.familyTable?.pool ?? [])]
  const rolls = 1 + totalExtraRolls(modifiers)

  for (let index = 0; index < rolls; index++) {
    const drawn = drawFromPool(pool, rng)

    if (drawn) {
      items.push(toResolved(drawn, rng))
    }
  }

  const currencyMultiplier = currencyMultiplierFor(modifiers)
  const currency = input.stageTable?.currency

  return {
    items,

    spiritStone: currency ? Math.floor(rollAmount(currency.spiritStone, rng) * currencyMultiplier) : 0,

    techniqueInsight: currency
      ? Math.floor(rollAmount(currency.techniqueInsight, rng) * currencyMultiplier)
      : 0,

    currencyMultiplier,

    qualityBonusSteps: qualityBonusStepsFor(modifiers),
  }
}
