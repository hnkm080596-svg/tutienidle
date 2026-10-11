# QA Review: alchemy queue rework — cross-system seams (QA-B blind)

- Date: 2026-10-11
- Mode: quick (escalation recommended — see below)
- Verdict: **FAIL**
- Task-owned paths (commit `77d311dc`, branch `devin/khai-mach`): `src/core/alchemy/AlchemySystem.ts`, `src/core/game/GameManagerAlchemyOps.ts`, `src/components/scenes/alchemy/AlchemySurface.vue`, `src/components/scenes/alchemy/fidelity/AlchemyFidelityScene.vue`, `src/components/scenes/alchemy/fidelity/alchemyUi.ts`, `src/composables/useThienCoEntries.ts`, `src/composables/useBuildingNavigation.ts`, `src/services/save/saveShapeValidation.ts`, `src/services/save/saveTypes.ts`, `src/data/alchemy/*`, locales `vi.json`/`en.json`
- QA writes: `src/core/alchemy/AlchemyQueueSeams.qa.test.ts`, `src/components/scenes/alchemy/AlchemyQueueSeams.qa.test.ts`, this report. No production edits.

## Scope and Risk Map

Assigned angle: seams (UI adapter, composable read models, stale callers, save boundary, brewing gate, dormant beta recipes, locale parity). QA-A covers the domain core; overlap minimized. Manual routing (no mapper run — narrow scope): `AlchemySystem` → consumers `GameManagerAlchemyOps` → `AlchemySurface`/`useThienCoEntries`/`useBuildingNavigation`/`GameManagerSaveRestore`. Escalation decision: the tinh-hoa findings are an economy transaction crossing the persistence boundary (reservation digest is save-checked) — per quick-workflow mandatory escalation this merits a deep pass by the coordinator; recorded here rather than issued as verdict because the assigned lane is quick.

## Invariant Ledger

| # | Invariant | Result |
|---|---|---|
| 1 | All per-unit reserved inputs scale by order quantity | **BROKEN** (luyen_dan_tinh_hoa flat) — F1 |
| 2 | Cancel refunds every per-unit reserved input for unstarted units | **BROKEN** (tinh hoa never refunded) — F2 |
| 3 | A merge-legal click is never blocked by the slot gate | **BROKEN** (canBrew gates on order count, not merge legality) — F4 |
| 4 | Every order-progress datum renders once | **BROKEN** (counter duplicated) — F3 |
| 5 | A job invisible/un-cancellable on the surface drives no read-model | **BROKEN** (board + badge leak) — F5 |
| 6 | Missing optional `quantity`/`unitsDone`/`recipeId` render sanely; progress division safe at 0/undefined | HELD (clamps `Math.max(1,…)`, `Math.min(100,…)`) |
| 7 | Save boundary rejects malformed batch fields | HELD (shape + witness digest + span check) |
| 8 | No stale callers of removed APIs | HELD (grep: only AlchemySurface → new ops) |
| 9 | Brewing glow only on recipeId match | HELD (mismatch = no glow, sane) |
| 10 | Locale key parity vi/en | HELD (all keys both locales) |

## Verification Evidence

| Command / observation | Result | Evidence/limitation |
|---|---|---|
| `node.exe node_modules/vue-tsc/bin/vue-tsc.js --noEmit` (game/, worktree) | clean | exit 0 |
| `node.exe node_modules/vitest/vitest.mjs run src/core/alchemy src/composables` | 232/232 pass | pre-existing suite green |
| `vitest.mjs run src/core/alchemy/AlchemyQueueSeams.qa.test.ts` | 3 fail / 3 pass | intended failures F1×2, F2; pins: merge-at-slots legal, parked job mechanism, cap const |
| `vitest.mjs run src/components/scenes/alchemy/AlchemyQueueSeams.qa.test.ts` | 3 fail / 0 pass | intended failures F3, F4, F5 (jsdom stubs per repo pattern) |

## Findings

### QA-2026-10-11-B1: `startJob` under-charges luyen_dan_tinh_hoa for quantity>1
- Severity: **High** (incorrect material cost; reach currently latent)
- Status: Confirmed (failing tests)
- Invariant: all per-unit inputs scale by `quantity`.
- Preconditions: any caller invoking the public `startJob(..., quantity>1)` — today only `enqueueJob` calls it, always with `1` (`AlchemySystem.ts:981`), so no UI-reachable path yet; the API signature and batch machinery are shipped.
- Reproduction: `startJob(RECIPE, herb, bag, reg, 0, 1, 1000, 1, 1, 4)` with `luyenDanTinhHoaAmount: 3`, bag tinh hoa = 11.
- Expected: deny `missing_tinh_hoa` (needs 12); with 30 stocked, burn 12 like herb/bui_go/specials (`* quantity`).
- Actual: `ok:true`, burns flat `recipe.luyenDanTinhHoaAmount` = 3. `AlchemySystem.ts:749` (`bag.has` flat) and `:770` (`bag.remove` flat) vs specials at ~`:758-762`/`:773` (`* quantity`) and merge path `:931`/`:947` (per unit). Reservation stores per-unit amount (`:791`, `:811`) so the digest stays self-consistent — the leak is invisible to the witness.
- Evidence: `AlchemyQueueSeams.qa.test.ts` — `startJob quantity=N must burn tinh hoa x N` (got 27 left, expected 18); `must REJECT when bag holds only N-1 unit worth` (got `ok:true`).
- Test file: `src/core/alchemy/AlchemyQueueSeams.qa.test.ts`
- Owner subsystem: `core/alchemy`
- Blast radius: latent today (enqueueJob→startJob is quantity=1); becomes a live mint-for-1 exploit for the first caller that passes the batch parameter.

### QA-2026-10-11-B2: `cancelJob` refunds zero tinh hoa for unstarted units
- Severity: **High** (incorrect material refund — silent loss of scarce material)
- Status: Confirmed (failing test)
- Invariant: cancel returns every per-unit reserved input for units not yet started.
- Preconditions: reachable today — 3 merge clicks (one order of 3), cancel at `now` inside unit 0's window.
- Reproduction: see test.
- Expected: tinh hoa back = `reservation.luyenDanTinhHoaAmount * unprocessedUnits` (2 units → +6), mirroring herb/bui_go/specials.
- Actual: `AlchemySystem.ts:1017-1037` refund loop covers `herbMaterialId`, `reservation.woodId`, `specialIngredients` — `reservation.luyenDanTinhHoaAmount` is omitted. Bag loses 9 for an order that minted 0 pills.
- Evidence: `cancelJob refunds tinh hoa for units that never entered the cauldron` — got 21, expected 27. Existing suite never asserts the tinh-hoa refund line (coverage gap in `AlchemySystem.test.ts:453-526`).
- Test file: same file.
- Owner subsystem: `core/alchemy`
- Blast radius: live — every partial cancel of a multi-unit order silently burns tinh hoa (a decompose-only material).

### QA-2026-10-11-B3: job subline renders the u/q counter twice
- Severity: **Low**
- Status: Confirmed (failing mount test)
- Invariant: each progress datum renders once.
- Reproduction: fidelity scene with `jobs:[{unitsDone:1, quantity:3, remaining:'1/3 · 5p'}]` — the exact adapter output shape.
- Expected: "1/3 viên · 5p" (or "· 1/3 · 5p" once).
- Actual: "1/3 viên · 1/3 · 5p". Adapter `AlchemySurface.vue:274` bakes `${unitsDone}/${quantity}` into `remaining`; `AlchemyFidelityScene.vue:143-148` `jobSubline` prepends `unitsProgress` again.
- Evidence: mount test — `/1\/3/` count = 2.
- Test file: `src/components/scenes/alchemy/AlchemyQueueSeams.qa.test.ts`
- Owner subsystem: `components/scenes/alchemy`
- Blast radius: every multi-unit order card, both locales.

### QA-2026-10-11-B4: `canBrew` blocks the merge click the rework is built around
- Severity: **High** (rework's core interaction dead on the default progression state)
- Status: Confirmed (failing mount test + passing domain pin)
- Invariant: slot gate must check whether the click needs a slot — a same-profile merge into the tail order needs none.
- Preconditions: pill_room L1 → `concurrentJobSlots = 1`; one running order; same recipe+herb selected; materials stocked.
- Reproduction: mount surface, `ops.startAlchemyJob(...)`, re-render, read `brewButton().disabled`.
- Expected: enabled — domain proves merge legality (`AlchemyQueueSeams.qa.test.ts` domain pin: `enqueueJob` returns `{ok:true, merged:true}` at `jobs.length == maxConcurrentJobs`).
- Actual: `disabled=true`. `AlchemySurface.vue:~321` `jobs.value.length >= Math.max(1, maxJobSlots.value)` in `canBrew` and `:~366` `job_slots_full` in `brewBlockReason` gate on order count — no merge-legality check exists in the adapter.
- Evidence: mount test `expected true to be false` on `button.disabled`.
- Test file: same file.
- Owner subsystem: `components/scenes/alchemy` (needs a domain "would this click merge?" predicate or equivalent)
- Blast radius: on the default 1-slot room every click after the first is blocked — players cannot queue a second unit until the first order fully settles.

### QA-2026-10-11-B5: parked dormant order leaks into Thien Co board + building badge
- Severity: **Medium**
- Status: Confirmed (failing mount test for the board; badge is the same unfiltered read, source-verified)
- Invariant: a job the surface hides and offers no cancel path for drives no read-model.
- Reproduction: restore `{recipeId:'alchemy_to_cot_dan_qi_refining', completesAtMs:60000}`, tick(120s). Tick parks it by design (scope-hidden family, record kept, no pill/event — `AlchemySystem.ts` tick seam comment). Then `useThienCoEntries` entry list.
- Expected: no `active:pill_room` entry; pill_room status not 'active'.
- Actual: entry `{id:'active:pill_room', detailParams:{done:0,total:1,waiting:0,minutes:1}}` — "còn 1 phút" forever, CTA navigates to a surface showing zero jobs and no cancel path. Same root: `useThienCoEntries.ts:98` reads `getAlchemyJobs()` unfiltered (also feeds `minutes`/`done`/`total`/`waiting`); `useBuildingNavigation.ts:96` `'active'` on `length>0` unfiltered → permanent badge.
- Evidence: mount test — entry present with captured detailParams.
- Test file: same file.
- Owner subsystem: `composables` (consumers must apply the same `betaRecipeFamilyOfId`/`scopeHidden` filter the surface uses, or the ops read-model should expose a filtered accessor)
- Blast radius: any pre-beta save containing dormant-family orders → permanent phantom "active" brew on board + badge.

### Nits (recorded, not blocking)
- `alchemyUi.ts:92-95` vs `:104-108` — `quantity?`/`unitsDone?` declared twice in `AlchemyJobDisplay` (merge leftover; identical optional types pass tsc).
- `AlchemySurface.vue:529` — hardcoded `phút` in duration string (P16: locale text belongs in useI18n); `:274` `remaining` `'p'` suffix is the same class at adapter level.

## New or Changed QA Tests

- `src/core/alchemy/AlchemyQueueSeams.qa.test.ts` — F1 burn/deny, F2 refund, plus pins: merge-legal-at-full-slots (domain contract for F4), parked-dormant mechanism (documents F5 precondition), cap sanity.
- `src/components/scenes/alchemy/AlchemyQueueSeams.qa.test.ts` — F3 mount (fidelity scene direct), F4 mount (full surface harness), F5 mount (composable inside component context).

## Gaps and Residual Risk

- F1 reachable-path is latent (no production caller passes quantity>1); flagged latent, not dropped — the API contract itself is violated.
- Badge half of F5 (`useBuildingNavigation.ts:96`) is source-verified same-root but not separately mounted — same unfiltered accessor, one-line check.
- jsdom cannot observe `measureFlow`/CTM visuals — stubbed null per repo pattern; flow-path rendering unreviewed.
- Escalation: recommend a deep pass over the tinh-hoa economy seam (reservation digest vs mint/refund parity) — F1+F2 suggest the per-unit input was wired into record/verify but skipped in mint and refund; audit any other per-unit field for the same omission (checked: herb, wood, specials, spirit stone all correct — tinh hoa alone).

## Pre-existing Failures

None observed. Baseline scope suite 232/232 green before QA tests.
