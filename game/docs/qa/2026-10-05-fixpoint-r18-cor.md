# Fixpoint r18 — COR audit (blind) of commit cef2af9e (the r17 adjudication batch)

Auditor role: COR (correctness/regression). Blind to other waves' findings.
Attacked: the epoch-flag + O(1) settle-jump in `WorkerLaneAdvance`, the
`offlineSinceIsServerEpoch`/`serverSeededPending` plumbing in
`ProductionOffline`/`GameManagerSaveRestore`, the duration-bound rewrite of
`payoutExpiresAtMs`/`boundTimedEffectClocks` in `stores/player.ts`, and
siblings (decompose/autofarm settle, validator probes, epoch stamping).

Verdict: **FAIL WITH REASON** — 1 Medium-High, 1 Medium, 1 Low, 1 Nit.

Repro evidence: `game/src/services/save/fixpointR18Cor.qa.test.ts` —
3 deterministic repros, all fail on cef2af9e. Scoped run
`npx vitest run src/services/save src/core/production src/stores`:
**981 pass, only these 3 fail.** `npm run type-check` clean.

## Confirmed findings

### R18-COR-1 — duration bound keyed to FIRST application kills honest refreshed non-stackable effects — Medium-High

`applyTimedEffect`'s non-stackable merge refreshes an existing record by
moving only `expiresAtMs` forward; `appliedAtMs` stays frozen at the FIRST
application (`GameManagerPersistentEffectOps.ts:307-352`). The validator
itself documents the consequence: "applyTimedEffect keeps appliedAtMs at the
FIRST application... an honest repeat purchase legitimately produces a span
beyond TU_LINH_TRAN_DURATION_MS" (`saveShapeValidation.ts:1556-1588`).

r17-COR-B1's new bounds key off `appliedAtMs` instead of the save marker:

- stored: `min(appliedAt, authorityNow) + 24h` (`player.ts:131-140`)
- payout: `min(appliedAt, lastSavedAt) + 24h` (`player.ts:167-174`)

For any chain whose first application is >24h before the save — i.e. any
rebuy that kept the buff alive — both bounds land in the deep past: the
stored buff reads **dead at restore**, and the payout split erases the whole
boosted tail. The player honestly owns the buff (validator admits the shape,
the last buy is what priced it) but loses it at load AND loses the +25%
offline segment — pure deny, worst-direction honest regression at **skew=0**,
the exact property this wave was told to preserve ("skew=0 must equal
pre-fix behavior"; under the r14 bound `min(lastSavedAt, authorityNow)+24h`
this shape kept its buff).

Every r17 pin uses fresh-application shapes (`appliedAt` ≈ last buy); the
merge-refresh shape is untested by the batch.

Evidence (repro a+b in the QA file):

- Record `{appliedAt: save-20d, expires: save+4h, percent: 0.25,
  group/source: tu_linh_tran}` — passes `validateGameSaveShape` (ok=true),
  then restore stores `expiresAtMs = 1723518370000` (= firstApply+24h =
  save − 19d) instead of the honest `1725174370000` (save + 4h). Live buff
  dies 19 days before it was bought.
- Same record through `restoreFromSave` (local boot, 30s window):
  `percentAtSave` probes the raw stamp live (unbuffed = 12.5/1.25 = 10), but
  the payout bound `appliedAt+24h` is dead through the whole window →
  cultivation = **300** paid flat, honest = **375**. The 75 missing units
  are honestly earned buff time.

Reachability note: the only authored non-stackable writer is
`activateTuLinhTran` (currently reachable in tests only); every authored pill
regen is `stackable: true` (exempt from the bound). Impact today is latent,
but the bound exists exactly for this class — it is wrong by construction
against the validator-admitted refreshed shape and silently regresses any
future non-stackable writer. Deny-direction only; no mint path found.

Fix direction (adjudicator's call, not implemented): the honest ceiling is
`min(lastSavedAt, authorityNow) + DUR` (last-refresh can't exceed the save
marker by construction of the merge), i.e. the r14 shape — or equivalently
key the bound to the refresh instant `expiresAtMs - DUR <= lastSavedAt`
relationship rather than the frozen first `appliedAtMs`.

### R18-COR-2 — O(1) budget-exhaustion jump only covers `budgetLeftMs === 0`; the unbounded forfeit walk survives for every leftover ∈ (0, cycleMs) — Medium-High

`WorkerLaneAdvance.ts:195`: the jump fires when `hasBudget &&
budgetLeftMs <= 0 && cycleMs > 0 && due > start`. Budget is only ever
*consumed* (`costMs <= budgetLeftMs` before completion), so `<= 0` means
exactly 0. When the completed-cost sum leaves a leftover in
`(0, cycleMs)` — the common case, hit whenever

- `cap mod cycleMs ≠ 0` (any leveled site: mortal L2 = 87s; golden_core L1
  2700s, nascent_soul 8100s, soul_transformation 24300s+ all fail to divide
  36_000_000ms — only mortal/qi_refining/foundation L1 land exactly),
- a saved head is priced below `cycleMs` (site levelled up since save), or
- a prior site left multi-site residue,

every remaining due on the chain forfeits **one per loop iteration**: the
successor's `costMs = cycleMs > leftover` fails the budget check but the
`<= 0` jump never arms — the chain respawns and re-forfeits until the window
end. That is exactly the unbounded window-depth walk r17-AUT-1 was meant to
kill, still live under the same adversarial reachability (crafted deep-past
`lastSavedAt` / deep-past saved deadline under a local-boot or
server-authorized long window). The r17 pins pass only because their 100s
cycles divide the cap exactly — the leftover case is untested.

Evidence (repro c): `advanceWorkerLanes` at `cycleMs=70_000`,
`budgetMs=36_000_000`, `emptyLaneStartMs=0`, `nowMs=200_000_000`:
514 completions consume 35_980_000 → leftover 20_000 → dues 515..2857
forfeit individually. Instrumented `lanes.shift` count = **2_857 = dues
count** (one shift per iteration); a correct jump would finish in ~515.
Doubling `nowMs` 100M→200M adds +1_429 iterations — linear in window depth,
i.e. the ~1e10-spin DOS persists whenever the leftover is positive.

`forfeited`/`consumedBudgetMs`/`pending` outputs are all correct — the defect
is purely the unbounded iteration count.

Fix direction: arm the jump when the current due *and* every successor can't
be paid — `budgetLeftMs < Math.min(costMs, cycleMs)` — not only at 0.

### R18-COR-3 — `forfeited` overcounts when an oversubscribed lane dies — Nit

The jump adds `skippedDues` (the whole remaining chain) to `forfeited` even
when `inFlight >= slots` — where the per-iteration semantics would process
exactly one forfeit and then kill the lane (no respawn). Oversubscribed
lanes therefore report window-depth-scaled forfeit counts that never
happened. Cosmetic: `forfeited` has no production consumer (grep-verified;
result field is only read in tests), so it distorts a diagnostic, not a
grant. Either cap the count at what the lane would actually have paid, or
document that `forfeited` is "dues the chain owed", not "dues processed".

### R18-COR-4 — pending heads persisted past-due for client-anchored windows — Low

`ProductionOffline.ts:194-204` shifts only `serverSeededPending` heads into
the field epoch. When `offlineSinceMs` is client-anchored and sits in the
deep past — a save written on a device clocked years behind (RTC reset), or
a crafted `lastSavedAt` — the spawned chain's pending head lands at
`~offlineSince + elapsed + cycleMs`, still deep-past. At the next online
`tickWorkers` that stamp reads massively past-due and the lane completes
once immediately — ~1 cycle/lane/site paid earlier than its honest client
deadline (the same class r16-INT-03 fixed for the server-seeded arm).
Bounded to one in-flight carry-over per lane (the count equals an honest
settle's pending head; only the deadline is early), no repeat, self-healing.
A `max(0, Date.now() - settleNowMs)` shift applied to *all* pending heads
whose stamps precede the field epoch would cover this arm too and is a no-op
at skew=0.

## Clean (audited, no defect)

- **Jump math equivalence (when it fires)**: `skippedDues = floor((now -
  due)/cycle) + 1`, head re-queued at `lastDue + cycle` — identical
  completed/forfeited/pending/slot accounting as per-iteration for the
  `budgetLeft <= 0` case; `consumedBudgetMs` unchanged; saved-identity heads
  preserved as `lane.saved`; zero-cost heads correctly excluded from the
  jump (validator rejects zero-span upstream anyway).
- **`serverSeededPending` classification**: flag rides the chain root;
  saved lanes and their successors never carry it (`saved !== undefined`
  excludes restored heads); `pending`/`lanes` index alignment verified.
- **`offlineSinceIsServerEpoch` derivation**: flag true ⟹
  `settleNowMs === authorityNowMs` necessarily, so
  `fieldEpochShiftMs = Date.now() - nowMs` is the true skew when it applies;
  honest fast-clock seeds get shifted to `until + skew`, slow-clock seeds
  unshifted (one-way, bounded underpay — documented residual).
- **`boundTimedEffectClocks` dead arm** `min(authorityNow, Date.now())`:
  correct direction both ways — fast clock caps at `until` (no revive), slow
  clock caps at `Date.now()` (no revive either).
- **Crafted far-future `lastSavedAt`**: elapsed ≤ 0 → settle skipped, no
  mint.
- **Decompose/autofarm siblings**: `DecomposeSystem.settleOffline` keeps its
  r12 cap-back (`windowStart + settled < 5000`); `settleAutoFarmOffline`
  clamps `effectiveSeconds = min(capped, anchorGap)` — the deep-past seed
  attack is bound on both.
- **`untilMs`/`sinceMs` provenance**: `parseTimestampMs` + `undefined` guards
  upstream (`SupabaseCloudSaveService:772`); NaN cannot reach the authority
  anchors.
- **Validator `expires ≤ lastSavedAt + 24h + 7d` allowance** stays ≥ the
  restore bound (no admit-then-clamp inconsistency beyond R18-COR-1).
- **QuestManager.ts**: comment-only delta (r14-INT-6 → r16-INT-04 wording).
- **Honest skew=0 regression** for production/decompose/autofarm/cultivation
  width: `settleNowMs = min(lastSavedAt + elapsed*1000, Date.now())` equals
  pre-fix on the honest path; only the timed-effect class regresses
  (R18-COR-1).

## Severity summary

| Finding | Severity | Direction |
| --- | --- | --- |
| R18-COR-1 refreshed non-stackable buff killed at restore + payout | Medium-High | honest deny / regression at skew=0 |
| R18-COR-2 leftover-budget walk unbounded | Medium-High | adversarial DoS hole in the fix |
| R18-COR-3 `forfeited` overcount on dying lanes | Nit | cosmetic diagnostic |
| R18-COR-4 client-anchored deep-past pending heads past-due | Low | bounded early pay (~1 cycle/lane/site) |
