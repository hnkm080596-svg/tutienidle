# M-QI-10 — Essence Drop-Band Production Swap — plan

Spec: `mqi-10-essence-drop-band.spec.md` (v1 — worker-authored draft,
pending coordinator C2C spec review). Implements QI-D4b's live half:
the authored `PHYSIQUE_ESSENCE_BAND_DROPS` go live in
`STAGE_DROP_TABLES`, so qi_refining emits Bảo essence and
foundation_establishment emits Pháp essence at the pinned rate
(1-3 @ 0.7). Completability of stranded lower-grade Body progression
is carried entirely by the landed M-QI-09 contract — this mission
adds no contract of its own there. No retune, no re-lock, no new
materials, no save change (QI-S).

## Step 0 — seam census (done during spec)

- `data/drop/StageDropTables.ts`: `STAGE_DROP_TABLES` is the only
  production delta — `mortal.guaranteed` holds the literal Phàm line
  today; `qi_refining`/`foundation_establishment` hold
  `guaranteed: []`. Pools/currencies/floors untouched.
- `data/realm/PhysiqueEssence.ts`: `PHYSIQUE_ESSENCE_BAND_DROPS`
  already derives each band's `GuaranteedDropEntry` from the pinned
  band map (band → grade → materialId) — the swap consumes these by
  reference, never re-authors literals (spec §2).
- `core/drop/DropTable.ts` + `data/drop/FamilyDropTables.ts`:
  `guaranteed` rolls independent chance per line; family tables hold
  no essence lines — the band map stays the only stage-layer essence
  lane (spec §4 invariant 2).
- `core/game/BattleLootSystem.ts`: resolves
  `stageDropTableFor(stage?.requiredRealmId ?? enemy.realmId,
  stage?.floor)` — drops key off the stage's band, exactly the swap
  semantic; essence particles route family-wide already (M-QI-08).
- `data/enemy/HiddenBeasts.ts`: `huyet_mong` signature
  `tinh_hoa_pham_the ×12 @ 1.0` stays — documented catch-up valve
  (spec §3.3).
- `data/realm/PhysiqueEssence.test.ts`: hosts the pre-swap guard to
  flip ("live LQ and TC bands emit no physique essence") plus the
  mortal drift sentinel — both rewritten to post-swap pins, never
  deleted.
- `core/simulation/earlygame/`: `PerfectionEconomy` reads the live
  mortal Phàm line (value-identical post-swap);
  `EssenceSubstitutionEconomy` reads authored inputs only — both
  unchanged; the M-QI-09 sim suite must stay green as-is.
- `core/drop/dropSampling.ts` + `dropCharacterization`/`dropEconomy`
  tests: assert currency/item rates only — no asserted constant
  moves (verify, don't assume: the printed items/kill rows shift).
- Save shape: untouched — bags persist stacks by material id; QI-S
  governs, no version bump.

## Step 1 — TDD failing tests first

1. `PhysiqueEssence.test.ts` (rewrite the two pre-swap pins):
   - replace the "no essence in LQ/TC" guard with the post-swap pin:
     each banded realm's `guaranteed` contains exactly the
     `PHYSIQUE_ESSENCE_BAND_DROPS[realm]` entry (the live line IS the
     authored map entry — structural/reference pin, not a literal
     copy);
   - mortal sentinel rewritten: the live mortal essence line still
     resolves to the band entry (equality kept — now also proves the
     mortal line flows through the band authority);
   - new pin: no family-material id
     (`physiqueEssenceGradeOf(id) !== undefined`) in any
     `FAMILY_DROP_TABLES` line, any stage `pool` line, or any
     non-band `guaranteed` line;
   - new pin: non-banded realms (e.g. `golden_core`) emit no
     essence-family material.
2. Runtime-emit proof (new test, `data/drop/` or `core/drop/`
   scope — follow the existing drop test conventions): a seeded kill
   on a `qi_refining` stage resolved through the real
   `stageDropTableFor` + drop-resolution path emits
   `tinh_hoa_bao_the`; same for `foundation_establishment` →
   `tinh_hoa_phap_the`; a `mortal` kill still emits
   `tinh_hoa_pham_the`.
3. `HiddenBeastDrops.test.ts` (or the file's existing signature
   harness): pin `huyet_mong` keeps `tinh_hoa_pham_the ×12 @ 1.0` —
   the valve survives the swap.
4. Re-run `EssenceSubstitutionEconomy` suite unchanged: lock
   recomputation AND `measureStrandedCompletion` (both stranded
   arcs) green — the swap leans on this contract, does not touch it.

## Step 2 — production wiring (the only production edit)

- `data/drop/StageDropTables.ts`:
  - `mortal.guaranteed`: literal Phàm line →
    `PHYSIQUE_ESSENCE_BAND_DROPS.mortal` (value-identical);
  - `qi_refining.guaranteed`: `[PHYSIQUE_ESSENCE_BAND_DROPS.qi_refining]`;
  - `foundation_establishment.guaranteed`:
    `[PHYSIQUE_ESSENCE_BAND_DROPS.foundation_establishment]`;
  - import `PHYSIQUE_ESSENCE_BAND_DROPS` from
    `data/realm/PhysiqueEssence` (data → data, acyclic — the reverse
    import never exists; the sentinel lives in the test file);
  - file-header comment updated where it describes the bands
    (essence arrives only through the band authority — P15 ASCII).
- `data/enemy/HiddenBeasts.ts`: no edit — pin proves the valve.

## Step 3 — sweep for characterization fallout

- `npx vitest run` scoped: drop (`core/drop`, `data/drop`,
  `data/enemy`), essence/substitution sims, `BattleLootSystem`
  consumers — fix only what the swap legitimately changed (printed
  characterization rows are report output; asserted constants must
  not move — investigate any that do before touching them).
- `EnemyDropSinkInvariant`/`DropTables.test.ts` entry validation:
  new lines name real authored materials — expected green; a failure
  means the swap touched an unlisted seam.

## Step 4 — gates

- P3 full is mandatory: `npm run verify` (type-check + build + full
  vitest) GREEN — the spec requires it unconditionally: the central
  stage drop table is consumed broadly (BattleLootSystem,
  resolveDrops, dropSampling, sims), so economy/progression blast
  radius is not bounded by the diff's size.
- E3 code-simplifier → P18 OCR (`open-code-review`) → P4
  `tutienidle-adversarial-qa` quick (economy lane touched; deep only
  if quick surfaces broad risk) → P5 sequential ≥ 3 passes.
- No P13/P14 trigger: no UI, no wiring-path, no rendering change —
  the runtime proof in Step 1.2 covers live behavior headlessly.
- P15 ASCII scan on new comments. Ledger row: add M-QI-10 to
  `game/docs/p7/mission-graph.md` M-QI completion ledger (same
  format as M-QI-01..09 — commit, gates evidence).
- Commit + push branch; PR base `p7/truc-co`.

## Acceptance criteria (per spec §6)

- Banded realms emit their band's grade material live through the
  band authority — LQ kills drop `tinh_hoa_bao_the`, TC kills drop
  `tinh_hoa_phap_the`, mortal still drops `tinh_hoa_pham_the`.
- Pre-swap guard replaced by post-swap pins; no literal re-authored
  essence line in the stage-layer band wiring (signature drops —
  `huyet_mong`'s Phàm ×12 — remain exempt per spec §3.3).
- `huyet_mong` valve preserved and pinned.
- M-QI-09 sim suite green unchanged; verification green; ledger row
  added.
