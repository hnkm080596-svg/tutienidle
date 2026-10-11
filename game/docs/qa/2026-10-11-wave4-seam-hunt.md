# QA wave-4: fresh-state seam hunt — khai-mach arc (round 4, blind)

- Date: 2026-10-11
- Mode: blind seam hunt — only seams not covered by waves A/B/C/R3
- Verdict: **PASS — 0 confirmed defects, 2 NITs** (dead-weight, report-only per tasking)
- Branch under test: `devin/khai-mach` @ `a76b4233`
- QA writes: `src/services/save/SaveV89AlchemySeams.qa.test.ts`, `src/core/alchemy/AlchemyParallelBrewing.qa.test.ts`, `src/core/realm/body/MeridianQualityAccumSeams.qa.test.ts`, this report. No production edits.

## Invariant Ledger

| # | Seam (assigned) | Result | Evidence |
|---|---|---|---|
| 1 | v89 save with seeded jobs verifies digest + re-stamps to v90 through real `loadGame()` | HELD | `v89 seeded job … verifies + migrates clean` |
| 2 | v89 save with LEGACY unseeded jobs (pre-anchor digest, no seed field) verifies through `loadGame()` | HELD | `v89 LEGACY unseeded job … verifies + migrates clean` |
| 3 | Migrated job settles through `restoreJobs -> tick` and mints | HELD | `the migrated v89 seeded job settles … and mints` |
| 4 | Post-dated restore re-grounds `startedAtMs/completesAtMs` AND re-folds digest over `rollSeedBase` | HELD | `the re-stamp arm re-folds … the witness still verifies` |
| 5 | A merged mid-batch job (quantity 3, unitsDone 1) reloads and rolls ONLY the remaining units (stream continues, never re-mints unit 0) | HELD | `a merged v89 job … rolls only the remaining units` |
| 6 | 2 different-recipe orders occupy 2 slots with independent `rollSeedBase` anchors (stride 1000) | HELD | `two different-recipe orders occupy two slots` |
| 7 | Cancelling order A mid-flight leaves order B's record byte-identical | HELD | `cancelling order A mid-flight leaves order B … untouched` |
| 8 | Order B's deterministic mintedGrades replay identically whether A cancels or settles | HELD | `order B's deterministic mint stream is identical …` |
| 9 | Cancel-refund counts unstarted units after merges (q3, 1 started → refund 2 units of every input) | HELD | `cancel-refund counts unstarted units after a merge` |
| 10 | qualityAccum running mean folds uplift-weighted mean at progress 100, clamps [1,2], drops accumulator | HELD | `the running mean folds … at completion` |
| 11 | Mid-accumulation reload preserves {sum,count}; later invests continue (never restart) | HELD | `a mid-accumulation reload preserves the running mean` |
| 12 | `integrityIssues` flags orphaned accum/multiplier entries (reset-consistency deny arm) | HELD | `integrity checker pins the reset contract` |
| 13 | dragOffsets across chapter switches/sessions | HELD | single `thanh_van` chapter holds all 30 nodes (`ExplorationSurface.vue:304-336`); `dragOffsets` is a non-persisted component ref — no cross-chapter/session carrier exists |
| 14 | pointercancel mid-drag / unmount mid-drag listener leaks | HELD | R2 fix at `ExplorationPaperMap.vue:114-137,84-86`: all 4 listeners removed in `end()`; `activeDragCleanup` runs `onBeforeUnmount`; covered by `ExplorationPaperMap.drag.qa.test.ts` D2 |
| 15 | SlotView `stage` variant style bleed outside map | HELD | sole `variant="stage"` consumer is `ExplorationPaperMap.vue:146`; CSS scoped under `.slot-view--stage` (`SlotView.vue:1178-1186`) |
| 16 | Locale parity en/vi for arc keys (alchemy.*, questPreview.*, exploration/stage strings) | HELD | structural diff: 0 missing keys either direction; interpolation-placeholder parity clean on all alchemy/quest/exploration/panels.stageSelect keys |
| 17 | `alchemy.queued` locale key dead-weight | **NIT** | en.json:1602 / vi.json:1602 defined but no `t('alchemy.queued')` call site (only a comment in `AlchemyParallelSlotLabel.qa.test.ts`); no dynamic `alchemy.${x}` access |
| 18 | `.job-card--queued` CSS dead-weight | **NIT** | `AlchemyFidelityScene.vue:300,306` styles a class the template never binds — only `--brewing`/`--empty` are emitted (template lines 210,219) |

## Additional probes that held (not in the 7 assigned seams, checked while reasoning)

- `enqueueJob` merge arm returns `spiritStoneCost` = per-unit of the click — ops debits exactly that; cancel refunds `reservation.spiritStoneCost * unprocessedUnits` (same per-unit source) — no stone print/loss path (`AlchemySystem.ts:1036`, `GameManagerAlchemyOps.ts:207-209,241-245`).
- `PillStackSave.quality` round-trips (`saveTypes.ts:30`, `SaveSystem.ts:370-378`) — quality mints survive reload.
- Strict-prefix meridian progress is enforced by `integrityIssues` (`MeridianChapter.ts:446-453`) — a crafted non-prefix save cannot reach the `recordMeridianOpenQuality` last-with-progress attribution.
- `rollSeedBase` wrap: `allocRollSeedBase` wraps mod 2**32 without re-aligning to the 1000 stride — a base like 704 would fail the save-shape stride gate on the NEXT write. Reachable only after ~4.3 billion allocated units — noted as unreachable-by-play, not filed.

## Verification Evidence

| Command | Result |
|---|---|
| `vitest.mjs run src/services/save/SaveV89AlchemySeams.qa.test.ts` | 5/5 pass |
| `vitest.mjs run src/core/alchemy/AlchemyParallelBrewing.qa.test.ts` | 4/4 pass |
| `vitest.mjs run src/core/realm/body/MeridianQualityAccumSeams.qa.test.ts` | 4/4 pass |
| `vitest.mjs run` (all three files) | 13/13 pass on HEAD `a76b4233` |

All 13 tests PASS on HEAD — they are regression pins documenting held contracts (the wave's seam questions were confirmed working), not defect repros. No finding was rejected for failing identically on main (no defect was confirmed).

## NIT ledger (report-only per tasking)

1. `alchemy.queued` — unused locale key pair (en/vi). Leftover of the pre-queue label scheme.
2. `.job-card--queued` (×2 rules) — dead CSS in `AlchemyFidelityScene.vue`. The queued visual state died with the merge-into-tail rework.
