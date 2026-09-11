// The season/time vocabulary the battlefield and home backdrops are indexed by.
//
// §5.4 of
// docs/superpowers/specs/2026-09-11-frontend-static-dynamic-boundary-design.md:
// "the art is a presentation asset". This is the smallest piece of that art
// contract — which of sixteen variants is current — and both layers name it:
// `CombatScene` picks the next one after a battle, and `DongFuScene.vue` renders
// the matching home stack.
//
// It was declared in `src/game/support/ThanhVanArt.ts`, which also holds the
// Phaser DEPTH table. The depths belong in the dynamic layer and stay there;
// this vocabulary does not. `ThanhVanArt.ts` re-exports everything below, so
// every existing import keeps resolving — the same shape V2 used for the panel
// ids.

export const THANH_VAN_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const

export const THANH_VAN_TIMES = ['morning', 'noon', 'evening', 'night'] as const

export type ThanhVanSeason = (typeof THANH_VAN_SEASONS)[number]

export type ThanhVanTime = (typeof THANH_VAN_TIMES)[number]

/** One of the sixteen backdrop variants: a season crossed with a time of day. */
export interface ThanhVanVariant {
  season: ThanhVanSeason

  time: ThanhVanTime
}
