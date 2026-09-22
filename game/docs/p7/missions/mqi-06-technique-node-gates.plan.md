# M-QI-06 — Technique Node Gates — plan

Spec: `mqi-06-technique-node-gates.spec.md` (**v3 — `MQI06_SPEC_REVIEWED`**). Implements QI-D3: technique-derived node unlock gates (already-evaluated prerequisites — the proving set authors `techniqueRank` only; `techniqueGrade` stays a supported-but-unauthored variant reserved for later content) + per-level cap mechanism (`levelGates` → `getEffectiveNodeMaxLevel`/`getBlockingNodeLevelGates` → `canUpgradeNode`/cost reads), plus a minimal authored set across all three way trees.

## Step 0 — seam census (done during spec)

- `canUpgradeNode` (NodeSystem:195-206): authored `getNodeMaxLevel` read at :201 — the single enforcement point; `upgradeNode` delegates.
- `progressionOps.getNextNodeCost` (:413-427) / `getSkillCoreUpgradeCost` (:540-559): cost previews must respect the effective cap.
- `NodeInspector`: `lockedReasons` only fires at level 0 — needs `upgradeGateReasons` driven by the BINDING gate (frozen-surplus-safe); `Lv x/max` stays authored; cost span renders upgrade text whenever `level>0 && !isMaxed` (:263) — must suppress on `nextCost === null`.
- `NodeTreePanel` (:225-243, costLabel :294-304): `nextCost` must null at effective cap; `is-maxed` (:603) keys authored max; `costLabel` interpolates `entry.nextCost` for `0<level<authoredMax` — must return '' at cap.
- Cast sink (`GameManager` castCountSink) writes `nodeLevels[core]` directly — untouched (spec INV-6).
- Save validation: `core_*` ids only enforce integer + authored max (`SKILL_CORE_BY_ID`); ordinary nodes validate as finite non-negative NUMBERS (`isNonNegativeFiniteNumber` — non-integer levels pass today) — UNCHANGED, no new ordinary-node max check (spec §5/INV-2).
- **M6 negative pin**: `GameManager.deadIds.test.ts:96-123` forbids techniqueRank/techniqueGrade in `prerequisites`/`revealWhen` across all 5 catalogs — must be migrated to a constrained-authoring guard or the authored set fails the full suite.

## Step 1 — TDD failing tests first

1. `src/core/progression/NodeSystem.levelGates.test.ts` (new):
   - `getEffectiveNodeMaxLevel`: no gates → authored max; unsatisfied L6 → 5; all satisfied → authored; two unsatisfied (L6,L9) → 5 regardless of authored order; absent `techniqueProgress` → fail-closed; `atLevel > maxLevel` inert.
   - `getBlockingNodeLevelGates`: considers only relevant gates (unsatisfied, `2 <= atLevel <= maxLevel`); returns gate(s) at the minimum relevant `atLevel`; `[]` when none — including when all unsatisfied gates sit above authored max (inert gates never surface as blockers).
   - `canUpgradeNode` at effective cap → false; rank raised → true. `upgradeNode` rejected at cap → zero mutation (insight, nodeLevels, purchasedNodeIds); over-cap owned level still aggregates (INV-1).
2. `progressionOps` tests: `getNextNodeCost`/`getSkillCoreUpgradeCost` → undefined at effective cap, defined below it.
3. `src/data/progression/TechniqueGateAuthored.test.ts` (new): real catalogs — 17 gated nodes present; `levelGates.atLevel ∈ [2, maxLevel]`; authored `techniqueRank >= 1`; exact gate table per spec §6.
4. **M6 pin migration** (`GameManager.deadIds.test.ts`): replace the negative invariant with a constrained-authoring guard — `techniqueRank` allowed in `prerequisites` only on the 9 unlock ids; allowed in `levelGates` only on the 8 cap ids; `techniqueGrade` + `revealWhen` technique gates forbidden everywhere.
5. System-level authored regression: `linh_ngo_<godUlt>` unpurchasable below rank 5 despite satisfied node prereq (AND composition); intensity node upgrades to 5, blocked 5→6 until rank 3, blocked 8→9 until rank 6.
6. `NodeInspector` mounted: capped node shows `Lv x/authoredMax`, disabled upgrade, localized binding-gate reason, NO cost text at `nextCost === null`; rank raised → enabled; **frozen-surplus**: owned L6 + rank reset 0 → upgrade disabled AND L6@rank3 reason renders; `NodeTreePanel` mounted: `costLabel` empty at cap (no null interpolation), badge `x/10`, `is-maxed` false.

## Step 2 — schema + evaluator

- `ProgressionNode.ts`: `levelGates?: { atLevel: number; prerequisite: NodePrerequisite }[]` + doc (upgrade-only, non-regressing, order-independent, `atLevel ∈ [2, maxLevel]` discipline). Same edit retires the stale M6 comment "No authored gates yet" at :42-48 → rank gates first authored by M-QI-06, grade remains unauthored.
- `NodeSystem.ts`:
  - `getBlockingNodeLevelGates(player, node)` — relevant gates = unsatisfied with `2 <= atLevel <= getNodeMaxLevel(node)`; returns gate(s) at the min relevant `atLevel`; `[]` when none. THE authority for "which gate binds".
  - `getEffectiveNodeMaxLevel(player, node)` — `min(getNodeMaxLevel(node), minUnsatAtLevel - 1)` derived from the helper.
  - `canUpgradeNode` switches :201 to the effective read.
- `GameManagerProgressionOps.ts`: `getNextNodeCost` (:422) + `getSkillCoreUpgradeCost` (:554) switch their cap checks to `getEffectiveNodeMaxLevel`.

## Step 3 — authored gates

- `PhapTuNodes.builders.ts`: `growth()` options gain `levelGates`; `minor_<element>_intensity` gets `[{atLevel:6, techniqueRank:3},{atLevel:9, techniqueRank:6}]`; `linh_ngo_<godUlt>` call site appends `{kind:'techniqueRank', rank:5}` to `unlockNode`'s prereq list.
- `KiemTuNodes.ts`: `ngu_kiem_sac`/`ngu_kiem_phong`/`ngu_kiem_sat` get `levelGates: [{atLevel:5, prerequisite:{kind:'techniqueRank',rank:4}}]`.
- `TheTuNodes.ts`: `major_bat_tu_tuc_menh`/`major_loan_dau_sat`/`major_khiem_khich_dien`/`major_son_nhac_bao_bi` append `{kind:'techniqueRank', rank:5}` to prerequisites.

## Step 4 — UI

- `NodeInspector.vue`:
  - Extract the prereq→localized-reason mapping into ONE local `prereqReason(prereq)` formatter shared by `lockedReasons` and `upgradeGateReasons` (no duplicated if/else chain).
  - `upgradeGateReasons` computed: `level >= 1 && level < authoredMax && level >= getEffectiveNodeMaxLevel(player, node)` → render `getBlockingNodeLevelGates(player, node)` prereqs via the shared formatter; block headed by `panels.skillPath.nodeInspector.upgradeGateHeader`.
  - Cost span: `nextCost === null && level < authoredMax` renders empty (no `cost.upgrade` interpolation).
- `NodeTreePanel.vue`: `nextCost` computed via `getEffectiveNodeMaxLevel` (null at cap); `is-maxed` gains `entry.level >= entry.maxLevel` (authored); `costLabel` returns `''` when `entry.nextCost === null` below authored max.
- Locales `en`/`vi`: `upgradeGateHeader` = "Upgrade blocked:" / "Nâng cấp bị chặn:".

## Step 5 — verification

- `npm run type-check` + focused vitest scope (levelGates, ops, authored-integrity, deadIds guard, inspector/tree mounted tests).
- Full `npx vitest run` — the authored set touches real catalogs; the deadIds guard migration is the suite-breaking seam M1 pinned.
- P15 ASCII-comment gate on touched files.
- P18 OCR → P4 adversarial QA → P5 sequential passes → external impl review.
