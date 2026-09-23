// Breakthrough-scoped resource census (M-F-CEILING, C2C round 9) - the
// canonical list of resources whose acquisition exists ONLY to feed a
// realm-breakthrough gate. Release policy suppresses them via the
// optional breakthroughRealmId tag on Material/Pill/AlchemyRecipe.
//
// INVARIANT: every id listed here must carry a valid breakthroughRealmId
// on its registry record, and every registry record carrying the tag
// must be listed here (the integrity test asserts both directions).
// Authoring a breakthrough-scoped resource without listing it - or
// listing it without the tag - fails the suite.

/** Pill the Truc Co breakthrough gate consumes (hasTrucCoDan check). */
export const TRUC_CO_DAN_PILL_ID = 'truc_co_dan'

export const BREAKTHROUGH_SCOPED_MATERIAL_IDS = ['great_dao_seed'] as const

export const BREAKTHROUGH_SCOPED_PILL_IDS = [TRUC_CO_DAN_PILL_ID] as const

export const BREAKTHROUGH_SCOPED_RECIPE_IDS = ['alchemy_truc_co_dan'] as const
