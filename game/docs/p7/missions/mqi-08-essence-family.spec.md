# P7 M-QI-08 — Grade-Aware Essence Family — Spec

Status: v3 — MQI08_SPEC_REVIEWED (external spec review, round 3)
Depends on: M-QI-07 (physiqueGrade + 10-rung ladder — merged), QI-D4b +
QI-D4c + QI-S (decisions.md:179-203).
Mission-graph scope: `Tinh Hoa <Grade>` material family (Phàm/Bảo/Pháp
authored now); grade-aware Body chapter costs; drop definitions per
pinned band map (Mortal→Phàm, LQ→Bảo, TC→Pháp); legacy
`tinh_hoa_pham_the` → Phàm-grade mapping. NOT in scope: the live drop
band swap (M-QI-10), the substitution contract + ratios (M-QI-09),
per-grade stat bonuses (QI-D4d deferred), any save migration (QI-S).

## 1. Intent

QI-D4b pins the Realm → Essence grade map: Mortal → `Tinh Hoa Phàm
Thể`; Luyện Khí → `Tinh Hoa Bảo Thể`; Trúc Cơ → `Tinh Hoa Pháp Thể`.
The dominant Essence in a band is the Physique grade being developed in
that band. The remaining seven grades are explicitly NOT extrapolated —
no material ids are authored for them.

Today only `tinh_hoa_pham_the` exists, referenced by raw id in the
mortal stage drop table, the hidden-beast signature drop, the body
refinement chapter currency, the loot-particle router, and the sim
package. Nothing in the codebase knows that this id means "Phàm-grade
physique essence" — so M-QI-09's substitution rule ("higher-grade
Essence satisfies lower-grade requirements") and M-QI-10's live band
swap have no grade identity or band map to resolve against.

This mission creates that identity layer: a canonical essence registry
keyed by `PhysiqueGradeId`, the two missing authored materials, the
pinned realm→grade band map, grade-aware Body chapter costs via the
family registry (the currency id IS the identity — grade derives), and
the authored (unwired) per-band drop entries. It changes no live drop,
no live cost value, and no persisted shape.

## 2. Decision — the material id IS the identity; grade derives from it

Three models were considered for the chapter-cost seam:

(a) currency carries the grade only and the id derives at consume time
    — rejected: forces every `currency.id` consumer through a resolver
    and leaves no stable key for bags/saves;
(b) currency keeps `id` and gains an independently authored
    `essenceGrade` field — rejected (spec review r1): two hand-authored
    values for one relation, held honest only by a drift test;
(c) **chosen:** `BodyChapterCurrency { bag, id }` stays byte-identical.
    "Grade-aware" means the currency id is a family member and its
    grade is derived through the canonical reverse lookup — one
    authored value, zero drift surface. A chapter consuming a
    physique-essence material automatically carries that material's
    grade, and no authored pair can disagree.

    **Namespace rule (spec review r2):** `BodyChapterCurrency.bag`
    selects between two disjoint registries — `'material'` →
    `MaterialBag`, `'pill'` → `PillBag`. Material ids and pill ids are
    NOT pinned as globally disjoint namespaces, so the reverse lookup
    alone is not a complete identity rule: a synthetic
    `{ bag:'pill', id:'tinh_hoa_bao_the' }` is a pill currency whose
    string happens to collide with a family id, and must NEVER classify
    as Bảo essence. The composed predicate lives in the currency
    contract owner:

    ```ts
    // core/realm/body/BodyChapter.ts
    export function bodyChapterEssenceGrade(
      currency: BodyChapterCurrency,
    ): PhysiqueGradeId | undefined {
      return currency.bag === 'material'
        ? physiqueEssenceGradeOf(currency.id)
        : undefined
    }
    ```

    `PhysiqueEssence.ts` stays a pure material-id registry and knows
    nothing about `BodyChapterCurrency`. M-QI-09's substitution boundary
    is REQUIRED to consume `bodyChapterEssenceGrade` (or an equivalent
    bag-gated composition) — substitution must never inspect MaterialBag
    essence for a PillBag requirement on a string-id coincidence.

## 3. Contract

### 3.1 `src/data/realm/PhysiqueEssence.ts` (new) — the registry authority

```ts
export interface PhysiqueEssenceDefinition {
  grade: PhysiqueGradeId      // unique, authored rungs only
  materialId: string          // the spendable id
}

// Ordered by the ladder; exactly the three authored rungs.
export const PHYSIQUE_ESSENCES: readonly PhysiqueEssenceDefinition[]

export function physiqueEssenceMaterialId(
  grade: PhysiqueGradeId,
): string | undefined                     // undefined for unauthored rungs

export function physiqueEssenceGradeOf(
  materialId: string,
): PhysiqueGradeId | undefined            // undefined for non-family ids

// QI-D4b pinned map. Only these three realms have a physique-essence
// band; realms absent from the map have no authored physique essence
// drop identity. The exact key union makes sparsity type-honest — a
// `Record<string, ...>` would claim every realm has a band.
export type PhysiqueEssenceBandRealm =
  | 'mortal'
  | 'qi_refining'
  | 'foundation_establishment'

export const PHYSIQUE_ESSENCE_BAND: Readonly<
  Record<PhysiqueEssenceBandRealm, PhysiqueGradeId>
>
// = { mortal: 'pham', qi_refining: 'bao', foundation_establishment: 'phap' }

// Sparse lookups accepting ANY realm id — absent realms return
// undefined; the absence check is mandatory for M-QI-10 consumers.
export function physiqueEssenceBand(
  realmId: string,
): PhysiqueGradeId | undefined

// Authored per-band guaranteed-drop entries (shape mirrors the live
// mortal line: chance 0.7, amount 1-3 — see §3.5 for the ownership
// ruling on these numbers). Authored data only — M-QI-10 wires them
// into STAGE_DROP_TABLES live. Same sparse contract as the band map.
export const PHYSIQUE_ESSENCE_BAND_DROPS: Readonly<
  Record<PhysiqueEssenceBandRealm, GuaranteedDropEntry>
>
export function physiqueEssenceBandDrop(
  realmId: string,
): GuaranteedDropEntry | undefined
```

The registry is the single source of truth. `PHYSIQUE_ESSENCE_BAND_DROPS`
is derived per band from the same table (`band → grade → materialId`)
so a band entry can never name a material of the wrong grade by
construction.

### 3.2 Materials (materials.ts)

Two new entries in the main `materials` array (current authored content,
not `legacyMaterials`):

```ts
{ id: 'tinh_hoa_bao_the',  name: 'Tinh Hoa Bảo Thể',  category: 'essence', sourceType: 'monster', description: ... }
{ id: 'tinh_hoa_phap_the', name: 'Tinh Hoa Pháp Thể', category: 'essence', sourceType: 'monster', description: ... }
```

Same shape as `tinh_hoa_pham_the` (no `stackLimit` — default
`MAX_STACK_AMOUNT`; the invest-drain cadence already tops up per tick).
No icon in this pass (icon is optional and not in the persisted shape).

The legacy id `tinh_hoa_pham_the` is NOT renamed: it IS the Phàm member
— `PHYSIQUE_ESSENCES` maps `pham → 'tinh_hoa_pham_the'`, which is the
"legacy → Phàm-grade mapping" the mission names. Saves, drop refs, and
chapter currency keep working; the registry is the only place that
learns the id's grade.

### 3.3 Grade-aware chapter cost — contract unchanged, grade derived

`BodyChapterCurrency { bag, id }` gains NO field (spec review r1 — an
authored `essenceGrade` beside `id` would be a second authority for one
relation). The chapter cost is grade-aware through the composed
predicate `bodyChapterEssenceGrade(currency)` (spec §2, r2):
`bag === 'material'` AND the id is a family member. Concretely,
`body_refinement.currency` = `{ bag:'material', id:'tinh_hoa_pham_the' }`
resolves to `'pham'`; `meridian`'s `{ bag:'pill', id:'thong_mach_dan' }`
resolves to `undefined` — and a hypothetical pill currency carrying a
family-member string id still resolves to `undefined`. A future LQ
chapter consuming `tinh_hoa_bao_the` is Bảo-grade by construction —
nothing to declare, nothing to drift.
`GameManagerRealmAdvanceOps.investBodyChapter` and the tick path are
untouched.

### 3.4 Loot particle routing (`BattleLootSystem.ts`)

The essence-stream check widens from the literal id to family
membership:

```ts
if (physiqueEssenceGradeOf(drop.itemId) !== undefined) {
  this.emitRewardParticle(sourceId, 'essence', ESSENCE_PARTICLE_COLOR)
}
```

Behavior-identical today (only `tinh_hoa_pham_the` is droppable); the
M-QI-10 live band then routes Bảo/Pháp motes correctly with no further
edit.

### 3.5 Drop definitions — authored, unwired, number ownership pinned

`PHYSIQUE_ESSENCE_BAND_DROPS` carries the authored entries for all three
bands (mortal included — the live mortal table stays the source of
truth and the authored entry is asserted equal to it, so the definition
set is complete and drift-checked). **No `STAGE_DROP_TABLES`,
`FamilyDropTables`, or `HiddenBeasts` line changes hands in this
mission** — wiring is M-QI-10, ordered after M-QI-09's substitution
contract so unfinished lower-grade progression is never stranded
(QI-D4b/QI-D4c + mission-graph ruling).

**Number ownership (spec review r1 L1):** the `0.7` chance / `1-3`
amount authored for the Bảo and Pháp bands are the **fixed simulation
inputs** for M-QI-09's deterministic ratio lock, not ownerless
first-pass values. M-QI-10 wires them unchanged. If the later balance
phase retunes them, the retune is invalid unless the M-QI-09 simulation
is re-run and the ratios re-locked against the final values first — the
drop-rate edit and the ratio re-lock land in one change.

Documented exception: `huyet_mong` (qi_refining hidden beast) keeps its
signature `tinh_hoa_pham_the` ×12 drop. Signature drops are hand-placed
by design, and this one is the catch-up valve for a player who reaches
LQ with the mortal chapter unfinished — the exact case QI-D4b calls
legal. The band map governs the *band* (stage tables), not signature
loot.

### 3.6 Sim reads

`PerfectionEconomy.expectedEssencePerKill` and `EarlyGameSession` keep
reading the mortal table / `TINH_HOA_PHAM_THE_MATERIAL_ID` — they are
mortal-progression instruments and the id is still the canonical Phàm
member. No change required (a direct registry read would be identical,
not more correct).

## 4. Consistency invariants (test-pinned)

1. `PHYSIQUE_ESSENCES` has exactly the authored rungs `{pham, bao, phap}`
   in ladder order; grades unique; material ids unique.
2. Every `PHYSIQUE_ESSENCES` materialId resolves to a real `Material`
   whose `category === 'essence'`.
3. `physiqueEssenceMaterialId`/`physiqueEssenceGradeOf` round-trip for
   authored rungs; unauthored rungs → `undefined`; non-family ids →
   `undefined`.
4. `PHYSIQUE_ESSENCE_BAND` = exactly `{mortal→pham, qi_refining→bao,
   foundation_establishment→phap}`; every band's grade is authored in
   `PHYSIQUE_ESSENCES` (a band can never point at an unauthored rung).
   Sparse lookups: `physiqueEssenceBand`/`physiqueEssenceBandDrop` on a
   non-banded realm id (e.g. `'golden_core'`, `'unknown'`) return
   `undefined` — pinned, not merely implied by object equality.
5. Chapter-cost coherence is structural and namespace-gated:
   `bodyChapterEssenceGrade(body_refinement.currency) === 'pham'`;
   `bodyChapterEssenceGrade(meridian.currency) === undefined`; and the
   namespace regression — a synthetic `{ bag:'pill',
   id:'tinh_hoa_bao_the' }` currency yields `undefined` even though the
   id is a family member. A future chapter consuming a family material
   id needs no field to be grade-correct; a pill currency can never be
   essence regardless of id coincidence.
6. Every `PHYSIQUE_ESSENCE_BAND_DROPS` entry names the material of its
   band's grade; the mortal authored entry equals the live
   `STAGE_DROP_TABLES` mortal essence line (drift sentinel until
   M-QI-10); `physiqueEssenceBandDrop` on a non-banded realm returns
   `undefined`.
7. Live tables unchanged: the LQ and TC bands still emit no physique
   essence (guard test — a premature live wiring fails loudly).
8. Save shape unchanged: no `physiqueGrade`-era field touched; no
   version bump (persisted material keys are already dynamic strings).
9. Material shape pinned per §3.2: both new entries are `category:
   'essence'` AND `sourceType: 'monster'`, carry no `stackLimit`
   (default `MAX_STACK_AMOUNT` applies), and no `years`/`element`/
   `profession` axis — same shape class as the Phàm entry.

## 5. Explicitly out of scope

- Substitution mechanics, `conversionRatio`, any exchange UI (M-QI-09).
- Live LQ/TC drop emission, mortal-band changes, hidden-beast signature
  retuning (M-QI-10; the huyet_mong Phàm drop is a documented exception
  per §3.5).
- Per-grade stat bonuses (QI-D4d deferred to the balance phase).
- Essence for rungs Linh→Tiên (QI-D4b: not extrapolated).
- Any rename of `tinh_hoa_pham_the` or material-id migration (QI-S).
- New LQ/TC body chapters (future authored content — the cost contract
  is ready for them).

## 6. Acceptance criteria

- `PHYSIQUE_ESSENCES`, `physiqueEssenceMaterialId`,
  `physiqueEssenceGradeOf`, `PHYSIQUE_ESSENCE_BAND`,
  `PHYSIQUE_ESSENCE_BAND_DROPS` exist and behave per §3.1/§4.
- `tinh_hoa_bao_the` + `tinh_hoa_phap_the` are real `Material`s
  (essence/monster).
- `BodyChapterCurrency` is unchanged; `bodyChapterEssenceGrade` exists
  in the contract owner and yields `'pham'` for `body_refinement`,
  `undefined` for the meridian pill, and `undefined` for a synthetic
  pill currency carrying a family-member id — grade-awareness is
  derivable, namespace-gated, not declared.
- BattleLootSystem routes any family material to the essence particle
  stream (pham behavior identical).
- Zero live-drop, zero cost-value, zero persisted-shape changes;
  `npm run verify` green (P3 full).
