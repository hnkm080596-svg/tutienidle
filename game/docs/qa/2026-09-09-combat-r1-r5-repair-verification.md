# QA Review: Combat repair chain R1-R5 — repair verification re-audit

- Date: 2026-09-09
- Mode: quick (verification of repairs against a prior deep report; no new production probing scope opened)
- Verdict: **PASS WITH EVIDENCE** (upgraded from FAIL on 2026-09-09 after the F7 repair was applied and verified; see F7 closure note)
- Reviewed base: deep report `2026-09-08-combat-r1-r5-reaudit-deep.md` (verdict FAIL, F1-F6 confirmed at HEAD `3ef2aca5`)
- Worktree: `E:/tutienidle/.agent-worktrees/combat-r1-r5-reaudit`
- Branch: `codex/combat-r1-r5-reaudit`
- Outcome: all six confirmed findings F1-F6 now have production repairs in the working tree (uncommitted). All 9 prior failing reproduction tests now pass (425 files / 2902 tests green). Static gaps S1/S2/S3 all closed. The F7 duplicate-invoke finding found during verification has been repaired with an exactly-once regression test (see F7 closure note below).
- Production edits: the F7 repair (single-call fix) and the S3 closure (read-only map views, setter removal, test-fixture migration) were applied after this report was first issued, each following the audit's repair direction. The other uncommitted repairs were pre-existing in the worktree; this audit only verified, ran tests, and wrote this report. No commit/merge/push/deploy. Real-browser (P14/playwright-cli) spot-check was not run this session per explicit user instruction; E2E Playwright evidence below is the browser-level evidence available in this worktree, and the live-browser visual check remains deferred to branch finishing on the main checkout.

## Scope and Risk Map

Verification target: the uncommitted working-tree diff on top of `3ef2aca5` (17 production files, 7 test files, learned-defects ledger) against the six findings and three static gaps of the 2026-09-08 deep report. One-hop consumers re-checked statically: CombatScene event bindings and ACK callbacks, PassiveSystem event subscription, GameManagerTurnBattleOps session wiring, App.vue tick, helper consumers, test fixtures.

Exclusions: save/cloud, offline, two-tab, soak, R7/R8.1 plans (unchanged scope from the deep report).

## Repair-by-repair verification

| Finding | Repair found in worktree | Verification result |
| --- | --- | --- |
| F1 duplicate gameplay attack | `TurnActionPresentationEvents.emitTurnCastStart` now emits `turn_cast_start` (visual-only); sole gameplay `attack` emit remains at `TurnBattleSystem.ts:928`. CombatScene binding migrated to `turn_cast_start` (CombatScene.ts:537). PassiveSystem subscribes `EVENT_TO_TRIGGER` keys (unchanged `attack` mapping) — no longer double-triggered. Existing tests migrated to new contract, not weakened. | PASS with evidence (reaudit mode-parity test green) |
| F2 cleansed DoT still executes | `BuffPool.hasInstance()` added; `BuffSystem.update()` skips buffs removed mid-iteration (before ticking, before each effect, after DoT apply, before expiry bookkeeping). | PASS with evidence (reaudit cleanse test green) |
| F3 composite drops ailments | Composite loop now calls `applySkillAilments(actor, target, pickedSkill)` for non-dodged picks; `applySkillAilments` widened to accept `SelectedAction \| TurnSkillDefinition`. | PASS with evidence (reaudit composite-ailments test green) |
| F4 ultimate damages enemy | `PHAP_TU_REACTION_ULTIMATE` now `targetScope: 'self'`, `damage` field removed. TurnBattleSystem self-scope path applies buff only. | PASS with evidence (reaudit ultimate test green) |
| F5 missing ACK token bypass | All three runtime ACKs now require token: `if (!token \|\| token !== this.playbackToken) return`. GameManager/GameManagerTurnBattleOps pass-through signatures unchanged; production scene callers already capture tokens; tokenless callers migrated in tests. | PASS with evidence (3 omission cases + stale-token control green) |
| F6 headless auto-invest | `GameManager.update()` now calls `investBodyRefinement(activePlayer)`. | PASS with evidence (reaudit headless test green) — but see NEW finding F7 |
| S1 tu_sinh_ngo default in CombatSystem | Default removed; `GameManagerTurnBattleOps.startBattleWithPlayer` now supplies explicit `grantBuffId: 'tu_sinh_ngo'`, `cleanseDebuffs: true`. Only production session wiring site (checked). surviveLethal tests updated to explicit config. | CLOSED |
| S2 literal `phap_tu_reaction_special` OR check | Removed; composite gate is `compositePicks.poolType === 'reaction_path'` only. Production SPECIAL definition carries `compositePicks`. TurnBattleSystem.test.ts fixture updated to carry compositePicks. | CLOSED |
| S3 writable helper map exposure | **CLOSED (2026-09-09, dev workflow):** helper and scene getters now return `ReadonlyMap`; replacement setters deleted; last production mutation site (`interpolations.delete` in reconcile) migrated to `positionInterp.delete`; `CombatGridViewHost.interpolations` narrowed to `ReadonlyMap` (TranPhap host unaffected). 7 test fixtures migrated off map-replacement assignment; QA encapsulation test rewritten to assert get-without-set + owned-API mutation. | CLOSED |

## Invariant Ledger (verification pass)

| ID | State/owner | Action | Invariant | Result |
| --- | --- | --- | --- | --- |
| INV-06 (recheck) | Gameplay event owner | Same action headless vs presentation ACKs | Exactly one `attack` event | RESOLVED (test green) |
| INV-05 (recheck) | Buff pool/survival | Cleanse mid-DoT-iteration | Removed effects cannot execute; survivor alive | RESOLVED (test green) |
| INV-03/04 (recheck) | Reaction composite/empowerment | Real content execution | Ailments preserved; self ultimate no damage | RESOLVED (tests green) |
| INV-07/08 (recheck) | Runtime pending phases | Omitted/stale token | No phase advance / damage | RESOLVED (tests green) |
| INV-09 (recheck) | Headless progression | Manager update with eligible player | Domain auto-invests without App | RESOLVED, but double-invocation found (F7) |
| INV-N1 (new) | Headless progression | One manager update, one tier cap | Auto-invest once per update | VIOLATED — F7 |
| INV-12 (recheck) | Policy/helper boundaries | Inspect consumers | One semantic/state owner | S1/S2 closed; S3 partial (R-B) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx.cmd vitest run` (4 reaudit files) | Exit 0; 4 files / 9 tests passed | All previously failing reproduction tests (8 failed / 1 passed in deep report) now pass. Duration 1.97s. |
| `npm.cmd run type-check` | Exit 0 | vue-tsc clean after repairs. |
| `npm.cmd run build` | Exit 0 | Vite build succeeds; pre-existing large-chunk warning only. |
| `npx.cmd vitest run --reporter=dot` (full) | Exit 0; 425 files / 2901 tests passed | 2892 baseline + 9 reaudit = 2901; no skip. 143.75s. |
| E2E `create-to-combat` + `turn-combat-hud` + `combat-overlay-layout`, DEV_PORT=5199, chromium | 4 passed / 1 failed first run | Failure: `turn-combat-hud` page.evaluate threw "eventBus chưa expose trong registry". |
| E2E rerun, same spec alone, workers=1 | 1 passed (43.9s) | Different outcome on rerun → classified **Flaky** per evidence rules (registry-expose race in test probe, not a production defect; both outcomes recorded). No combat wiring failure observed: create-to-combat plays battle to terminal state and refights. |
| Static: token flow CombatScene.ts:1832-1840, 2241-2244, 2262-2291 | Scene captures `getPendingPlaybackToken()` before async ack; null-guarded | Mandatory-token contract satisfied at all three presentation call sites. |
| Static: `EVENT_TO_TRIGGER` / PassiveSystem.ts:30-44,69-71 | PassiveSystem subscribes `attack` once via mapping | F1 double-consumption blast radius neutralized. |
| Static: surviveEffects call sites | Only `GameManagerTurnBattleOps.ts:197` constructs session (plus explicit-null clear at :166) | S1 default removal has no orphaned production caller. |

## Findings

### F7 / QA-2026-09-09-RR7: investBodyRefinement is invoked twice per GameManager.update

**Status: REPAIRED (2026-09-09, same session, dev workflow).** Applied per the repair direction below:
- `GameManager.ts`: removed the second call at the end of `update()`; the single call remains at the top of `update()` inside the existing `activePlayer` block (line ~2729).
- `App.vue` tick(): removed the redundant `investBodyRefinement` call; `bumpState()` at the end of tick still refreshes the UI each tick. Comment documents the domain-ownership boundary.
- Regression test added (`GameManager.r5Refinement.reaudit.test.ts`): asserts `investBodyRefinement` is attempted **exactly once** per `manager.update()`. Verified red-green: it failed with two call sites present, passes after the fix.

Post-fix verification: type-check exit 0; full suite 425 files / 2902 tests passed; E2E `create-to-combat` (battle to terminal state + refight) passed. `turn-combat-hud` E2E failed once and passed on isolated rerun — same pre-existing Flaky probe race documented below, unaffected by the fix. Code-review verdict: Approve (no finding at confidence >= 80).

- Severity: Low. Status: ~~Confirmed~~ Repaired. Confidence: 90.
- Owner: `game/src/core/game/GameManager.ts:2729` (top of `update()`, after `tickTimedEffects`) and `:2849` (end of same `update()`, after `updateBattleFixedStep`). Both sites are inside the single method `update()` (lines 2718-2851).
- Invariant: exactly-once domain side effect per update tick.
- Preconditions: any `GameManager.update(delta>0)` with an active player.
- Expected: auto-invest attempted at most once per update.
- Actual: attempted twice per update. Not a double-spend today — `investTinhHoa` consumes only the current tier's `remaining` (BodyRefinementSystem.ts:118-144), so the second call is either a no-op (tier just filled / no materials / tier locked) or spends leftover materials in the same tick. App.vue:305 additionally still calls `investBodyRefinement` in its own tick, giving up to three attempts per live frame; App-side calls remain needed only for `bumpState()` UI refresh. Waste + duplicate-ownership risk, not value corruption.
- Evidence: static read of both call sites in the working tree (reproduced above); no test asserts single-attempt cardinality.
- Blast radius: idle CPU waste per tick; future risk if invest side effects grow (e.g., notifications, tier-completion events would fire per attempt).
- Repair direction: keep exactly one invocation inside `update()` (drop the second), or better, extract one owner method (e.g. domain `autoInvestTick()`) called once; update App.vue comment to reflect domain ownership and keep only the UI-refresh wrapper.

### R-A (residual, not a new defect): App.vue invest call — RESOLVED by the F7 repair

R5 ownership migration is now complete: App.vue no longer calls `investBodyRefinement`; domain (`GameManager.update()`) is the sole trigger, and the UI refreshes via the per-tick `bumpState()`.

### R-B (residual, S3 partial): writable getter/setter on helper maps — RESOLVED by the S3 closure

`CombatPositionInterpolation` and `CombatCastBar` now expose `ReadonlyMap` getters with no setter; the only state mutations go through the helpers' owned API (`setInterpolationTarget`/`snapInterpolationTarget`/`delete`/`clear`, `onCastStart`/`destroyCastBar`). `CombatScene` passthrough getters are read-only views. Test fixtures seed state via the helpers' own APIs or simply use the naturally-empty initial maps. A new descriptor-level QA test (`combat-helpers-encapsulation.qa.test.ts`) guards get-without-set permanently.

## Gaps and Residual Risk

- Converter `attributeScaling`/`manaScalingRatio` discard (Suspected in deep report) was not re-probed here — no repair or test exists for it in the diff; status unchanged.
- E2E suite run was combat-scoped (3 specs), not the full matrix; accessibility spec (pre-existing `ERR_NETWORK_ACCESS_DENIED` in the deep report) was not rerun. Combat wiring (the repair scope) is covered; other flows unaffected by the diff per static consumer check.
- P14 interactive-browser spot-check via `playwright-cli` was not attempted: isolated-worktree exception applies per AGENTS.md; E2E evidence above serves as the browser-level evidence available in this worktree. Live-browser visual confirmation remains deferred to branch finishing on the main checkout.
- No soak/two-tab/offline runs (out of scope, unchanged).

## Pre-existing or Environment Failures

- First-run `turn-combat-hud` E2E failure ("eventBus chưa expose trong registry") passed on isolated rerun → **Flaky**, retained as both-executions evidence in Verification Evidence. Root cause is a test-probe race (page.evaluate before registry expose), not attributable to the audited repairs.
- Vite i18n fallback warnings during E2E (`combat.defeat.retry`/`returnHome` missing keys) — pre-existing, not combat-repair-related.

## New or Changed QA Tests

None authored by this verification pass. The deep report's four reproduction tests were reused as the acceptance oracles and remain intact.

## Notes / Suggestions

1. All six confirmed findings' reproduction tests plus the full baseline pass; static gaps S1, S2, and S3 are all closed; the F7 duplicate-invoke finding was repaired with exactly-once regression coverage. The R1-R5 re-audit is closed with this report's PASS WITH EVIDENCE verdict.
2. Remaining dev-workflow item before commit: none required by this audit.
3. Learned-defect ledger already carries the six RR rows from the deep report plus the F7 row. S3's lesson (test seams must not shape production APIs — seed via owned APIs instead) is captured by the rewritten descriptor-level QA test rather than a ledger row, since the original gap was static, not a gameplay defect.
4. P14 live-browser visual check explicitly skipped this session per user instruction ("bỏ qua test thực tế đi, note lại"); deferred to main-checkout verification at branch finishing.
