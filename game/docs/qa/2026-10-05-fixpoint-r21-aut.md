# Fixpoint r21 AUT audit — commit be30c152 (r20 adjudication batch)

Blind adversarial audit of the r20 batch: the widened
`advanceWorkerLanes` guard (non-finite + ordering + `|stamp| >= 2^53`
magnitude + non-finite slots), the zero-advance freeze semantics it
introduces, the TLT bound matrix, and the `seededPending` field-epoch
re-stamp. Threat model: malicious client forging save payloads + device
clock; the shape gate admits only bounded shapes; restore/settle must
never mint beyond authorized widths.

**Verdict: FAIL WITH REASON** — no residual mint path confirmed (every
attacked bound denies), but the wave CONFIRMED reachable denial
defects: the r20 adjudication accepted the magnitude-guard freeze as a
Nit on the rationale "unreachable from any save today (validator pins
every stamp finite + ordered)". That rationale is stale — the validator
pins finiteness, ordering, exact span, and `startedAtMs <= lastSavedAt`
but carries **no magnitude pin** on the stamps, and `player.lastSavedAt`
itself is finite-only. Crafted magnitude-bearing stamps sail through
the gate, so the permanent freeze fires on real saves today.

Repro evidence: `game/src/services/save/auditR21Aut.probe.test.ts` —
20 deterministic probes, all passing (each documents an admitted
shape plus its mechanism outcome). `npx vitest run
src/services/save/auditR21Aut.probe.test.ts` green;
`vue-tsc --build` clean.

## Confirmed findings

### F-R21-01 — permanent production-site freeze via admitted pending stamps (recommended Medium)

Reachability (probes A1/A2/A4): `validateGameSaveShape` admits
`workerCycles` entries with `|startedAtMs|`/`|completesAtMs|` at and
above `2^53`, and just below it. The validator's own pins (finite,
strict ordering, exact authored span, `startedAtMs <= lastSavedAt`)
all pass because:

- The exact-span check
  `completesAtMs - startedAtMs === computeCycleSeconds(...) * 1000`
  stays exact at ANY magnitude where both stamps are representable —
  every authored span is a multiple of 1000, representable as a float
  delta far above `2^53` (spacing 2 admits even deltas; spacing 8
  admits multiples of 1000 up to ~2^56). The span pin does NOT cap
  crafted magnitude — it only fixes the difference.
- `startedAtMs <= lastSavedAt` is satisfied by a crafted finite
  `lastSavedAt` (probe A3: `-1e300` and `+9e15` both admitted — the
  marker pin is finiteness only).

Mechanism (probes B1/B4): `advanceWorkerLanes` trips its magnitude arm
on EVERY call — `deadline` settle (ProductionOffline.ts:157) and
`observe` tick (ProductionSystem.ts:414) alike. The early return
passes `pending` back verbatim; both callers re-persist it into
`state.workerCycles`, so the crafted record is immortal and the whole
site — honest sibling lanes and empty-lane seeding included — produces
nothing, forever, silently. One crafted entry suffices: the guard is
`pending.some(...)`. A second settle still returns 0 (B1). The freeze
reaches non-`autoRestart` sites carrying in-flight lanes too
(`advanceableStates` includes `workerCycles.length > 0`, B4).

Also reachable as a per-lane park BELOW the pin: `completesAtMs = 9e15`
(< `2^53`) never comes due and re-persists untouched — the lane is
frozen without tripping the guard; `maxLanes` (= 3) crafted entries
kill the whole site (A4 + B2).

Severity basis: reachable today through every save feed, permanent,
silent, and total for each affected site — strictly worse than the
decompose/autofarm cap-or-forfeit semantics the codebase uses
elsewhere. Deny-direction only (never mints), which is why Medium not
higher.

### F-R21-02 — crafted deep-past `lastSavedAt` freezes ALL sites' offline settle per boot (recommended Low)

`player.lastSavedAt` admits `-1e300` (A3). Through
GameManagerSaveRestore.ts:426-429, `offlineSinceMs = min(lastSavedAt,
authorityNowMs - elapsed*1000)` lands at the marker →
`|emptyLaneStartMs| >= 2^53` trips the guard for EVERY site in the
settle pass (B3: three autoRestart sites all zero-advance, no seeding).

Scope measured precisely:

- The `elapsed > 60` gate still controls reachability: under cold-boot
  the elapsed comes from the server-approved window, so the crafted
  marker fires whenever the server granted a real offline span; under
  the legacy path elapsed ≈ `1e297` and it always fires.
- Pending lanes are NOT corrupted — the guard returns them verbatim, so
  the freeze is payload-scoped and self-heals the moment an honest
  `lastSavedAt` overwrites it (B3 second settle pays normally). Under
  a remote-authoritative head the crafted marker can re-fire on each
  boot until overwritten.
- Asymmetric: the same marker leaves the cultivation channel paying
  its `DEFAULT_MAX_OFFLINE_SECONDS` cap and decompose paying its own
  bounded window — a crafted marker selectively confiscates ONLY the
  production offline channel (settle advance + worker seeding).

Deny-direction; boot-scoped rather than state-permanent. Low.

### F-R21-03 — sibling magnitude-gap family: every persisted deadline/cursor field parks permanently (recommended Low)

Same root class — a finite-only timestamp pin, a consumer that treats
the field as "due later":

- **alchemyJobs[].completesAtMs** (probe F1, end-to-end confirmed): a
  self-consistent crafted job — valid `reservation` digest included
  (the digest is a deterministic FNV-1a fold over the job's own
  fields, recomputable by the forger — a consistency check, not a MAC)
  — is admitted with `completesAtMs = 9e15`, then parks forever under
  `AlchemySystem.tick` (`nowMs < completesAtMs` → skip). Occupies one
  of `maxJobs` concurrent slots; `4` crafted jobs at `pill_room` L9
  freeze alchemy delivery.
- **decompose.nextCycleAt** (F2): non-negative finite only;
  `restore()` takes `Math.max(0, v)` verbatim (DecomposeSystem.ts:258)
  → `9e15` parks the decompose loop permanently.
- **buildings[].lastCollectedAt** (F2): non-negative finite only;
  consumed in SECONDS vs `Date.now()/1000` (BuildingSystem.ts:329) →
  `9e15` keeps `elapsedSeconds <= 0` → accrual permanently parked.
- **tribulation.cooldownUntil** (F2): admitted up to
  `lastSavedAt + TRIBULATION_COOLDOWN_SECONDS*1000` — under the same
  crafted `9e15` marker a ~`9e15` cooldown is admitted; the director
  compares it to `Date.now()` → ~285,000-year lockout.

All deny-direction, all permanent inside the persisted state, all
reachable through any validated feed. Recommend severity Low as a
family (per-channel DoS via forged save; self-inflicted unless a
crafted payload reaches a victim's save slot — same precondition as
F-R21-01).

### Nit — observational forfeit counter inflation

`advanceWorkerLanes` jump guard (WorkerLaneAdvance.ts:219-247) counts
`skippedDues` (~`1e11` for deep-past dues) into `result.forfeited`;
neither consumer reads it (settle uses `completed`/`pending`/
`consumedBudgetMs` only). Dead-ended counter — cosmetic (B5).

## Considered and clean (attacker probes)

**(1) Absorb/ULP pin boundary.** The dispatch's worry — a sub-`2^53`
`emptyLaneStartMs` absorbing `+ cycleMs` — is dead by arithmetic
(probe C1): every authored `cycleMs` is `ceil(base/speed) * 1000`, a
multiple of 1000 in `[22000, 656100000]` (mortal L9 … tribulation L1).
Absorb needs `delta < spacing/2` — spacing hits 2 exactly AT `2^53`
(so `< 1ms` needed; none exists, authored or honest). The `>= 2**53`
pin boundary is correctly placed; `2^53 - 1` advances cleanly while
`±2^53` trip on both the `emptyLaneStartMs` and pending arms (C2).

**(2) Below-pin span overflow.** Impossible by construction: the
validator's span subtraction IS the mechanism's `headCost`
subtraction — same floats, same result at every magnitude. Deep-past
dues grant at most `floor(budgetMs/span)` authorized completions
before the O(1) forfeit jump terminates the chain (B5).

**(3) TLT bound matrix at tip** (probes D1-D4, r20-B1..B6 re-verified
in code). Every input to `boundTimedEffectClocks` is gated or
authority-owned: `appliedAtMs` finite + `<= lastSavedAt`
(1496/1508-1517); `expiresAtMs` finite + `<= lastSavedAt + 24h + 7d`;
`durationStackable` boolean and forbidden on TLT (1552) so the
raw-passthrough arm can't ride the cultivation group (D4); `nowMs` is
`restoreAuthorityNowMs(timeAuthority)` — server `untilMs` or
`Date.now()`, never payload; `provenanceMs = min(lastSavedAt,
authorityNow)`; `saveLastSavedAtMs` finite-pinned (2297). Forged
markers deny at both poles: `+9e15` marker + marker-exact expires
stores dead at `min(authorityNow, Date.now())` (D2); a `-1e300` marker
absorbs the validator's own provenance ceiling to itself, so every
live TLT claim is REJECTED at the gate (D3). Percent domain shared by
the cap probe and the payout read: `(0, 0.25]` parity holds.

**(4) Re-stamp early-land.** `fieldEpochShiftMs = max(0, Date.now() -
nowMs)` can only defer seeded heads; every admitted marker shape lands
them in `(max(settleNow, Date.now()), + cycleMs]` (E3). The `seeded`
flag never crosses onto saved chains — `pending` emits the saved ref
while `seededPending` filters by the lane flag, and the budget-jump
rewrite (which does spawn a fresh head object) keeps the flag
undefined on saved lanes (E2). The jumped saved head persists
UNSHIFTED at `~settleNow + fraction` — the same `<= 1` cycle/lane
residual r20-C4 documented, now also reached through the jump arm
(E1); parity, not a new class.

**Feed census (re-verified, unchanged):** every path into
`state.workerCycles`/job/TLT state gates on `validateGameSaveShape` —
`LocalCloudSaveService.load`/`inspectLocalSave`,
`SupabaseCloudSaveService.load`/import, `recoveryApi`,
`useAppLifecycle` boot → `restoreGameSession`,
`EarlyGameSession→restoreGameSession`. `ProductionSystem.restoreStates`
copies `workerCycles` verbatim but only ever sees post-validator
state. No live-replacement producers exist (`restoreAuthorityNowMs`
has a `live-replacement` arm but nothing constructs one).

## Hardening directions (adjudicator's call — no production edits made)

- Mirror `|stamp| < 2^53` into `validateProductionCycleSave` and put a
  sane epoch bound on `player.lastSavedAt` (e.g. `|v| <= ~1e13`) —
  closes F-R21-01/-02 at the gate, and the marker arm of F-R21-03's
  tribulation pin.
- A single audit rule for the family: every persisted field consumed
  as a deadline/cursor (`workerCycles`, `alchemyJobs`,
  `tribulation.cooldownUntil`, `decompose.nextCycleAt`,
  `buildings[].lastCollectedAt`, `persistentTimedEffects` stamps)
  carries the same magnitude bound.
- Optional blast-radius shrink: per-lane quarantine inside
  `advanceWorkerLanes` (drop the bad lane, keep siblings) instead of
  the whole-site early return — preserves defense-in-depth if a future
  feed ever bypasses the gate.
