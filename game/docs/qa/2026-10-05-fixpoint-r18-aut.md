# Fixpoint r18 AUT audit — commit cef2af9e (r17 adjudication batch)

Blind adversarial audit of the r17 batch: chain-root `serverSeeded` epoch
flag, O(1) deadline-settle jump, and the duration-anchored timed-effect
bounds. Attack surface: crafted save payloads that pass
`validateGameSaveShape` then mint or corrupt at restore.

**Verdict: FAIL — 1 Medium-High (deny regression introduced by r17-COR-B1), 1 Nit.**

## Confirmed findings

### R18-AUT-1 — Medium-High: `appliedAt + duration` bound truncates honest refresh chains — kills a live paid buff and strips the offline payout tail

**Where:** `src/stores/player.ts` — `boundTimedEffectClocks` live arm
(`min(appliedAt, authorityNow) + TU_LINH_TRAN_DURATION_MS`, stored copy) and
`payoutExpiresAtMs` (`min(appliedAt, lastSavedAt) + duration`, payout copy).

**Defect.** The r17-COR-B1 fix bound every non-stackable live claim at
`firstApply + duration`. But `applyTimedEffect`
(`GameManagerPersistentEffectOps.ts:315-321`) keeps `appliedAtMs` at the
FIRST application and only `Math.max`-extends `expiresAtMs` on every rebuy —
so the honest shape of a refreshed Tu Linh Tran is
`{appliedAt = firstBuy, expires = lastRebuy + 24h}`, a span legitimately
LONGER than one duration. The shape validator documents exactly this honest
class (saveShapeValidation.ts r13-COR-1: "applyTimedEffect keeps appliedAtMs
at the FIRST application and max-extends expiresAtMs on rebuy, so an honest
repeat purchase legitimately produces a span beyond
TU_LINH_TRAN_DURATION_MS" — only `expires < appliedAt` and
`expires > lastSavedAt + 24h + 7d` are rejected). TLT's own cost model
incentivizes refresh-while-live (`getTuLinhTranCost` scales on active stacks),
so this is the designed usage path, hit on every restore by every chain user.

**Evidence (failing tests, deterministic):**
`src/stores/player.r18Aut.test.ts` — two reds on cef2af9e:

- `R18-AUT-1`: applied `save-30h`, rebought `save-2h` → honest
  `expires = lastSavedAt + 22h` (passes all validator pins) restores clamped
  to `firstBuy + 24h = lastSavedAt - 6h` — a live paid buff is stamped dead
  and reaped by `tickTimedEffects`. Same record's payout pays
  `10 x 20s = 200` vs the honest buffed `250`.
- `R18-AUT-1b`: rebought 22h ago → honest expiry `lastSavedAt + 2h` (live)
  lands at `lastSavedAt - 2h` (past) — buff deleted at boot.

**Direction / magnitude.** Deny-direction (no mint — the bound is strictly
tighter than r14/r16's `min(lastSavedAt, authorityNow) + duration`, which
never cut this shape since honest `expires <= lastSavedAt + duration` always
holds). Loss per restore: up to `lastRebuy - firstApply` of paid buff life
(unbounded over chain age; a 2-day chain loses ~everything) + the whole
authorized offline window's +25% cultivation. Exceeds the ~1-cycle deny bar.
This is a REGRESSION authored in this batch — r14's provenance bound was the
correct honest ceiling for chains; it only had the bounded `skew`-cut for
claims applied inside `lastSavedAt > until`.

**Fix direction (suggestion, not a patch):** the honest ceiling is
`lastSavedAt + duration` in the payload epoch (validator already pins
`expires <= lastSavedAt + duration + 7d`). Payout: `lastSavedAt + duration`
is skew-free by itself. Stored: `min(lastSavedAt, authorityNow) + duration`
restores the r14 bound (bounded skew-cut only) — or, cleaner, re-stamp
`appliedAtMs = rebuy now` inside `applyTimedEffect`'s non-stackable merge so
`expires <= appliedAt + duration` is honest again and r17's bound stands
(`appliedAt <= lastSavedAt` validator pin still holds under a re-stamp).

### R18-AUT-N1 — Nit: O(1) jump over-counts `forfeited` on oversubscribed lanes

`WorkerLaneAdvance.ts:195-219`: when `inFlight >= slots`, the per-iteration
path forfeits ONE head then the lane dies; the jump forfeits the whole
remaining chain (`skippedDues`) before the same death. Pending/completed
outcomes are identical — only the counter diverges. `forfeited` is a result
field read by no production consumer (one parity test asserts 0). Cosmetic.

## Considered and clean (attacker probes)

**(a) `serverSeeded` epoch classification.** The flag derives as
`offlineSinceMs === authorityNow - elapsed && offlineSinceMs < lastSavedAt`,
i.e. exactly "the server bound anchored the window start". Server-anchored
seeds always get marked and shifted by `max(0, Date.now() - settleNowMs)`;
client-anchored seeds and saved-lane successors never carry the flag. The
`lastSavedAt === serverBound` equality edge produces numerically identical
stamps either way — the ambiguity is free (no shift difference can exist).
`offlineSinceMs` non-finite is unreachable (validator pins `lastSavedAt`
finite; `calculateOfflineTime` clamps elapsed >= 0). No path lets a
server-epoch stamp persist unshifted or a client-epoch stamp take the shift.

**(b) O(1) jump.** Gated on `hasBudget && budgetLeft <= 0 && cycleMs > 0 &&
due > start` — positive-cost heads at zero budget forfeit identically to the
per-iteration path (cost > 0 can never satisfy `cost <= 0`); successor dues
step `cycleMs` in both paths; `inFlight < slots` re-insert and the
`deadline`-mode gate match; `lane.saved = undefined` + `serverSeeded`
preserved, so `serverSeededPending` marks jumped chains correctly.
Zero-cost heads (`due <= start`) are unreachable: the shape validator pins
`completesAtMs - startedAtMs === computeCycleSeconds(base, level)*1000`
exactly and `startedAtMs <= lastSavedAt`. `skippedDues` float drift vs the
accumulated chain is sub-ULP at reachable magnitudes (cycle >= ~22s) and the
pending head stays the first due past `nowMs` regardless. The 10h budget cap
bounds the pre-jump walk to ~1600 completions/lane — boot-hang vector closed.

**(c) timed-effect mint direction.** Closed by validator pins upstream of
the r17 bounds: `appliedAtMs <= lastSavedAt` (F-TC9-1) makes the stored and
payout bounds identical (`appliedAt + duration <= lastSavedAt + duration` =
the honest ceiling); TLT `expires <= lastSavedAt + 24h + 7d`; unresolvable
`sourceItemId` rejected outright; non-`tu_linh_tran` sources cannot carry
`cultivationSpeedPercent`; `effectGroup` deduped. The `F-TC9-4` cps probe
reads the same raw live-percent-at-marker the restore divides by, so a
crafted live claim can only re-declare its own bounded rate
(`unbuffed = claim/(1+p) <= BASE`). Non-finite `appliedAt`/`expiresAt`
rejected; negative appliedAt self-denies. Stackable expiry passthrough is
the DOCUMENTED r14-AUT-1 residual (decisions-needed D-2026-10-05-01) —
unchanged by r17. Dead arm `min(authorityNow, Date.now())` cannot revive a
dead-at-save record under either clock direction.

**Other surfaces probed clean:** double-restore is idempotent (payload
identity guard + dues consumed; re-seed only fills freed slots);
`decompose.nextCycleAt`/`alchemy`/`autofarm` stamps are payload-epoch with
their own field-epoch anchors (no r16-INT-03 sibling); `elapsedOfflineSeconds`
uncapped at the GameManager seam is bounded by each channel's own cap
(10h production budget, 24h autofarm, 5000-cycle decompose bound);
`settleProductionOffline` has exactly one caller and it passes the flag.

**Pre-existing bounded residual (not r17, for the ledger):** a crafted
`workerCycles[].rollSeed` is validator-pinned to range only, so a forged
in-flight cycle picks its reward roll — bounded by
`workerCycles.length <= betaEffectiveWorkerCapacity` and one grant per
restore. Provenance-limit class, same family as earlier accepted items.

## Verification

- `npm run type-check` — clean (cef2af9e worktree).
- `npx vitest run src/services/save src/core/production src/stores` —
  **981 pass / 2 fail**, both failures are this audit's intentional repro
  tests (`player.r18Aut.test.ts`).

Repro branch: `devin/audit-r18-aut-cef2af9e` carries the failing test +
this document; no production code touched.
