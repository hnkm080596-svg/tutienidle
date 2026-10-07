# Fixpoint audit — wave r29, role COR (correctness & regression)

- Date: 2026-10-06
- Audited commit: `faa893c1` (r26 + r27 batches + full r28 adjudication), branch `codex/hoa-cau-fireball-vfx`
- Auditor: COR (`devin-ba2fa853e2404a59978f7f531006cce4`)
- Probe: `game/src/services/save/auditR29Cor.probe.test.ts` — **41 tests, all green** (`npx vitest run src/services/save/auditR29Cor.probe.test.ts --pool=threads`)

## Verdict: PASS WITH EVIDENCE — 0 Critical / 0 High / 0 Medium / 1 Low / 3 Nit

All four r28 claims verified exact against code and probes. One new actionable
Low (sibling ungated-clock seams, same class r28-AUT-2 closed on alchemy tick),
two Nits (one uncapped-record sibling walk, one claim-premise imprecision), one
documentation Nit.

## Claim verification

| # | Claim | Result |
| --- | --- | --- |
| 1 | `restoreJobs` shift arm re-derives `reservation.digest` only on foldable witnesses; malformed reservations keep stale digest (deny) and normalize tolerates them | **CONFIRMED** — probes A1-A8 |
| 2 | The two downstream `Object.entries(player.talentLevels)` walks are cap-gated (`<= 1024`) | **CONFIRMED** — probes B1/B2; Proxy get-trap shows **0** value-reads on an over-cap record |
| 3 | persistPlayer coded-refuse arm: `report('corrupted', payload, undefined, 'local')` + `bootFlow.fail()`; ok arm calls `clear()` | **CONFIRMED** — App.vue :591-605 / :613-619; probes C1-C4 pin the store semantics; every sibling `report()` site pairs `fail()` (App.vue :718, useAppLifecycle :409-414/:429/:479/:568/:691) |
| 4 | `AlchemySystem.tick`/`settleOffline` zero-advance on `!isFinite(nowMs) \|\| \|nowMs\| >= 2**53` | **CONFIRMED** — probes D: NaN/±Infinity/±2^53/±1e300 zero-advance; ±(2^53−1) admitted (past clock parks, future settles); honest feed settles |

### Boundary arithmetic pinned

- Foldable truth table (A): `null`/scalar/`{specialIngredients:{}}`/`[null]` → **not foldable** → stale digest + normalized downstream; `[{materialId:1,amount:'x'}]`/`[{...amount:NaN}]` → **foldable** (objects only, field types unchecked — fold is a throw-gate, not a schema check) → re-derived digest, verify still element-denies; well-formed → re-derive + verify passes.
- Cap boundary (B): exactly 1024 → no cap issue; 1025 → `player.talentLevels` cap issue + zero `get` trap hits (all walks gated).
- Clock edges (D): `|nowMs| >= 2**53` blocked; `2**53 - 1` admitted; negative admitted clocks park (`nowMs < completesAtMs`), positive settle.
- Scope/clear (C): `DATA_REFUSE_CODES = {SAVE_INVALID, SAVE_TOO_LARGE}` exactly; `report('local')` → `remoteResettable=false` (SaveIncompatibleScreen.vue:32 computed mirrored); `clear()` sweeps status/raw/foundVersion/scope back to `remote` default; both refuse codes map to `authorityStateForError → 'recovery'`.

## Findings

### F1 — Sibling ungated-clock seams diverge from the r28 finite-clock doctrine — **Low** (confirmed, deterministic repros E1-E6)

r28 closed the class on `AlchemySystem.tick`/`settleOffline` (guard parity with
`advanceWorkerLanes`, WorkerLaneAdvance.ts:150-151). The same guard is absent on
every sibling seam that consumes a caller-supplied ms clock:

| Seam | Ungated input | Effect | Direction |
| --- | --- | --- | --- |
| `DecomposeSystem.tick(NaN)` (:151-193) | `nowMs` | `NaN < nextCycleAt` false → catch-up arm mints one cycle AND sets `nextCycleAt = NaN`; persisted slice then fails `isNonNegativeBoundedTimestamp` (saveShapeValidation:4569) → coded refuse wedge on every write | mint + self-brick |
| `DecomposeSystem.restore(state, NaN)` (:265-270) | `restoreNowMs` | `Math.min(clampedDeadline, NaN + cycleMs) = NaN` → `nextCycleAt = NaN` → same write wedge | self-brick |
| `DecomposeSystem.settleOffline(+Infinity, since)` (:284-330) | `nowMs` | fast-forward `+= Infinity` → settle loop mints the full 5000-cycle bound | bounded mint |
| `QuestManager.restore(state, NaN)` (:191) | `nowMs` | `Math.min(validStamp, NaN) = NaN` → `lastDailyResetAtMs = NaN` persists → fails :3354 pin → write wedge | self-brick |
| `TribulationDirector.restoreRuntime(slice, NaN)` (:862-864) | `restoreNowMs` | `cooldownUntil = NaN` → `getCooldownSeconds` returns NaN → `> 0` gate false → cooldown silently cleared (free retry); `> 0` serialize guard keeps it out of the save | in-memory grant |
| `AlchemySystem.restoreJobs(jobs, -Infinity)` / `restoreStates(-Inf)` | `restoreNowMs` | shift arm re-anchors every began-pair deep-past → instantly due on next honest tick | mint queue |

**Reachability:** ungated callers only — production feeds are bounded
(`restoreClockMs = min(finite lastSavedAt, Date.now())`,
`settleNowMs` derived from the validated marker, `Date.now()` ticks), and the
write-side validator refuses every crafted stamp before these paths. Same
calibration as the fixed r28-AUT-2 item (rated Low "ungated feeds only"). The
wedge chains (E1/E2/E4) are new reachability detail worth pinning: a poisoned
in-memory stamp converts into a deterministic `SAVE_INVALID` refuse on the next
persist, i.e. the r28 refuse arm mounts its error surface against a healthy
remote row.

### F2 — `player.nodeLevels` over-cap record still pays 3 uncapped `Object.entries` walks — **Nit** (confirmed, probe B3)

`saveShapeValidation.ts:3041` binds `nodeLevels` without a cap check, and
`validateSkillCoreCoverage` iterates it unconditionally at :3158, :3225, :3253
(`Object.entries(nodeLevels)`). Probe B3's Proxy `get` trap counts **3075**
reads on a 1025-entry record (3 × 1025 — exactly the three walks) while the
same probe on `talentLevels` counts **0** after the r28 fix. Verdict is already
`ok:false` (root cap at :2026 fires) — cost-only asymmetry, identical class to
the fixed r28-COR-Nit.

### F3 — claim-3 premise imprecision (refuse codes are not pre-invocation-only) — **Nit** (behavior verified correct anyway)

The stated rationale — "refuse codes only fire when the adapter was never
invoked" — is incomplete: the remote adapter itself returns `SAVE_INVALID`/
`SAVE_TOO_LARGE` (SupabaseCloudSaveService.ts:975-979 server-side refuse).
The `'local'` scope is still correct in both cases (a refused write never
commits — the remote row holds last-good regardless), so this is a
documentation nit, not a defect. Related notes: `flushSave`/manual-save paths
bypass the coded-refuse arm intentionally (all one-shot, no autosave loop);
`saveIssue.report` is overwrite-idempotent as pinned.

### F4 — foldable re-derive forgives a crafted wrong digest for free — **Nit** (documented residual)

On the shift arm, a post-dated forged job whose witness is foldable but carries
a wrong digest gets a valid re-derived digest installed (the verifier never
needed to implement the fold). Within the already-accepted self-consistent-
forge residual class — listed only to pin the predicate asymmetry: `foldable`
gates *throw-safety*, `verify` gates *admission*.

## Rejected candidates (checked, not findings)

- **Negative `restoreNowMs` through gated feed**: began-pair admission pin
  (`startedAtMs <= lastSavedAt`) makes the shift arm fire only on post-dated
  pairs; covered by the accepted r28 residual.
- **`decompose.settleOffline(NaN)`**: `windowStartMs` collapses to NaN →
  `while (NaN <= NaN)` false → returns 0, deny. Only `+Infinity` mints.
- **`decompose.restore(state, -Infinity)`**: `Math.max(nextCycleAt, -Inf)` keeps
  the finite deadline — benign; only NaN poisons.
- **`questManager.restore(state, +Infinity)`**: `Math.min(stamp, Inf) = stamp`
  — benign.
- **Honest regression**: valid wire save validates clean (F2 test); honest
  in-flight job restores verbatim, digest unchanged, verify passes (F1 test);
  honest decompose tick mints exactly one cycle with finite re-anchor (F3 test).
