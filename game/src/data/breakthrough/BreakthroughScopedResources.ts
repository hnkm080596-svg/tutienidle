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

/** Pill the Truc Co breakthrough gate requires (presence check via
 *  hasTrucCoDan - it is a key, not a consumable: defeats already cost
 *  cooldown + cultivation, the pill is not debited). */
export const TRUC_CO_DAN_PILL_ID = 'truc_co_dan'

// 2026-09-23 hidden-perfection-lineage sec.19 - great_dao_seed retired
// (Dai Dao is a lineage channel now, never a breakthrough-scoped
// material). The list stays empty until another material qualifies.
export const BREAKTHROUGH_SCOPED_MATERIAL_IDS: readonly string[] = []

export const BREAKTHROUGH_SCOPED_PILL_IDS = [TRUC_CO_DAN_PILL_ID] as const

export const BREAKTHROUGH_SCOPED_RECIPE_IDS = ['alchemy_truc_co_dan'] as const

// M-F-ARTIFACT-DEFER - the DOMAIN-scoped census (distinct family from
// breakthroughRealmId above): resources whose acquisition exists ONLY to
// feed a domain gated by a shared unlock declaration (the artifact
// domain today). Delivery composes window + player reach via
// isDomainScopedAcquisitionEnabled - a below-unlock player gets nothing
// even once the unlock realm ships, which is why this family is NOT
// breakthrough-scoped (that gate only checks the window).
//
// INVARIANT: every id listed here must carry domainUnlockRealmId equal
// to the domain's shared unlock declaration (ARTIFACT_UNLOCK_REALM_ID),
// and every material record carrying the tag must be listed here - the
// integrity test asserts both directions plus the cross-field pin.
export const DOMAIN_SCOPED_MATERIAL_IDS = ['doan_bao_thach'] as const
