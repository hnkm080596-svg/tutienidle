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

  /** Owned count for the slot amount corner (optional - amount string stays authoritative). */
  readonly owned?: number

  /** Owned >= needed for this variant (drives the shortage tone). */
  readonly enough: boolean

  /** Bag prop-set (owner ruling): optional SlotView fields the adapter
   * fills when the material carries them. */
  readonly description?: string

  readonly tooltip?: { title: string; description: string }

  readonly equipmentQualityRank?: number

  readonly rarityRank?: number

  readonly rarityRankScale?: 5 | 10

  readonly nameSegments?: import('@/core/item/NameSegment').NameSegment[]
}

export interface AlchemyCostRow {
  readonly id: string

  readonly label: string

  /** Display string, e.g. "3 / 5" or "50". */
  readonly value: string

  /** Slot icon (production fills from materialRegistry). */
  readonly icon?: string

  /** Owned count for the slot amount corner. */
  readonly owned?: number

  /** false renders the shortage tone; undefined hides the flag. */
  readonly enough?: boolean

  /** Bag prop-set (owner ruling): optional SlotView fields. */
  readonly description?: string

  readonly tooltip?: { title: string; description: string }

  readonly equipmentQualityRank?: number

  readonly rarityRank?: number

  readonly rarityRankScale?: 5 | 10

  readonly nameSegments?: import('@/core/item/NameSegment').NameSegment[]
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
  readonly state?: 'active' | 'waiting'

  readonly id: string

  readonly recipeId: string

  /** Herb variant the order was started with (tail-merge key). */
  readonly herbMaterialId?: string

  /** Pill room level at order start (tail-merge key). */
  readonly roomLevelAtStart?: number

  readonly name: string

  /** Order quantity (vien trong order) - optional until queue domain lands. */
  readonly quantity?: number

  /** Vien already minted inside this order. */
  readonly unitsDone?: number

  readonly icon: string

  /** 0-100 percent complete. */
  readonly progress: number

  readonly remaining: string
}
