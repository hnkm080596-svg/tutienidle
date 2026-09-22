# QA Review: M-QI-07 physique transformation authority

- Date: 2026-09-23
- Mode: deep (mandatory escalation: save-boundary change + 3 mapped domains, `deepAuditCandidate: true`)
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `src/data/realm/PhysiqueLadder.ts` (new), `src/data/realm/PhysiqueLadder.test.ts` (new)
  - `src/core/realm/body/BodyChapter.ts`, `src/core/realm/body/BodyProgressionSystem.ts`, `src/core/realm/body/BodyRefinementChapter.ts`
  - `src/core/player/Player.ts`
  - `src/services/save/saveShapeValidation.ts`, `src/services/save/saveVersion.ts`
  - `src/components/panels/realm/BodyRefinementSection.vue`
  - `src/locales/{vi,en}.json`
  - test files: `BodyProgressionSystem.physique.test.ts` (new), `GameManager.bodyPhysique.test.ts` (new), `GameManagerSaveRestore.boundary.test.ts`, `saveShapeValidation.test.ts`, `RealmBodySections.test.ts`, `BodyProgressionSystem.test.ts`, `SaveRoundTrip.test.ts`, `GameManager.legacySkillRestore.test.ts`, tribulation/breakthrough fixture files, `stores/player.*.test.ts` fixtures

## Scope and Risk Map

Changed systems: physique identity data (new ladder), body-chapter contract + dispatch authority (gate + transform write + derived integrity), `PlayerData` schema (new required field), save shape + version (v74), RealmPanel body section (read-only display).

One-hop consumers: `investBodyChapterState` callers (`GameManagerRealmAdvanceOps.investBodyChapter` bag-debit op; `GameManagerTickOps` tick auto-invest), `assertBodyProgressionIntegrity` caller (`GameManagerSaveRestore.preflightSaveRegistryReferences`, last preflight before owner mutation), `createDefaultPlayer`/`buildGameSave` (player slice spread — `physiqueGrade` serializes automatically), player-store restore whitelist (`allowedPlayerKeys` from `createDefaultPlayer` — covers the new field), `BodyRefinementSection` computed (stateVersion-gated read).

Mapper: `deepAuditCandidate: true` ("critical state boundary: save-and-cloud", "cross-system change: 3 domains"); `unmappedPaths` = `Player.ts` + both locale files — manually routed: `Player.ts` is the persisted-state schema owner (save-and-cloud), locales are ui-input-lifecycle strings only.

Escalation rationale: a new REQUIRED persisted field plus a semantic-coherence preflight rejection is exactly the save-boundary class the escalation rule names.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-PHY-1 | `player.physiqueGrade` / BodyProgressionSystem | 6/6 body_refinement completes inside invest | Exactly-once, monotonic | Repeat | grade `pham->bao` once; post-completion invest returns 0, grade stays `bao` | unit (`BodyProgressionSystem.physique.test.ts`) + real-op (`GameManager.bodyPhysique.test.ts`) | Critical | no defect |
| INV-PHY-2 | save payload / saveShapeValidation + restore preflight | restore incoherent combos | Recoverability, fail-closed | Value mutation, corruption | `6/6+pham`, `5/6+bao`, `6/6+phap`, `6/6+tien` throw `/physique/i` before owner mutation; `6/6+bao`, `0/6+pham` pass | integration (`GameManagerSaveRestore.boundary.test.ts` v74 block) | Critical | no defect |
| INV-PHY-3 | tick -> invest -> transform -> save chain | live tick auto-invest completes the seeded chapter | Cross-system chain | Timing boundary | real-browser probe: seeded `5/6 + 26000/26300 + 1000 essence` flips the DOM line to `Bảo Thể` and persists `physiqueGrade: 'bao'` | browser (Playwright probe, tick-driven, real dev server :5740) | High | no defect |
| INV-PHY-4 | transaction ordering / investBodyChapterState | gate -> invest -> transform-write -> rebuild | Atomicity | Reorder | source-grade gate runs before any mutation; write only after `consumed>0` + `isComplete` + exact `from` match | unit + code inspection | High | no defect |
| INV-PHY-5 | physiqueGrade read paths | UI reads while grade flips mid-session | Synchronization | Stale state | mounted section re-renders `Phàm Thể` -> `Bảo Thể` on store write + stateVersion bump, no remount | jsdom (`RealmBodySections.test.ts` new flip test) | Medium | no defect |
| INV-PHY-6 | grade enum membership | non-string/unknown/empty grade in save | Boundedness | Value mutation | shape rejects `pham_the`, `TIEN`, ``, `3`, `null`, `{}`, `['bao']` with `player.physiqueGrade` path; all 10 members accepted | unit (`saveShapeValidation.test.ts`) | High | no defect |
| INV-PHY-7 | meridian chapter | meridian completes fully | Domain isolation | Cross-system chain | all `MERIDIANS.length` meridians opened + grade stays `pham` | unit (physique.test meridian case) | Medium | no defect |
| INV-PHY-8 | restore -> continue -> complete | seeded 5/6 save restores, play completes | Idempotency | Interruption | `5/6+pham` is coherent at restore; later completion transforms once | browser probe (step 2) | High | no defect |
| INV-PHY-9 | bypass writers | direct `completedTiers = 6` write outside invest | Recoverability | Cross-system chain | only `BodyRefinementChapter.invest` mutates `completedTiers`; only `investBodyChapterState` writes `physiqueGrade` — no production bypass exists | grep evidence over `src/` | High | no defect |
| INV-PHY-10 | `derivePhysiqueGrade` | derive on arbitrary registry order | Determinism | Reorder | advancements sorted by `from` index before walking; gap or incomplete stops the walk | unit (unreachable-rung cases) | Medium | no defect |
| INV-PHY-11 | mid-transaction save | autosave between invest and transform write | Atomicity | Concurrency | write is synchronous inside the invest call — no observable intermediate state; save serializes the whole player atomically | construction + `buildGameSave` spread | Low | no defect |
| INV-PHY-12 | gated invest early-return | grade below `from` on an advancement chapter | Conservation | Value mutation | returns 0 before `chapter.invest` — no consumption, no mutation, no bag debit | unit (synthetic `bao->phap` helper gate) + wiring inspection | Medium | no defect (see gaps) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | PASS | clean after all edits |
| `npm run build` | PASS | `vite build` 5.26s, no errors |
| `npx vitest run` (full) | PASS | 737 files / 6576 passed / 4 expected-fail; sole red was P15 on two new non-ASCII comments, fixed and re-verified |
| `npx vitest run tests/architecture/asciiComments.test.ts` | PASS | post-fix |
| P14 browser probe (Playwright, worktree dev server :5740) | PASS | fresh char renders `Phàm Thể` + `0/6`; seeded `5/6+26000/26300+1000 essence` save -> reload -> live tick completes tier 6 -> `Bảo Thể` + `6/6` + empty state; post-save `physiqueGrade === 'bao'`; zero browser errors. Probe spec deleted after capture (scratch artifact) |
| `npx playwright test save-reload boot-fresh cultivation-path-ritual` | PASS | 9/9 — v74 seeds (spread real saves) boot and the full six-way ritual matrix passes |

## Findings

None — no `Confirmed`, `Suspected`, or material `Coverage gap` findings.

## New or Changed QA Tests

- `src/components/panels/realm/RealmBodySections.test.ts` — "updates the physique line when the grade flips mid-session": proves the mounted component observes the reactive store write + stateVersion bump (INV-PHY-5), the only ledger row the earlier browser probe did not already cover.

## Gaps and Residual Risk

- INV-PHY-12 wiring: the `investBodyChapterState` early-return branch (`advancement && !canProgress`) is unreachable through today's catalog (the only authored `from` is `pham`, vacuously satisfied). The gate logic itself is directly oracled via `canProgressPhysiqueChapter` with a synthetic `bao->phap` advancement; the dispatch wiring is verified by construction and will gain a real oracle when a second transition is authored. Non-material: fail-closed direction (blocked invest) is the safe side.
- Derived-grade drift between live state and a not-yet-saved snapshot: a bypass writer could create a live incoherent state that only trips at the next restore. No production bypass writer exists today (grep-verified); this is the intended fail-closed posture, recorded as residual risk rather than a defect.
- Old-version saves (< v74): rejected wholesale by the existing `version !== CURRENT_SAVE_VERSION` gate — migration deliberately out of scope (P7 standing rule).

## Pre-existing Failures

None observed in scope. (Suite carries the standing 4 `.fails` markers; unrelated.)
