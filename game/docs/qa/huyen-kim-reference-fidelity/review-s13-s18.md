# Review — S13/S14 (route-owned scenes) + S15/S16/S17/S18 (scroll scenes)

Reference dir: `docs/design/references/huyen-kim/scenes/`. Before: `evidence/before/`. After: `evidence/after/` (1280x720). Refs are AI-generated guides — canonical domain data wins over ref geometry where they disagree.

## S13 Combat (ref 10-combat.jpg)

- **Composition**: full-bleed battlefield retained; DOM HUD stays edge-hugging. Ref's player plate top-left is AI-drift — canonical PlayerHudLayer owns the HP/Linh Lực/Kiếm-Thế bar stack bottom-left on canvas (deliberate prior decision, kept).
- **Chrome**: turn tokens (`turn-token`), skill orbs (`skill-orb-frame`), AI panel already on combat chrome; no new material needed.
- **Interaction**: manual cast / auto / target selection unchanged (gameplay-owned).
- Verdict: VISUAL_ACCEPTED.

## S14 Tribulation (ref 13-tribulation.jpg)

Changes made:
- Removed the `frame-xl-ceremony` nine-slice painted fullscreen at depth 20 (`TribulationScene.ts`) — read as a stray dark ring over the storm; ref/spec want full-bleed vista. Depth contract + comments updated, `viewportFrame` state/resize/shutdown wiring removed.
- `TribulationSceneOverlay.vue`: left status card restructured — now a real `surface-m-panel` card containing the `scroll-title-plaque` band + chapter name + "Chương n / m" progress; tank phase strikes/hint fold in below. Previously text overflowed the plaque's painted bounds (escaped left/bottom).
- Question card stays right-anchored (`top:26%; right:4%`), timer ring (`timer-ring` art) + seconds + right-anchored time bar; canonical answers/timers untouched.
- Fixed dead font tokens: `--text-display-md`/`--text-body-lg`/`--text-xl` were never defined (silently resolved to `unset`); chapter → `--text-display`, question → `--text-lg`. Same dead token fixed in CombatVictoryPanel/CombatDefeatPanel titles → `--text-display-lg`.
- Route invariant pinned in capture spec: `.hk-scroll` count must be 0 before the shot (kills the earlier capture-race false positive of a "scroll leak").

Remaining nits (accepted): tracker pip discs nearly touch at 1280px (18px gap, disc imgs inset -6px — intentional adjacency, text does not overlap); Vue DevTools anchor visible in dev builds only.

Verdict: VISUAL_ACCEPTED.

## S15 Victory (ref 14-victory.jpg) / S16 Defeat (ref 15-defeat.jpg)

- Ceremonial scroll envelope + ribbon title + reward slot row + growth card + dual CTA — matches ref grammar.
- `RewardList.vue`: labels switched to light ramp (were `--paper-text-soft` gray on dark `frame-s-slot` — illegible).
- Dead title token fixed (above) — "CHIẾN THẮNG"/"THẤT BẠI" now render at true `--text-display-lg`.
- Defeat: cinnabar ribbon + hint + retry/return countdown verified live (10s).
- No canonical flow change: reward admission, countdown, retry/continue semantics untouched.

Verdict: VISUAL_ACCEPTED both.

## S17 Settings (ref 16-settings.jpg)

- Root defect: panel still carried `paper-on-dark` (remaps `--paper-*` to the dark surface ramp) — stale from the dark-scroll era; on the pale scroll interior it produced muddy dark cards + washed-out note text. Removed → sections are pale cards with hairline borders on paper; autosave note readable; nav pills stay dark via `--hk-surface-raised` (matches ref's dark rail buttons with jade active bar).
- All canonical surfaces intact: save/reload/export/import/reset, UI scale, locale, audio sliders (hk slider chrome), reduced shake, account (remote only), update (feed-bound only), feedback, build identity.
- Verdict: VISUAL_ACCEPTED.

## S18 Quest (ref 17-quest.jpg)

- List rail (cadence group + `list-row` chrome entries) + detail column (name/desc/progress/target/rewards/shortfall/claim) inside imperial scroll — canonical `getBetaQuestSurfaceModels()` rows, no invented tabs/cadences.
- Fix: empty state was trapped inside the 240px rail while 2/3 of the scroll stayed blank; now spans the full content grid (rail hidden when the model emits no rows).
- Verdict: VISUAL_ACCEPTED.

## Micro overlays

- `ConfirmModal`/`FeedbackDialog`/`GuestAbandonDialog`/`OfflineSummaryModal`/`TalentEntitlementModal` already ride `surface-m-panel` + `frame-m-modal` chrome with scrim/focus/Esc semantics; kept `paper-on-dark` correctly (they render on dark modal chrome).
