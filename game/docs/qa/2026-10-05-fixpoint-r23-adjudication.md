# Fixpoint r23 — adjudication (audit commit `da0d553d`, batch r22)

Auditors: COR `devin/audit-r23-cor-da0d553d`, AUT `devin/audit-r23-aut-da0d553d`, INT `devin/audit-r23-int-da0d553d`.

## Verdicts

| Auditor | Verdict | Medium+ | Low | Nit |
| ------- | ------- | ------- | --- | --- |
| COR | PASS | 0 | 2 | 1 |
| AUT | PASS | 0 | 0 | 2 (+1 hardening suggestion) |
| INT | PASS | 0 | 1 | 2 |

## Dispositions

### R23-COR-1 — O(1) insight drain: product rounding leaves a negative remainder at acc >= ~4.6e18 (Low, CONFIRMED -> FIXED)

Claim verified: `steps * threshold` past the exact-integer domain (~2^53) rounds up (`acc + 512`), so `acc - steps*threshold` lands at -512; `requireNonNegativeNumber` then rejects the next save the game itself wrote (self-wedge class). Unreachable through any honest feed (acc < threshold always; gained cap-clamped; crafted acc >= threshold already rejected at admission by F-A11-2) — but the wedge is one cheap clamp away: the drain now writes `max(0, acc - steps*threshold)` and the comment states the exact-integer domain where the jump is bit-identical. COR's probe flipped to a deny pin (remainder 0, save validates).

### R23-COR-2 — stackable binge chains lose their tail past provenance+24h on each restore (Low, ACCEPTED RESIDUAL)

Already recorded as the accepted honest-loss class in the r22 adjudication: a stackable chain must claim >24h of expiry (~440+ same-family drinks) before the provenance bound truncates anything, the truncation only shrinks (deny direction), and no honest bound distinguishes a long chain from a parked mint. Re-pinned by COR's chain probes; classification unchanged.

### R23-COR-3 — `payoutExpiresAtMs` stackable arm is payout-irrelevant today (Nit, DEFENSE-IN-DEPTH, no change)

True as stated: the offline payout map only matters for effects carrying cultivationSpeedPercent (tu_linh_tran family), and the validator rejects `tu_linh_tran` + `durationStackable`, so a stackable record's bounded expires never changes a payout segment. The arm is retained deliberately — it is the same seam, the same bound, and it costs one disjunct; ripping it out would make the next stackable-percent family mint by default. Documented, no code change.

### R23-COR-4 — three stale/overstated comments (Nit, CONFIRMED -> FIXED)

- `auditR22Cor.probe.test.ts` step (2): "passes a stackable expiresAtMs through verbatim" — rewritten to describe the restore clamp.
- `auditR22Cor.probe.test.ts` step (3): "the parked buff parks forever" — now notes the restore-seam bound.
- `CultivationInsight.ts` O(1) comment: "identical result" — tightened to the exact-integer domain plus the `max(0, ...)` clamp above.
- `GameManagerPersistentEffectOps.ts` R22-COR-1 comment: "the parked buff stays parked (deny-direction residual)" — superseded by the restore clamp; rewritten.

### R23-AUT-1 — `Math.min(2**52-1, x)` propagates NaN if a feed ever passed NaN expires (Nit, EXCEPTED - unreachable)

Every caller supplies a code-stamped effect record (`appliedAtMs`/`expiresAtMs` written by applyTimedEffect at drink time, finite by construction) or a persisted record that survived `isBoundedTimestamp` (finite + magnitude). There is no NaN feed; the non-stackable arm shares the same shape and is equally uncovered. Exception recorded: mechanism guards already deny non-finite feeds, so the only reachable failure mode does not exist.

### R23-AUT-2 — non-finite `gained` poisons `cultivationInsightAccumulator` permanently (Nit, CONFIRMED -> FIXED)

True mechanism-level wedge: `acc += gained` with a non-finite `gained` left acc = Infinity, the guard returned without touching it, and every later save-write failed shape validation — self-wedge forever. Fixed: the guard now mints nothing AND resets the accumulator to 0 (bounded deny — the corrupt accrual is discarded, the save stays writable). Pin added in `CultivationInsight.test.ts`; AUT probe E2 flipped to the deny pin.

### R23-AUT hardening — `timeAuthority` stamps bypass the save gate (suggestion, IMPLEMENTED)

`sanitizeRestoreAuthority` (saveTypes.ts) now drops the whole authority to `undefined` when any stamp is non-finite or |x| >= 2^52 — the input class the validator never sees. Fallback is legacy client-clock semantics: bounded deny (pays only what the save's own marker + the local clock justify; every downstream mechanism guard still applies). Applied at the entry of both `player.restoreFromSave` and `GameManagerSaveRestore.restoreFromSave`, covering every caller (useAppLifecycle, recovery API, direct probes). Pins: out-of-domain `untilMs` pays the client window not the absurd span; boundary `2^52 - 1` still honored; non-finite `nowMs` falls back.

### R23-INT-01 — "clamps equal whenever a payout can run" comment false under cold-boot skew (Nit, CONFIRMED -> FIXED)

The `payoutTimedEffects` map comment claimed the map bound (provenance+dur) and the payout bound (lastSavedAt+dur) coincide whenever a payout runs; under a fast client clock `lastSavedAt > authorityNow` the map bound is strictly tighter while the payout still pays. Semantics were always right (map <= payout, deny direction); the comment was wrong — rewritten to state the one-directional relation.

### R23-INT-02 — appliedAtMs clamps on authority epoch while the dead arm anchors field epoch (Nit, DOCUMENTED)

Asymmetric but strict-subset: `appliedAtMs` is write-only after persistence (refresh merges read `expiresAtMs` only), so the clamp epoch has no runtime consequence and never admits anything the raw payload could not already claim. Comment added at the clamp site; no code change.

### R23-INT-03 — `decisions-needed.md` D-2026-10-05-01 stale (Low, CONFIRMED -> CLOSED)

The open ruling asked whether to cap stackable `expires` at `lastSavedAt + K`; r22 already implemented the cap at the restore seam (K = 24h = TU_LINH_TRAN_DURATION_MS, the longest authored window). The item is now marked RESOLVED with what shipped and what remains genuinely open for the product owner (tighten K; an admission-side span pin is noted as impossible — `appliedAt` keeps the first-drink stamp).

### INT seam confirmations (no action)

Dual-clamp divergence is one-directional (map <= payout always; live-in-payout/dead-in-map bounded by authorized width); every derived cursor lands in-domain; the write->save->validate round-trip is closed; the 65536 capacity pin and F-W-16 fire as two coherent distinct issues.

## Verification

`npm run type-check` clean; scoped `npx vitest run src/services/save src/stores src/core/cultivation src/core/game` — 211 files / 2090 tests pass.

## OCR coverage

`ocr delegate preview`: 16 files total, 11 reviewable (5 excluded .md — unsupported_ext). Reviewed 11/11: every production diff read against adjudication intent, every probe file read for determinism and no hidden production edits. Self-review findings fixed during the pass: dead `spawnSync`/`fileURLToPath` imports in `auditR23Aut.probe.test.ts` (removed). Coverage: 11/11 = 100%, 0 skipped.
