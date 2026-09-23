// M-QI-09 (QI-D4c) - downward-only essence substitution at the Body
// chapter invest seam: pure plan math over grade counts - no bags, no
// PlayerData, no mutation. GameManagerRealmAdvanceOps owns the bags and
// applies the plan.
//
// Contract (spec docs/p7/missions/mqi-09-essence-substitution.spec.md,
// C2C rulings round 10):
// - one unit of grade g substitutes for ratio[g] (PHYSIQUE_ESSENCE_
//   CONVERSION_RATIO) integer units of grade g-1 (adjacent hops
//   only); a multi-hop yield is
//   the per-hop integer product down the chain (ratios are authored
//   integers, so the product IS the floor-at-each-hop result), so no
//   conversion path can beat the chain (no-arbitrage by construction);
// - the namespace gate lives HERE at the resolver boundary (C2C 6): the
//   plan takes the full typed currency descriptor and refuses every
//   non-material bag and every id outside the physique-essence family -
//   callers must not pre-qualify;
// - lowest-grade spend first, then resolve the shortfall grade-by-grade
//   upward (required -> required+1 -> ...) consuming the MINIMUM whole
//   units per hop - ceil(shortfall / yield);
// - the last hop's whole-unit overpay is credited back in required-grade
//   units inside the same transaction (C2C 2): exact-value substitution
//   - change is always < the last hop's yield, so it can never create
//   value or act as a free exchange;
// - callers scope `consumed` inside `owned + coverage`, so a plan
//   always covers its `consumed` in full (all-or-nothing).
import {
  physiqueEssenceConversionRatio,
  physiqueEssenceMaterialId,
} from '../../../data/realm/PhysiqueEssence'
import {
  PHYSIQUE_GRADES,
  getPhysiqueGradeIndex,
  type PhysiqueGradeId,
} from '../../../data/realm/PhysiqueLadder'
import { bodyChapterEssenceGrade, type BodyChapterCurrency } from './BodyChapter'

export interface EssenceSubstitutionDebit {
  readonly materialId: string
  readonly amount: number
}

export interface EssenceSubstitutionPlan {
  readonly debits: readonly EssenceSubstitutionDebit[]
  /** Required-units the debit list covers - >= consumed when the
   * caller honoured the coverage bound. */
  readonly covered: number
  /** Required-grade change credited back when the last debit's hop
   * overpaid (covered - consumed > 0); absent when the spend was
   * exact. Overflow beyond the bag's stackLimit is lost - bounded
   * by the deepest hop's yield. */
  readonly change?: EssenceSubstitutionDebit
}

/** Required-units covered per source unit: the per-hop integer product
 * of the adjacent ratios from `source` down to `required`. Returns 1
 * when the grades match, 0 when the source is lower or the chain is
 * broken (a rung with no authored material or no ratio can never carry
 * value). */
export function essenceSubstitutionYield(
  required: PhysiqueGradeId,
  source: PhysiqueGradeId,
): number {
  const requiredIndex = getPhysiqueGradeIndex(required)
  const sourceIndex = getPhysiqueGradeIndex(source)
  if (sourceIndex <= requiredIndex) return sourceIndex === requiredIndex ? 1 : 0

  let yieldPerUnit = 1
  for (let g = sourceIndex; g > requiredIndex; g--) {
    const grade = PHYSIQUE_GRADES[g]?.id
    if (grade === undefined) return 0
    const ratio = physiqueEssenceConversionRatio(grade)
    if (ratio === undefined || physiqueEssenceMaterialId(grade) === undefined) {
      return 0
    }
    yieldPerUnit *= ratio
  }
  return yieldPerUnit
}

/** Total required-units coverable from higher grades -
 * `sum(ownedOf(g) * yield(g))` over every rung above the cost's grade.
 * Returns 0 when the cost is not a material-bag physique essence (the
 * resolver-side namespace gate). */
export function essenceSubstitutionCoverage(
  cost: BodyChapterCurrency,
  ownedOf: (grade: PhysiqueGradeId) => number,
): number {
  const required = bodyChapterEssenceGrade(cost)
  if (required === undefined) return 0

  let coverage = 0
  const requiredIndex = getPhysiqueGradeIndex(required)
  for (let g = requiredIndex + 1; g < PHYSIQUE_GRADES.length; g++) {
    const source = PHYSIQUE_GRADES[g]?.id
    if (source === undefined || physiqueEssenceMaterialId(source) === undefined) continue
    coverage += ownedOf(source) * essenceSubstitutionYield(required, source)
  }
  return coverage
}

/** Deterministic debit plan for `consumed` required-units of `cost`:
 * spend the required currency first, then ascending grades
 * nearest-higher-first. Returns undefined when `cost` is not a
 * material-bag physique essence - the resolver refuses substitution
 * outright rather than planning against a foreign currency.
 * Precondition: `consumed <= ownedOf(required) + coverage` - honoured
 * whenever the caller passed `owned + coverage` as availability. */
export function planEssenceSubstitution(
  consumed: number,
  cost: BodyChapterCurrency,
  ownedOf: (grade: PhysiqueGradeId) => number,
): EssenceSubstitutionPlan | undefined {
  const required = bodyChapterEssenceGrade(cost)
  const requiredMaterialId =
    required === undefined ? undefined : physiqueEssenceMaterialId(required)
  if (required === undefined || requiredMaterialId === undefined) {
    return undefined
  }

  const debits: EssenceSubstitutionDebit[] = []
  let shortfall = consumed
  let covered = 0

  const requiredSpend = Math.min(
    consumed,
    Math.max(0, ownedOf(required)),
  )
  if (requiredSpend > 0) {
    debits.push({ materialId: requiredMaterialId, amount: requiredSpend })
    covered += requiredSpend
    shortfall -= requiredSpend
  }

  const requiredIndex = getPhysiqueGradeIndex(required)
  for (let g = requiredIndex + 1; shortfall > 0 && g < PHYSIQUE_GRADES.length; g++) {
    const source = PHYSIQUE_GRADES[g]?.id
    if (source === undefined) continue
    const materialId = physiqueEssenceMaterialId(source)
    if (materialId === undefined) continue
    const yieldPerUnit = essenceSubstitutionYield(required, source)
    if (yieldPerUnit <= 0) continue // broken chain: carries no value
    const units = Math.min(ownedOf(source), Math.ceil(shortfall / yieldPerUnit))
    if (units <= 0) continue
    debits.push({ materialId, amount: units })
    covered += units * yieldPerUnit
    shortfall -= units * yieldPerUnit
  }

  const change =
    covered > consumed
      ? { materialId: requiredMaterialId, amount: covered - consumed }
      : undefined

  return { debits, covered, change }
}
