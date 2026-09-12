/**
 * The drop system's own modifier vocabulary (spec E8).
 *
 * Deliberately NOT the same thing as EnemyTag: the Perfect Clear spec's D4
 * makes boss a stage property rather than a tag, so a drop system that read
 * the tag list directly would have to fall back to an isBoss branch for the
 * one case that matters most. Here 'boss' is simply another modifier id.
 * DropContext.ts is the only place that knows which modifiers came from tags.
 */
export interface DropModifier {
  id: string

  /** Added to the number of times the merged pool is drawn from. */
  extraRolls: number

  /** Added into the currency multiplier - see currencyMultiplierFor. */
  currencyBonus: number
}

/**
 * Currency adds and caps; it does NOT multiply.
 *
 * The Perfect Clear spec stacks STATS multiplicatively (boss + tinh anh =
 * HP x7 x2.5). Reusing that shape for rewards produced x12.5, which the
 * user rejected. Adding with a named ceiling means a third modifier can
 * only reach the ceiling sooner, never blow past it.
 */
export const MAX_CURRENCY_MULTIPLIER = 4

/** Quality steps a single kill can add on top of the normal roll. */
export const MAX_QUALITY_BONUS_STEPS = 2

export const TINH_ANH_MODIFIER: DropModifier = {
  id: 'tinh_anh',
  extraRolls: 1,
  currencyBonus: 1,
}

export const BOSS_MODIFIER: DropModifier = {
  id: 'boss',
  extraRolls: 3,
  currencyBonus: 2,
}

export function totalExtraRolls(modifiers: readonly DropModifier[]): number {
  return modifiers.reduce((sum, modifier) => sum + modifier.extraRolls, 0)
}

export function currencyMultiplierFor(modifiers: readonly DropModifier[]): number {
  const raw = 1 + modifiers.reduce((sum, modifier) => sum + modifier.currencyBonus, 0)

  return Math.min(MAX_CURRENCY_MULTIPLIER, raw)
}

/**
 * Derived from HOW MANY modifiers the kill carries, not from a per-modifier
 * field (spec E9).
 *
 * A per-modifier qualityBonus cannot express the rule that was actually
 * agreed: give tinh_anh +1 and a lone elite is upgraded; give boss +1 and a
 * lone boss is upgraded. Both break "only when the kill carries both".
 * Counting reproduces the rule exactly and still generalises.
 */
export function qualityBonusStepsFor(modifiers: readonly DropModifier[]): number {
  return Math.min(MAX_QUALITY_BONUS_STEPS, Math.max(0, modifiers.length - 1))
}
