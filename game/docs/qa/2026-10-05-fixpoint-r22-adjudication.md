# Fixpoint r22 adjudication — audited tip `bf3b44a1` (r21 batch)

Wave auditors: COR `devin-62b490e31e1d48acb239f0449be400a6` (FAIL, 1M+1N),
AUT `devin-eae5c7c15ff34b4dafd2b95ae8c6a912` (FAIL, 1M+2L+1N),
INT `devin-772bb67e02604d1d9be650ad79e64763` (PASS, 1L+1N).

Reports: `2026-10-05-fixpoint-r22-{cor,aut,int}.md`. Probes:
`src/services/save/auditR22Cor.probe.test.ts`,
`src/services/save/auditR22Aut.probe.test.ts`,
`src/services/save/auditR22InsightHang.probe.test.ts`,
`src/services/save/auditR22Int.probe.test.ts`.

## Findings and dispositions

### r22-COR-1 (Medium — CONFIRMED, fixed): the stackable writer ratchets a parked stamp out of the admitted domain

Verified in code. `GameManagerPersistentEffectOps.applyTimedEffect` was the ONE
writer that adds onto a persisted stamp:

```ts
existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
```

The r21 adjudication accepted "sub-pin parked stamps" as an inert residual —
true for every read-only cursor, but NOT here: a crafted-but-admitted
stackable `expiresAtMs` parked just under 2^53 + one honest re-drink of the
same pill family → stamp written past the bound → `buildGameSave` persists it
verbatim → the next `validateGameSaveShape` permanently rejects the save.
A parked record becoming save loss through normal play is NOT deny-direction.

**Fix (writer clamp, not gate tightening):** the arm now clamps inside the
admitted domain:

```ts
existing.expiresAtMs = Math.min(
  2 ** 52 - 1,
  Math.max(Date.now(), existing.expiresAtMs) + duration,
)
```

Every written save now re-validates by construction; the parked buff stays
parked. The admission bound tightened to 2^52 for the derivation headroom
below, so the clamp target follows it. (The mint half of this field —
AUT's F-R22-01 — needed the restore-seam fix below.)

### r22-INT-01 (Low — CONFIRMED, fixed by the same bound tightening): derived cursor lands exactly on the mechanism pin

Verified. The r21 gate admitted `|stamp| < 2^53`, but `offlineSinceMs =
min(lastSavedAt, authorityNowMs - elapsedOfflineSeconds * 1000)` performs one
honest-epoch add then a /1000*1000 float64 round-trip. For the outermost
admitted value `-(2^53 - 1)`: `A - L` rounds to `A - L - 1`, so the derived
cursor comes back at exactly `-2^53` → `advanceWorkerLanes`' magnitude guard
trips → the site's lanes freeze verbatim on every boot — the wedge class the
gate was installed to close, surviving through a DERIVED feed.

**Fix:** `isBoundedTimestamp` tightened `|x| < 2^52` on every persisted
timestamp cursor (all eight issue messages updated). Honest stamps are
epoch-ms (~1.8e12) or epoch-seconds (~1.8e9, `buildings.lastCollectedAt`) —
the bound still leaves ~2500x headroom over anything a real clock writes,
and ~4.5e15 of derivation headroom to the mechanism's own 2^53 pin (kept
unchanged as defense-in-depth for non-save feeds: probes B/C/3 still pin it).

### r22-AUT-1 (Medium — CONFIRMED, fixed): a parked stackable expiry is GRANT direction — mints a permanent buff

Verified. The r14/r21 residual classification "far-future parked stamp =
deny-direction self-harm" held only for deadline/cursor fields; for an
EXPIRY field parking IS the mint: `durationStackable` records were exempt
from `boundTimedEffectClocks`, so a crafted `expiresAtMs = 9e15` (or 1e15,
or save+30d) on a regen record restored verbatim and
`getActiveTimedModifiers` returned it live — ~285M years of regen vs the
75s authored. The writer half (admit→re-drink→brick) is the same finding
as COR-1 above.

**Fix:** the exemption is removed — `boundTimedEffectClocks` and
`payoutExpiresAtMs` apply the same two arms to stackable expiries
(dead-at-save clamps dead; live claim clamps at `provenance + 24h`, the
class-max window). Honest-class analysis: every extension is
`max(drinkTime, oldExpiry) + dur` with `drinkTime <= lastSavedAt`, so
honest expiry ≤ `lastSavedAt + Σ(drinks)`. Σ is structurally unbounded
(no drink counter persists), so the cap uses the 24h class window: any
honest chain needs ~360+ consecutive same-family drinks to exceed it,
and a chain beyond loses only the tail past save+24h on load — bounded
deny vs a permanent mint. Admission still doesn't bound the span
(comment updated at the regen arm); the restore seam owns it.

### r22-AUT-2 (Low, latent — CONFIRMED, excepted with reason): `hiddenChannelCycles` pity counters can't be gate-bounded

`productionSites[].hiddenChannelCycles` counters are honest-shape
non-negative ints; a crafted count ≥ `guaranteedAfterCycles` forces the
authored deterministic emission early. No validator bound can separate
forged from honest counters — the field IS a count. Bounded grant (one
authored drop per channel), scope-hidden feature. Recorded exception;
if hidden channels unhide, revisit with a per-channel authored cap.

### r22-AUT-3 (Low, latent — CONFIRMED, fixed): `autoWorkerCapacity` unbounded

Capacity feeds `advanceWorkerLanes` slots; >65536 re-trips the r21
per-site freeze when `manualWorkforce` unhides. Pinned `<= 65536` at the
gate (matches the mechanism's slots bound; honest capacity is small and
CHQ-gated anyway).

### r22-AUT-4 (Nit — CONFIRMED, fixed): `accrueCultivationInsight` O(acc) drain loop

`while (acc >= threshold)` iterates the persisted counter — child probe
hung on acc=1e15 (admission closed today via F-A11-2, latent). The loop
body is uniform; replaced with `floor(acc/threshold)` O(1) jump,
identical semantics, bounded work. The C2 probe now asserts the armed
child COMPLETES (status 0).

### r22-COR-2 (Nit — CONFIRMED, fixed): child-probe pkill can self-kill the suite

`fixpointR20Cor.qa.test.ts` spawned `vitest run` children for the slots-hang
repro and swept survivors via `pkill -f <spec-name>` — any pattern a parent
vitest cmdline also matches can kill the suite runner itself. Replaced with
`--pool=threads` + `NODE_OPTIONS=--max-old-space-size=768` so the child's own
timeout SIGTERM reaps its workers; pkill removed entirely.

### r22-INT-02 (Nit — CONFIRMED, fixed): stale comments

- `saveShapeValidation.ts` docblock said "epoch-ms" only — the same helper
  also owns `buildings.lastCollectedAt`, an epoch-SECONDS field. Comment now
  names both domains.
- `WorkerLaneAdvance.ts:127` still said "upstream pins keep every input
  finite" — describes the r19 contract; upstream now bounds magnitude too.
  Comment updated.

## Residual (accepted, band narrowed)

Sub-bound far-future parking remains admitted for DEADLINE/cursor fields:
stamps in `(now, 2^52)` park their own channel (autofarm next-due, daily
reset markers). Deny-direction self-harm only, harms only the crafter's
save, and no honest bound exists — a tighter absolute cap re-kills honest
saves on machines with a broken clock (the r15-COR-D incident class).
EXPIRY fields are out of the residual as of r22 (AUT-1): bound at the
restore seam to provenance + 24h. New minor honest-loss class: a stackable
binge chain longer than ~360 drinks (>24h of claimed expiry) loses its
tail past save+24h on load — bounded deny, absurd-reach honest shape.
`hiddenChannelCycles` pity counters stay excepted per AUT-2.

## Verification

- `npm run type-check`: clean.
- `npx vitest run src/services/save src/core/production src/stores src/core/game src/core/cultivation`:
  222 files / 2188 tests pass (new pins: stackable clamp x2 in
  `GameManager.timedEffect.test.ts`, boundary flip + threads-pool child in
  `fixpointR20Cor.qa.test.ts`, ratchet flip + O(1) differential in
  `auditR22Cor.probe.test.ts` (17/17), gate+mechanism pins in
  `auditR22Int.probe.test.ts` (3/3), mint/ratchet/hang flips in
  `auditR22Aut.probe.test.ts` (8/8), restore-clamp pins x2 in
  `player.restoreFromSave.test.ts`, D4 residual pin flipped in
  `auditR20Aut.probe.test.ts`, capacity cap pin in
  `saveShapeValidation.test.ts`, O(1) drain pin in
  `CultivationInsight.test.ts`, retargeted admit/reject sets in
  `auditR21Aut.probe.test.ts`).
- OCR gate (P18): _PENDING_
