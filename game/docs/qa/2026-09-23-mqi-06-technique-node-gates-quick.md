# QA Report — M-QI-06 Technique Node Gates (quick)

Date: 2026-09-23 · Scope: M-QI-06 (`ProgressionNode.levelGates`, `getEffectiveNodeMaxLevel`/`getBlockingNodeLevelGates`, `canUpgradeNode` effective read, ops cost projections, authored gate set, NodeInspector/NodeTreePanel lock-reason UI)

## Mode decision

`changed-risk-map.mjs` returned `deepAuditCandidate: true` (domains: economy-and-progression, ui-input-lifecycle; one unmapped path: `GameManagerProgressionOps.ts`). Quick mode retained, documented bound: the mission adds ONE read-model (`getBlockingNodeLevelGates` → `getEffectiveNodeMaxLevel`) consumed by exactly one transaction authority (`canUpgradeNode`) plus two cost projections and two presentation surfaces. Persistence shape, restore, save validation, cast-channel leveling, refund logic, and aggregation semantics are untouched — each attacked invariant has a decisive unit or browser oracle. No save/cloud, clock/offline, or combat-boundary semantics change; the progression transaction is fully oracle-covered. The unmapped path is manually routed to economy-and-progression (cost-preview consumers of the same authority).

## Invariant ledger

| ID | State/owner | Action/transition | Invariant | Attack operator | Oracle | Result |
|----|-------------|-------------------|-----------|-----------------|--------|--------|
| INV-MQI06-1 | `canUpgradeNode` (NodeSystem.ts:245-252) | upgrade L→L+1 at effective cap | Conservation: rejected action mutates nothing | Value mutation at cap boundary | `skillInsight`/`nodeLevels`/`purchasedNodeIds` unchanged after `upgradeNode` | Covered — `NodeSystem.levelGates.test.ts:142` |
| INV-MQI06-2 | `getBlockingNodeLevelGates` (NodeSystem.ts:139-160) | evaluate at frozen surplus (owned L6, gate binds at 6, effective 5) | Binding authority agrees with effective max and UI reason | Stale state (rank reset after purchase) | blocking set = min unsatisfied gate only | Covered — `levelGates.test.ts:81`, authored frozen-surplus test |
| INV-MQI06-3 | technique rank reset → owned surplus | rank drops below gate while owning level ≥ gate | Monotonicity: owned levels never regress; aggregation intact; save legal | Reorder/timing | aggregator emits owned level; save validates | Covered — `levelGates.test.ts:151` (L6 aggregates to flat 12), validator keeps ordinary levels finite-non-negative only (saveShapeValidation.ts:426-433) |
| INV-MQI06-4 | `canPurchaseNode` (NodeSystem.ts:205-231) | 0→1 purchase of a gated node | Gate semantics upgrade-only | Reorder | `canPurchaseNode` true at L0 regardless of techniqueProgress | Covered — `levelGates.test.ts:165`, authored god-ult test |
| INV-MQI06-5 | `getNextNodeCost`/`getSkillCoreUpgradeCost` (ProgressionOps:421-424,556-559) | preview at effective cap | Preview mirrors `canUpgradeNode`; never contradicts | Boundary | undefined at cap, curve cost below | Covered — `GameManagerProgressionOps.levelGates.test.ts` (3 tests incl. gated registered core) |
| INV-MQI06-6 | Cast channel (`recordCast` → `nodeLevels` direct write) vs `canUpgradeNode` cast-core early reject (:237-239) | hypothetical levelGate on a cast-levelled core | Cast leveling unchanged by design | Cross-system | `canUpgradeNode` rejects cast cores before the cap read; deadIds allowlist forbids authored technique gates outside the 17-id set | Bounded — no authored cast-gate exists; allowlist guards technique kinds |
| INV-MQI06-7 | `devResetBranch`/`revokeNodeOwnership` (NodeSystem.ts:477-519) | branch reset while owning frozen-surplus levels | Conservation: refund = Insight actually paid for ALL owned levels | Cross-system | loop `spentStart..level-1` reads owned level, never effective cap; waive ledger subtracted | Verified in source — no effective-cap read; refund covers frozen surplus |
| INV-MQI06-8 | save validation/restore | `nodeLevels` above effective cap persists (frozen surplus round-trip) | Recoverability: effective cap never enters save validation | Interruption | ordinary levels: finite non-negative only; `core_*`: integer ≤ AUTHORED max | Verified — saveShapeValidation.ts:426-462, no `getEffectiveNodeMaxLevel` in save code |
| INV-MQI06-9 | Van Dao waive (`rollVanDaoWaive`, upgradeNode:318-336) | waived upgrade at effective cap | Waive skips cost, never eligibility | Cross-system | `canUpgradeNode` runs before the waive roll; cores never waive | Verified in source |
| INV-MQI06-10 | UI reads (`upgradeGateReasons`, `nextCost`, `is-maxed`, `x/max`) | display at effective cap / frozen surplus | Authored max is the display ceiling; binding-gate reason shows at cap AND above it (frozen surplus) | Stale state | P14 real-browser: `Hoa Luc` 5/10 badge, no cost, "Nâng cấp bị chặn:" + rank-3 reason, disabled upgrade; jsdom suites | Covered — NodeInspector.test.ts (4 new tests), NodeTreePanel.test.ts (3), P14 scratch spec |
| INV-MQI06-11 | `levelUpSkill` (ProgressionOps:497-519) | Insight-channel core upgrade under hypothetical gate | Inherits `upgradeNode` → `canUpgradeNode` → effective cap | Cross-system | delegates to `upgradeNodeSystem` | Verified in source |
| INV-MQI06-12 | `upgradeGateReasons` reactivity (NodeInspector.vue) | techniqueProgress mirror changes while inspector open | Synchronization: reason appears/disappears with mirror state | Stale state | computed reads Pinia `$state` + `stateVersion` | Verified — reactive reads; satisfying-rank test asserts reasons clear |

## Findings

No confirmed defects. All ledger rows resolve to shipped oracles or direct source verification.

### Notes (not defects)

- Non-technique `levelGates` prerequisite kinds (e.g. `realm`) are schema-legal and would be silently inert on a cast-levelled core (the cast channel bypasses `canUpgradeNode`). No authored instance exists; the deadIds allowlist pins only technique kinds. Flag for the content pass if non-technique gates are ever authored on cast-channel cores.
- The P14 scratch e2e hit stale-fixture classes already recorded (QA-2026-09-01-001 validator-fixture audit): the atomic `spellPath` element/route pair and technique progression fields (`grade/rank/mastery/quality`) must be seeded together. No new ledger row — same defect class.

## Verification evidence

- `npm run type-check` — clean.
- `npm run build` — clean.
- `npx vitest run` — 734 files / 6548 passed / 4 expected-fail.
- Focused: `NodeSystem.levelGates.test.ts` (13), `GameManagerProgressionOps.levelGates.test.ts` (3), `TechniqueGateAuthored.test.ts` (7), `NodeInspector.test.ts` (4 new), `NodeTreePanel.test.ts` (3), `GameManager.deadIds.test.ts` allowlist guard — all green.
- P14 real browser (dev server :5593, worktree): seeded spell_pathway + `minor_fire_intensity` at owned L5 with rank 0 → tree shows `5/10` authored badge, no `is-maxed`, empty cost (sibling `Dot Van Hoa` shows `1 Cảm Ngộ` for contrast); inspector shows `Nâng cấp bị chặn:` + one rank-3 reason + disabled upgrade + empty cost; zero browser errors.

## Verdict

PASS WITH EVIDENCE — every invariant row has a decisive passing oracle; no reproduction tests needed (no confirmed defects). The P5 sequential review still runs per gate order.
