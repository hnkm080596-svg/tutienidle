# Fixpoint r32 — adjudication

- **Wave:** r32 blind trio (COR / AUT / INT) on `1d27aee4` (r31 adjudication tip).
- **Verdicts:** COR FAIL (3 Low + 3 Nit) · AUT PASS (2 Low + 4 Nit) · INT FAIL (1 Medium + 1 Nit).
- **Aggregate:** 1 Medium + 5 Low + 8 Nit = 14 findings → 12 fixed, 2 excepted.
- **Commit:** this adjudication lands the fixes below.

## Fixed

| Finding | Sev | Fix |
|---|---|---|
| R32-INT-1 | Medium | `useAppLifecycle.bootGame` — the `simPaused = false` re-baseline now also calls `gameManager.resumeCombat('authority-pause')`. The pause contract is TWO latches: the composable flag AND the `CombatClock.reasons` set. r31 cleared only the first, so a live battle frozen by a terminal authority-pause stayed frozen forever after re-auth (`resumeSimulation` dead-ends on the already-false flag, `'authority-pause'` has no user-visible toggle). `resume()` deletes only that reason and no-ops on a stopped clock, so other reasons (`user-pause`, `tab-hidden`) are untouched. |
| COR-F1 + R32-AUT-1 | Low | `AlchemySystem.restoreJobs` drop-check now mirrors the validator's ordering pin: `completesAtMs <= startedAtMs` drops at the boundary. An inverted in-domain pair previously parked verbatim and settled (minted a pill) on the next honest tick — parity hole vs `advanceWorkerLanes`'s ordering deny. |
| R32-AUT-2 | Low | Shift arms no longer mint inverted pairs: the headroom `restoreNow + span < 2^52` is trivially true for a NEGATIVE span, so a post-dated inverted pair minted `{started: restoreNow, completes: < restoreNow}` — instantly-due in alchemy (mint) and ordering-denied-then-wedging in production. Alchemy now drops inverted pairs outright; `ProductionSystem.restoreStates` adds `completesAtMs > startedAtMs` to the shift condition (inverted parks verbatim — deny). |
| COR-F2 | Low | `advanceWorkerLanes` headroom denominates `mintedSpanMs = max(cycleMs, computeCycleSeconds(baseSeconds, siteLevel) * 1000)` — the stamp `buildProductionCycle` actually persists. An incoherent `cycleMs` smaller than the authored span previously admitted while the minted `completesAtMs` escaped the domain. Both real callers pass the coherent pair (no honest tightening); a NaN authored span denies like other bad mint inputs. |
| COR-F3 + R32-AUT-4 | Low/Nit | `settleWorkersOffline` field-epoch re-stamp now requires `completesAtMs + fieldEpochShiftMs < 2^52`; a seeded head that cannot shift cleanly keeps its settle-epoch stamps (parked). Closes the one seam where a far-future `Date.now()` still minted out-of-domain stamps while every sibling input stays `min(…, Date.now())`-clamped. |
| R32-AUT-3 | Nit | `DecomposeSystem.restore` merged-deadline cap clamped `min(restoreNow + cycleMs, 2^52 - 1)`; `TribulationDirector.restoreRuntime` cooldown cap clamped identically. The caps are themselves minted stamps — a restore clock within `cycleMs`/cooldown-span of the bound minted `>= 2^52` and self-refused the next write. |
| R32-AUT-5 | Nit | `applyTimedEffect` push arm coerces non-finite stamps before clamping (Math.min/max propagate NaN): applied falls back to `now` (just-applied), expires falls back to the applied stamp (dead on arrival — deny). A NaN stamp previously persisted verbatim and self-refused every later write. |
| R32-AUT-6 (NaN sub-case) | Nit | Stackable arm coerces a non-finite caller span to `0` (no extension) before the add — a NaN duration previously propagated through `Math.min` into `existing.expiresAtMs` and wedged every later write. The huge-finite-span-to-ceiling outcome stays Nit (self-bounds at the domain edge; `boundTimedEffectClocks` re-clamps at restore). |
| R32-INT-2 | Nit | `expiresCeiling` is now source-class aware: TLT-group records clamp at `min(2^52-1, Date.now() + TU_LINH_TRAN_DURATION_MS + 7d)` — the validator's own writer bound — so a pushed TLT record can no longer land in the band that passes the magnitude clamp yet self-refuses the next write. Other groups keep `2^52 - 1`. |
| COR-F6 | Nit | `en.json`/`vi.json` trailing newlines restored (diff artifact). |

## Exceptions (recorded, not fixed)

| Finding | Reason |
|---|---|
| COR-F4 — `restoreJobs` shift-arm headroom provably dead after the domain drop | Accepted over-guard. Post-drop, `completesAtMs < 2^52` + `startedAtMs > restoreNowMs` already imply `restoreNow + span < completes < 2^52`. Kept for symmetry with `restoreStates` where the same arm IS reachable (no domain drop there). Harmless; removing it would only make the two arms diverge in shape for zero gain. |
| COR-F5 — saved-cycle reward-shaping fields unpinned at the mechanism | Accepted — `collectionRealmId`/`siteLevelAtStart`/`rewardTableVersion`/`rollSeed` ride `lane.saved` verbatim into grants, but the validator pins all of them at admission (realm <= player, level <= site, rollSeed range, span = authored). Defense-in-depth gap, no reachable crafted-save path; recorded so the class isn't re-derived. |

## Old-probe flips this wave (pins of behavior r32 intentionally changed)

- `auditR23Aut` A3 — NaN stamp now stores the parked expiry unchanged (coerced no-extension), previously pinned NaN propagation.
- `auditR23Aut` A4 — over-ceiling parked TLT stamp collapses to `now + 24h + 7d` (was `2^52-1`).
- `auditR31Cor` laneParams fixture made coherent (`baseSeconds: 30` → authored span 30_000 = `cycleMs`) — the truth-table boundary rows exercise the intended edge again; the pre-F2 headroom that only measured `cycleMs` would have made an incoherent fixture silently wrong.
- 6 `auditR32Cor` + all `auditR32Aut`/`auditR32Int` probes flipped from bug-demonstrating to deny-pins (61/61 green).

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save src/core/production src/core/alchemy src/core/economy src/core/game src/core/tribulation src/composables` — 3022 green, 0 fail.
- `npx vitest run tests/architecture` — 995 green (P15 ASCII ratchet pass).
- ESLint on touched files — 0 errors, 0 warnings (also removed 2 pre-existing unused imports in r23/r31 probe files).

## Reachability summary

Every Low/Nit this wave was defense-in-depth: reachable only through a validator-bypassed payload or an ungated internal caller clock — no honest save or honest `Date.now()` feed produces the inputs. The one Medium (INT-1) was a real user-visible freeze chain on the re-auth path. With these fixes the `[0, 2^52)` domain contract now holds on every mint site, including inverted ordering and the `+delta` re-stamp/deadline-cap seams.
