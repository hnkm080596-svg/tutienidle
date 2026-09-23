# M-F-ESSENCE — Essence Bands + Substitution Residual — Spec

Status: v1 — draft (worker-authored, pending C2C spec review)
Depends on: M-QI-08 (essence family + authored band drops — `9343215e`),
M-QI-09 (substitution contract + sim-locked ratios — `7916fbe9`),
M-QI-10 (live drop-band swap — `d6eae631`), M-F-BODY-CORE (chapter-kind
vocabulary + physique completion seam + base-stat channel), all merged
on `p7/truc-co`. QI-D4b + QI-D4c + QI-S (decisions.md:179-203).

Mission-graph scope: F9 — the Trúc Cơ-side essence consumption
contract. M-F-CHU-THIEN (dependent mission) authors a `zhou_tian`
chapter that consumes Pháp essence (`tinh_hoa_phap_the`). This mission
verifies the namespace/typed-currency seam accepts that cost shape so
the M-QI-09 contract applies unchanged to TC chapter kinds, and pins
whatever is genuinely missing after audit.

NOT in scope: material redefinition, ratio changes
(`PHYSIQUE_ESSENCE_CONVERSION_RATIO = { bao: 2, phap: 2 }` is locked),
drop-number retunes, upward/bidirectional exchange, exchange UI, the
zhou_tian chapter itself (id, state slice, invest rule, registry
entries, UI — all M-F-CHU-THIEN), signature-drop edits, save/schema
migration (QI-S).

## 1. Audit verdict — F9 production surface is fully landed

The mission premise ("most of F9 already landed") was verified
file-by-file against `origin/p7/truc-co`. Every row below is present,
tested, and live — nothing is re-wired here.

| Surface | Evidence | Verdict |
|---|---|---|
| Essence family Pham/Bao/Phap | `PHYSIQUE_ESSENCES` — `data/realm/PhysiqueEssence.ts:21-25`; legacy `tinh_hoa_pham_the` is the pham member | LANDED |
| `tinh_hoa_bao_the` / `tinh_hoa_phap_the` Materials | `data/materials/materials.ts:282,289` (category `essence`, sourceType `monster`, Pham-entry shape) | LANDED |
| Realm→grade band map + derived drop entries | `PHYSIQUE_ESSENCE_BAND` + `PHYSIQUE_ESSENCE_BAND_DROPS` — `PhysiqueEssence.ts:53-114` (band→grade→materialId, 0.7 / 1-3) | LANDED |
| Live band emission (LQ→Bảo, TC→Pháp, Mortal→Phàm) | `STAGE_DROP_TABLES` banded realms carry the authored band entries BY REFERENCE — `data/drop/StageDropTables.ts:39,55,71`; identity pins `PhysiqueEssence.test.ts:109-123`; runtime-emit proofs + chance gate `data/drop/StageDropTables.essenceBand.test.ts` | LANDED — do not re-wire |
| Sim-locked conversion ratios | `PHYSIQUE_ESSENCE_CONVERSION_RATIO = { bao: 2, phap: 2 }` — `PhysiqueEssence.ts:83-88`; no-arb/adjacency/≥2 pins `PhysiqueEssence.test.ts:193-222` | LANDED |
| Pure substitution resolver | `core/realm/body/BodyChapterEssenceSubstitution.ts` — per-hop integer product, required-first ascending minimum-whole-units, exact change-back in required units, namespace gate inside | LANDED |
| Atomic invest seam (validate→consume→apply) | `GameManagerRealmAdvanceOps.investBodyChapter` — `GameManagerRealmAdvanceOps.ts:479-559`: JSON probe (never `structuredClone`), `bag.has` per debit, change-credit stack-capacity preflight, all-or-nothing commit | LANDED |
| `zhou_tian` chapter-kind vocabulary | `BODY_CHAPTER_KINDS` includes `'zhou_tian'` — `BodyChapter.ts:41-46`; pinned `BodyChapter.test.ts:63-65` | LANDED |
| Any-kind physique completion seam + base-stat channel | `applyPhysiqueAdvancement` callable from ANY chapter completion path — `BodyProgressionSystem.ts:88-119`; optional `collectBaseStatDeltas` on the shared contract — `BodyChapter.ts:129-138` | LANDED |
| Essence sink invariant | sinks derived via `essenceSubstitutionYield('pham', g) > 0` — `EnemyDropSinkInvariant.test.ts:75-79`; `tinh_hoa_phap_the` already counts through the pham chain | LANDED |
| Presentation lane | family-wide essence particle routing — `BattleLootSystem.ts:559-567`; `essence_stream_arrival` is a headless wait-flag only (`useAppLifecycle.ts:148-166`), materials land via `resolveDrops` — NO second invest path exists | LANDED / closed |

**Audit verdict: the residual PRODUCTION delta is zero.** No TC-side
essence gap exists — the entire substitution path is chapter-agnostic
by construction (sec.2). The genuine residual is pin coverage at the
typed-currency boundary the TC chapter will occupy (sec.3), which is
test-only.

## 2. Why the seam is already chapter-agnostic — evidence

The substitution contract never reads chapter identity. Its only input
is the `BodyChapterCurrency { bag, id }` descriptor:

1. `bodyChapterEssenceGrade(currency)` — `currency.bag === 'material'
   ? physiqueEssenceGradeOf(currency.id) : undefined`
   (`BodyChapter.ts:103-109`). The signature has no `chapterId` /
   `chapterKind` parameter; the bag namespace is checked FIRST so a
   pill carrying a colliding id can never classify.
2. `essenceSubstitutionCoverage(cost, ownedOf)` and
   `planEssenceSubstitution(consumed, cost, ownedOf)` take the typed
   descriptor plus a grade→count oracle — nothing else
   (`BodyChapterEssenceSubstitution.ts:85-156`). The resolver refuses
   non-material bags and non-family ids at its own boundary (C2C 6).
3. `investBodyChapter(player, chapterId)` resolves the chapter
   definition, reads `chapter.currency` / `chapter.auxCurrency`, and
   branches exactly once — on
   `bodyChapterEssenceGrade(chapter.currency) === undefined`
   (`GameManagerRealmAdvanceOps.ts:498`). Everything after the branch
   (coverage, probe, plan, debit preflights, commit, change credit) is
   currency-driven; `chapterId` is used only to fetch the definition
   and to key `investBodyChapterState`.
4. `bodyChapterBag(currency)` maps the bag namespace to the deps bags
   (`GameManagerRealmAdvanceOps.ts:561-563`); both `MaterialBag` and
   `PillBag` implement the `getAmount/has/remove/add` contract it
   returns. A `{ bag: 'material', id: 'tinh_hoa_phap_the' }` descriptor
   routes to the material bag identically for any chapter.
5. `investBodyChapterState` dispatches `chapter.invest` by definition;
   apply-side gates (physique source grade, completion, chapter-internal
   rules) are chapter-owned and surface as `consumed = 0` before any
   debit (`BodyProgressionSystem.ts:131-152`).
6. Every production invest caller shares the one seam: tick auto-invest
   (`GameManager.ts:916`), `MeridianSection.vue:102`,
   `EarlyGameSession.investRefinement` (`EarlyGameSession.ts:349`),
   `EssenceSubstitutionEconomy.ts:306`.

Consequence: a `chapterKind: 'zhou_tian'` chapter declaring
`currency: { bag: 'material', id: 'tinh_hoa_phap_the' }` receives the
full M-QI-09 contract — coverage-aware availability, detached-probe
validate→consume→apply, all-or-nothing debit — **unchanged, with zero
production edits**. For a Pháp-required cost today the contract
degrades deterministically: no rung above `phap` has an authored
essence material, so coverage is 0, availability is the owned Pháp
stack, and the plan is a required-only exact debit (never a `change`
credit — coverage 0 ⇒ `consumed <= owned` ⇒ `covered === consumed`).

## 3. Residual contract — the pin set (test-only)

The audit found exactly one unspec'd TC-side edge class: the typed
descriptor boundary was never exercised at non-pham required grades.
All resolver/ops tests drive `PHAM_COST` (`tinh_hoa_pham_the`) or the
meridian pill gate. The pins below close that gap; each names the
file it lands in and what it asserts.

### 3.1 Namespace gate — the TC cost shape

`bodyChapterEssenceGrade` is pinned today only for `body_refinement`
(pham), `meridian` (pill), and a synthetic colliding pill
(`PhysiqueEssence.test.ts:154-184`). Add:

- `{ bag: 'material', id: 'tinh_hoa_phap_the' }` resolves to `'phap'`
  — the exact descriptor M-F-CHU-THIEN's chapter will declare;
- `{ bag: 'material', id: 'tinh_hoa_bao_the' }` resolves to `'bao'`
  for completeness.

### 3.2 Resolver — Bảo- and Pháp-required costs

`core/realm/body/BodyChapterEssenceSubstitution.test.ts` gains
`BAO_COST` / `PHAP_COST` fixtures beside `PHAM_COST` and asserts:

- `essenceSubstitutionCoverage(PHAP_COST, ownedOf)` is `0` for every
  owned set — the top authored rung has no higher substitute. This is
  a pinned semantic (absence is the contract), not an error.
- `planEssenceSubstitution(consumed, PHAP_COST, ownedOf)` debits
  `tinh_hoa_phap_the` only: exact when owned covers, partial when it
  does not, and `change` is ALWAYS `undefined` (structurally
  unreachable while nothing above Pháp is authored).
- `planEssenceSubstitution` on `BAO_COST`: Pháp substitutes Bảo at
  `ratio[phap]` per unit — `ownedOf({ phap: 6 })` against `consumed =
  11` debits 6 Pháp covering 12 and credits 1 `tinh_hoa_bao_the`
  change; mixed stacks order Bảo spend before the Pháp hop
  (required-first, then ascending).
- `essenceSubstitutionCoverage(BAO_COST, ownedOf({ phap: n }))` ===
  `n * ratio[phap]` — the single-hop coverage sum from the top rung.

### 3.3 Contract seam — a synthetic `zhou_tian` chapter

`core/realm/body/BodyChapter.test.ts` (the
`validateBodyChapterRegistry` suite, which already accepts a
`zhou_tian` kind tag) adds: a synthetic chapter
`chapterKind: 'zhou_tian'` carrying
`currency: { bag: 'material', id: 'tinh_hoa_phap_the' }` —

- `bodyChapterEssenceGrade(fake.currency) === 'phap'`: the namespace
  gate accepts the descriptor regardless of the chapter's kind tag;
- `validateBodyChapterRegistry([refinement, fake])` reports NO kind
  violation (the missing-state-slice issues it does report are the
  expected noise — the slice is M-F-CHU-THIEN's to author, matching
  the existing convention at `BodyChapter.test.ts:108-116`).

This is the strongest honest pin of "Pháp substitution works unchanged
for TC chapter kinds": the descriptor the chapter declares IS the
seam's only input — proven at the contract boundary without
registering a chapter.

### 3.4 Boundaries that are NOT gaps (recorded, not pinned)

- **End-to-end `investBodyChapter` for a Pháp-cost `zhou_tian` chapter
  cannot be pinned today** — `BodyChapterId`
  (`'body_refinement' | 'meridian'`), `BodyProgressionState` slices,
  `BODY_CHAPTERS` / `BODY_CHAPTER_BY_ID`, and
  `EXPECTED_BODY_CHAPTER_KIND` are the closed authoring surface
  M-F-CHU-THIEN extends. Mocking the registry would exercise a fake,
  not production; the sec.3.1-3.3 pins plus sec.2 structural evidence
  carry the contract. When the chapter registers, the downstream
  consumers are already registry-generic:
  `validateBodyProgressionPersistedState`,
  `assertBodyProgressionIntegrity`, `collectBodyBaseStatDeltas`,
  `derivePhysiqueGrade`, and the sink invariant all iterate
  `BODY_CHAPTERS`.
- **`auxCurrency` is outside substitution scope by design.** The seam
  reads `auxCurrency` as a raw bag count (`investBodyChapter`
  computes `auxOwned` via `getAmount` only) — meridian's
  `thien_dia_chi_kieu` is a presence gate, not a graded spend. A
  chapter wanting substitutable aux must spec it separately; this
  mission pins nothing there.
- **`BodyChapterCurrency.bag` is the `'material' | 'pill'` union.** A
  new bag namespace would be a union extension — dependent scope, not
  an essence gap.
- **Save shape**: registering the chapter adds a `bodyProgression`
  slice — a persisted-shape change and the save-version decision
  belong to M-F-CHU-THIEN (QI-S: bump = reject, no translator).

## 4. Consistency invariants

- Zero production-file edits: the whole delta is test files under
  `src/core/realm/body/` + `src/data/realm/`.
- `PHYSIQUE_ESSENCE_CONVERSION_RATIO`, `PHYSIQUE_ESSENCE_BAND_DROPS`,
  `PHYSIQUE_ESSENCE_BAND`, and every live `STAGE_DROP_TABLES` line are
  byte-identical pre/post (no retune, no re-wire — the M-QI-10 identity
  pins keep proving it).
- `huyet_mong` Phàm ×12 signature valve untouched.
- The M-QI-09 suite stays green unchanged — the pins exercise the same
  public resolver functions it pins, no signature drift.
- New tests assert against PRODUCTION data
  (`PHYSIQUE_ESSENCE_CONVERSION_RATIO`, authored material ids) — the
  existing convention (`R_BAO`/`R_PHAP` read from the authored map, not
  copied constants).

## 5. Out of scope

- The `zhou_tian` chapter: id, `BodyChapterId` union member,
  `BodyProgressionState` slice, `BODY_CHAPTERS`/`BODY_CHAPTER_BY_ID`
  entries, `EXPECTED_BODY_CHAPTER_KIND` pin, invest rule, persisted
  validation, integrity checks, UI section, save version.
- Substitutable `auxCurrency` (sec.3.4 boundary).
- Material definitions, ratio/drop-number retunes, re-locking the sim
  (identical inputs ⇒ identical lock; M-QI-09 spec sec.3.5).
- Upward/bidirectional exchange, exchange UI (QI-D4c).
- Seven unauthored ladder rungs — no extrapolation (QI-D4b).
- Signature-drop edits; per-enemy/family-table drop authoring.
- Save/schema migration (QI-S).

## 6. Acceptance

- Pins per sec.3.1-3.3 land in the named test files; zero
  production-file edits in the diff.
- `npm run type-check` + scoped `npx vitest run` green (P3 quick —
  test-only delta, no build/deps/architecture touch).
- P18 OCR clean; P4 adversarial QA quick verdict recorded; P5
  sequential passes per gate order.
- Report records the zero-delta audit verdict with this sec.1 evidence
  table.
