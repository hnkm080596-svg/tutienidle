# P5 — Three-Path Balance Baseline

Spec: `docs/specs/2026-09-20-post-canonical-foundation-block-spec.md` §P5.
Depends on: P4 harness (`runBattle`/`runBattles`, `BattleMetrics`, seeded
RNG, phase-split durations — all landed and externally approved).

## Goal

Establish baseline builds for the three cultivation paths and validate
DISTINCT combat identities across a fixed benchmark battery — a
machine-checkable balance report plus a committed metrics snapshot that
later balance work can diff against.

Exit conditions (spec §P5, verbatim):
- no path dominates every benchmark category;
- each path has identifiable strengths and weaknesses;
- no core resource economy deadlocks;
- no secondary mechanic unintentionally becomes the universal dominant
  damage source.

## Decisions

### Baseline construction (review r1 HIGH-1)

- **BaselineRecipe** — NOT ritual-only. Verified gaps: `phap_tu/ngu_hanh`
  grants no `skillIds` at ritual (kit arrives via `selectPhapTuElement`,
  a separate atomic writer that purchases the element root —
  `GameManagerProgressionOps.ts:198`); `the_tu/hien` needs a root node
  (`resolveTheTuKit` returns `undefined` without `cuong_chien`/`tran_the`
  → `GENERIC_PHYSICAL_BASIC`, no kit); only `kiem_tu/hien` is functional
  from `freshKiemTuState()` alone.
- Recipe = ONE identical mortal source `PlayerData` + ritual
  `{pathId, wayId}` + an explicit, declared list of **canonical
  post-ritual writes** per baseline:
  - `kiem_tu/hien`: none (preset is functional at ritual).
  - `phap_tu/ngu_hanh`: `selectPhapTuElement(<element>, <route>)` —
    element + route are build inputs declared per baseline (default row:
    one declared element, e.g. `fire`; element-sensitivity is a
    secondary-row concern, not a gate row).
  - `the_tu/hien`: `progressionOps.purchaseNode('cuong_chien')` —
    canonical root via the public manager writer, declared in the
    recipe.
- The source player carries the insight budget the recipe's node
  purchases actually spend (M0 census pins exact costs; the recipe
  fails loudly if a canonical write returns false — no silent
  partial builds).
- **Power point**: the baseline measures ENTRY-level identity — the
  earliest point where every path's kit is mechanically live
  (qi_refining, ritual + declared writes). Verified limitation: the
  `linh_ngo_<element>` special/ultimate unlock nodes are
  `golden_core`-gated (`PhapTuNodes.builders.ts:184`), so ngu_hanh's
  empowered-ult lane is unreachable at the baseline point — the report
  records this as an explicit entry-vs-full-kit limitation rather than
  inflating the source player to golden_core (which would also flood
  every path with unrelated progression power). Full-kit comparison is
  deferred follow-up work, not P5 scope.
- **Alternate rows** (ngo_dao, ung_the, ngu) run the same matrix
  reported as alternates, not gate rows. Verified eligibility differs
  per way — `ngu` requires `tram` skillLevel 3, `ung_the` requires
  `huy_quyen` skillLevel 3, `ngo_dao` requires `linh_bao` cast-level 3 —
  so the shared mortal source state carries ALL THREE preconditions
  (one universal-qualified mortal), pinned in M0 census. Alternate
  recipes get their own declared post-ritual writes on the same
  principle.

### Metrics (review r1 HIGH-2, r2 HIGH-1)

- Player HP output is derived from the VITALS lane, not the `damage`
  event: verified `applyDirectDamage`/`applyReactionDamage`/
  `applyModifiedDirectDamage` emit `entity_vitals_changed` only —
  `damage` fires solely from `resolveActionHit`/`applyDotDamage`, so
  `damage.bySource['player']` under-counts scheduler flat/reaction/
  reflection damage. The collector gains
  `hpDamageBySource` = sum of `hpBefore − hpAfter` on
  `entity_vitals_changed` where the target is enemy-side, `sourceId`
  resolves to the player role, AND `reason` is in the declared
  damage-reason set (existing role-key machinery).
  Player DPS = `hpDamageBySource['player'] / combatDurationSeconds`.
  The `damage`-event metrics stay as hit-context (crit/dodge/type)
  but never feed a path KPI.
- Incoming player damage = negative HP deltas on vitals events where
  `entityId` is the player AND `reason` is in the declared damage set —
  `damage | dot | ward_break | reaction | reflection |
  heavenly_tribulation`. `stat_refresh` (verified: max-HP shrink clamps
  HP without combat damage), `regen`, `healing`, `leech`,
  `survive_lethal`, and `ward_*` reasons are NOT damage and are
  excluded. The allowed set is pinned in M0 and enforced by tests.
  `takenByTarget['player']` stays as the event-lane cross-check.
- Companions are not part of the baseline (no companion keys in KPIs).
- Per cell (path × benchmark × seed): outcome, fightingSteps, TTK
  (victory-only — see ordering), player DPS, HP damage taken, healing,
  resource ledger, casts per skillId, reaction counts,
  `damageByMechanic` buckets, fingerprint.

### Seed policy (review r1 HIGH-3)

- Fixed seed battery `BALANCE_SEEDS` (K seeds, K pinned in M0 — enough
  to separate rolls without inflating runtime), IDENTICAL across all
  paths and benchmarks: cell (path, benchmark, seed_i) for i in 1..K.
- Gates evaluate AGGREGATES, never single rolls: victory rate
  (wins/K), median TTK/fightingSteps, mean player DPS, mean damage
  taken. Per-seed fingerprints retained — the regression snapshot pins
  the full ordered fingerprint set, so any engine/content drift still
  fails deterministically.

### Scenario ranking + gates (review r1 HIGH-4, r2 HIGH-2)

- **Lexicographic aggregate ordering** per benchmark — a seed battery
  yields mixed outcomes, so ordering keys on:
  1. `victoryRate` desc (wins/K);
  2. `defeatRate` asc (losses/K);
  3. the scenario scalar (below).
- **TTK** = median `fightingSteps` over VICTORIOUS seeds only. A row
  with `victoryRate = 0` has no TTK — it ranks below every row with
  ≥1 victory regardless of scalar, and the cell records `ttk: null`
  explicitly rather than blending defeat times into a clear-time stat.
- Scenario scalars:
  - `single_target`, `durable_target`: median victory TTK (lower
    better) — kill-speed identity.
  - `multi_enemy`: median victory TTK, then mean player DPS — AoE
    throughput identity.
  - `burst_pressure`: median player HP fraction remaining at battle
    end across all seeds (survival margin), then mean player DPS.
  - `attrition`: median victory TTK, then resource-stability flag.
- **Comparator contract, key-by-key** (review r3 MEDIUM): the ordering
  evaluates keys sequentially; advance to key i+1 ONLY when key i ties:
  1. `victoryRate` — exact equality required to tie;
  2. `defeatRate` — exact equality required to tie;
  3. each subsequent numeric scalar — ties when
     `|a − b| ≤ ε·max(|a|, |b|)`, ε = 0.05;
  4. booleans/enums (resource-stability flag) — exact equality.
  `ttk: null` semantics: null vs null = tie (advance to next key);
  null vs number = the null row strictly loses at that key (it never
  reaches scalar comparison anyway when victoryRate=0 rows already
  lost at key 1). Dominance and strength/weakness gates consume this
  ONE comparator — no separate ad-hoc comparisons.
- **Dominance gate (exit-1)**: FAIL if one path is strictly first on
  the scenario ordering in EVERY benchmark.
- **Strength/weakness gate (exit-2)**: per path, FAIL if it is not
  best-or-tied on ≥1 benchmark (no identifiable strength) OR not
  strictly-worst on ≥1 benchmark (no identifiable weakness). Both
  directions required — strengths AND weaknesses.
- **Stalemate gate**: outcome `timeout` where the player's own DPS is
  negligible AND incoming damage cannot kill — flagged per cell.
- **Resource-deadlock gate (exit-3, distinct from stalemate)**:
  phase-aware `expectedEconomy` per recipe — three declared channel
  lists, all evaluated only on `attrition` (and `single_target`):
  - `mustGenerate`: ledger fields that must move UP
    (`theGained>0` etc.);
  - `mustSpend`: ledger fields that must move DOWN
    (`mpSpent>0` etc.);
  - `notActiveAtThisPowerPoint`: channels the way owns but whose
    spender/generator is realm-gated out of the entry baseline —
    recorded, never asserted.
  `none` (all lists empty) is allowed. Verified ownership: Thế is the
  Ứng Thế reactive economy (`TheEconomy.ts` — "ung_the proc-fuel"), so
  `the_tu/hien` declares no `the*` channels. Verified entry-level gap
  (r3 MEDIUM): `ngu_hanh` owns `phap_tu.the_pool` and its element
  basic does generate Thế (`applyPhapTuTheGains` +5/cast), but the
  spender is the empowered ultimate (`THE_THRESHOLD=100`) — the same
  golden_core gate recorded above. So ngu_hanh declares
  `mustGenerate: [theGained]`, `mustSpend: [mpSpent]`, and puts
  `theSpent` in `notActiveAtThisPowerPoint` — owning a pool never
  implies its spender is live at this power point. M0 resolves each
  row's declaration from the active way's owned mechanics at the
  entry point. Verified limitation: Kiếm Ngự's Kiếm Ý/Kiếm Đạo gauges
  are buff-state, not in the MP/Ward/Thế ledger — alternate-row
  declarations use the channels the ledger actually sees; uncovered
  channels are recorded as observability limitations.
- **Universal-secondary gate (exit-4) — tri-state verdict** (review
  r4 HIGH): per path, `damageByMechanic` from the canonical
  provenance seam — `trace.records[].operation.origin`
  (`kind`/`originId`/`reactionId`) joined to the record's settled
  `deal_damage` result `hpDamage`, bucketed as `kit_skill` /
  `other_skill` / `reaction` / `buff_periodic` / `proc` / `scripted` /
  `unattributed`. Never inferred from cast counts. Verdict:
  - `PASS` — `unattributed` share within tolerance AND no non-kit
    bucket is the top damage source on every primary row;
  - `REVIEW_REQUIRED` — one non-kit bucket tops EVERY primary row
    (pending design-intent adjudication);
  - `INCONCLUSIVE` — `unattributed` share exceeds tolerance (the
    evidence is insufficient to conclude anything about secondary
    mechanics).
  The exit condition is satisfied ONLY on `PASS` — the report must
  never claim exit-4 while in `REVIEW_REQUIRED`/`INCONCLUSIVE`.

### Tuning bounds

If a gate fails, adjust ONLY content the failing path owns (its
skills/stat facets/node values per the P1 ownership map) — no
cross-path edits, no new content, no harness-side normalization. If no
in-scope tuning satisfies the gate, the report records the failure
with evidence and the task stops for review — never silently widened.

## Mission split

### P5-M0 — Census + report skeleton
- Inventory doc `docs/architecture/2026-09-23-balance-baseline-inventory.md`:
  - per-path BaselineRecipe resolved through CULTIVATION_PATH_MODULES +
    canonical writers (ritual args, required post-ritual writes with
    exact node ids / element / route, insight costs, kit contents the
    writes produce);
  - universal-qualified mortal source state (all three alternate
    preconditions + baseline ritual gate `linh_bao` lv3 + realm level);
  - the five benchmark fixtures (concrete statsInput per encounter +
    rationale — stats chosen so the scenario metric discriminates
    rather than binary pass/fail);
  - `BALANCE_SEEDS` value + justification;
  - scenario scalar / ε / gate table;
  - `expectedEconomy` declarations per baseline.
- Pin the damage-surface contract in the inventory: `damage` event =
  hit-lane subset (resolveActionHit/applyDotDamage); vitals
  `entity_vitals_changed` = complete HP-damage surface. Confirm every
  `deal_damage` damageProfile channel emits vitals with a usable
  `sourceId`, which producers bypass the scheduler entirely (feeding
  `unattributed`), and that reflection/ward_break source attribution
  is correct under the vitals-derived rule.

### P5-M1 — Fixtures + matrix runner + mechanic attribution
- `src/core/simulation/benchmark/BenchmarkEncounters.ts`: the five
  encounter factories (deterministic literals, no Math.random).
- `src/core/simulation/benchmark/BalanceBaselines.ts`: mortal source +
  BaselineRecipes (primary rows + alternate rows with declared
  post-ritual writes and `expectedEconomy`).
- `src/core/simulation/benchmark/BalanceReport.ts`: `runBalanceMatrix()`
  → `runBattles` over recipe × benchmark × seed; aggregate per cell;
  gate evaluation producing the flags above.
- Extend `BattleMetricsCollector` (tooling module only) with
  `damageByMechanic` (trace origin provenance, settled `hpDamage`)
  and `hpDamageBySource` (vitals-lane player output, declared
  damage-reason set) — the bucket schema + coverage check.
- Fingerprint scope (review r3 HIGH): the P4 fingerprint hashes
  `damage.bySource` — the incomplete event lane. P5 extends the digest
  to include the normalized `hpDamageBySource` + `damageByMechanic`
  buckets (plus `phaseSteps`, resource ledger — the fields that drive
  gates), so a reaction/direct-damage tuning that moves P5 output MUST
  move the fingerprint. The committed regression oracle is the
  per-seed fingerprint set + the committed aggregate metric table.
- Catalog bootstrap (review r4 HIGH): verified `BattleSimulation`
  registers only `PHAP_TU_NODES` + `PHAP_TU_AN_NODES` while production
  (`App.vue:295-299`) registers the full closure —
  `+ KIEM_TU_NODES + THE_TU_NODES + THE_TU_AN_NODES`. The harness
  bootstrap extends to the same required progression-node closure, so
  `progressionOps.purchaseNode('cuong_chien')` resolves. Oracle: the
  real `the_tu/hien` recipe must successfully purchase its root —
  covers alternate recipes needing Kiem/Ung The nodes too.
- Recipe application seam (review r2 MEDIUM, r4 MEDIUM): `postRitual`
  lives on `BattleSimulationInput` — it is simulation SETUP, not build
  state, so `SimBuildSnapshot` stays a pure state payload. Entries are
  a CLOSED discriminated union — never callbacks (an arbitrary
  mutation seam inside the harness):

  ```ts
  type SimulationCanonicalWrite =
    | { type: 'select_phap_tu_element'; element: ElementType; route: PhapTuRoute }
    | { type: 'purchase_node'; nodeId: string }
  ```

  `runBattle()` switches exhaustively to the public GameManager
  writers (`progressionOps.selectPhapTuElement`,
  `progressionOps.purchaseNode` — never the pure `purchaseNodeSystem`
  directly). Future setup operations extend the union explicitly. A
  write that returns false fails the run loudly with the recipe id.
- Tests: matrix shape, per-cell aggregation correctness on synthetic
  inputs, gate unit tests (dominance / strength-weakness / stalemate /
  deadlock / secondary flags each fire on crafted metrics and stay
  quiet on a healthy table), mechanic-bucket attribution correctness
  + coverage check, failed-write rejection.

### P5-M2 — Baseline measurement + tuning loop
- Run the matrix on real content; write
  `docs/balance/2026-09-23-three-path-baseline.md` with the full table
  (aggregates + per-seed fingerprints + gate verdicts + per-path
  strength/weakness read + limitations).
- If a gate fails: in-scope tuning on the failing path's owned content
  only; re-run matrix; record the delta in the report.
- Regression test: committed expected fingerprint set per cell
  (exact match — any drift is a deliberate-review event updated with
  the balance change that caused it).

### P5-M3 — Gates + docs
- `npm run verify` full green in worktree.
- P18 OCR over the P5 delta; adversarial QA (quick); 3 sequential
  passes; external review loop to IMPLEMENT-READY.
- `docs/systems/combat-simulation.md` gains the balance-matrix section;
  systems README index updated.

## Boundaries

- Tooling-only: `src/core/simulation/**` stays unimported by gameplay /
  presentation code.
- No combat-rule changes; tuning touches only path-owned content values
  (numbers), never mechanics/authority.
- Benchmarks are fixtures, not new game content — they never register
  into the real catalog outside a simulation run.
- The gate evaluates the ENTRY-level baseline point only; full-kit and
  cross-realm balance are explicitly out of scope (recorded
  limitation).
- Fingerprint snapshot updates are allowed ONLY alongside an
  intentional balance/content change, documented in the same commit's
  report.

## Risks

- `selectPhapTuElement` purchases a real node — insight cost and the
  `canPurchaseNodeSystem` prerequisites must be satisfiable at the
  baseline point; M0 pins exact costs and the source player's insight.
- A benchmark may be un-winnable or un-losable by construction —
  fixture stats get a stated rationale in the inventory, tuned so the
  scalar discriminates rather than binary pass/fail.
- K seeds × 5 benchmarks × (3 primary + 3 alternate) rows is the
  runtime floor; K stays small enough for the suite budget (M0 pins).
- Mechanic attribution coverage: damage emitted outside the scheduler
  (raw CombatSystem paths) lands in `unattributed` — if that share is
  large the gate's resolution degrades; the M0 census bounds it before
  the tolerance is set.
- Tuning loop scope creep — bounded by path-owned content only +
  documented deltas; unresolved gates report honestly.
