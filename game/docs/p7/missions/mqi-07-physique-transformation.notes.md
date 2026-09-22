# M-QI-07 — Physique Transformation Authority — implementation notes

Spec `mqi-07-physique-transformation.spec.md` v4 (`MQI07_SPEC_REVIEWED`, round 4). Implements QI-D4/D4b/D4d/QI-S: persisted `player.physiqueGrade` (default `pham`), the 6/6 `body_refinement`-completion one-rung transform (`pham -> bao`), the 10-rung ladder catalog, save v74 + exact-derived-grade coherence at the semantic preflight, and the BodyRefinementSection display line. No stat bonuses; no migration — incompatible versions rejected.

## Gate evidence

- TDD: 17 failing tests across 6 files (ladder, physique system, ops seam, save/restore coherence, section UI, authored-integrity) -> all green after implementation.
- P3 full: `npm run verify` — type-check + build + full vitest green. Original run: 737 files / 6576 passed / 4 expected-fail; re-run after the round-1 review fixes: 737 files / 6579 passed / 4 expected-fail.
- P15 ASCII: green (2 non-ASCII comments reworded; later P15 re-run after review fixes also green).
- P13/P14 (worktree dev server :5740, live tick): fresh char renders `Phàm Thể`; seeded `5/6 + 26000/26300 + 1000 essence` save -> reload -> live tick auto-invest completes 6/6 -> DOM flips to `Bảo Thể` -> post-save `physiqueGrade === 'bao'`; zero browser errors. Probe spec deleted after capture per convention.
- P18 OCR (Delegation Mode): 29/29 reviewable files reviewed, 0 skipped (2 spec/plan docs excluded — already C2C-reviewed). No Medium+.
- P4 adversarial QA — deep audit (mandatory escalation: save boundary + 3 domains): PASS WITH EVIDENCE — `docs/qa/2026-09-23-mqi-07-physique-transformation-deep.md`. 12-row invariant ledger all resolved; 1 QA test added (mounted-section mid-session flip). Deep-audit e2e slice (save-reload + boot-fresh + cultivation-path-ritual six-way matrix) 9/9 under v74.
- P5 sequential passes: 4 passes, 0 unresolved Medium+ (chronology below).
- External review: round 1 BLOCKED (1M + 2L + 3 nits) — all resolved in this state; see "External review round 1" below.

## P5 — Sequential Multi-Pass Review

### Sequential Review Pass 1 — Local Correctness / Regression
- Reviewed state: post-OCR + post-QA staged state (incl. the QA-added mid-session flip test).
- Findings: none Medium+. Verified: `investBodyChapterState` ordering — source-grade gate before any mutation (returns 0, no consumption), write only after `consumed > 0` + `isComplete` + exact `from` match, chapter effect rebuilt once after mutation; re-invest on a complete chapter is a no-op; fixture coherence sweep (`'bao'` iff 6/6, `'pham'` otherwise — 12 production-truth sites + 5 store literals); derive on field-malformed slices is comparison-safe (`'x' >= 6` -> false -> derived `'pham'`, no throw); meridian path untouched.
- Missed here, later caught by external review (round-1 L1): a missing `body_refinement` slice inside a present `bodyProgression` object reached `derivePhysiqueGrade` and threw a raw TypeError instead of the aggregated integrity error. Recorded honestly — fixed and re-verified in review round 1 (Pass 4).
- Fixes: none during the pass.
- Verification: focused suites green (RealmBodySections 16/16; physique / boundary / saveShape / round-trip files green); type-check clean.

### Sequential Review Pass 2 — Architecture / Authority / Ownership
- Reviewed state after Pass 1 fixes: YES (no fixes — same state).
- Findings: none Medium+. Verified: single writer — `investBodyChapterState` is the only production `physiqueGrade` assignment (grep-verified across `src/`); single semantics oracle — `derivePhysiqueGrade`; layering split correct — shape boundary uses `isPhysiqueGradeId` (membership), semantic preflight uses derived equality; dependency direction `core/realm/body -> data/realm` matches the `BodyRefinement.ts` convention; `PhysiqueAdvancement` on the chapter contract matches the chapter-owns-state / system-owns-transaction split; `PlayerData` is the single persisted home — no second copy, no derivation cache.
- Fixes: none.
- Verification: type-check + focused suites green.

### Sequential Review Pass 3 — Adversarial Integration
- Reviewed state after Pass 2 fixes: YES (no fixes — same state).
- Findings: none Medium+. Probed: invest callers — `realmAdvanceOps` debits only on `consumed > 0` so a gated 0-return cannot over-debit; `tickOps` re-entry post-completion returns 0 (no rebuild spam); `computeRestoreIdentity` covers the new field via the whole-player hash; `allowedPlayerKeys` whitelist picks up `physiqueGrade` via `createDefaultPlayer` (boundary test asserts `'bao'` survives store restore); physique check rides the last preflight before owner mutation; e2e seeds all spread real saves (no surgery needed); a field-malformed-but-present slice can never fabricate an ahead-grade (derive reads `isComplete`, which fails closed).
- Fixes: none.
- Verification: full suite green; deep-audit e2e slice 9/9.

### Sequential Review Pass 4 — Round-1 review-fix state
- Reviewed state after Pass 3: CHANGED — external review round 1 produced one Low code fix (L1 derivation guard + missing-slice boundary test), one Low doc fix, and two nit fixes. This pass reviews the resulting state.
- Findings: none Medium+. Verified: `derivationBlocked` is set exactly on missing advancement-owning slices; a missing non-owning slice (meridian) still aggregates its issue without blocking derivation of the (correctly `pham`-derived) grade — both paths now fail through the canonical aggregated error; `PHYSIQUE_GRADES` now satisfies `readonly PhysiqueGradeDefinition[]` (union is the explicit source; satisfies + the ladder test's exact 10-id order assertion guard both directions); new missing-`body_refinement` boundary case sits beside the missing-meridian sibling and asserts `/BodyProgression integrity/i` + zero-mutation.
- Fixes: none.
- Verification: `npm run type-check` clean; boundary suite green incl. the new case; focused physique set green.

## External review round 1 — resolutions

- M1 (Medium): P5 chronological evidence missing -> this notes file records the actual passes; Pass 4 added over the review-fix state.
- L1 (Low): missing `body_refinement` slice could throw a raw TypeError past the aggregated error -> `derivationBlocked` guard; new boundary case.
- L2 (Low): spec/plan status lines + mission-graph `migration` wording stale -> synchronized (`MQI07_SPEC_REVIEWED, round 4`; "no migration — old save versions rejected").
- Nit: outbox staged-index metadata corrected (32 files, +1169/-3).
- Nit: QA report INV-PHY-7 "8/8" -> `MERIDIANS.length` wording.
- Nit: `PHYSIQUE_GRADES` satisfies tightened to `readonly PhysiqueGradeDefinition[]`.
