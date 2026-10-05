# QA Review: mortal equipment drop gate (poolDrawChance 0.15)

- Date: 2026-10-05
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/core/drop/DropTable.ts
  - game/src/core/drop/resolveDrops.ts
  - game/src/data/drop/StageDropTables.ts
  - game/src/core/drop/resolveDrops.test.ts
  - game/src/core/drop/dropEconomy.test.ts
  - game/src/data/drop/DropTables.test.ts
  - game/src/core/game/BattleLootSystem.dropResult.test.ts
  - game/src/core/game/BattleLootSystem.realmReward.test.ts
  - game/src/core/game/GameManager.grantRandomEquipmentDrop.test.ts

## Scope and Risk Map

Task: Minh ruling 2026-10-05 — mortal-band kills mint equipment ~15% of the
time instead of every kill, realized as a reserved "miss" weight inside the
existing single-rng() pool draw (`StageDropTable.poolDrawChance`). No new rng
call; documented consumption order preserved.

Changed-risk mapper: all 9 paths returned `unmappedPaths` (the drop subsystem
is not in the mapper's path table). Manual routing by code inspection:
`core/drop/*`, `data/drop/*`, and the three `core/game` test seams map to the
**economy-and-progression** and **inventory-equipment** domain packs.
One-hop consumers inspected: `BattleLootSystem.grantResolvedDrops` (items
sink), `dropSampling.sampleDropExpectation` (statistical preview — calls the
real `resolveDrops`, so previews inherit the gate), `explorationRewards.ts`
(display label only), `stageDropTableFor`/`familyDropTableFor` (unchanged
lookup). No other equipment minting path exists: `equipment_any` resolves
exclusively through `resolveDrops`.

Escalation decision: no mandatory deep trigger — no save/cloud change, no
clock/offline change, no Vue/Pinia/Phaser ownership change, mapper
`deepAuditCandidate: false`. The economy change is the bounded task scope
(one band, one optional field, deterministic gate); material risk bounded by
code inspection plus real-path statistical pins.

Exclusions: none — all dirty paths are task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-GATE-1 | `resolveDrops` pool draw | Kill on mortal band → each pool draw yields equipment_any/family item at 15% | Conservation — no item minted on a miss; rate exact at merged-bag level | Value mutation (rolls in hit/miss bands) | `result.items` empty on miss; statistical rate | `resolveDrops.test.ts` miss-band test; `dropEconomy.test.ts` rate pins | High — the ruling's core claim |
| INV-GATE-2 | rng cadence | Miss consumes exactly one rng() per draw | Determinism — downstream signature/currency rolls keep documented positions | Reorder (scripted cadence) | spiritStone/techniqueMastery amounts read the right rng slots | `resolveDrops.test.ts` cadence pin ([0.9,0.1,0.9] → items 0, SS 1, TM 9) | High — order contract is pinned by scripted-rng tests |
| INV-GATE-3 | draw boundary | rng() = 0 exactly | Boundedness — endpoint values resolve sanely | Value mutation (endpoints) | roll 0 → first entry pays (hit) | covered by chance-0 test boundary reasoning; rng=0 lands in hit band | Medium |
| INV-GATE-4 | rng() out-of-domain (learned defect QA-2026-09-01-012) | injected rng returns >1, <0, NaN | Boundedness — no value created from bad roll | Value mutation (just-outside, nonfinite) | rng>1 → miss; rng<0 → first entry (same as pre-change); NaN → miss (pre-change: paid last entry — stricter now) | code inspection; same behavior class as pre-change for finite inputs | Medium |
| INV-GATE-5 | `grantResolvedDrops` items sink | Kill → `items: []` result | Atomicity/no partial grant | Interruption (empty items) | `for (const drop of items)` no-ops; no toast, no bag add | BattleLootSystem dropResult/realmReward tests (miss → no equipment grant) | Medium — empty items was already reachable via empty pool |
| INV-GATE-6 | `poolMissWeight` | `poolDrawChance <= 0` | Boundedness — always miss | Value mutation (zero chance) | Infinity miss weight → miss for all rng in [0,1], NaN for rng=0 still misses | `resolveDrops.test.ts` chance-0 test | Medium |
| INV-GATE-7 | family-only gate leak | `familyTable` lines in merged bag | Conservation — family lines gated at same rate | Cross-system chain | roll in miss band pays nothing even though family entry exists | `resolveDrops.test.ts` merged-bag test (gated vs ungated) | High — ruling covers the merged bag |
| INV-GATE-8 | extra rolls (boss/elite) | BOSS_MODIFIER 4 draws, each gated | Exactly-once per draw semantics | Repeat | 2 hits / 2 misses under scripted rolls | `resolveDrops.test.ts` extra-roll test | Medium |
| INV-GATE-9 | empty pool + gate | stage pool empty, gate set | Determinism — zero rng per draw (pre-change parity) | Value mutation (empty bag) | `total <= 0` early return before rng() — identical to pre-change | code inspection; poolMissWeight returns 0 on hitWeight <= 0 | Low |
| INV-GATE-10 | downstream item consumers | items[] length < rolls | consumers must not assume positional parity | Cross-system chain | bags/summary/toast iterate `items`, never index by draw number | code inspection of grantResolvedDrops + BattleLootSystem tests | Medium |
| INV-GATE-11 | boundary equality | roll exactly at hit/miss boundary (roll == hitWeight after walk) | Conservation — boundary belongs to hit side | Value mutation | `roll <= 0` after subtracting last weight pays last entry | code inspection | Low |
| INV-GATE-12 | signature/guaranteed lines | gate must NOT affect guaranteed or signature rolls (independent chances) | Conservation — only pool draws gated | Scope check | guaranteed essence line still rolls its own 0.7 chance | BattleLootSystem realmReward test (0.8 misses essence, 0.1 hits pool) | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run` (full suite, worktree) | 8868 passed, 12 expected-fail, 9 skipped, 0 failed | Full run after all test fixes |
| `npm run type-check` | clean | vue-tsc build |
| `resolveDrops.test.ts` gate suite (7 new tests) | pass | miss band, cadence pin, hit band, merged-bag gating, extra rolls, chance 1/undefined, chance 0 |
| `dropEconomy.test.ts` statistical pins | pass | mortal noEquipmentRate 0.83–0.87 via 100k seeded samples of the real path; qi_refining/foundation unaffected |
| `BattleLootSystem.*` + `GameManager.grantRandomEquipmentDrop.test.ts` stale-pin fixes | pass | scripted rng injected through `setLootRng` — real authority path, no behavior mock |
| Balance check (economy-designer subagent unavailable in this env — run inline) | healthy within ruling intent | no quest/forge gate depends on equipment influx; boss ≥1-item chance ~48% (4 draws), elite ~28% — noted for Minh |
| OCR delegate review (P18, all 9 files, 100% coverage) | 0 confirmed findings | rules: core/domain-authority, content/registry, test-defect groups |

## Findings

None. All ledger hypotheses resolved by real-path tests or direct code
inspection with recorded reasoning.

## New or Changed QA Tests

QA observed the task's own tests (authored in the implementation diff) as
evidence; no additional reproduction test was needed because every
high-risk hypothesis already had a conclusive real-path check:

- `resolveDrops.test.ts` `poolDrawChance gate` suite — deterministic oracle
  for miss band, rng cadence (one call per draw), merged-bag gating,
  extra-roll gating, and boundary chances (0, 1, absent).
- `dropEconomy.test.ts` — statistical oracle over 100k seeded kills of the
  real `resolveDrops` for mortal (~15% equipment) and unaffected bands.
- `DropTables.test.ts` — shape pin constraining authored `poolDrawChance` to
  (0, 1].
- Stale-pin repairs in `BattleLootSystem.dropResult.test.ts`,
  `BattleLootSystem.realmReward.test.ts`,
  `GameManager.grantRandomEquipmentDrop.test.ts` — re-pinned scripted rolls
  that document the gate (guaranteed 0.8 miss → pool 0.1 hit), keeping
  assertions on observable grants/summary/toast.

## Gaps and Residual Risk

- Boss/elite equipment expectation: 4-draw boss ≈ 0.6 expected items (≥1 at
  ~48%), 2-draw elite ≈ 0.3 (≥1 at ~28%) — an 85% reduction in expected
  mints, consistent with the ruling, but the ≥1 probability is not flat 15%.
  Surfaced to coordinator for Minh's awareness; not a defect against the
  specified mechanism ("gate each draw").
- `rng()` returning exactly the float-precision boundary values relies on the
  same `roll <= 0` walk as before; endpoint semantics unchanged.
- balance-check skill could not spawn its `economy-designer` subagent in this
  environment; the analysis was executed inline by the reviewer instead.

## Pre-existing Failures

None observed. Full suite green.
