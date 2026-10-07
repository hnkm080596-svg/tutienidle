# Fixpoint r26 adjudication — commit 8f3cb237 (r25 batch + wire-form gate)

Auditors: COR `devin-af92283193764f14bb6068b8b6f08e9a` (PASS WITH EVIDENCE — 1M/3L/4N), AUT `devin-9c8aad866791454a86643e973430d331` (FAIL — 1H/1M/1L/2N), INT `devin-45bda4c57549485d851cd1e2b03dee42` (FAIL — 1H/1M/2L/3N). All blind, all probed at `8f3cb237`.

## Confirmed findings and fixes

### R26-AUT-1 (High) + R26-COR-1 (Medium) + R26-INT-02 (Medium) — deadline stamps restore verbatim → the write gate bricks every subsequent write until Δ decays

- Claim (verified): the r25 write-side gate protects the slot, but `workerCycles[].startedAtMs`, `alchemyJobs[].startedAtMs`, `tribulation.cooldownUntil`, `decompose.nextCycleAt` still restore verbatim. A uniformly +Δ-shifted payload passes every admission pin (each pin compares stamps to the payload's OWN editable `lastSavedAt`), restores the post-dated stamps, and every write afterward self-fails until wall time overtakes Δ — permanent for far-future crafted stamps. Under remote authority the boot commit refuse wedged the character with no designed escape (INT-01); under local the session could never persist (INT-02).
- Fix: **restore-side re-anchor** on all four channels, driven by `restoreClockMs = Math.min(authorityNowMs, Date.now())` (computed once in `GameManagerSaveRestore`, passed as `restoreNowMs` to every seam — persisted stamps live in the client epoch, so a stamp past `min(authority, device-now)` is impossible-authored by construction):
  - **Began-time pairs** (`workerCycles[].startedAtMs/completesAtMs`, `alchemyJobs[].startedAtMs/completesAtMs`): post-dated pair shifts BOTH fields by `startedAtMs − restoreNowMs`, preserving the exact authored span the write pin re-checks.
  - **Deadline fields**: `tribulation.cooldownUntil` clamps at `restoreNowMs + TRIBULATION_COOLDOWN_SECONDS*1000` (authored max-remaining); `decompose.nextCycleAt` clamps at `restoreNowMs + cycleMs` (mirroring the tick's own rebase).
  - `restoreNowMs = Date.now()` optional default on all 4 seams — deny-safe, keeps ~25 existing test call sites compiling.
- Second-order fix surfaced by probes: the alchemy `reservation.digest` FOLDS `startedAtMs/completesAtMs` into the witness — shifting the pair without re-deriving the digest made every re-anchored job fail the witness pin. `restoreJobs` now re-derives the digest over the shifted stamps (safe: a forged-consistent bundle could always self-consistent-digest — documented residual; honest past stamps are untouched so their digest replays).
- Verdict on wedge persistence: the +Δ head itself stays +Δ on the slot, but restores heal it — every subsequent boot re-anchors, and the first post-restore write commits a fully-admissible payload. Self-healing at the source, no slot churn.

### R26-INT-01 (High) + R26-COR-3 (Low) — the refuse envelope could not arm the recovery surface (no `code`, `retryable:true` → 'reconnecting' churn or generic fail forever)

- Claim (verified): `OUTGOING_ADMISSION_REJECTED`/`OUTGOING_UNSERIALIZABLE` returned `detail` + `retryable:true` and NO `BackendErrorCode` → `authorityStateForError(undefined)` → `'reconnecting'` (autosave churn per tick under remote — INT-03's flap) or generic `onError`+`boot.fail()` with the `saveIssue.report('corrupted', …)` remote-reset surface unreachable — "the only real un-wedge" for exactly this class.
- Fix: both refuses now return `code: 'SAVE_INVALID'` + `retryable: false` (a deterministic-invalid state can never retry to success; a skewed state that heals changes the payload, not the same retry). `authorityStateForError` maps the code → terminal `'recovery'` (INT-03 flap closed — `observeSaveResult` enters terminal instead of pause+reconnect).
- `DATA_REFUSE_CODES` (`{SAVE_INVALID, SAVE_TOO_LARGE}`) moved from a local const in `useAppLifecycle.ts` to an exported const in `BackendStatus.ts` beside the union it classifies; `App.vue` + `useAppLifecycle.ts` both import it.
- `persistPlayer` (mid-session writes): local-mode `observeSaveResult` early-returns, so the refuse now explicitly escalates — `saveIssue.report('corrupted', refusedPayload, undefined, remoteAuthority ? 'remote' : 'local')` after a data-class refuse. 'local' scope correctly hides the remote-reset affordance (burning a remote row can't fix a local wedge); remote mode gets the terminal + the reset card.
- Boot arm unchanged and now reachable: `useAppLifecycle` fires `saveIssue.report('corrupted', …) + boot.fail()` + early return (no generic `onError`).

### R26-AUT-2 (Medium) + R26-COR-2/R26-INT-04 (Low) — record-map and nested channels bypass `ID_COLLECTION_CAP`

- Claim (verified): `hiddenBeastKills`, `productionSites[].hiddenChannelCycles` (both via `validateNonNegativeIntMap`), `nodeFreePurchaseRecord`, `skillCastCounts`, `baseStats`, `nodeOneShotGrants[].learnedSkillIds`, `hiddenPerfection.hiddenBreakthroughRealmIds` walked unbounded counts — crafted 2000-entry maps admitted, taxing every write-gate validation.
- Fix: `Object.keys(value).length > ID_COLLECTION_CAP` inside `validateNonNegativeIntMap` (covers both channels at once); explicit caps on `skillCastCounts`, `baseStats`, `nodeFreePurchaseRecord`, `learnedSkillIds` length, `hiddenBreakthroughRealmIds` length (placed after the foundation block so an invalid foundation label cannot bypass it). `talentLevels` stays indirectly bounded via the `selectedTalentIds` ownership pin (auditor-verified, untouched).

### R26-AUT-3 (Low) — `decompose.nextCycleAt` had no marker pin

- Covered by the re-anchor above (restore-now + cycleMs bound).

### COR-N1 — `sanitizeRestoreAuthority(null)` threw `TypeError` before the whitelist

- Fixed: `null` degrades to `{kind:'live-replacement', nowMs: Date.now()}` (deny primitive), same as foreign kinds. `undefined` stays reserved for the absent arm.

## Formally excepted / documented (non-actionable)

- **R26-COR-4 (Low) — honest equipment hoard can exceed `ID_COLLECTION_CAP`**: `EQUIPMENT_BAG_SOFT_CAP=500` + `autoDissolveOverflow` exempts locked/favorite → >1024 locked items = honest save the gate refuses (total write wedge while the hoard holds, self-heals when it dips). Needs a product ruling — hard cap counting locked/favorite changes gameplay semantics. Escalated to `decisions-needed.md` (new entry).
- **COR-N2 — double `JSON.stringify` per write** (gate serializes for wire form, adapter again for storage): trivial at save cadence; the wire form is what boot judges — accepted.
- **COR-N3 / AUT-4 / INT-05 — `OUTGOING_UNSERIALIZABLE` unreachable for honest writes**: `buildGameSave` JSON-detaches every slice; only bypassing callers can produce a circular payload. Correct defensive fail-safe — now also carries the armed envelope.
- **COR-N4 — `lastDailyResetAtMs` crafted-past**: DORMANT (zero authored daily quests); unchanged.
- **AUT-5 — displaced-queue callers resolve 'ok' with their payload never gate-evaluated**: join-or-displace contract is intentional — the promoted (newest) entry's gate evaluation is authoritative for the slot; the displaced payload never lands. Deny-direction, recorded.
- **INT-06 — `PendingSaveJournal` replay bypasses the gate for pre-r25 records**: self-limiting (only journals written before the gate existed), and now self-healing (a journaled +Δ head re-anchors at the next restore). Recorded.
- **INT-07 — `restoreBackup` deliberately ungated**: recovery lane restoring previously-admitted bytes; a +Δ backup re-installs the wedge shape but the next boot's restore re-anchors it — bounded, consistent with the earlier exemption.

## Pins added / flipped

- `auditR26Aut.probe.test.ts` — A2/A3/A4/B1/C2/C3/D1/E4 flipped to the new contract: re-anchor asserts (startedAt=NOW, span preserved, digest re-derived, deadline clamps), refuse envelope `code:'SAVE_INVALID'`+`retryable:false`, B1 arm asserts `saveIssue.report('corrupted',…)` fires without generic `onError`, cap round-trip at 1024/2048.
- `auditR26Cor.probe.test.ts` — D2/D3 envelope, W1/W2 verbatim→re-anchor (wire-injected crafted stamps since the writer-side seams clamp too), C2 uncapped→deny, G1 null-degrade.
- `auditR26Int.probe.test.ts` — inflight/UNSERIALIZABLE envelopes, DATA_REFUSE arm-predicate test flipped to arms:true + `authorityStateForError → 'recovery'`, +Delta end-to-end flipped to re-anchor + commit, uncapped walks flipped to deny.
- `auditR25Aut/auditR25Int` — verbatim-restore residual pins flipped to re-anchor + commit.
- `auditR21Aut` F1 — parks-forever flipped to re-anchor + digest replay; residual comments updated (deadline channels closed; cursor channels keep the residual).
- `auditR22Cor` — `9e15 stays parked` row replaced by a re-anchor pin (`nextCycleAt = restore-now + cycleMs`).
- `ProductionSystem.offlineParity.test.ts` — 3 sites pass an explicit `restoreNowMs` in the fixture frame (the seeded lanes' began-times precede the restore instant, matching real saves where `startedAtMs <= lastSavedAt`).

## Verification

- `npm run type-check`: clean.
- Scoped `npx vitest run --pool=threads` (services/save, services/cloudSave, services/session, core/production, core/alchemy, core/tribulation, composables): 111 files / 1567 tests green (includes 42 r26 probe tests, all flipped to the new contract).
- P18 OCR: see gate output below.

## Wave state

r26 closes the wedge at the SOURCE: post-dated persisted stamps can no longer survive restore, and the refuse envelope now reaches the recovery surface it was designed for. Remaining residuals are cursor-channel parks (self-harm, bounded) and the equipment-hoard ruling awaiting product decision. Next: wave r27 blind trio at the new tip.
