# P7 M-QI-06 — Technique Node Gates (unlock + max-level cap) — Spec

Status: v3 — external SPEC review approved (MQI06_SPEC_REVIEWED, round 3)
Depends on: M-QI-05 (canonical Core Node authority — merged `040a6765`), P7-M6
(technique prerequisite kinds + `player.techniqueProgress` mirror — shipped),
P7-M3 (canonical Technique holder).
Mission-graph scope: technique-derived node unlock + node max-level cap
mechanism (schema + evaluator) **plus a minimal authored gate set** per
QI-D3's ruling — not mechanism-only.

## 1. Intent

QI-D3 (decisions.md:148): "Technique provides stat% + node unlock gates +
node max-level gates; it never owns a node's current level."

Today the technique→node seam is half-built: `techniqueRank`/`techniqueGrade`
prerequisites evaluate correctly (P7-M6), but **zero authored nodes use them**,
and no mechanism exists for technique-derived **level caps** — a node either
reaches its static `maxLevel` or not, regardless of the way's technique
mastery. This mission ships the cap mechanism and authors the first honest
gate set so both channels are live on real content (the complete authored
set is a later content pass — M-F-CONTENT-TC in the foundation graph).

## 2. Decision — per-level gate entries, not a cap field

Two shapes were considered for "node max-level gates":

| Shape | Semantics |
|---|---|
| A. `levelGates?: { atLevel; prerequisite }[]` | "Reaching level `atLevel` requires `prerequisite`" — effective max = min over unsatisfied gates' `atLevel - 1`, else authored `maxLevel`. Reuses `NodePrerequisite` wholesale: technique gates are the authored use, but any existing kind composes. |
| B. `techniqueLevelCaps?: { techniqueRank?; techniqueGrade?; maxLevel }[]` | Technique-only threshold table — narrower, duplicates the prerequisite machinery's evaluation + UI-reason plumbing for one caller. |

**Chosen: A.** Rationale:

1. It is the smallest true mechanism: one field, one evaluator, and every
   `NodePrerequisite` kind (incl. `revealWhen` plumbing and inspector
   reasons) carries over unmodified. B invents a second gate language
   that only technique can speak.
2. Order-independent evaluation: effective max = `min(maxLevel, min over
   unsatisfied gates (atLevel - 1))` — no authored ordering contract,
   no first-match semantics to mis-author.
3. The semantic reads directly: `{atLevel: 6, prerequisite: techniqueRank 3}`
   means "the 5→6 upgrade requires technique rank ≥ 3".

## 3. Schema

```ts
// ProgressionNode.ts
export interface ProgressionNode {
  // ...existing fields...
  /**
   * M-QI-06 (QI-D3) - per-level gates: the L-1 -> L upgrade requires
   * `prerequisite` to hold at purchase time. Gates the upgrade
   * transaction ONLY - owned levels never regress (rank resets on
   * technique grade advance are normal progression, not invalidation),
   * and 0->1 purchase is unaffected (prerequisites own existence).
   * Data discipline: atLevel in [2, maxLevel]; entries need not be
   * sorted (evaluation takes the min over all unsatisfied gates).
   */
  levelGates?: { atLevel: number; prerequisite: NodePrerequisite }[]
}
```

## 4. Evaluator — `getEffectiveNodeMaxLevel`

```ts
// NodeSystem.ts
/** Effective reachable max under levelGates: the smallest unsatisfied
 *  gate's atLevel - 1, floored by authored maxLevel. Upgrade semantics
 *  only - getNodeMaxLevel stays the authored/registered ceiling used by
 *  save validation and catalog checks. */
export function getEffectiveNodeMaxLevel(player: PlayerData, node: ProgressionNode): number
```

- `min(authoredMax, min(unsatisfied gate.atLevel - 1))`.
- Gates with `atLevel > maxLevel` are inert; `atLevel < 2` is a
  data-authoring error (documented discipline, not schema-enforced —
  consistent with `techniqueRank >= 1` discipline).
- Fail-closed: an absent `techniqueProgress` mirror fails any positive
  technique gate exactly as M6's prerequisites do (same
  `hasPrerequisite` call).
- Shared blocking read `getBlockingNodeLevelGates(player, node)`:
  considers only RELEVANT gates — unsatisfied entries with
  `2 <= atLevel <= getNodeMaxLevel(node)` — and returns the one(s)
  tied at the minimum `atLevel` within that set (the gate(s) that
  BIND the effective max). Returns `[]` when none: a `levelGates`
  array whose unsatisfied entries all sit above authored max has NO
  blocker, matching the inert-gate rule. `getEffectiveNodeMaxLevel`
  derives from it; UI consumes the same helper so the min-selection
  algorithm lives in NodeSystem only and is never re-derived in Vue
  (single authority for "which gate blocks now" — a caller may treat
  a non-empty result as "blocked" without re-filtering inert gates).

## 5. Enforcement seams (single authority: `canUpgradeNode`)

| Consumer | Change |
|---|---|
| `canUpgradeNode` (NodeSystem) | `level >= getEffectiveNodeMaxLevel(player, node)` replaces the authored read — the authoritative transaction gate; `upgradeNode` inherits it (it delegates to `canUpgradeNode`). |
| `progressionOps.getNextNodeCost` | effective-max read: undefined at the gate so UI never previews a cost for a blocked level. |
| `progressionOps.getSkillCoreUpgradeCost` | same effective-max read (cores carry no levelGates today, but the accessor must not preview a cost past ANY cap). |
| `progressionOps.levelUpSkill` → `upgradeNode` | inherits `canUpgradeNode` — no second check. |
| `NodeInspector` | `Lv x/authoredMax` display stays authored (honest); new `upgradeGateReasons` surface explains a cap-blocked upgrade; `is-maxed` semantics unchanged (true maxed only at authored max); `nextCost === null` below authored max renders NO upgrade-cost text (see §7). |
| `NodeTreePanel` | `nextCost` respects the effective cap (null at cap); `x/max` badge stays authored; `is-maxed` styling keys off authored max (a temporarily capped node never claims completion); `costLabel` renders NO upgrade-cost text when `nextCost === null` below authored max (see §7). |
| `purchaseNode` (0→1) | unaffected — levelGates are an upgrade concept only. |
| Aggregators (`aggregateNodeStatModifiers`, `aggregateTurnSkillResourceModifiers`, body/hidden collectors) | unchanged — owned levels always aggregate (frozen surplus above the current gate is legal by design). |
| `devResetBranch` | unchanged — refunds paid costs; cap state irrelevant. |
| Cast-level sink (`GameManager` castCountSink → `nodeLevels[core]`) | unchanged — the cast channel writes canonical levels per QI-D3's channel-restricted input; no cast-channel core carries a levelGate in this mission (a future technique cap on cast skills is a content ruling, not this mechanism's default). |
| Save validation | unchanged — effective caps NEVER participate in save validation. Existing coverage stands as-is: `core_*` ids validate integer + authored `maxLevel` via `SKILL_CORE_BY_ID`; ordinary nodeLevels entries validate only as finite non-negative NUMBERS (`isNonNegativeFiniteNumber` — non-integer ordinary levels pass today, unchanged). An owned ordinary-node level above the *effective* cap is a legal frozen state, and above authored max remains out of scope (no new ordinary-node max check is added). |

## 6. Minimal authored gate set (QI-D3 ruling — not mechanism-only)

Both mechanisms authored on real, purchasable content across all three
way trees. Thresholds chosen inside the live LQ/TC technique envelope
(grade ceiling = realm index; rank 0..10 per grade). This is a mechanism-
proving set, not a balance pass — the complete gate map is content
authoring deferred to M-F-CONTENT-TC.

**This set authors `techniqueRank` only.** `techniqueGrade` remains a
supported, M6-evaluated prerequisite kind reserved for later content —
the proving set deliberately does not invent a grade placement (QI-D3
requires the mechanism + minimal authored gates, not coverage of every
variant). The constrained-authoring guard below forbids techniqueGrade
in all authored fields until a later mission allows it.

### Unlock gates (`prerequisites` gain `techniqueRank`)

| Nodes | Gate | Composition |
|---|---|---|
| `linh_ngo_<godUlt>` ×5 (PhapTu builder, `unlockNode`) | `{kind:'techniqueRank', rank: 5}` | ANDs with the existing node-chain prereq (`linh_ngo_<special>`, which itself ANDs node+`realm: golden_core` — the realm constraint arrives transitively) |
| `major_bat_tu_tuc_menh`, `major_loan_dau_sat`, `major_khiem_khich_dien`, `major_son_nhac_bao_bi` (TheTu HIEN) | `{kind:'techniqueRank', rank: 5}` | ANDs with `realm: foundation_establishment` + node prereq |

### Max-level cap gates (`levelGates`)

| Nodes | Gates | Reachable at |
|---|---|---|
| `minor_<element>_intensity` ×5 (PhapTu builder, maxLevel 10) | L6 @ `techniqueRank 3`; L9 @ `techniqueRank 6` | LQ grade-1 technique: L1-5 free, 6-8 at rank 3+, 9-10 at rank 6+ |
| `ngu_kiem_sac`, `ngu_kiem_phong`, `ngu_kiem_sat` (KiemTu, maxLevel 5) | L5 @ `techniqueRank 4` | Kiem Tu way: last mastery level needs technique rank 4 |

## 7. UI — upgrade-gate reasons + cap-blocked cost text

### Reasons — binding gate, not next-level scan, not forecast

`NodeInspector.lockedReasons` fires only at level 0 (purchase context).
A purchased node parked at a cap needs a parallel read — new computed
`upgradeGateReasons`, shown **only when the upgrade is gate-blocked**:
`level >= 1` AND `level < authoredMax` AND `level >= effectiveMax`
(the last condition subsumes frozen-surplus states: an owned L6 node
whose technique rank reset below the L6 gate has effectiveMax 5,
`6 >= 5` — blocked, and the L6@rank3 gate is the binding gate to
explain).

It renders exactly `getBlockingNodeLevelGates(player, node)` — the
unsatisfied gate(s) tied at the minimum unsatisfied `atLevel`
(= `effectiveMax + 1` whenever blocked) — through the SAME
prereq->reason mapping as `lockedReasons`. Later, non-binding gates
are NOT shown (no forecast). The prereq->localized-reason formatter
is extracted into ONE local function shared by `lockedReasons` and
`upgradeGateReasons` — the mapping must not be duplicated as a second
if/else chain.

One new i18n key pair
(`panels.skillPath.nodeInspector.upgradeGateHeader`, en + vi) labels
the block — e.g. "Nâng cấp bị chặn:" / "Upgrade blocked:".

### Cost text — never render a null upgrade cost

Both surfaces format an upgrade-cost label for `0 < level <
authoredMax` unconditionally today — a `nextCost === null` at the
effective cap would interpolate an empty cost. Pinned behavior:
when `nextCost === null` below authored max, NO upgrade-cost text is
rendered — NodeInspector's cost span stays empty (the
`upgradeGateReasons` block explains why), `costLabel` in
NodeTreePanel returns the empty string (the authored `x/max` badge
remains the signal). `isMaxed`/`is-maxed` styling still keys off
authored max only.

- Disabled upgrade button already follows `canUpgradeNode` — no wiring.

## 8. Invariants (pins for review + QA)

- **INV-1** Owned levels never regress: a node owned at L10 keeps
  aggregating L10 even when a later grade advance drops technique rank
  below the gate (same non-regressing contract as M6's purchase-gate
  prerequisites). Effective max is an *upgrade* ceiling, never an
  *ownership* ceiling.
- **INV-2** `getNodeMaxLevel` (authored) remains the registry-free
  ceiling wherever an authored bound is read today: save validation
  (currently only `core_*` ids via `SKILL_CORE_BY_ID` — ordinary nodes
  validate as finite non-negative numbers, unchanged) and catalog
  checks. Only player-context reads move to `getEffectiveNodeMaxLevel`.
  This mission adds NO new ordinary-node authored-max validation.
- **INV-3** Failed `canUpgradeNode` mutates nothing (Insight, nodeLevels,
  purchasedNodeIds all unchanged) — inherits `upgradeNode`'s atomicity.
- **INV-4** Level-gate evaluation is order-independent (min over
  unsatisfied) — authored order cannot change semantics.
- **INV-5** The mirror is the only read: `hasPrerequisite` sees
  `player.techniqueProgress`, republished by the M6 sink; no
  `TechniqueManager` coupling inside NodeSystem.
- **INV-6** `levelGates` on `levelsSkillId` cores are legal schema but
  unauthored in this mission; if ever authored, the Insight channel
  respects them through `canUpgradeNode`/`getSkillCoreUpgradeCost`
  automatically — the cast channel would need a separate ruling.

## 9. Tests (TDD)

1. `NodeSystem.levelGates.test.ts` — evaluator unit matrix: no gates →
   authored max; unsatisfied L6 gate → effective 5; satisfied all →
   authored; multiple unsatisfied → min wins (order-independence);
   absent techniqueProgress mirror → fail-closed; `atLevel > maxLevel`
   inert — asserts BOTH effective max == authored max AND
   `getBlockingNodeLevelGates === []` (inert gates never surface as
   blockers); helper returns only gate(s) at the minimum RELEVANT
   unsatisfied `atLevel` (`2 <= atLevel <= maxLevel`).
2. `canUpgradeNode`/`upgradeNode`: purchase to cap boundary → upgrade
   rejected with zero mutation; raise `techniqueProgress.rank` →
   upgrade succeeds; over-effective-cap owned level still aggregates
   (INV-1).
3. Ops seams: `getNextNodeCost`/`getSkillCoreUpgradeCost` return
   undefined at effective cap.
4. Authored data integrity: the 17 gated nodes resolve in the real
   catalogs (`PHAP_TU_NODES`, `KIEM_TU_NODES`, `THE_TU_NODES`); every
   `levelGates` entry has `2 <= atLevel <= maxLevel`; every authored
   `techniqueRank` is `>= 1`.
5. **M6 invariant migration** — `GameManager.deadIds.test.ts`'s
   "no authored node carries a technique gate" pin is REPLACED by a
   constrained-authoring guard over all three authored gate fields:
   `techniqueRank` allowed in `prerequisites` only on the 9 unlock
   nodes (5 linh_ngo + 4 TheTu majors); `techniqueRank` allowed in
   `levelGates` only on the 8 cap nodes (5 intensity + 3 KiemTu);
   `techniqueGrade` and `revealWhen` technique gates forbidden
   everywhere. Any new technique gate outside the allowlist fails.
6. `NodeInspector` mounted: capped node shows `Lv x/authoredMax`,
   disabled upgrade, localized binding-gate reason, NO cost text
   (`nextCost === null` never interpolates); rank raised → enabled.
   Frozen-surplus regression: owned L6 intensity + rank reset to 0 →
   upgrade disabled AND the L6@rank3 reason still renders (the binding
   gate is below the owned level — the `level + 1` scan would miss it).
   `NodeTreePanel`: entry `nextCost` null at cap, badge `x/10`,
   `is-maxed` false, `costLabel` empty (no null interpolation).
7. Regression: `linh_ngo_<godUlt>` purchase blocked below rank 5 even
   with realm+node prereqs met (mounted or system-level).

## 10. Out of scope

- No balance retuning (gate thresholds above are mechanism-proving,
  flagged for the content pass).
- No technique-progression model changes (M-F-TECHNIQUE owns the
  frozen-cycle model).
- No new save fields / no version bump (levelGates are authored data;
  `techniqueProgress` mirror already exists).
- No cast-channel cap semantics (INV-6).
- No respec/refund interaction changes.
