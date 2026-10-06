# Fixpoint adjudication — wave r28

- Date: 2026-10-06
- Audited commit: `1582467f` (r26 + r27 batches)
- Auditors: COR (`079dffba`, PASS WITH EVIDENCE), INT (`ba234422`, PASS WITH EVIDENCE), AUT (`0d8d6bb0`, PASS WITH EVIDENCE). **Wave complete — 1 Medium + 3 Low + 6 Nit adjudicated.**

## Tally (COR)

| Finding | Severity | Verdict | Disposition |
| --- | --- | --- | --- |
| R28-COR-Low `restoreJobs` shift arm: digest re-derive throws TypeError on a defined-but-malformed reservation (`null`, `{specialIngredients:{}}`, primitives) before the normalize arm can run — same input class, two outcomes across shift vs verbatim arms | Low | Confirmed (ungated callers only; production nets at 'rejected') | **FIXED** |
| R28-COR-Nit over-cap `player.talentLevels` still pays two unconditional `Object.entries` walks downstream (CPS headroom ~:854, entitlement sanitize ~:1038) | Nit | Confirmed, cost-only (verdict already refuses) | **FIXED** |
| R28-COR-Nit timestamp-domain asymmetry: `lastSavedAt` + began-pairs admit negatives (`isBoundedTimestamp`) while deadline fields use the non-negative variant — negative marker → deep-past restoreClock → began-shift unreachable → deep-past completes settle inside authorized window at channel caps | Nit | Confirmed, deny-equivalent (no new grant class) | Accepted residual — same self-harm class as crafted-low markers (r21/r25 rulings) |
| R28-COR-Nit sibling restore seams throw on structurally malformed ungated input (`restoreStates` null/non-array, `decompose.restore` null, `restoreJobs` non-iterable) | Nit | Confirmed, pre-existing class | Accepted — upstream `restoreGameSession` wraps to 'rejected' (the contain-net); seam-by-seam defensiveness is boilerplate with no reachable benefit |

## R28-COR-Low — re-derive arm now skips non-foldable witnesses (FIXED)

**Claim verified.** In `restoreJobs`, the post-dated (shift) arm re-derived
`alchemyJobReservationDigest(shifted, job.reservation)` for every
`reservation !== undefined` — but the fold reads
`reservation.specialIngredients.map`, so a defined-but-malformed witness
(`null`, primitives, `{specialIngredients:{}}`, `[null]` elements) threw
TypeError *before* the r27 normalize arm could run. The same payload on a
non-post-dated job normalized silently — identical input class, two outcomes.

**Fix.** The shift arm only re-derives when the witness is actually
foldable: `reservation` is an object AND `specialIngredients` is an array
of non-null objects. A non-foldable witness keeps its stale digest through
the shift (deny direction — shifted stamps can never match it) and the
normalize arm still tolerates it downstream. Probe A1/A1b flipped to
assert no-throw + normalized specials; A2 retitled (arms now converge).

## R28-COR-Nit — cap guard on the two sibling talentLevels walks (FIXED)

Both downstream `Object.entries(player.talentLevels)` walks (CPS headroom
snapshot, entitlement sanitize) now require
`Object.keys(...) <= ID_COLLECTION_CAP`, matching the root walk — an
over-cap record is already refused, so it no longer pays unbounded
iterations.

## Tally (INT)

| Finding | Severity | Verdict | Disposition |
| --- | --- | --- | --- |
| R28-INT-1 persistPlayer's coded-refuse arm calls `saveIssue.report('corrupted', ..., remoteAuthority ? 'remote' : 'local')` without `bootFlow.fail()`: dead write under `entryStage 'game'` (the card mounts only on the error route), and the armed `corrupted` + `remote` state leaks into later unrelated error mounts — remote reset then offered against a row that provably never received the refused bytes (`saveCalls === 0`). Under local mode: no overlay, no card — one deduped toast only | Medium | Confirmed — provenance inversion + mount-contract violation; every sibling report site pairs `report()` with `fail()` | **FIXED** |
| R28-INT-2 `restoreJobs` shift arm re-derives the digest over the raw reservation before the normalize arm — same input class, opposite verdicts across sibling/intra arms | Low | Same defect class as R28-COR-Low | **Already fixed** by the COR batch (`7601b33f`) |

## R28-INT-1 — refuse escalation now mounts its surface, scoped local (FIXED)

Three-part fix in `App.vue` persistPlayer:

1. **Scope `'local'` always.** These refuse codes (`OUTGOING_ADMISSION_REJECTED` /
   `OUTGOING_UNSERIALIZABLE` → `SAVE_INVALID`) only fire when the adapter was
   never invoked — the refused bytes never left the client, so under remote
   authority the cloud row still holds the last-good commit. Labeling it
   `'remote'` armed `resetCharacter()` against a healthy row (provenance
   inversion — the exact fact pattern the pending-conflict arm scopes `'local'`
   for, useAppLifecycle.ts:426-429).
2. **Paired `bootFlow.fail()`.** `SaveIncompatibleScreen` mounts only under
   `entryStage === 'error'`; a bare `report()` was a dead write whose stale
   armed status could hijack a later non-save `fail()` mount. The refuse is
   deterministic and terminal for the session — the error mount is the correct
   escalation the r26 arm intended (onResume arm documents the rule verbatim).
3. **`saveIssue.clear()` on the ok arm.** An ok write proves the save path
   healthy; any armed status is stale and is swept instead of leaking for the
   page lifetime (previously `clear()` had no production caller).

Probe flips: I1/I2 now assert no-throw + normalized `[]` on every malformed
reservation shape (post-dated or not); I3 now restores `'ok'` through the
session seam with the stale digest still failing the grant-time verify (deny
preserved downstream); M1 asserts `remoteResettable === false`; M2 asserts the
ok arm's clear contract; M3 records all report sites paired.

## Tally (AUT)

| Finding | Severity | Verdict | Disposition |
| --- | --- | --- | --- |
| R28-AUT-1 `restoreJobs` shift arm folds the digest over the raw reservation before the normalize arm — same defect class as R28-COR-Low. Siblings listed: `restoreStates([null])`, `restoreJobs([null])`, `questManager.restore(null)`, `advanceWorkerLanes({pending:[null]})` — null-element throws on ungated feeds | Low | Main item already fixed by the COR batch; siblings = same class as the accepted COR Nit-3 residual (validator refuses every shape before the sole production caller; `restoreGameSession`'s catch degrades any throw to 'rejected' — bounded deny) | **Already fixed** (digest fold) / siblings accepted residual, pinned by F1a/F1b/F1e/F1f |
| R28-AUT-2 `AlchemySystem.tick`/`settleOffline` carries no `Number.isFinite(nowMs)` guard — asymmetric with `advanceWorkerLanes` (r21-COR-2 doctrine). `tick(NaN)`/`tick(1e300)` mints the whole in-flight queue; `tick(-1e300)` parks all | Low | Confirmed (ungated feeds only — validator rejects NaN on every gated path; thin incremental surface since a forged `completesAtMs` already mints on the same feed) | **FIXED** — guard parity: `!Number.isFinite(nowMs) \|\| \|nowMs\| >= 2^53` zero-advances (jobs preserved untouched, deny direction) |
| R28-AUT-3 NaN began-stamps skip every `> restoreNowMs` shift arm verbatim; NaN `cooldownUntil` never persists (`>0` guard) | Nit | Deny-equivalent boundary note | Accepted — covered by the AUT-2 guard class; pins stand |
| R28-AUT-4 pre-existing hygiene: 3 non-ASCII (`Δ`) comments in `auditR25Int.probe.test.ts` trip the P15 gate; ~15 pre-existing TS2307 in `src/ui-preview/` | Nit | Confirmed — `Δ` comments fixed; ui-preview errors pre-existing, out of scope | **`Δ` FIXED** / ui-preview documented (not the delta) |
| R28-AUT-5 quest `progress`/`claimed` unbounded vs authored goal — mints only the authored reward | Nit | Same-value residual class | Accepted residual |

## Verification

- `npm run type-check` — clean.
- `npx vitest run --pool=threads src/core/alchemy src/services/save src/services/cloudSave src/services/session src/App.routeMountWitness.test.ts src/composables src/stores tests/architecture/asciiComments.test.ts` — **1585 pass** (15 COR + 10 INT + 22 AUT r28 probes green after flips; P15 gate clean).
- OCR gate: 100% reviewable-file coverage on the batch diffs (commits `7601b33f`, `80e8b5bd`, and this batch).
