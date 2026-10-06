# Fixpoint r21 — INT (integration coherence) audit

**Audit target:** commit `be30c152` on `codex/hoa-cau-fireball-vfx` — the
r20 adjudication batch (widened `WorkerLaneAdvance` defensive guard:
ordering + magnitude + slots pins, R20-INT-01 comment fix, flipped
r19/r20 repro pins). Re-verifies the r20 surface at the new tip.

**Verdict: PASS WITH EVIDENCE** — 1 Low + 2 Nit findings. No
Medium-or-higher defect; every audited contract verified coherent.

## Axis 1 — widened guard coherence at both callers

**Coherent.**

The r20 guard (`WorkerLaneAdvance.ts:134-157`) still fires BEFORE lane
construction and returns the same zero-advance shape:
`{completed: [], pending: [...params.pending], forfeited: 0,
consumedBudgetMs: 0, seededPending: []}` — now covering ordering and
magnitude trips on top of the r19 finiteness arms.

- `tickWorkers` (ProductionSystem.ts:414-426, observe): on a trip,
  `state.workerCycles = result.pending` persists the SAME object refs
  `params.pending` carried — probe A/C pins element-wise identity, no
  copies, no mutation. `completed: []` ⇒ `grantCycleRewards` never runs ⇒
  no double-grant. Slot accounting (`activeWorkerSlots`) is upstream of
  the call ⇒ untouched.
- `settleWorkersOffline` (ProductionOffline.ts:157-170, deadline): on a
  trip `seededPending: []` ⇒ `seededHeads` is empty ⇒ the re-stamp map
  (:184-194) returns every `cycle` verbatim ⇒ saved objects persist
  byte-identical. `budgetMs -= result.consumedBudgetMs` = `-= 0` ⇒ the
  shared 10h cap is fully preserved for the next site — the tripped site
  neither starves nor over-feeds its sibling. Probe A: poisoned LAM
  freezes verbatim while sibling QUANG settles 8 completions under the
  untouched budget; a second settle call re-trips idempotently (0).
- `slots` finiteness pin: both callers source `slots` from
  `allocateWorkerSlots`, whose output is bounded by
  `Math.max(0, Math.floor(capacity))` — a domain-owned scalar, not a
  persisted stamp. The pin is belt-and-braces for future callers, same
  philosophy as the stamp pins.
- Per-site-atomic wedge semantics unchanged: one poisoned pending entry
  wedges that site's whole lane set until cleared — preserve-over-drop,
  deny-direction, never mints.

## Axis 2 — 2^53 magnitude pin vs honest stamp producers

**Coherent — every honest producer sits ~7 orders of magnitude inside
the pin, under all orderings.**

- `emptyLaneStartMs` producers:
  - `tickWorkers` passes `nowMs` (ProductionSystem.ts:421) — a caller
    arg, honestly `Date.now()` ≈ 1.76e12 today.
  - `settleWorkersOffline` passes `offlineSinceMs`
    (ProductionOffline.ts:166), derived in GameManagerSaveRestore.ts:429
    as `min(lastSavedAt ?? settleNowMs, authorityNowMs - elapsedMs)`.
    Honest `lastSavedAt` is game-written epoch-ms (~1e12); server
    `untilMs` (cold-boot authority) is the same scale.
- Pending stamp producers: `buildProductionCycle` stamps derive from
  `emptyLaneStartMs` or the prior head due plus `cycleMs`
  (authored max 656.1e6 ms = tribulation/level-1 span); restored saves
  carry stamps verbatim. Every honest chain stays ≤ ~1e12 + bounded
  walks.
- Far-future ordering: `Date.now()` reaches 1e15 in year ~33658 — still
  4 orders under 9.007e15. `emptyLaneStartMs` magnitudes are bounded by
  `min(lastSavedAt, authorityNow)` ⇒ can never exceed `Date.now()`'s own
  magnitude on any ordering.
- Legacy (no-authority) path: `restoreAuthorityNowMs` falls back to
  `Date.now()` (GameManagerSaveRestore.ts:391); `settleNowMs =
  min(lastSavedAt + elapsed*1000, Date.now())` — same bound. A
  `lastSavedAt = 0` edge save clamps the window to ≈0, not beyond.
- The pin is the float64 exact-integer edge (2^53 ≈ 9.007e15), not a
  gameplay bound — no honest path approaches it.

## Axis 3 — comment/doc coherence sweep

**Two stale/imprecise claims found in r20-touched text.**

### R21-INT-02 — Nit — adjudication doc A1 "unreachable from any save today" is stale for the magnitude arm

`docs/qa/2026-10-05-fixpoint-r20-adjudication.md:19` (R20-AUT A1 row):

> `freeze is bounded, self-evident, and unreachable from any save today
> (validator pins every stamp finite + ordered).`

For the finiteness/ordering arms this holds. For the MAGNITUDE arm it
does not: `validateProductionCycleSave` (saveShapeValidation.ts:3313-)
pins finite + ordered + exact-authored-span but has NO magnitude bound —
probe B crafts `{startedAtMs: -1e16, completesAtMs: -1e16 + 100_000}`
(finite, ordered, exact mortal span, `startedAtMs <= lastSavedAt`),
the validator ADMITS it, and the wedge persists verbatim across both
`settleOffline` and `tickWorkers`. The outcome is the intended
deny-direction freeze (mechanism owns the bound), so the verdict stands;
only A1's reachability parenthetical over-claims — magnitude-shaped
pending pairs ARE save-reachable today. The COR-1 row (:20) states the
split correctly ("the mechanism now owns the bound"); A1 conflicts with
its own row.

### R21-INT-03 — Nit — imprecise magnitude claims in touched comments

- `fixpointR20Cor.qa.test.ts:35-36`: "ulp at 1e21 is 131072 > every
  authored cycleMs" is wrong twice: authored `cycleMs` range
  100_000..656_100_000 (9 of 10 realms exceed 131072), and absorb needs
  `cycleMs < ulp/2` (65536 at 1e21) — even mortal's 1e5 fails, so at
  1e21 the addition rounds UP (+131072 head), which is exactly why the
  doc's control line notes `-1e21` terminates. The repro itself uses
  -1e308 where ulp ≈ 1e292 — correct; only the illustrative sweep
  over-claims. Cosmetic.
- `WorkerLaneAdvance.ts:131`: "Honest stamps stay under ~1.8e12 ms" is
  a calendar value (today's epoch ms); it drifts ~8.7e10/decade —
  readable today, will read oddly in a few years. Cosmetic.

Cross-check otherwise clean: R20-INT-01's player.ts fix (:605-627) now
names `boundTimedEffectClocks` + `payoutExpiresAtMs` accurately;
`ProductionOffline.ts:152` "authorized window start" matches cold-boot
semantics; r19/r20 doc claims (jump arm `headCostMs > budgetLeftMs &&
cycleMs > budgetLeftMs`, dead-arm `min(nowMs, Date.now())`, re-stamp
kill invariant) all match shipped code; guard describe renamed
`r19/r20` consistently.

## Axis 4 — flipped-pin split contract (validator admits marker, mechanism owns magnitude)

**Coherent and documented consistently.**

- Repro (a) still asserts the validator admits `lastSavedAt = -1e308`
  (isFinite-only pin at saveShapeValidation.ts:2297) — verified green.
- Repro (b) asserts the crafted record is mechanism-denied — the
  pending-pair magnitude arm trips to zero-advance; probe B extends this
  end-to-end through the real validator → `restoreStates` →
  `settleOffline`/`tickWorkers` chain: ADMITTED at the gate, WEDGED at
  the mechanism, verbatim persistence, deny-direction.
- The split is stated identically in the COR-1 adjudication row
  ("validator still admits ... the mechanism now owns the bound, so any
  future derived-feed path is covered too") and in the guard comment
  (mechanism-level absorb prevention). No contradictory claim found.
- Consumer-side residual verified per site: a save carrying
  `-1e308 lastSavedAt` persists the marker into `player.lastSavedAt`
  verbatim, so every boot wedges all settles — bounded deny-direction
  (permanent underpay, never mint/hang); each sibling consumer owns its
  own bound: decompose fast-forward clamps `min(windowStartMs, nowMs)` +
  5000-iteration cap (DecomposeSystem.ts:274-315), autofarm runs the 24h
  cap + anchor re-set, alchemy is deadline-bounded. The mechanism pin
  added at r20 is the last line, consistent with the documented design.

## Findings

### R21-INT-01 — Low — huge-FINITE scalars re-open the runaway class the r20 pins closed (sibling of R20-COR-2)

The r20 guard pins `!Number.isFinite(slots)` and non-finite `budgetMs`,
but neither scalar has a magnitude bound — the same hole the magnitude
pin closed for stamps, one field over:

- `slots = 1e9` (finite): the empty-lane seed loop
  (WorkerLaneAdvance.ts:179-189) pushes lane objects until the count is
  reached → real heap exhaustion. Probe D: env-gated child vitest worker
  at `--max-old-space-size=768` dies with "Worker exited unexpectedly"
  (non-zero exit), deterministically — same failure mode the +Inf pin
  was added for, except OOM terminates FASTER than a pure CPU loop.
- `budgetMs = 1e10` (finite) + an admitted deep-past window
  (`emptyLaneStartMs = -8e15`, inside 2^53): the deadline walk grants
  completions linearly in budget — 100,000 completions vs the 360 an
  honest 10h cap intends (probe E). Unlike the hang class, `completed`
  DOES flow to `grantCycleRewards` — a crafted caller arg mints real
  rewards at O(budget). Weaker arm: the budget is caller-owned policy
  (the mechanism honoring a huge budget arg is arguably its contract),
  unlike stamps which can arrive crafted from saves.

Reachability today: none — both callers bound `slots` via
`allocateWorkerSlots(capacity)` and `budgetMs` via
`PRODUCTION_OFFLINE_CAP_SECONDS = 10*60*60`; no save field feeds either
scalar. Same class as R20-COR-2 (+Inf `slots`), which the r20 batch
fixed with a finiteness pin while leaving the finite-huge siblings open.
Suggested disposition: mechanism-level magnitude pin (e.g.
`slots <= some sane ceiling`, `budgetMs <= cap`) or an explicit
caller-contract comment — same defense-in-depth rationale the pending-
stamp pin already uses.

### R21-INT-02 — Nit — stale A1 reachability claim (see Axis 3)

### R21-INT-03 — Nit — imprecise magnitude claims in touched comments (see Axis 3)

## Evidence

- Probe file: `game/src/services/save/auditR21Int.probe.test.ts` — 6
  probes, all green at `be30c152`:
  - A — a 2^53-domain pending stamp freezes its site verbatim while the
    sibling site settles 8 completions under the untouched budget;
    re-settle idempotent (per-site isolation + zero budget consume).
  - B — the real validator ADMITS a crafted magnitude pending pair;
    `restoreStates` → wedge persists across `settleOffline` AND
    `tickWorkers` (reachable-by-design deny).
  - C — seed-arm trip leaves no residue: `workerCycles` stays empty,
    next honest `tickWorkers` seeds all 4 lanes at `nowMs`.
  - D — `slots = 1e9` finite: env-gated child spec
    (`auditR21IntSlotsHuge.probe.test.ts`) dies via vitest worker exit
    under `--max-old-space-size=768`; control run exits 0.
  - E — `budgetMs = 1e10` + deep-past admitted window mints 100,000
    completions vs 360 under the honest cap; `forfeited > 1e9`.
  - F — round-trip closure: emitted `pending` is always finite,
    ordered, and inside 2^53 — the mechanism never poisons its own
    input (re-admissible forever).
- Scoped suite: `npx vitest run src/services/save/auditR21Int.probe.test.ts
  src/services/save/fixpointR20Cor.qa.test.ts
  src/services/save/auditR20Int.probe.test.ts
  src/core/production/ProductionOffline.test.ts` — 4 files / 33 tests
  green at `be30c152`.
- Type-check: `npm run type-check` clean.

## Residual / verified-clean notes

- Magnitude-admitted pending pair → per-site verbatim wedge persists
  across settle AND tick (deny-direction: freeze, never mint; siblings
  unaffected) — mechanism-owned bound per the COR-1 split contract;
  reachable but intended.
- Seed-arm trip is per-call, leaves no residue; the site resumes on the
  next honest tick.
- Emitted `pending` always re-admissible (finite/ordered/<2^53) — a
  healthy site can never self-trip on its own output.
- `forfeited` still has no production consumer — r18-AUT-N1 disposition
  holds.
