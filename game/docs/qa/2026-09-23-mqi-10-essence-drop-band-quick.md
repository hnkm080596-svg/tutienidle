# QA Review: M-QI-10 essence drop-band production swap

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/data/drop/StageDropTables.ts`
  - `game/src/data/drop/StageDropTables.essenceBand.test.ts`
  - `game/src/data/realm/PhysiqueEssence.test.ts`
  - `game/src/data/enemy/HiddenBeastDrops.test.ts`
  - `game/src/data/enemy/EnemyDropSinkInvariant.test.ts`
  - `game/src/core/game/BattleLootSystem.dropResult.test.ts`

## Scope and Risk Map

Production change: `STAGE_DROP_TABLES` banded realms now carry
`PHYSIQUE_ESSENCE_BAND_DROPS[realm]` by reference — mortal literal
replaced by the same shared entry; qi_refining/foundation_establishment
guaranteed lines gain the shared Bao/Phap entries. Everything else is
test pins.

Mapper: domains `combat-and-tribulation` + `economy-and-progression`,
`deepAuditCandidate: true` (cross-system label only).

- `game/src/data/drop/StageDropTables.ts` (unmappedPath) — routed to
  `economy-and-progression`: consumed read-only by `resolveDrops` via
  `stageDropTableFor` in `BattleLootSystem`.
- `game/src/data/drop/StageDropTables.essenceBand.test.ts`
  (unmappedPath) — routed to `economy-and-progression`: pins runtime
  emit through the real `stageDropTableFor` + `resolveDrops` seam.
- `game/src/core/game/BattleLootSystem.dropResult.test.ts`
  (unmappedPath) — routed to `combat-and-tribulation`: presentation
  consumer pin (essence particle stream).

Deep-escalation decision: NOT escalated — risk confidently bounded by
inspection. No save shape, clock, lifecycle, or Vue/Pinia/Phaser change;
the only new runtime behavior is essence ids landing in a generic
material bag at rates already sim-locked by M-QI-09 (0.7 / 1-3). The
substitution sink was production-tested by M-QI-09 and stays green.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BAND-1 | `materialBag` / BattleLootSystem | LQ/TC kill emits bao/phap essence into bag | Conservation — dropped material has a sink | Cross-system chain | `collectSinkMaterialIds` covers id through real substitution yield | Vitest data | High — dead drops = economy leak |
| INV-BAND-2 | `PHYSIQUE_ESSENCE_BAND_DROPS` shared objects / PhysiqueEssence | Two table lanes + authority share one object | Boundedness — a mutating consumer corrupts the shared entry | Repeat (every kill reads the same object) | `resolveDrops`/`EssenceSubstitutionEconomy` field-level read audit | Code inspection | High — aliasing by design |
| INV-BAND-3 | `materialBag` contents / save | bao/phap ids persist and restore | Recoverability — no orphan material ids | Interruption (save/reload) | `MATERIALS` registry contains both ids | Vitest data | Medium |
| INV-BAND-4 | `reward_particle` stream / BattleLootSystem | guaranteed lane + signature lane both emit | Exactly-once routing — no item-path leak, no duplicate grant | Cross-system chain | 2 essence particles asserted, 0 item particles | Vitest integration | Medium |
| INV-BAND-5 | pham essence availability / stranded player | LQ stops dropping pham mid-chapter | Monotonicity — chapter completability preserved | Stale state (mid-progress save) | `measureStrandedCompletion` sim at pinned inputs (M-QI-09) | Vitest sim | High — progression lock |
| INV-BAND-6 | `huyet_mong` signature / ENEMIES | band swap must not retune the catch-up valve | Conservation — signature exempt from band map | Value mutation | chance 1, amount 12/12 literal pin | Vitest data | Medium |
| INV-BAND-7 | chance gate on migrated line | gate (0.7) must live INSIDE the entry (learned-defect QA-2026-09-12-009) | Determinism — gate preserved through lane change | Value mutation (rng 0.5 vs 0.99) | emit at rng 0.5, no emit at rng 0.99 | Vitest integration | High — ungated essence = economy leak |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/drop src/data/drop src/data/enemy src/data/realm src/core/simulation/earlygame src/core/game/BattleLootSystem src/core/realm` | 41 files / 324 tests, all pass | INV-BAND-1/3/4/5/6/7 resolved by green pins |
| `resolveDrops.ts` field audit (rg `\.chance =\|\.amount =\|push(\|Object.assign` over resolver + sim) | read-only: `entry.chance`/`entry.amount` consumed, never written | INV-BAND-2 resolved — shared-object mutation impossible via these consumers |
| `rg tinh_hoa_(bao|phap)_the src/data/materials/materials.ts` | both registered (`id:` at 282, 289) | INV-BAND-3 resolved |
| `npx vitest run tests/architecture/asciiComments.test.ts` | remaining violations all pre-existing M-F-RESPEC files; zero task-owned | P15 clean on task surface |
| `npm run verify` (full: type-check + build + 745 files) | 6734 pass, 6 fail — none task-owned | Pre-existing: 3 SkillPathPanel (`getTurnBattle` mock gap from base commit 04364847), 2 `magick` ENOENT env, 1 asciiComments (16 sibling violations, 0 task-owned) |

## Findings

No Confirmed, Suspected, or Coverage-gap findings on the task-owned
diff. All seven ledger hypotheses resolved with conclusive checks.

## New or Changed QA Tests

None authored during QA — the mission's own pins already cover every
ledger row (`StageDropTables.essenceBand.test.ts` runtime emit + chance
gate, `PhysiqueEssence.test.ts` identity/lane pins,
`HiddenBeastDrops.test.ts` signature pin, `EnemyDropSinkInvariant.test.ts`
sink coverage now derived from the real substitution authority,
`BattleLootSystem.dropResult.test.ts` particle routing).

## Gaps and Residual Risk

- Shared-object aliasing is protected by convention (all current
  consumers read-only) rather than a freeze; a future consumer that
  mutates `guaranteed` entries would corrupt the authority. Bounded by
  the identity pin (stray/literal lines fail loudly) — low residual.
- Live-browser emission of the new particles not exercised (P13/P14 not
  triggered — no UI/wiring/rendering change; presentation routing is
  M-QI-08's landed surface, unchanged here).

## Pre-existing Failures

- `SkillPathPanel.test.ts` ×3 — `gameManager.getTurnBattle is not a
  function` inside `NodeTreePanel.vue:107` mocks; introduced by base
  commit `04364847` (M-F-RESPEC) on `origin/p7/truc-co`. Not task-owned.
- `dongFuBackgroundAssets` / `dongFuBuildingPipeline` — `spawnSync
  magick ENOENT`; environment lacks ImageMagick. Same class recorded by
  M-QI-09's ledger.
- `asciiComments` ratchet — 16 violations, all in M-F-RESPEC sibling
  files on the base branch. Zero task-owned.
