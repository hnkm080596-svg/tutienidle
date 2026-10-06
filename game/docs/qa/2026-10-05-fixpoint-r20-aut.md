# Fixpoint r20 AUT audit — commit 060826af (r19 adjudication batch)

Blind adversarial audit of the r19 batch: the widened defensive guard in
`WorkerLaneAdvance` (non-finite stamps now trip a zero-advance early
return), the TLT claim bounds unchanged since r18, the `seededPending`
field-epoch re-stamp, and the flipped R19-COR-1 deny pins. Threat model:
malicious client forging save payloads + device clock; the shape gate
admits only bounded shapes; restore/settle must never mint beyond
authorized widths. Attack surface: crafted saves passing
`validateGameSaveShape`, crafted clocks, and every upstream feed that
reaches `advanceWorkerLanes`/`boundTimedEffectClocks`.

**Verdict: PASS WITH EVIDENCE.** No residual mint path confirmed; every
attacked bound verified held by deterministic probes (19 passing tests,
`src/services/save/auditR20Aut.probe.test.ts`). Two mechanism-level
hardening notes recorded below — both unreachable through the shape
gate at this tip.

## Confirmed findings

None. The documented residuals from earlier waves re-verified bounded:

- **Saved-lane pending head early-pay (~1 cycle).** Unchanged: a saved
  lane's surviving head is never seed-rooted, keeps its payload-epoch
  stamp verbatim, and pays once at the next `tickWorkers` under a fast
  field clock (probe C4). Bounded: one cycle per saved lane head,
  `workerCycles.length <= betaEffectiveWorkerCapacity` (= 3 in beta).
- **Stackable pill-regen expiry passthrough (r14-AUT-1).** Re-verified
  reachable and bounded at this tip (probes D4/D4b): a crafted
  `expiresAtMs = 1e15` on a valid regen claim IS admitted and stored
  raw — `expires - appliedAt` is intentionally unbound (stackable
  refresh legitimately widens it). Mint ceiling: ONE record per
  effectGroup (dedup), one `manaRegenPerTurn` modifier at
  `flat <= mpPerSecond x 1.5` of the authored pill, realm-earnability
  gated, dormant families rejected, `durationStackable` must match
  authored. Cultivation channels stay closed — no non-TLT record can
  carry `cultivationSpeedPercent`, and a TLT record can never be
  `durationStackable`.

## Considered and clean (attacker probes)

**(1) WorkerLaneAdvance widened guard.** `WorkerLaneAdvance.ts:123-138`,
`ProductionOffline.ts:157-194`.

- *Feed census* (A3): every path that can put entries into
  `state.workerCycles` is save-gated — `validateGameSaveShape` requires
  finite `startedAtMs`/`completesAtMs`, integer `rollSeed`,
  `completesAtMs > startedAtMs`, `span === computeCycleSeconds*1000`
  exactly, `startedAtMs <= lastSavedAt`, `siteLevelAtStart in
  [1, level]`, lane count <= 3 (saveShapeValidation.ts:3313-3539). All
  load seams run it: `LocalCloudSaveService.load`/`inspectLocalSave`,
  `SupabaseCloudSaveService.load`/import, `recoveryApi`,
  `useAppLifecycle` boot -> `restoreGameSession`, `EarlyGameSession`.
  `ProductionSystem.restoreStates` copies `workerCycles` verbatim but
  only ever sees post-validator state. No migration, checkpoint,
  warm-load, or dev-console feed bypasses the gate. The guard is
  defense-in-depth: unreachable from saves at this tip.
- *Preserve-then-persist* (A1): when the guard trips,
  `result.pending` is the verbatim input array and
  `settleProductionOffline` re-persists it into `state.workerCycles` —
  a crafted NaN-stamped record would be re-saved verbatim, and the
  zero-advance early return freezes every honest sibling lane. Repro
  documented; unreachable (see hardening notes).
- *Finiteness-only blind spot* (A2): a finite reversed-span record
  (`startedAtMs > completesAtMs`) passes the widened guard —
  `headCostMs = max(0, due - start) = 0`, the crafted saved head is
  granted at ZERO budget cost, successors renormalize from `due`.
  Exactly one free completion per crafted entry, then the chain is
  honest. The validator's ordering + exact-span pins reject the shape
  upstream (A3). Same unreachable class as A1 — see hardening notes.
- *Non-object entries* (A4): `pending: [null]` throws inside the guard
  predicate — through `restoreGameSession` the throw aborts the restore
  (deny), never mints.

**(2) TLT bounds.** `player.ts:111-174`, `saveShapeValidation.ts:1474-1721`.

- *Marker-exact death* (B1): `expires == lastSavedAt` routes to the
  dead arm — stored `min(expires, min(authorityNow, Date.now()))` =
  its own stamp, dead under the strict `expires > now` liveness shared
  by both percent probes. Payout contributes zero buffed seconds and
  the cps claim normalizes to BASE. No off-by-one revive.
- *Marker+1 revival* (B3): `expires == lastSavedAt + 1` stores exactly
  its own stamp — the crafted +1ms survives the marker, bounded by the
  claim's own width; the read-side strict `>` keeps parity with the
  validator probe.
- *Validator-ceiling expiry* (B2): `expires = lastSavedAt + 24h + 7d`
  (widest admitted shape) stores at `lastSavedAt + 24h` — never raw.
- *Percent edges* (B4): `-0`, NaN, `0.25 + eps` all rejected;
  `0.25` and `MIN_VALUE` admitted. The read filter is the same
  `(0, 0.25]` interval — parity holds; a `MIN_VALUE` claim loosens the
  cps bound by nothing measurable.
- *Non-finite marker* (B5): `lastSavedAt` in {null, 'x', undefined,
  NaN} rejected at the gate — every `!isFinite(saveLastSavedAtMs)`
  raw-passthrough arm in `boundTimedEffectClocks`/`payoutExpiresAtMs`
  is unreachable through validated restores.
- *Non-finite expires* (B6): `expiresAtMs` in {Infinity, NaN, null}
  rejected — the `!isFinite -> raw expires` arm (which would ride the
  whole split window at +25%) never sees a non-finite stamp.

**(3) `seededPending` re-stamp.** `ProductionOffline.ts:184-194`.

- *Kill invariant* (C1): for any skew, a seeded pending head lands in
  `(max(settleNow, Date.now()), max + cycleMs]` — never early in the
  field epoch, never deferred beyond one cycle of the honest epoch.
  Proven by the chain structure: dues step exactly `cycleMs` from a
  seed `<= settleNow`, the first due past `settleNow` sits in
  `(settleNow, settleNow + cycleMs]`, and `+max(0, Date.now() -
  settleNow)` maps that to the field epoch one-way. Verified at skews
  +200s, -200s, 0, and +30d.
- *Crafted `sinceMs`/`untilMs`*: `nowMs` cannot be pushed below the
  honest settle bound — cold-boot `elapsed = max(0, until - since)` is
  server-asserted (monotonic cutoff stamps server-side;
  `progression_cutoff_at = anchor_at + elapsedMonotonicMs`),
  `settleNow = min(lastSavedAt + elapsed, until)`, `offlineSince =
  min(lastSavedAt, until - elapsed)`. A crafted deep-past `since` only
  widens the seed window backward (C1 d); a crafted narrow window
  shrinks paid width to zero (C2). `until > Date.now()` defers heads
  (deny), never advances them.
- *Legacy identity* (C3): with no timeAuthority,
  `settleNow = min(lastSavedAt + elapsed, Date.now())` and
  `elapsed = max(0, Date.now() - lastSavedAt)` make `settleNow ==
  Date.now()` identically — shift is always 0, heads land in
  `(Date.now(), Date.now() + cycleMs]`. The "Date.now() honest but
  nowMs under the client" shape cannot arise in local mode.
- *Saved lanes* (C4): keep raw payload-epoch stamps — the documented
  residual above; the re-stamp never rescues them, bounded <= 1
  cycle/lane <= 3 lanes.
- *Authority kinds*: `live-replacement`'s `nowMs` has no production
  constructor at this tip (tests only); `cold-boot` uses server
  `untilMs`; `undefined` uses `Date.now()`. No client-controlled
  `nowMs` exists.

**(4) R19-COR-1 flipped deny pins.**

- *Epoch-flip mint attempt* (D1): forged future marker +
  `expires in (Date.now(), lastSavedAt]` — admitted by the validator,
  stored dead at `min(authorityNow, Date.now())`, payout flat. The
  identical crafted payload stays indistinguishable from the honest
  flipped-epoch case, so deny holds.
- *Forged future marker + ceiling expires* (D2): provenance clamps at
  `min(lastSavedAt, authorityNow) = authorityNow` -> stored =
  `authorityNow + 24h`, NOT the raw +37d claim — forging the marker
  forward cannot move the bound past server-now + duration.
- *Honest-width pin* (D3): a fresh marker + ceiling expires pays the
  authorized buffed width only — `120 x 10 x 1.25 = 1500`; the unbounded
  raw tail adds nothing.
- *Raw-expires readers*: exactly three consumers read the persisted
  `expiresAtMs` — the stored copy (clamped at provenance + 24h /
  dead bound), the payout copy (`min(expires, lastSavedAt + 24h)`),
  and `percentAtSave` (deny-direction only — a live probe relaxes the
  cps cap identically in the validator and at restore; the shapes it
  admits still pay <= BASE x 1.25 for <= elapsed). No read path pays
  the raw stamp past these clamps.

## Hardening notes (outside threat model — not client-reachable)

1. **Reversed-span pending escapes the widened guard** (A2). The guard
   checks `Number.isFinite` on nowMs/budgetMs/emptyLaneStartMs and every
   pending stamp, but not ordering: a finite `completesAtMs <
   startedAtMs` record completes once at cost 0 (`headCostMs =
   max(0, negative)`), then the chain renormalizes — one free grant per
   crafted entry. The validator's `completesAtMs > startedAtMs` +
   exact-span pins reject this shape on every seam, so it is
   unreachable today; worth a `cycle.completesAtMs > cycle.startedAtMs`
   clause inside the same guard if any future feed bypasses the shape
   gate.
2. **Preserve-then-persist on guard trip** (A1). The early return hands
   back `pending: [...params.pending]` verbatim and the caller
   re-saves it — a crafted record would be persisted unmodified and
   freeze honest sibling lanes. Same reachability caveat; a drop-the-
   bad-entry (or reject) semantic would poison nothing if it ever
   became reachable.

## Verification

- `npm run type-check` — clean.
- `npx vitest run src/services/save/auditR20Aut.probe.test.ts` —
  **19 passed / 0 failed** (A1-A4, B1-B6, C1-C4, D1-D4b).
- `npx vitest run src/services/save src/core/production` —
  **918 passed / 0 failed** (no regressions; additive test file only).
- `npx vitest run tests/architecture/asciiComments.test.ts` — clean.

Repros on `devin/audit-r20-aut-060826af`: 19 deterministic probes in
`src/services/save/auditR20Aut.probe.test.ts`. No production code
touched.
