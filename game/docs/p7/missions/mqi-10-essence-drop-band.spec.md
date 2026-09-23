# P7 M-QI-10 — Essence Drop-Band Production Swap — Spec

Status: v1 — draft (worker-authored)
Depends on: M-QI-08 (essence family + authored band drops — merged at
`9343215e`), M-QI-09 (substitution contract + sim-locked ratios —
merged into `p7/truc-co`), QI-D4b + QI-D4c + QI-S
(decisions.md:179-203).
Mission-graph scope: wire the authored `PHYSIQUE_ESSENCE_BAND_DROPS`
into `STAGE_DROP_TABLES` so the live qi_refining band emits Bảo-grade
essence and the live foundation_establishment band emits Pháp-grade.
Lower-grade Body requirements stay completable through the M-QI-09
substitution contract. NOT in scope: new essence materials or grades,
ratio or drop-number retuning, any exchange UI, upward/bidirectional
exchange, new Body chapters, per-grade stat bonuses (QI-D4d),
signature-drop edits, any save/schema migration (QI-S), the E2E
journey coverage (M-QI-12).

## 1. Intent

QI-D4b pins the Realm → Essence grade map: Mortal → `Tinh Hoa Phàm
Thể`; Luyện Khí → `Tinh Hoa Bảo Thể`; Trúc Cơ → `Tinh Hoa Pháp Thể`.
M-QI-08 authored the family registry, the two missing materials, the
band map, and `PHYSIQUE_ESSENCE_BAND_DROPS` — derived per-band
guaranteed-drop entries deliberately left unwired ("M-QI-10 wires
these into STAGE_DROP_TABLES live"). M-QI-09 landed the
downward-substitution contract at the Body invest seam with the
sim-locked ratio 2 on both authored hops — the ordering rule ("only
then may M-QI-10 shift the live drop band") is satisfied.

Today the live production is asymmetric: the mortal stage band emits
`tinh_hoa_pham_the` (1-3 @ 0.7 guaranteed) while the qi_refining and
foundation_establishment stage bands emit no physique essence at all
(`guaranteed: []`). A player who crosses into LQ with the mortal Body
chapter unfinished — the common case, the chapter is back-loaded —
earns zero essence in-band and can only complete by backfarming
mortal stages or the `huyet_mong` signature valve (Phàm ×12).

This mission is the swap: the live stage bands start emitting their
band's dominant grade per the pinned map. A resident earns the
essence their current band develops; unfinished lower-grade Body
progression completes automatically through M-QI-09's substitution
(higher-grade units satisfy the lower-grade requirement at the locked
ratio, atomically at the cost check — no exchange UI, no player
action). The mortal band keeps dropping Phàm, so deliberate
backfarming and the signature valve remain as additional catch-up
lanes — nothing is removed, the bands gain their dominant grade.

## 2. Decision — consume the authored band entries; never re-author literals

Two wiring shapes were considered for putting the band entries live:

(a) hand-authored literal `GuaranteedDropEntry` copies inside the
    LQ/TC `guaranteed` arrays, kept honest by equality tests against
    `PHYSIQUE_ESSENCE_BAND_DROPS` — rejected: a second authored value
    for one relation, held honest only by a drift test. That is the
    exact duplicate-authority shape M-QI-08 spec §2 rejected for
    chapter costs; the same rule binds here.

(b) **chosen:** the stage table's `guaranteed` array carries the
    band's `PHYSIQUE_ESSENCE_BAND_DROPS[realm]` entry directly. The
    live tables become a projection of the band map — one authored
    value, zero drift surface. The mortal literal is replaced by the
    same reference (`PHYSIQUE_ESSENCE_BAND_DROPS.mortal`): the
    M-QI-08 sentinel already asserts value-equality, so the live
    state is unchanged while all three bands resolve through one
    authority.

Import direction is acyclic: `data/drop/StageDropTables.ts` reads
`data/realm/PhysiqueEssence.ts` (data → data, same layer);
`PhysiqueEssence.ts` never reads the stage tables (its drift
sentinel lives in the test file, not the data).

## 3. Contract

### 3.1 Live table change (the entire production delta)

`STAGE_DROP_TABLES` (`data/drop/StageDropTables.ts`):

- `mortal.guaranteed` — the literal Phàm line is replaced by
  `PHYSIQUE_ESSENCE_BAND_DROPS.mortal` (value-identical:
  `tinh_hoa_pham_the`, 1-3 @ 0.7).
- `qi_refining.guaranteed` — gains `PHYSIQUE_ESSENCE_BAND_DROPS.qi_refining`
  (`tinh_hoa_bao_the`, 1-3 @ 0.7); previously empty.
- `foundation_establishment.guaranteed` — gains
  `PHYSIQUE_ESSENCE_BAND_DROPS.foundation_establishment`
  (`tinh_hoa_phap_the`, 1-3 @ 0.7); previously empty.

Pools, currencies, floor bands, and family tables are untouched.
Essence enters the stage layer ONLY through the band authority: if a
band's `guaranteed` later gains non-essence lines they are authored
inline as today, but every essence-family line must resolve through
`PHYSIQUE_ESSENCE_BAND_DROPS` — never a literal.

### 3.2 Completability — why this swap is legal

The mission-graph ordering rule exists for one case: a player
stranded in a higher band with a lower-grade Body chapter
unfinished. After the swap that player earns the higher band's grade
and completes through M-QI-09's contract:

- stranded-in-LQ: Bảo income substitutes for the Phàm requirement at
  the locked ratio 2;
- stranded-in-TC: Pháp income compounds at ratio² = 4
  (Pháp→Bảo→Phàm).

`measureStrandedCompletion` (M-QI-09) already proves both arcs
end-to-end through the real seams on every lock seed. Substitution
is automatic inside `investBodyChapter` — the same call driven by
per-tick auto-invest — so the swap needs no new UI, no opt-in, and
no player action. This mission adds no contract of its own here; it
relies on the landed one, which is why the graph forced the order.

### 3.3 Signature-drop exception stays

`huyet_mong` (qi_refining hidden beast) keeps its hand-placed
`tinh_hoa_pham_the` ×12 @ 1.0 signature drop — the documented
catch-up valve (M-QI-08 spec §3.5). The band map governs stage
tables, not signature drops. No signature drop is added, removed,
or re-graded in this mission.

### 3.4 Guard flip — the pre-swap invariant is replaced, not deleted

`PhysiqueEssence.test.ts` currently pins "the live LQ and TC bands
emit no physique essence (premature wiring fails loudly)". After
the swap the guard's negation would be a live defect description, so
it is replaced by post-swap pins (§4): each banded realm emits
exactly its band-map entry, and essence appears nowhere else in the
stage/family layers.

### 3.5 Number ownership unchanged

The live band numbers ARE the pinned sim inputs (0.7 chance, 1-3
amount) — this mission wires them, it does not retune them, and it
does not re-run or re-lock the M-QI-09 sim (identical inputs ⇒
identical lock). The ownership rule still binds: any later retune of
drop numbers, tier caps, or arc length invalidates the locked ratio
unless the sim is re-run and the ratio re-locked in the same change
(M-QI-09 spec §3.5). The mortal drift sentinel keeps guarding
production-vs-authored equality — post-swap it additionally proves
the mortal line still flows through the band authority.

### 3.6 Sim and read-model effects — none on the gameplay path

- `PerfectionEconomy.expectedEssencePerKill` reads the live mortal
  table's Phàm line — the post-swap entry is value-identical, so
  mortal progression instruments are unchanged.
- `EssenceSubstitutionEconomy` reads `PHYSIQUE_ESSENCE_BAND_DROPS`
  (authored inputs), not the live tables — unchanged; the M-QI-09
  sim suite stays green as-is.
- `dropSampling`-based characterization (`dropCharacterization`,
  `dropEconomy`) asserts spirit-stone/item rates only — no asserted
  constant moves (the printed items/kill rows shift; that is report
  output, not a gate). Verified at implementation, not assumed.
- `BattleLootSystem` family-wide essence particle routing (M-QI-08
  §3.4) already routes Bảo/Pháp motes — no code change.
- `stageDropTableFor`'s remaining consumers
  (`resolveDrops`/`BattleLootSystem`) read guaranteed entries
  generically — the new lines flow with no wiring edits. Stage-keyed:
  drops follow the STAGE's `requiredRealmId`, which is exactly the
  band semantic this mission wires.

## 4. Consistency invariants (test-pinned)

1. `STAGE_DROP_TABLES` banded realms carry the band entry by
   reference: `guaranteed` of `mortal`, `qi_refining`,
   `foundation_establishment` contains exactly the
   `PHYSIQUE_ESSENCE_BAND_DROPS[realm]` entry — asserting the object
   IS the authored map entry (structural pin on the reference/value,
   not a re-authored literal).
2. No essence-family material id (`physiqueEssenceGradeOf(id) !==
   undefined`) appears in any `FAMILY_DROP_TABLES` line, any stage
   `pool` line, or any non-band `guaranteed` line — the band map is
   the only stage-layer essence lane (signature drops exempt per
   §3.3).
3. `huyet_mong`'s signature drop remains
   `tinh_hoa_pham_the ×12 @ 1.0` — the catch-up valve is preserved,
   pinned, not merely implied.
4. Non-banded realm stage tables emit no essence-family material —
   sparse band lookups govern (e.g. `golden_core` stays undefined).
5. Runtime proof through the production seam: a seeded LQ kill
   resolved via the stage table (the `resolveDrops` path, as driven
   by `BattleLootSystem`) emits `tinh_hoa_bao_the` — the entry is
   live, not merely present in data. Same shape for a TC kill
   emitting `tinh_hoa_phap_the`.
6. Completability stands: the M-QI-09 sim suite
   (`EssenceSubstitutionEconomy` — lock recomputation AND
   `measureStrandedCompletion` on both stranded arcs) is green
   unchanged, proving the stranded player still retires the
   lower-grade chapter on band income.
7. Save shape untouched: bags persist stacks by material id already;
   no `physiqueGrade`-era field is added or renamed; no version bump
   (QI-S).
8. `PHYSIQUE_ESSENCE_BAND_DROPS` values are identical pre/post swap
   (0.7 / 1-3): the production write consumed pinned inputs, no
   retune slipped in.

## 5. Out of scope

- New essence materials, grades, or band realms (the three authored
  rungs stand; seven unauthored rungs stay unauthored).
- `PHYSIQUE_ESSENCE_CONVERSION_RATIO` or drop-number changes — no
  retune, no re-lock (inputs identical).
- Exchange UI, manual conversion, upward/bidirectional exchange.
- New Body chapters or Bảo/Pháp-demanding chapters (no authored
  consumer beyond `body_refinement` exists; substitution still only
  serves the lower-grade requirement).
- Signature-drop retargets (huyet_mong stays per §3.3); family-table
  or pool changes; per-enemy drop authoring.
- Per-grade stat bonuses (QI-D4d), Body stat rework.
- Save/schema migration (QI-S — save-version rejection governs).
- The LQ→TC E2E journey coverage (M-QI-12).

## 6. Acceptance

- `STAGE_DROP_TABLES` wired per §3.1 — banded realms emit their
  band's grade material live through the band authority.
- Pre-swap guard replaced by the §4 post-swap invariants; all new
  pins covered by tests (data pins + runtime-emit proof).
- huyet_mong valve preserved and pinned.
- M-QI-09 sim suite green unchanged; `npm run verify` green.
- `game/docs/p7/mission-graph.md` M-QI ledger gains the M-QI-10 row
  (same format as M-QI-01..09).
