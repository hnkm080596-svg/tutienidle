// S11 Luyen Dan display contract - presentation-only shapes the
// production surface (AlchemySurface.vue) fills from
// GameManagerAlchemyOps / materialBag / previewAlchemyOutcome and the
// ui-preview fixture fills with sample data. The UI never derives
// craftability: `brewDisabled`/`blockReason`/`enough` arrive resolved.

export interface AlchemyRecipeChoice {
  readonly id: string

  readonly name: string

  readonly icon: string

  readonly grade: string

  /** Optional profession-grade rank tint (production only). */
  readonly gradeColor?: string
}

export interface AlchemyHerbChoice {
  readonly id: string

  readonly name: string

  readonly icon: string

  /** Display string, e.g. "12 / 2" (owned / needed). */
  readonly amount: string

  /** Owned >= needed for this variant (drives the shortage tone). */
  readonly enough: boolean
}

export interface AlchemyCostRow {
  readonly id: string

  readonly label: string

  /** Display string, e.g. "3 / 5" or "50". */
  readonly value: string

  /** false renders the shortage tone; undefined hides the flag. */
  readonly enough?: boolean
}

export interface AlchemyRecipeDisplay {
  readonly id: string

  readonly name: string

  readonly icon: string

  readonly grade: string

  /** Optional profession-grade rank tint (production only). */
  readonly gradeColor?: string

  readonly description: string

  readonly variants: readonly AlchemyHerbChoice[]

  readonly costs: readonly AlchemyCostRow[]

  readonly duration: string

  readonly outcome: string

  /** CTA state resolved by the adapter - the button never re-derives it. */
  readonly brewDisabled: boolean

  /** Localized reason the CTA is blocked; empty when brew is allowed. */
  readonly blockReason: string
}

export interface AlchemyJobDisplay {
  readonly id: string

  readonly name: string

  readonly icon: string

  /** 0-100 percent complete. */
  readonly progress: number

  readonly remaining: string
}
