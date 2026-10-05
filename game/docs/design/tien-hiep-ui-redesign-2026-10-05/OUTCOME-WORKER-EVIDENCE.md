# Quest, settings and battle outcome worker evidence

Checkout: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`; branch `codex/tien-hiep-ui-redesign`. Existing task edits preserved. No commit, push or merge.

## G0/G1 scope and source census

This extends the construction task card in `REBUILD-EXECUTION.md`. The authorized responsibility is presentation composition for quest/settings, combat, tribulation and battle results. Quest/settings fidelity are production shells with real slot content from `QuestScene` and `SettingsSurface`. Combat/victory/defeat/tribulation fidelity are preview-only. The coordinator authorized the real consumers as a scope extension: `VictoryScene`, `CombatDefeatPanel`, `CombatSceneOverlay`, `TribulationSceneOverlay`. Their existing props, commands, timers and read-model authorities remain unchanged.

| Questions | Evidence |
|---|---|
| Q1 | Quest names/objectives/claim reasons readable, real settings operations accessible, results show actual summary/growth, battle/tribulation retain their live controls. |
| Q2/Q3 | `questOps`, existing settings methods, `useBattleActions`, retry-countdown composables and `tribulationDirector` retain writes/lifecycle authority. Changed layout sections only group existing components; CSS has no state. |
| Q4 | `QuestScene` slots -> fidelity workspace; `SettingsSurface` slot -> `SettingsPanel`; `CombatVictoryPanel` -> `VictoryScene`; `CombatDefeatPanel` -> unchanged hint/reward/actions; active game route -> actual combat/tribulation overlay. |
| Q5 | Reuse existing slot/read-model components, GameButton, meters and title/reward/growth primitives. No new domain mechanism. |
| Q6/Q7 | CSS imports remain presentation-only. No changed damage, outcome, timing, reward award, clock or ACK logic. Combat top/right inset publishers and enemy anchors unchanged. |
| Q8/Q9 | All values come from current props/real production slots. Result title uses localized rendered text over decorative ribbon. Queries remain observational. |
| Q10 | Existing busy, auto-retry, return countdown, unavailable claim and pending settings flows unchanged; browser input remains on original commands. |
| Q11 | Preview-only fidelity remains explicitly sample-labelled. Production slot overrides prevent fixture data from entering live quest/settings. Begin gate is handled by E2E boot/re-auth helpers; wheel capture uses explicit player click. |
| Q12 | Focused tests/runtime checks below are worker evidence; coordinator owns aggregate type/build/OCR/adversarial/sequential review and terminal decision. |

## G2/G3 changed responsibility

Added `src/assets/tien-hiep-outcomes.css`, imported by the owned fidelity scenes and real production hosts. Quest/settings use clearly separated list/category and detail workspaces. Production quest names have a full line, objectives use ink text on paper, and the decorative banner uses the warm landscape without pretending to be unique quest art. Real VictoryScene splits summary rewards from growth; actual defeat separates the reason and any earned rewards. Runtime battle and tribulation chrome keeps existing canvas viewport/insets and character assets.

E2E changes are limited to `helpers.ts`, `tien-hiep-pc-ui.spec.ts` and `huyen-kim-fidelity-capture.qa.spec.ts`. The latter's existing defeat capture formerly set HP to 1 and waited for an enemy hit, which stalled. Its terminal setup now mirrors its existing victory setup (`currentHp=0/alive=false` for the displayed player), allowing the real loop to mount defeat. This is a capture-only fixture; it proves result UI reachability, not damage/death rules.

## G4 focused evidence

All commands executed from `game/` against this checkout's existing server on port 5449.

- Focused Vitest: seven suites / 24 tests passed (latest 09:30 local). Suites: VictoryFidelityScene, CombatVictoryPanel, CombatDefeatPanel, CombatSceneOverlay.style, TribulationFidelityQuestion, CombatFidelityMeter, remainingPreview. Coverage retains action, summary and geometry semantics.
- `DEV_PORT=5449 npx playwright test tests/e2e/tien-hiep-pc-ui.spec.ts --grep 'PC outcome and support|production quest and settings' --workers=1`: two tests passed on latest resulting state. Six fixture scenes and their interactions; actual quest slot, settings save and Escape close exercised.
- `DEV_PORT=5449 npx playwright test tests/e2e/huyen-kim-fidelity-capture.qa.spec.ts --grep 'combat-victory-defeat live battle' --workers=1`: one test passed, real battle + victory/defeat capture (59.8 seconds).
- Production tribulation route test passed on the final resulting status-title repair (31.9 seconds); realm entry, live mind question and director-driven completion exercised.

Screenshots under `runtime-evidence/`: `pc-production-quest.png`, `pc-production-settings.png`, `pc-rebuilt-{quest,settings,victory,defeat,tribulation,combat}.png`, `13-combat.png`, `15-victory.png`, `16-defeat.png`, `14-tribulation.png`. Visually inspected actual quest/settings, real combat/results/tribulation and all six fixtures. UI review caught and repaired dark inherited text/pseudo-frame conflicts, squeezed quest row names, blank-looking objective section headings, growth amount overflow and incomplete loot-name readability. Those source/fixture differences show why preview screenshots alone are insufficient.

One intermediate fixture run failed only the console gate with Vite HMR WebSocket `ERR_NO_BUFFER_SPACE`; no page errors or failed interactions. No allowlist was weakened. A later identical resulting-state run passed. One test-selection mistake initially selected the lightning phase while expecting the mind-question card; selector corrected to the actual mind phase, with a passing re-run.

## G5 aggregate acceptance boundary

No QA fixed-point claim. Coordinator must incorporate these visual failures and repairs into the shared ledger/learning, then finish aggregate checks. This slice does not certify all game surfaces, all viewport sizes or progression/outcome rules from capture fixtures. No `any` introduced. No gameplay, dependency, save ownership or Phaser geometry edits.
