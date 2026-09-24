# Closure audit — Round-B sealed-review findings vs repairs

Producer: coordinator (devin-4df500e190cc4b9d837f408a5ed53852), NON_INDEPENDENT CLOSURE review
over repairs authored in e6ec09ba (contract findings) and 2d5349a6 (correctness findings) —
different context from the finding contexts; repair code reviewed against the sealed review texts.

## REV-B-CONTRACT findings (sealed on 92b4ebaa; artifact reviews/round-b-contract.md)

- F1-P15-ASCII-GATE (Medium, REAL_DEFECT): contract test comments carried `—`/`↔`. Repair: ASCII-only rewrite in e6ec09ba. Verification: asciiComments.test.ts PASS on head. Sibling search: full diff scanned for new non-ASCII comment tokens; remaining hits are baselined em-dashes and Vietnamese string data — gate itself is the arbiter and is green.
- F2-RPC-INPLACE-MIGRATION (Medium, REAL_DEFECT): in-place edit left already-migrated DBs without forward path. Repair: NEW forward migration 202609240001_beta_creation_character_pick.sql adds column-if-missing, backfills 'tram', drops v81 overload by identity args, recreates 7-param function, re-grants. Verification: file inspected + contract test pins the same signature. Sibling search: only 2 migration files touched in the diff — the in-place edit plus this forward path; no other live-migration left unrepaired. NOTE: the in-place edit to 202608240001 was also NOT reverted — both paths now converge to the same shape (forward migration is the fix for already-migrated DBs; in-place edit keeps fresh-apply shape consistent). 
- F3-STALE-ALLOCATION-DOC (Low, DOCUMENTATION_DEFECT): plan doc updated in e6ec09ba — no `5-point/allocat*` residue. Sibling: spec §48/§1c2 allocation references are intentional (as-was census table + untouched economy budget). 
- F4-DUP-ASSERT (Nit, TEST_DEFECT): duplicate expect removed in e6ec09ba (:1151 area).
- F5-STALE-BASELINE-ENTRY (Nit, TEST_DEFECT): asciiComments.json baseline entry removed; gate green.

## REV-B-CORRECTNESS findings (sealed on 92b4ebaa; artifact reviews/round-b-correctness.{md,json})

- COR-B1 (Low, REAL_DEFECT): bootstrapEarlyGamePlayer discarded learnSkill returns for non-picked precursors → silent missing hidden-way gate. Repair in 2d5349a6: fail-closed `MORTAL_PRECURSOR_SKILL_IDS` loop throws `bootstrap: precursor learn failed`. Verification: mortalBasicSkill.test.ts PASS incl. fail-closed case. Sibling search: other unchecked learnSkill calls — App.vue onRestoreOk legacy-save repair learns + RealmAdvanceOps way-grant learns are idempotent repair/grant seams with different contracts (out of this diff; pre-existing semantics recorded, not new defects of this change).
- COR-B2 (Low, REAL_DEFECT): preflight mortal predicate keyed on cultivationPath===undefined → crafted non-mortal+no-path save could pass. Repair: `isMortalSave = realmId==='mortal' && cultivationPath===undefined` + fixtures keyed coherently. Verification: boundary test PASS (extended +21 lines incl. crafted-save case). Sibling: saveShapeValidation.ts:679,700 + fixture :28/:57 predicates are consistent (realmId-keyed or deliberate shape-layer semantics).
- COR-N1 (Nit, TEST_DEFECT/hardening): creating-latch could stick on a throwing createCharacter. Repair: try/finally resets `creating` when `error` set. Verification: screen test PASS + type-check clean.

## Pre-existing items (recorded by reviewers, not defects of this diff)

- F-IMPL-PRE-1: SettingsPanel + dongFu asset test failures — identical on base 6d9af7a9 (verified in isolated worktree) → REJECTED_WITH_PROOF as out-of-diff.
- F-IMPL-PRE-2: rollId invalid-consumed soft-lock + p_roll_id reroll race — v81 shape unchanged by this diff; fail-closed outcomes → REJECTED_WITH_PROOF (pre-existing remote seam behavior, unchanged).

All 8 Round-B findings verified CLOSED on head 2d5349a6.
