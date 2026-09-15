// The Tu Reimagined (spec 2026-09-15 section 3.2/3.3) — one constants
// module for both The Tu stat channels. Emitters (CultivationPathSystem)
// and the consumption cap (StatMetadata) import from here so the ratios
// and the cap can never drift apart.
//
// Cap contract (review-locked): emitters and the domain delta deriver
// emit UNcapped raw linear values. REACTIVE_CHANCE_CAP is registered as
// the metadata `max` and applied only at final probability consumption/
// display (clampStatValue) — calculateEffectiveStats composes
// base + temp + derived(delta), so a clamped base would drop off cap
// early under a negative attribute delta.
export const THE_TU_AN_STR_COUNTER_PER_POINT = 0.004
export const THE_TU_AN_DEX_COUNTER_PER_POINT = 0.004
export const THE_TU_AN_VIT_PROTECT_PER_POINT = 0.004
export const THE_TU_AN_DEX_PROTECT_PER_POINT = 0.003
export const THE_TU_AN_DEX_FOLLOWUP_PER_POINT = 0.004
export const THE_TU_AN_INT_FOLLOWUP_PER_POINT = 0.003
export const REACTIVE_CHANCE_CAP = 0.6

// the_tu (Hien) channel: vitality -> enduranceThreshold, moved out of
// the universal attribute derivation (spec 3.3 — block/endurance is
// body-path identity, like MP is Phap Tu's).
export const THE_TU_VITALITY_ENDURANCE_THRESHOLD_PER_POINT = 1
