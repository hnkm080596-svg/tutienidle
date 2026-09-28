# Combat slice — fix report

Branch: `devin/ui-fix-combat` · Base: `origin/master` (merge #40) · Fixer session: combat slice only.
Verification: `npm run type-check` clean; `npx vitest run src/components/game/combat src/game/scenes/combat/PlayerHudLayer.test.ts src/presentation/geometry/combatInsets.test.ts src/composables/useAutoRetryCountdown.test.ts` → 15 files / 73 tests green. Runtime re-verified on dev server (headed Playwright, real guest char → Thanh Vân stage, manual + auto); after-shots in `game/docs/ui-audit/combat/fixed/`.

Constraint honored: no edits under `core/battle/runtime/**`, `SkillPresentation*` internals, or camera/impulse plumbing (PR #43 pending). All fixes are Vue HUD/CSS + the `combat_exit_request` call-site wiring.

## Per-finding status

### FIXED

1. **[Critical] Skill slots render at 2×2px** — `.turn-combat-skill-bar__slot-button` now owns an explicit footprint (`width: var(--combat-skill-slot-size)`, new token = 64px in `theme.css`; `flex: none`). Root cause confirmed in code: `SlotView` inside is `width:100%; aspect-ratio:1` of a shrink-to-fit button → collapse. Rail switched to a vertical column to match the narrow dock. Verified live: all 3 slot buttons measure 64×64; tappable state (jade outline) visible (`fixed/42-dock-manual-fixed.jpg`, `fixed/44-slotrow-zoom-fixed.jpg`).

2. **[High] Skill dock empty-drawer footprint (27–49vw void)** — `CombatSkillDockPanel` is now hug-content (`top: var(--combat-topbar-h); right: 0; width: auto`), no `bottom: 0`, no `clamp(340px,27vw,440px)`. `CombatSceneOverlay` mounts it with `v-if="isBattleFighting"` so the dock unmounts on intro/results and `clearSkillDockWidth()` drops the scene's right inset to 0. ResizeObserver keeps publishing the real width. Verified live: dock = 203×282 top-right rail while fighting; `dockMounted=0` during intro/countdown/results (`fixed/42`, `fixed/70-narrow-820-fixed.jpg` — still 203px at 820px).

3. **[High] Victory title dark-on-dark + reward names** — `.combat-victory-panel` and `.combat-defeat-panel` now remap `--paper-text{,-soft,-muted}` → `--surface-text{,-soft,-muted}` at the panel root (the documented `.ink-drawer` contract, applied per-panel since these surfaces aren't drawers). Covers the title AND `RewardList` item names via var inheritance. Verified live: `★ THẮNG ★` computes `rgb(232,228,220)` (was `#211f1a`); reward rows legible (`fixed/50-victory-panel-fixed.jpg`, `fixed/61-defeat-panel-fixed.jpg`).

4. **[High] Defeat auto-return countdown label** — return button now renders `{{ t('combat.defeat.returnHome') }} {{ t('combat.defeat.returnCountdown', { duration: formatDuration(returnCountdown, 'countdown') }) }}` using the already-running `useAutoRetryCountdown(10, returnHome)` handle. New key `combat.defeat.returnCountdown` = `"({duration})"` in vi/en. Verified live: button reads `Về Động Phủ (10s)`, ticking down (`fixed/61-defeat-panel-fixed.jpg`).

5. **[High] Combat exit wiring (`requestCombatExit` dead code)** — `CombatTopBar` gained a `Thoát Trận` / `Leave Battle` button emitting `combat_exit_request` on `gameManager.eventBus` (the bridge contract `CombatScene.requestCombatExit` already emitted; the scene's own call site remains for Esc-style callers). Button renders only when `ui.combatOrigin === 'stage' && isBattleFighting`. Stale "no retreat mechanism" comment corrected. Verified live: button opens `CombatExitConfirmModal` (Ở Lại / Thoát Trận, Esc) (`fixed/60-exit-confirm-modal-fixed.jpg`).

6. **[Medium] Thế pips readability** — `PlayerHudLayer`: fixed `THE_DOT_RADIUS = 3` → adaptive radius in `layoutTheExtras` (`min(5, (spacing − 2px gap)/2)`, floor 2). Cap-5 pool now draws 10px pips; densest row (12) keeps ≥2px gaps. Verified live via runtime poke (`maxThe=5/currentThe=4`): "Thế 4/5" row shows 5 distinct fat pips (`fixed/90-the-pips-fixed.jpg`).

7. **[Medium] Cast-blocked slot visibility** — `.is-insufficient` / `.is-out-of-range` already dimmed the slot (grayscale 0.6, opacity .7); the cost text now also flips to `--crimson` + bold so the blocked slot shows WHY it can't cast. Verified via poked 999-cost slot: cost renders `rgb(229,72,77)` crimson (`fixed/46-cast-blocked-fixed.jpg`).

8. **[Medium] Hardcoded VI in TurnCombatSkillBar** — `Bị Động` / `Thủ công` / `Đến lượt bạn` / aria-labels → `t('combat.overlay.skillBar.*')` (new group: `roles.{basic,special,ultimate}`, `passiveTag`, `manualToggle`, `awaitingChoice`, `use`, `empty`, `unreleased`). Also moved `CombatSkillSlot`'s `'Trống'` fallback and `'Chưa Ra Mắt'` overlay to the same group. Verified live: EN locale shows Manual/Special/Ultimate/"Your turn — pick a skill", topbar "Leave Battle" (`fixed/80-en-locale-combat-fixed.jpg`).

9. **[Low] Exit modal over victory screen** (cross-referenced by the exit-wiring fix) — `CombatExitConfirmModal.onExitRequest` now also requires `gameManager.getTurnBattle()?.state === 'fighting'`, not just `combatOrigin === 'stage'`. Verified live: emitting `combat_exit_request` on the victory screen no longer opens the modal; exit button is absent on results. Covered by a new unit test (`request ngoài trạng thái fighting … KHÔNG mở modal`).

### DEFERRED / out of slice (pre-assigned to other fixers per ownership map)

- Toast flood (≤15 cards, right edge) — toast surfaces, not combat HUD.
- Turn-order strip clipping under dock — partially mitigated (dock 203px vs 386px) but strip is still full-width; strip surface is not mine.
- Player HP ×3 / hardcoded "Player" sprite label; enemy HP sliver ~30×4px; duplicate monster names (chips/sprites indistinguishable) — scene/sprite label surfaces.
- Reward list template names ("Kiếm +6") — reward composition/display names.
- AI panel floating over scene; battle log flat; stage-select truncation; victory reward re-read; Vue DevTools anchor.
- "Thủ công" checkbox coachmark / segmented-control half of that Medium — the i18n half is fixed; a coachmark is new-feature work, not a bug fix.
- Toast eyebrow "Nhận được" hardcode — lives in the toast component (other slice's surface); TurnCombatSkillBar's half is fixed.

### REJECTED

None — every owned finding reproduced in code before fixing.

## Remaining risks / notes

- `isBattleFighting` lags the `state → 'fighting'` flip by one tick (sub-frame; dockMounted sampled at the transition instant showed 0, then present). Not user-visible.
- `useTurnCombatManual` is now consumed by `CombatTopBar` too (shares `useStateVersion` provider — already provided app-wide; no new provider requirement).
- Test updates made: `CombatExitConfirmModal{,.focus}.test.ts` mocks gained `getTurnBattle` + new non-fighting gate test; `TurnCombatSkillBar.display.test.ts` mounts with `app.use(i18n)`; `PlayerHudLayer.test.ts` fake Arc gained `setRadius`.
- Before-shots for comparison: `origin/devin/ui-audit-report:game/docs/ui-audit/combat/shots/*.jpg`.
