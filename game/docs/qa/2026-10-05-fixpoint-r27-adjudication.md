# Fixpoint adjudication — wave r27

- Date: 2026-10-05/06
- Audited commits: `a9a9c37c` (COR, wave start), `7bea330a` (AUT/INT, tip after the r27-COR batch)
- Auditors: COR (`dc7333fe`, FAIL) / AUT (`c39228ee`, FAIL) / INT (`92ca3e5b`, PASS WITH EVIDENCE)

## Tally

| Finding | Severity | Verdict | Disposition |
| --- | --- | --- | --- |
| R27-COR-1 finite-low `authorityNowMs` re-anchors honest stamps into 1970 → live-tick instant grants | High | Confirmed real, regression introduced by r26 | **FIXED** |
| R27-COR-2 `verifyAlchemyJobReservation` throws on reservation missing `specialIngredients` → escapes armed SAVE_INVALID envelope | Medium | Confirmed (root cause pre-existing; r26 interaction) | **FIXED** |
| R27-COR-3 `player.talentLevels` uncapped `Record<string,number>` | Low | Confirmed | **FIXED** |
| R27-COR-4 skewed-honest began-pairs under server `until` pay up to skew early | Low | Confirmed, inherent bound of the re-anchor | **Accepted residual** |
| R27-005 `restoreJobs` fabricates `{specialIngredients: []}` on witnessless jobs | Nit | Confirmed, pre-existing (present at 3588ebf9) | Accepted residual (deny-equivalent) |
| R27-006 `learnedSkillIds` cap shares generic issue text | Nit | Confirmed | **FIXED** |
| R27-AUT-1 `specialIngredients` array containing null/undefined ELEMENTS still throws TypeError through the gate → remote-load unhandled rejection wedges boot loading permanently; local slot misclassifies 'unavailable'; driveSave escapes DATA_REFUSE; import/recovery throw silently | High | Confirmed (element-class bypass of the COR-2 gate) | **FIXED** |
| R27-AUT-2 `.map` over unvalidated collections inside restore seams throws on ungated callers (contained by upstream 'rejected') | Nit | Confirmed, defense-in-depth | **FIXED** (same clone-arm repair as INT-Low) |
| R27-INT-Low `restoreJobs` clone arm throws on `specialIngredients:{}` for ungated callers (gate names the shape cleanly — ungated path diverged) | Low | Confirmed | **FIXED** |
| INT-Nit cap-reporting asymmetry: over-cap arrays walk entries AND emit the cap issue; over-cap maps emit cap only | Nit | Confirmed, message-layer only | Accepted (no behavioral difference — refuse either way) |
| INT-Nit `decompose.nextCycleAt` has no vs-marker admission pin (tribulation.cooldownUntil does) | Nit | Confirmed, sibling asymmetry | Accepted residual — same class as cursor-channel far-future stamps: parks own channel, deny-direction |
| INT-Nit dead `!Array.isArray` arm in the post-digest specials compare | Nit | Confirmed | **FIXED** (removed) |
| INT-Nit decompose restore merges (max(live, restored)) while siblings replace | Nit | Confirmed, bounded ≤30s deny-direction | Accepted |
| INT-Nit `saveIssue.report` re-overwrites the store per wedged autosave | Nit | Confirmed, idempotent | Accepted |

## R27-COR-1 — restoreClock no longer takes authority input (High → FIXED)

**Claim verified.** `restoreClockMs = Math.min(restoreAuthorityNowMs(authority), Date.now())`
bounds only the high side; a formally-valid corrupt-LOW stamp (epoch-seconds
`serverTimeUtc` ~1.7e9) passed `sanitizeRestoreAuthority` and re-anchored every
honest began-pair (~1.7e12) into 1970. The first live tick then completed every
in-flight lane head, minted reserved pills (re-derived digest replays),
evaporated the tribulation cooldown, and fired the pending decompose cycle —
through the tick path, so the offline cap never even ran. Deny turned into grant:
the exact inversion the codebase defends everywhere else.

**Fix.** `GameManagerSaveRestore.ts`: authority removed from the formula entirely.
The restore clock is now `Math.min(save.player.lastSavedAt, Date.now())` — the
save's own epoch bounded by device-now:

- Corrupt-LOW authority → only denies the accrual window (`settleNowMs` still
  collapses to the stamp); in-flight deadlines restore verbatim, no grant.
- Corrupt-HIGH authority → previously clamped by `Date.now()`; unchanged.
- Post-dated stamps (impossible-authored vs. `lastSavedAt` or vs. device-now)
  still shift to `restoreClockMs + span` — the r26 self-heal is preserved.

Four call sites pass the same `restoreClockMs` (production :374, decompose :391,
alchemy :519, tribulation :551).

**Probe flips** (`auditR27Cor.probe.test.ts`): F1–F5 now go through
`saveOps.restoreFromSave` with `{kind:'cold-boot', untilMs:1_700_000_000}` and
assert every channel restores verbatim + the first tick pays nothing early.
F6/F7 re-documented for the marker-based bound.

## R27-COR-2 — shape check precedes digest fold (Medium → FIXED)

**Claim verified.** `alchemyJobReservationDigest` folds
`reservation.specialIngredients.map(...)` before `verify` checked
`Array.isArray`; the TypeError escaped `validateGameSaveShape`, and driveSave's
`.catch(adapterThrow)` converted it to a codeless `SAVE_ADAPTER_THROW` →
`authorityStateForError(undefined)` → `'reconnecting'` churn, bypassing the
armed `SAVE_INVALID → 'recovery'` arm.

**Fix.** `AlchemySystem.ts:verifyAlchemyJobReservation` —
`if (!Array.isArray(witness.specialIngredients)) return 'specialIngredients'`
before the digest fold. Malformed witness is now a validation issue; the refuse
lands on the coded envelope. Probe G1 flipped to `toBe('specialIngredients')`;
G2 now asserts the coded `OUTGOING_ADMISSION_REJECTED` envelope end-to-end
through `CloudSaveCoordinator.save`.

## R27-COR-3 — talentLevels capped at the root (Low → FIXED)

`saveShapeValidation.ts`: `Object.keys(talentLevels).length > ID_COLLECTION_CAP`
refuses at the collection root before the per-entry walk — last uncapped
`Record<string,number>` sibling now uniform with the r26 sweep. Probe C2 flipped
to assert the cap issue + no per-entry walk; `auditR26Int.probe.test.ts`
talentLevels case updated (2000-entry → root cap; ≤cap unowned ids → ownership
pin still fires).

## R27-006 — learnedSkillIds cap message (Nit → FIXED)

`saveShapeValidation.ts`: the three arms now emit distinct messages —
'phải là mảng string' (non-array), the `ID_COLLECTION_CAP` text (count),
'phải là mảng string' retained for non-string entries. The C1 probe's
`messageMayDiffer` special-case removed.

## Accepted residuals

- **R27-COR-4** (skewed-honest over-fire, bounded by skew): inherent to the
  re-anchor premise — `lastSavedAt > device-now` cannot be distinguished from a
  crafted `+Delta` marker. Deny-side alternative (park deadlines till the
  marker) re-opens the r26 self-brick class. Bound = skew, one payment, live
  tick. Pin F6 documents it.
- **R27-005** (phantom `{specialIngredients: []}` on witnessless jobs):
  pre-existing at 3588ebf9; deny-equivalent (settle fails on `costScale`);
  not a finding against this batch — recorded so the diff isn't blamed.

## R27-AUT-1 — element-class bypass + validator now fail-closed (High → FIXED)

**Claim verified.** The COR-2 gate checked `Array.isArray` only; a crafted
`specialIngredients: [null]` (or `[undefined]` — which survives the wire as
`[null]`) reached `alchemyJobReservationDigest`'s
`.map(s => s.materialId)` and threw TypeError through
`validateGameSaveShape`. All six call sites were unguarded, so the throw
propagated: remote load + pending-journal → unhandled rejection wedging
boot loading (`coordinator.load()` was the one arm the batch's own
comment warned about but never wrapped); local slot → blanket-catch
'unavailable' with no recovery surface, re-wedging every boot; driveSave
→ codeless `SAVE_ADAPTER_THROW` escaping `DATA_REFUSE_CODES`;
`importSaveRaw`/`validateRecoveryData` → silent throw inside the
FileReader onload.

**Fix — three layers:**
1. `verifyAlchemyJobReservation`: every element must be a
   `{materialId:string, amount:finite}` object BEFORE the digest fold —
   a malformed element reports 'specialIngredients' like every other
   malformed field.
2. `validateGameSaveShape` is now **fail-closed at the boundary**: the
   checked body moved to `validateGameSaveShapeChecked` and the exported
   function catches any internal throw into a refused verdict
   (`issues:[internal]`). The whole class — any field check that throws
   on an unverified shape, now or in future — lands on 'corrupted' /
   coded-refuse at every one of the six call sites instead of an
   unhandled rejection. (The validator has no deliberate throws; no test
   asserts one.)
3. `restoreJobs` clone arm: `Array.isArray(job.reservation?.specialIngredients)
   ? map : []` — the restore seam tolerates a non-array specials field on
   ungated callers (INT-Low / AUT-2, same repair). The dead `!Array.isArray`
   arm in the post-digest compare removed (INT nit).

**Probe flips** (`auditR27Aut.probe.test.ts`): A2–A4 now assert the
refused verdict + specials issue; B1 asserts the coded
`OUTGOING_ADMISSION_REJECTED`/`SAVE_INVALID` envelope through
`coordinator.save`; B2 asserts `loaded.status === 'corrupted'`
(recovery surface armed); B3/B4 assert `false`/`invalid` without a
throw. `auditR27Int.probe.test.ts` E3 asserts restoreJobs no longer
throws on `{}` specials and normalizes to `[]`.

## Verification

- `npm run type-check` — clean.
- `npx vitest run --pool=threads src/services/save src/services/cloudSave src/services/session src/core/production src/core/alchemy src/core/tribulation src/composables` — **1621 pass** (18 COR + 20 AUT + 16 INT r27 probes green after flips; r26 suite green).
- OCR gate: 100% reviewable-file coverage on the batch diff (see run output below).
