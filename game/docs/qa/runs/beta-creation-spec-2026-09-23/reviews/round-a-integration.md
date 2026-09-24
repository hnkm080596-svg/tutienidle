# REVIEW_RESULT — REV-A-INTEGRATION (beta-creation-spec-2026-09-23)

- reviewerSession: devin-e26dd567e2e54cbdadbe51715e17590c (fresh child, sealed)
- requestId: req-roundA-integration
- phase: INTEGRATION / BLAST RADIUS
- priorFindingsVisible: NO (verified — did not read game/docs/qa/*)
- verdict: FINDINGS (9)
- reviewedState: productStateId c7159ec3 @ docsCommit 44abadfb
- access: PASS — cloned + checked out 44abadfb; read both docs in full; code as truth oracle; read-only, no commits

## Findings

1. **INT-A-1 (High)** — v82 mortal-required preflight invalidates ~24 test files / ~100+ restore fixtures the plan never enumerates. `baseSave()` (boundary.test:50-69, skills:[]), `createIncomingSave()` (bootRestore:24-26), `validSave()`, `createDefaultPlayer()` call sites (saveLoadRoundTrip, conformance, r81qa) + ~20 more consumers + sim journeys. Spec §1h lists only 3 files — the fixture sweep is unscoped.
2. **INT-A-2 (High)** — `create_character` server function lives IN this repo (`supabase/migrations/202608240001_online_auth_character.sql:139-167`) and is outside the plan's edit map: `p_attributes` validated sum=5, `base_attributes` NOT NULL, signature-scoped grants; `create or replace` leaves the old overload callable unless dropped.
3. **INT-A-3 (High)** — production sim modules consuming the removed allocation data missing from census: `PerfectionEconomy.ts:25,32-36,102,111` + `EssenceSubstitutionEconomy.ts:32,48-51` (compile break + semantic drift of `creationPoints`/`available`/`shortfall`).
4. **INT-A-4 (Medium)** — profile conversion is not value-neutral: sim profiles lose 5 stat points; pinned journey margins may flip; no re-pin rule stated (MortalChapterJourney:48,54,:66,:91-96; TrucCoJourney; economy verdicts).
5. **INT-A-5 (Low)** — `boot-fresh.spec.ts:29` asserts `Bước 1 / 3` stepper text — misclassified "likely unchanged"; dies with the stepper.
6. **INT-A-6 (Low)** — e2e helper rewrite underspecified: stepper-navigation testids `creation-continue-name`/`creation-confirm-talent` (helpers.ts:41,48) also die.
7. **INT-A-7 (Low)** — i18n reshape underspecified + spec↔plan key inconsistency (`skillStep` = kicker,title,selected vs plan's hint); footer copy (finish/creating/summary*/rechoose*) has no named home — parity test can't catch missing copy.
8. **INT-A-8 (Low)** — doc-surface census gaps: `m-f-journey-spec.md:100` quotes PINNED profile verbatim; `superpowers/plans/2026-09-23-early-progression-loop-closure.md:63,210`; `p7/ui-inventory.md`; `ui-components.md` stepper description.
9. **INT-A-9 (Low)** — `saveShapeValidation.test.ts:2309` absent-case update instruction is mis-layered: file's own :2260 comment says shape layer stays pick-agnostic; the absent→reject flip belongs in `boundary.test.ts` (also missing from §1h).

## Attacks (summary)

(a) consumer-of-removed-data sweep — found the two economy modules + migration; all other cited consumers verified. (b) combination flows create→save→reload→ritual→post-path traced end-to-end; loop coherent; edge cases (dirty-transaction retry, hand-edited saves, remote {} p_initial_save) probed. (c) fixture strategy answered: NO, does not cover every mortal-save test. (d) i18n locales verified key-for-key; TurnSkillDisplayMeta consumers enumerated. (e) out-of-scope audit — D7 items verified genuinely load-bearing-free.

## Gaps

Static review only; INT-A-4's stat-drift is inferred risk not measured; deployed Supabase function version unverifiable from repo; Q-A open ruling materially changes blast radius if coordinator rules pick-only; per-file restore-fixture enumeration is a lower bound.
