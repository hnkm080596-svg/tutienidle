# Combat presentation polish - 2026-10-15

Workspace: E:\tutienidle; app: game; branch: master. Changes remain local and uncommitted. No push or merge performed.

## Accepted scope and rulings

1. Default actor placement uses the middle player-side 3x3 standing slot. BattlefieldRegions owns DEFAULT_PLAYER_STANDING_POSITION; default formation and presentation compatibility aliases derive from it. Companion construction requires the admitted formation position; no row-4 placeholder remains. Target selection rules are unchanged.
2. x2 means faster combat playback and shorter battles; production/cultivation stay 1x. CombatPlaybackSpeed is read only by presentation. CombatScene scales authored sprite animation, its tween manager and skill/VFX presentation delta. Ready-phase pacing scales with playback. No global Game clock or GameManager update delta is scaled.
3. Removed procedural turn-ready lean, cast lunge surface, critical size punch, standby scale reset and static PNG idle bob. Authored clips, hit recoil/flash and dodge feedback remain.
4. Missed hit outcomes keep authored skill imagery; landed remains the condition for hit camera feedback. Dodge feedback recoils away from the attacker, including companions, and fades to 0.55 then restores. Empty/skipped targets are not invented.
5. Linh Bao uses target-local blue flame gathering and an expanding explosion. The old burst atlas is no longer in its recipe. Generic flame cues are bounded and pooled; fitCastPhase keeps charge alive until the played clip's actual impact marker.
6. battle_end only selects/preloads the next backdrop. Results keep the finished battle background. Fresh-session rebind behind the closed curtain commits the prepared backdrop. Renderer READY waits for outstanding textures; stale bindings and stopped scenes cannot publish readiness. A paused renderer may finish loading.
7. The CSS/SVG initiative track reads actual participant speed and actionGauge, not a duplicated predicted actor queue. Equal gauge markers group with a tooltip retaining every participant identity. Dead actors are omitted. World/scheduler formulas are not reimplemented.

## Focused evidence

- Type-check passed on the final production state.
- Latest focused Vitest: 6 files / 77 tests passed (initiative grouping, recipe validation, skill runner, VFX driver, combat feedback and backdrop lifecycle).
- Coordinator/command mounting checks also passed in the earlier 8-file / 115-test focused run. Placement/companion closure passed 8 files / 68 tests.
- Real Edge/Playwright isolated guest session: created a character, started Thanh Van 1-1, selected x2, checked five equal bottom cards inside 1280x720 and the initiative track, reached defeat results, retried through the existing curtain transition and reached the next battle without page exceptions.
- Linh Bao and miss imagery inspected using the production runner/driver/feedback in the isolated VFX fixture. It does not read or modify a player's save. This is visual fixture evidence; an actual player cast of unlocked Linh Bao was not exercised.
- Actual screenshots: combat-initiative-2026-10-15.png, combat-result-backdrop-2026-10-15.png, combat-refight-backdrop-2026-10-15.png. VFX: linh-bao-charge-fixed-2026-10-15.png and linh-bao-miss-impact-2026-10-15.png.
- git diff whitespace check passed for affected production files.

## Repairs and evidence limits

The first browser-check retry selector assumed the victory label; the tested character lost and the correct label was Tai Chien. The checker now accepts both retry labels and the real workflow completed. This was a detector error, not a combat stall.

A horizontal SVG gradient initially used object-bounding-box units on a zero-height path, hiding the rail line. It now uses userSpaceOnUse; the corrected line is visible in runtime screenshots. The stage counter was moved beneath the right control cluster to avoid overlap with the new track.

The headless background test had a pre-existing Phaser/canvas import gap. Its renderer API is now explicitly mocked while the real runtime is checked separately. Loader controls cover pending assets, stale identity, shutdown and pause.

Browser extension transport became unavailable (Debugger unattached). The isolated Playwright Edge check supplied runtime evidence without touching the user's browser save. Full QA/fixed-point qualification and independent lesson promotion were not run, per requested scope. No merge-readiness or QA_FIXED_POINT_REACHED claim.
# Follow-up: authored white charge

## Follow-up: ready-phase synchronization and minimal line

The earlier display-only interpolation did not pace gameplay. In addition, treating every combat-clock freeze as a visual pause stopped marker travel during `turn-in-flight`. Production ready playback now starts a token-bound initiative request, lets the line travel while only that internal hold is present, and acknowledges ready only after the requested actor's displayed progress reaches 100. Stale tokens do not acknowledge; timers and shutdown listeners clean up. Headless/no-line fallback retains the existing ready timer. No damage or target rule moved into presentation.

The line renders only its stroke and avatars, with no labels, numbers, ticks, panel fill or hover text. The existing summon-visibility owner gates initiative avatars; wave fade-in publishes completion from its actual tween callback. Chrome mounting owns a composable `ui-assets` freeze latch while its images, active skill icons and fonts load; cleanup releases only that latch. Countdown stays under the existing combat clock.

Playback speed persists as a local UI preference. Auto mode uses an SVG perimeter light. Basic skills use a thin tapered SVG orbit without forced gold selection; card slots have no captions. Skill tooltip stat rows were extracted unchanged from SkillSurface into one shared projector used by both the skill panel and combat; names, description and player core level use the same catalog/progression queries. Card buttons retain hover while ineligible manual actions remain guarded.

Runtime evidence from a fresh isolated Edge guest battle: the player and three boars each emitted their first observed cast at displayed progress 100; five UI-loading samples showed no countdown advance; a fresh page restored selected x2; the technique tooltip rendered on hover; no page exceptions occurred. Screenshot: `combat-ready-order-2026-10-15.png`. Focused tests: 39 across six files, including stale/duplicate ready ACK, summon visibility and preference reload. Type-check passed. This is targeted validation, not full QA or a fixed-point claim; unlocked companion gameplay was not exercised.

## Follow-up: shared initiative line and occupied party cards

Initiative now uses one shared line and a stable marker per living participant; equal positions no longer merge identities. The user's subsequent ruling permits avatar overlap: markers farther ahead draw last, with higher speed breaking position ties. If authoritative gauge consumption occurs before the displayed sweep finishes, the display completes its trip to 100 before returning to zero. This is a presentation-only cycle; gameplay gauge and turn order remain authoritative and unchanged.

The dock filters empty formation positions and centers the occupied cards at the existing five-card width. Defeated participants remain displayed because they did enter battle. Both human and companion skills use CombatSkillSlot/SlotView state: defined basic slots are occupied and bright with a rotating ring light; missing or locked human abilities and missing companion abilities render locked. Manual-click eligibility no longer dims an automatic basic's entire card slot. SlotView is static inside the outer interaction owner to avoid nested buttons.

Linh Bao's white explosion rings and spark spread use a bounded cue scale of 1.3. The atlas orb is unchanged.

Evidence: type-check passed; 52 focused tests passed, including display-cycle completion, card skill states and exact 1.3 ring dimensions. An isolated Edge fresh guest battle rendered one centered card, a basic orbit, two locked skill slots and separate participant markers on one line, with zero page exceptions. The screenshot was inspected. Multi-companion formation rendering was not exercised in that guest flow; no full QA was run.

## Follow-up: charge pose, white explosion and continuous initiative travel

Linh Bao no longer emits the analytic flame-tongue impact cue. Both explosion rings use the recipe's white color. The inspected mortal unarmed contact sheet reaches the fully raised palm at clip-local frame 4, before impact frame 10. That charge-start marker travels from CharacterArt through the live clip catalogue into CombatScene and the runner; fitted charge playback occupies only the remaining interval before impact. It does not alter damage or impact authority.

Initiative markers now consume detached display positions advanced at a fixed linear rate (one track per second at x1, scaled by combat playback x2). They move toward current authoritative gauge positions instead of being assigned those positions immediately. The presentation loop stops advancement when the combat clock is frozen, discards stale battle display state, and cancels its animation-frame subscription on unmount. Gameplay continues using discrete gauge steps; this display does not define seconds in the gameplay gauge contract.

Focused checks: type-check passed; 65 tests initially passed, then the additional live-catalogue charge-marker regression passed with the 22-test runner scope. The isolated Edge fixture showed white rings without flame tongues and zero page exceptions. A fresh guest battle yielded successive marker coordinates 73.68 -> 150.96 -> 228.24 over the sampled intervals, confirming actual travel rather than a direct assignment to the endpoint. Full QA was not run.

## Follow-up: boar showed slash, not bite

The user corrected the symptom: boars displayed slash. Root cause confirmed in recipe generation: upright attack presets injected an analytic slash alongside the authored ram/bite sheet. Ram and bite presets now declare a sparks impact style; the shared generator consumes that presentation metadata rather than adding a weapon stroke. Stomp already uses a ground ring; bandit slash/multi-slash retain their slash cues. Gameplay targeting, damage and cadence are unchanged.

Focused verification: 35 tests across recipe, sheet manifest and Beta roster passed. An isolated Edge production-driver fixture rendered the ram sheet plus sparks, with no slash and zero page exceptions; screenshot: `boar-ram-without-slash-2026-10-15.png`. This is presentation-fixture evidence, not a fresh real-battle replay. The earlier unexplained-bite note below is superseded by this corrected symptom and root cause.

The user clarified that Linh Bao must reuse the Phap Tu charge animation after the magic circle, not the analytic flame shape. Its cast cue now plays the existing `hoa-cau-charge` atlas (51 frames) at target anchors, fitted to the current clip's impact marker. Phaser 4 FILL tint replaces RGB with white while preserving texture alpha; sprite opacity is 0.8. Explosion cues remain unchanged. Pool reuse clears tint and restores opacity.

Focused evidence: type-check passed; four relevant test files passed (73 tests). The isolated Edge VFX fixture rendered the production driver and the charge atlas with zero page exceptions; screenshot inspection confirmed a white translucent charge on the target. This fixture is not proof of an unlocked player Linh Bao cast in a real battle.

The six shipped Beta enemy definitions already declare ram / ram + stomp, slash / slash + multi-slash, and bite / bite + multi-bite respectively. A regression check now verifies these kits through enemy-to-combat conversion. No source evidence yet explains the reported boar bite; do not label that runtime symptom fixed from catalog tests alone. Dormant species and damage balance remain outside this check.

