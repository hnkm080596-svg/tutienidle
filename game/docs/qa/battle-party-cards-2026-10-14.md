# BattleCard component integration - 2026-10-14

Scope: reusable raster components assembled into BattleCard; five equal bottom cards, admitted formation ordering, live battle vitals/skill data and current stat tooltip. No balancing, companion unlock, commit or push.

Components: BattleCard.vue composes GameCard, portrait crop/ring, CombatVitalMeter and skill slots. CombatPartyDock renders exactly five positions. BattlePartyCards orders admitted participants by live row/column and preserves identity; it does not read or activate persisted formation assignments.

Art generated with built-in imagegen, saved in public/assets/ui/tien-hiep-2026-10/combat/battle-card/. Prompt set: empty restrained antique-gold Chinese meander 9-slice frame with transparent center; parchment upper/dark ink lower background without baked UI; transparent circular cloud/gold socket; transparent beveled horizontal meter outline. Frame, ring and meter center alpha was verified zero. Existing assets retained.

Verification: type-check passed; focused Vitest three files, 17 tests passed. Browser ran actual Thanh Van 1-1, live HP/skill icons and five equal cards observed. At 1280x720 each card is approximately 238.93x181.33 at y528, within the shared frame. A resize check exposed stale physical bottom inset usage; CombatScene now reserves the fixed dock proportion from its current canvas height. Runtime reload and repeat verification performed for this change.

Limits: Beta formation/companions remain scope-hidden; no real five-member roster runtime available. Stat tooltip currently lists damage, defense and speed from live effective entity.stats. Additional stat categories can be added without changing battle authority. No full QA or fixed-point claim, per requested scope. No commit/push.

Final browser confirmation: fresh runtime, paused actual battle, resize to 1280x720 after larger viewport. Hero and enemies stayed above the dock after the proportional bottom reservation fix. Keyboard focus displayed the current-stat tooltip with damage 33, defense 9, speed 100. Temporary viewport override reset and battle resumed. Final images: battle-party-cards-small-fixed-2026-10-14.jpg and battle-party-card-tooltip-2026-10-14.jpg. Earlier small screenshot records the diagnosed pre-fix failure; use the fixed image for acceptance.
