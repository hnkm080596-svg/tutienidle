# REVIEW_RESULT — REV-B-CORRECTNESS (beta-creation-impl-2026-09-23)

- reviewerSession: devin-993f75f9b0bc4f708dd3c38d35309c4a (fresh child, sealed)
- requestId: req-roundB-correctness
- phase: CORRECTNESS
- priorFindingsVisible: YES — `attack-model.json`'s `implReportedItems` (impl/coordinator-reported defect records) were visible inside the sanctioned contract slice and were adjudicated
- verdict: FINDINGS (3)
- reviewedState: impl head 92b4ebaa3417b0c8d8de55a4a56140c65c684363 (productStateId 08c93b6a)
- access: PASS — full read access; own clone on frozen head, base 6d9af7a9; type-check clean; scoped vitest 31 files / 696 tests PASS; /tmp boot-seam repro suite 3/3 PASS
- raw sealed payload: `round-b-correctness.json` (verbatim SEALED_RESULT)

## Findings

1. **COR-B1 (Low)** — `bootstrapEarlyGamePlayer` discards `learnSkill` boolean returns: a failed learn of a non-picked precursor boots silently with 2/3 precursors. EXECUTED repro (`/tmp/reprodir/bootgap.test.ts`, 3/3 pass): with `huy_quyen` template absent, bootstrap completes — pick written, `huy_quyen` silently missing, hidden-way Lv3 gate (`hidden_body_pathway`) lost forever; the save stays legal under the v82 preflight. Fail-open asymmetry vs the pick's fail-closed assert. Repaired in `2d5349a6` (fail-closed precursor learns).
2. **COR-B2 (Low)** — restore preflight "mortal save" predicate keys on `cultivationPath===undefined`, not `realmId==='mortal'`: a crafted non-mortal+no-path save carrying a valid learned precursor pick passes BOTH the shape layer and the registry preflight, restoring an incoherent player; the pick-requirement direction is also logically inverted for that class. Corrupt-save-only; no legal save slips through. Repaired in `2d5349a6` (realmId-keyed `isMortalSave` predicate + coherent fixtures).
3. **COR-N1 (Nit)** — `CharacterCreationScreen.finish()`: `creating` latch would stick true if `createCharacter` ever threw — dead path at review time (both service impls map failures to `ok:false`). Repaired in `2d5349a6` (try/finally latch reset on error).

## Attacks (summary)

(1) Boot-seam ordering: learns all 3 precursors BEFORE `setMortalBasicSkill` inside the single bootGame transaction; pick failure throws fail-closed — HOLD, modulo COR-B1. (2) `pendingCreationPick` lifecycle: `onNewCharacter` consumes once; re-entry hits `newCharacterGrantsApplied`→`hardReset`; impl-reported "module state never cleared" adjudicated NOT a live defect at 92b4ebaa. (3) Restore ordering: shape → preflight-before-mutation verified; all v82 contracts throw; corrupt non-mortal+no-path class = COR-B2. (4) Fixture coherence: `withMortalCreationPick`/`primeMortalCreationPick` write all three channels coherently. (5) Timing/re-entry: ready-gate + creating latch make double submit impossible. (6) Supabase seam: 7-param RPC body, roll FOR UPDATE + consumed/expiry/talent-membership/name checks, fixed 1/1/1/1/1, not-null column, revoke/grant — PRE-EXISTING (recorded not filed): rollId invalid-consumed soft-lock to generic error until manual reroll (v81 same shape); `p_roll_id` read after awaits can race a mid-flight reroll → stale rollId → fail-closed server rejection.

## Gaps

Playwright e2e specs NOT executed (browser-level verification belongs to the integration lens); `pendingCreationPick`→`onNewCharacter` pinned by AST-order + unit evidence rather than DOM runtime. priorFindingsVisible=YES disclosed and adjudicated (see above).
