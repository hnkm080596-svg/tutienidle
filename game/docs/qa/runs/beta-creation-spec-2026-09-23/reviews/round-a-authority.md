# REV-A-AUTHORITY — sealed review (spec/plan @44abadfb) — verdict FINDINGS

Session: devin-cfccc238e95f4d4ea966a7916d6efdc6 | model: swe-2-max | sealed, priorFindingsVisible=NO

## Attestation
priorFindingsVisible: NO — "No prior reviewer/coordinator findings were provided or found in the repo (no run dir for beta-creation-spec-2026-09-23 exists at this commit)."
access: full read — cloned repo, checked out 44abadfb, read both targets in full, verified every cited surface on disk.

## Findings
- REV-A-01 (Medium) Census incomplete: creation-allocation contract has 4 consumer surfaces missing from spec §1/plan Step 0.
  CHARACTER_CREATION_ATTRIBUTE_POINTS 'exists only for creation allocation' is false: (a) PerfectionEconomy.ts:25 imports it; mortalStatBudget uses it (:102 available = POINTS + breakthroughPoints, :111 creationPoints) — creation allocation is a term in the mortal-perfection feasibility budget model; (b) PerfectionEconomy.test.ts:133 asserts measuredDeficit === mortalStatBudget().shortfall; (c) TWO MEASUREMENT_PROFILE literals carry attributes:{strength:2,vitality:3} — PerfectionEconomy.ts:32-35 + EssenceSubstitutionEconomy.ts:48-51 — absent from §1h's fixture list; (d) GameManagerSaveRestore.boundary.test.ts:1019-1045 pins 'absent = tram default' — the exact case v82 flips, not in §1h. Stale: GameManager.theTuAnE2E.test.ts:330 title 'creation-granted tram'. Consequence: plan strands these at type-check and forces an unplanned semantic decision mid-impl (how mortalStatBudget re-derives; deficit identity re-baseline).
- REV-A-02 (Medium) Client RPC diff written unconditionally while server-side create_character ownership unresolved (Q-D).
  Spec D6/plan Step 1 drops p_attributes and sends p_mortal_basic_skill_id "confirmed at impl time". Client shipping the new body against a server function still requiring p_attributes fails at RPC time → cloud creation path hard-down while local/mock works. Deploy-order dependency must be resolved/documented.

## Attacks (all PASS)
single-writer integrity (exactly one write :652 + one delete :315); write-order feasibility (op's has() guard unsatisfiable pre-boot — D2 placement correct, first save already v82-valid); seam forking (EarlyGameSession runs identical seams; plan extends same seam, App.vue delegates — closes verified P6-M1 drift); duplicated-truth (draft membership vs op learned-check vs preflight serialization — single set); save-version layering (bump in saveVersion.ts, contract in preflightSaveRegistryReferences; realmId==='mortal' ⇔ cultivationPath===undefined verified equivalent via Player.ts:108-112 + ritual atomicity); scope-creep (D7 fences hold); three-option set ('tram' IS 'Huy Kiếm', option set === MORTAL_PRECURSOR_SKILL_IDS); consumer-survival (produced REV-A-01); transaction semantics (pendingPick threading safe: bootGame(true) only from onCharacterCreated; newCharacterGrantsApplied+hardReset cover retry).

## Gaps
Could not verify server side of create_character (function source not in repo) — Q-D dependency noted in REV-A-02. Did not exhaustively re-read all 15 e2e specs for direct attribute assertions. Pre-existing nit (not in scope): bootstrap learns literal ['tram','linh_bao','huy_quyen'] rather than iterating MORTAL_PRECURSOR_SKILL_IDS — if set grows, seam silently under-learns.
