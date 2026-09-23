# M-F-CHU-THIEN — Trúc Cơ Chu Thiên Body Chapter — plan

Spec: `game/docs/specs/m-f-chu-thien-spec.md` (v1 — pending C2C spec
review). Implements the `zhou_tian` chapter kind: realm-bounded
circulation (20 × TC realmLevel, Tiểu 180 / Đại 360 = normal
completion), authored sequential unlock, Pháp-essence invest through
the M-QI-09 seam, state slice + UI row + save v77. Scope limits per
ruling: mechanism only (no invest costs/per-invest amounts/stat
values), no content beyond the chapter, reuse the Body panel row
pattern (M-UI-SYSTEM owns theme).

Phase 1 delivered docs only; Phase 2 begins after C2C spec + plan
gates pass.

## Step 0 — seam census (done during spec)

- `core/realm/body/BodyChapter.ts`: `BodyChapterId` union (:39) gains
  `'zhou_tian'`; `BODY_CHAPTER_KINDS` (:44) already declares it;
  `EXPECTED_BODY_CHAPTER_KIND` (:59-64) gains the pin;
  `BodyChapterShared` (:118-155) gains optional
  `unlocksAfterChapters`; `BodyProgressionState` +
  `createDefaultBodyProgression` (:183-190) gain the slice;
  `BODY_CHAPTERS` (:195-198) appends (iteration order IS canonical
  order, :192); `validateBodyChapterRegistry` (:208-331) gains
  backward-only prereq-ref validation; `BODY_CHAPTER_BY_ID` (:365-368).
- `core/realm/body/BodyProgressionSystem.ts`: `investBodyChapterState`
  (:131-152) gains the sequential gate before the physique gate; new
  exported `isBodyChapterUnlocked(player, chapterId)` read.
- `core/realm/body/MeridianChapter.ts`: definition gains
  `unlocksAfterChapters: ['body_refinement']` (C2C-59 HIGH — chain is
  system-wide). EXPECTED TEST CHURN: existing meridian invest tests /
  fixtures that never completed body_refinement now hit the gate —
  update fixtures to satisfy the prereq (tests only, never weaken the
  assertions).
  `applyAllBodyModifiers` (:158), `collectBodyBaseStatDeltas` (:170),
  `assertBodyProgressionIntegrity` (:222-271),
  `validateBodyProgressionPersistedState` are registry-generic — no
  edits, they pick the chapter up automatically.
- `core/game/GameManagerRealmAdvanceOps.ts:518-598`: `investBodyChapter`
  is chapter-agnostic (essence spec sec.2 — JSON probe, coverage,
  `planEssenceSubstitution`, bag debit, commit). ZERO edits; the id
  union extension is the only requirement.
- `data/realm/PhysiqueEssence.ts`: `tinh_hoa_phap_the` =
  `foundation_establishment: 'phap'` band (:53-59), coverage-0 top rung
  — exact debit only.
- `components/panels/realm/`: `MeridianSection.vue` (manual invest
  pattern, :102 invest call) + `BodyRefinementSection.vue` (summary +
  bar + Eyebrow) are the row templates; `RealmPanel.vue` mounts a
  third `.realm-panel__body` col.
- `services/save/saveVersion.ts`: `CURRENT_SAVE_VERSION` +1 above
  the merged-base value at impl start (C2C-59 rule) + changelog
  comment. `saveShapeValidation.ts:729` delegates to
  `validateBodyProgressionPersistedState` — auto-covered.
  `GameManagerSaveRestore.ts:291` `assertBodyProgressionIntegrity`
  preflight — auto-covered.
- `GameManager.ts:916` tick auto-invest — NOT touched (spec sec.1).
- i18n: `panels.realm.*` keys in `src/locales/{en,vi}.json` (~:500-545);
  `tests/architecture/i18nKeyParity.test.ts` guards parity.

## Step 1 — TDD failing tests first

1. `BodyChapter.test.ts` (extend): `BodyChapterId`/`BODY_CHAPTERS`
   include `zhou_tian` LAST in canonical order; `EXPECTED_...` pin;
   `createDefaultBodyProgression` carries `{ zhou_tian: { circulation:
   0 } }`; completeness check accepts 3 slices; registry validation
   rejects a chapter whose `unlocksAfterChapters` refs a self, a
   forward chapter, or an unknown id (synthetic-catalog convention,
   :109-132 already fabricates zhou_tian fixtures).
2. `ZhouTianChapter.test.ts` (new): capacity 0 (mortal/LQ), 20×level in
   TC (L1→20, L9→180, L18→360), 360 post-TC; Tiểu/Đại reads at the
   179/180/359/360 boundaries; `isComplete` iff 360; invest clamps at
   capacity, consumes ≤ available, idempotent at capacity and at
   completion; `integrityIssues` on >360, >capacity, non-integer,
   negative; `validatePersistedState` on missing/non-object/bad-type
   slice (also through `validateBodyProgressionPersistedState`);
   `progress()` shape; `collectBaseStatDeltas` `{}`;
   `scrubLegacyModifiers` removes only `zhou-tian:` ids.
3. `BodyProgressionSystem.test.ts` (extend or adjacent suite):
   sequential gate on the REAL registry — BOTH rejections pinned
   (C2C-59): meridian invest returns 0 while body_refinement
   incomplete; zhou_tian invest returns 0 while meridian incomplete;
   full chain satisfied → invests; `isBodyChapterUnlocked` mirrors;
   assert net behavior, not gate ordering.
4. `GameManager.bodyChapter.test.ts` /
   `GameManager.essenceSubstitution.test.ts` (extend — the ops seam
   surface): SEAM-CONTRACT test on the real chapter — exercises
   whichever currency `ZHOU_TIAN_CURRENCY_MATERIAL_ID` declares
   (C2C-59: read the constant, never a literal; mechanism is the
   mission). With the current Pháp assignment: exact debit
   (coverage 0, no substitution even when lower bands owned);
   under-owned → consumes owned only; zero owned → 0 + no debit;
   locked → 0 + no debit; preflight path unchanged.
5. `RealmBodySections.test.ts` (extend — jsdom mountSection harness):
   sequential-locked render names the incomplete prerequisite;
   realm-locked render pre-TC; active render shows capacity bar +
   Tiểu/Đại markers; complete render at 360; invest click → ops seam
   → `bumpState` (mirror MeridianSection's pinned interaction);
   disabled states (locked / full / no essence owned).
6. Save-boundary pin (the BodyChapter.test.ts persisted suite or
   `saveShapeValidation.test.ts`, matching where meridian's is):
   a payload shaped for the pre-mission version (missing
   `zhou_tian`) rejects at `player.bodyProgression.zhou_tian`.

## Step 2 — authored data + contract/registry edits

- `data/realm/ZhouTian.ts` (new): the constants per spec sec.2 —
  `ZHOU_TIAN_CURRENCY_MATERIAL_ID` marked DEFERRED placeholder
  (QI-D8 comment convention).
- `BodyChapter.ts`: id union, `EXPECTED_BODY_CHAPTER_KIND` pin,
  `unlocksAfterChapters` optional field (docstring: backward-only,
  canonical order is the authority), `BodyProgressionState` + default
  slice, `BODY_CHAPTERS` append, `validateBodyChapterRegistry` prereq
  validation, `BODY_CHAPTER_BY_ID`.
- `MeridianChapter.ts`: gains `unlocksAfterChapters:
  ['body_refinement']` — the only existing chapter whose authored
  behavior changes (coordinator-pinned).

## Step 3 — chapter definition + system gate

- `ZhouTianChapter.ts` (new): `ZhouTianChapterState`,
  `getZhouTianCapacity`, `isTieuChuThienReached`,
  `isDaiChuThienReached`, the `BaseStatBodyChapter` definition —
  `id/chapterKind 'zhou_tian'`, currency =
  `ZHOU_TIAN_CURRENCY_MATERIAL_ID`,
  `unlocksAfterChapters: ['meridian']` (C2C-59 — immediate
  predecessor; transitivity covers body_refinement), invest
  (clamped), `collectBaseStatDeltas → {}`, `legacyModifierPrefix
  'zhou-tian:'`, progress/isComplete/persisted validation/integrity.
- `BodyProgressionSystem.ts`: sequential gate in
  `investBodyChapterState` + exported `isBodyChapterUnlocked`.

## Step 4 — UI section + i18n

- `ZhouTianSection.vue` (new) per spec sec.7 — mirrors the meridian
  section skeleton (Eyebrow + summary + Bar + invest row); lock
  states via `isBodyChapterUnlocked` + `getZhouTianCapacity`; invest
  calls `realmAdvanceOps.investBodyChapter(player, 'zhou_tian')` then
  `bumpState()`.
- `RealmPanel.vue`: third `.realm-panel__body` col.
- `src/locales/en.json` + `vi.json`: `panels.realm.zhouTian.*` —
  title/summary/note/lockedSequential/realmLocked/tieu/dai/invest/
  owned/complete.

## Step 5 — save contract

- `saveVersion.ts` → CURRENT value on merged base + 1 (C2C-59: rule
  not literal — 77 today, 78+ if a parallel bump lands first);
  changelog comment states rejected version + new slice.
- Confirm no `saveShapeValidation.ts` edit needed (delegated
  validator covers the slice — verify in the pin test, not by
  editing).

## Step 6 — gates

- E3 simplify pass before verification.
- P3 **full** — `cd game && npm run verify` (persisted PlayerData
  shape + save-version bump is a P3 full trigger, M-QI-07 precedent).
- P18 OCR delegation: `ocr delegate preview -f json` + `ocr delegate
  rule <paths>` per blueprint knowledge.
- P14 triggers (new UI surface): Playwright pass on the dev server —
  locked / active / milestone / complete row states on a real
  browser; state exactly what was visually confirmed.
- P4 adversarial QA quick (`tutienidle-adversarial-qa`) —
  progression/persistence vectors; escalate to deep if quick flags
  breadth (save boundary + registry).
- P5 sequential review ≥ 3 passes with per-pass evidence blocks.
- P15 ASCII scan on new comments.
- No P13 trigger: no GameManager.update/boot/lifecycle wiring —
  invest enters through the existing ops seam.
- Commit + push + PR base `p7/truc-co`. Report to coordinator:
  branch, files, per-gate evidence, limitations.

## Per-delta acceptance map

| Delta | Spec § | Plan step | Acceptance test |
|---|---|---|---|
| 1 — zhou_tian kind + capacity + milestones + 360 completion | §2, §3 | 2, 3 | A2, A5 |
| 2 — sequential unlock (system-wide chain, C2C-59) | §4 | 2, 3 | A3 |
| 3 — currency seam (DEFERRED constant, C2C-59) | §5 | 2, 3 | A4 |
| 4 — state slice + definition + invest/apply + UI row + tests | §2, §6, §7 | 1-5 | A1, A6, A8 |
| 5 — chapterKind pin | §6 | 2 | A1 |
| save boundary (m-f-essence assignment; +1 rule, C2C-59) | §8 | 5 | A7 |
