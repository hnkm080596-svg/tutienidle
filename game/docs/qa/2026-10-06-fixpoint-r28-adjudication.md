# Fixpoint adjudication — wave r28

- Date: 2026-10-06
- Audited commit: `1582467f` (r26 + r27 batches)
- Auditors: COR (`079dffba`, PASS WITH EVIDENCE). AUT (`0d8d6bb0`) / INT (`ba234422`) — running; this document will be amended when they report.

## Tally (COR so far)

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

## Verification

- `npm run type-check` — clean.
- `npx vitest run --pool=threads src/services/save src/services/cloudSave src/services/session src/core/production src/core/alchemy src/core/tribulation src/composables` — **1636 pass** (15 r28 COR probes green after flips).
- OCR gate: 100% reviewable-file coverage on the batch diff.
