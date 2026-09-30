# QA Review: beta-scope-v2 skill-domain read-models (Phase-3)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths:
  - game/src/core/betaScopeSkillDomain.ts (new)
  - game/src/core/game/GameManagerProgressionOps.ts (4 thin binding methods)
  - game/tests/architecture/betaScopeSkillDomain.test.ts (new)
  - game/docs/qa/2026-09-30-beta-scope-v2-skill-domain-plan.md (plan doc)

## Scope and Risk Map

changed-risk-map.mjs returned all four paths as `unmappedPaths` (no
`deepAuditCandidate`). Manual routing: the change is a pure read-model
layer (no mutation, no persistence, no combat tick, no Vue/Pinia/Phaser
lifecycle) - domain packs: economy-and-progression (NodeSystem consumers)
only. No escalation to deep: no save/cloud, time/offline, or
lifecycle owners touched; the read-models are pure functions over
PlayerData + injected PathCapabilityDeps.

Exclusions: none.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-RAIL-1 | betaCombatRolesFor | any player shape -> 3-entry rail | Fail-closed (Recoverability): corrupt input never yields 'available' | Value mutation: realmId x cultivationPath x cultivationWay cross product | Every corrupt pairing yields scope-hidden + null skillId | unit | High - corrupt save renders a fake rail |
| INV-RAIL-2 | betaCombatRolesFor | non-beta way (sword/body/hidden) | Conservation: no kit skillId leaks into rail | Value mutation: committed non-beta way | basic/special skillId null, state scope-hidden 'non-beta-way' | unit | High - wrong-way kit leaking into UI |
| INV-RAIL-3 | betaCombatRolesFor | special gate | Synchronization: gate derives from authored linh_ngo_<special> keystone prereqs | Stale state: keystone prereq drift | Act II committed -> 'realm-gate' with skillId named; Act III unlearned -> 'not-learned'; learned -> 'available' | unit | High - restated literal would drift from authored gate |
| INV-TREE-1 | betaSkillTreeFor/treeNodeFor | element commit boundary | Conservation: only committed branch renderable | Value mutation: 5 committed elements x 5 element tags | post-commit fire player: non-fire renderable nodes only; other elements 'other-element-branch' | unit | High - spec sec.8 core contract |
| INV-TREE-2 | treeNodeFor | grant-only nodes | Boundedness: rewardOnly/grantedOnly/levelsSkillId never tree-renderable | Value mutation: element-tagged tinh_thong_<e> on committed branch | always 'scope-hidden' 'grant-only-node' | unit | Medium - grant nodes masquerading as purchasable |
| INV-TREE-3 | betaSkillTreeFor | mortal player | Monotonicity: pre-initiation => progression-locked, not hidden | Timing boundary: mortal vs initiated | all renderable nodes 'initiation-pending'; grant nodes stay hidden | unit | Medium - wrong lock class teaches frontend 'future feature' |
| INV-TREE-4 | treeNodeFor | purchased/gated nodes | Determinism: state cascade order fixed | Reorder: level>=1 before prereq eval | level>=1 -> 'purchased'; unmet gates -> 'progression-locked'; gates met + !canPurchase -> 'available'+'insufficient-insight'; else 'purchasable' | unit | High - purchase-state mislabel drives wrong UI affordance |
| INV-SURF-1 | betaCombatSurfacesFor | BETA_FEATURES flags | Conservation: off-flag => scope-hidden regardless of progressionMet | Value mutation: hidden-way player w/ learned aura | 'sword-dynamic-basic' + 'an-ultimate-emblem' both scope-hidden 'out-of-beta-scope' even when progressionMet | unit | High - work-order sec.19 contract |
| INV-PURE-1 | all read-models | read-only over PlayerData | Atomicity: no mutation of input | Structural: all returns are fresh arrays/objects; only canonical read fns called | code inspection - no writes to player fields | inspection | Medium - read-model must never become a writer |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run tests/architecture/betaScopeSkillDomain.test.ts` | 25/25 pass (3 new repro tests failed for the intended reason pre-fix, now green) | EXECUTED_UNIT |
| `npm run type-check` | clean except pre-existing `electron/main.ts` electron-updater TS2307 | EXECUTED_TYPECHECK; electron error verified pre-existing on base (missing node_modules entry, base checkout errors identically) |
| INV-PURE-1 code inspection | no player mutation in any read-model path | SOURCE_PROOF - all returns fresh objects; only canonical reads (getActiveWay/getActiveElement/hasPrerequisite/canPurchaseNode/canUpgradeNode/getNodeLevel/getNextLevelCost/getEffectiveNodeMaxLevel/getNodeMaxLevel) |

## Findings

### QA-2026-09-30-01: mortal + committed path/way save yielded 'available' rail + renderable tree
- Severity: Medium
- Status: Confirmed -> FIXED (regression tests added)
- Invariant: Recoverability - corrupt input fails closed
- Preconditions: crafted/corrupt save `realmId:'mortal'` + `cultivationPath:'spell'` + `cultivationWay:'spell_pathway'`
- Reproduction: `betaCombatRolesFor(corruptMortal)` returned `basic 'available' linh_bao`; `betaSkillTreeFor` rendered the fire branch purchasable.
- Expected: all rail entries scope-hidden 'unresolved-way-state'; every node scope-hidden.
- Actual (pre-fix): mortal check required `cultivationPath===undefined`, so mortal+pair fell through to the beta-way branch and emitted legal-looking verdicts for a save `mortalBoundaryContractViolation` rejects on its face.
- Evidence: failing repro tests `corrupt mortal + cultivationPath save fails closed` (rail) and `every node is scope-hidden` (tree) - failed for the intended reason, now pass.
- Test file: game/tests/architecture/betaScopeSkillDomain.test.ts (kept as regression)
- Owner subsystem: core/betaScopeSkillDomain.ts
- Blast radius: read-model only; corrupt saves reachable only via crafted payloads (legal flows never produce the shape), so Medium not High.
- Fix: face-level mortal pairing (`realmId==='mortal'` && (cultivationPath||cultivationWay) defined) now folds into the existing fail-closed 'unresolved-way-state' branch in `betaCombatRolesFor` and `treeNodeFor`; `betaSkillTreeFor` header reports `element:null` for mortal realm (a corrupt mortal+way save advertises no committed element).

### QA-2026-09-30-02: missing linh_ngo_<special> keystone silently reported special gates met
- Severity: Low
- Status: Confirmed -> FIXED (inspection + convention; no repro test - unreachable with pinned data)
- Invariant: Recoverability - content drift fails closed
- Preconditions: hypothetical catalog drift (keystone node deleted/renamed)
- Evidence: `keystone === undefined` short-circuited `keystoneGatesMet` to true; fixed to `keystone !== undefined && every(...)`. Pinned existence covered by the sec.7 kit-table test.
- Owner subsystem: core/betaScopeSkillDomain.ts

### QA-2026-09-30-03: foreign-catalog non-beta-way node surfaced as 'progression-locked'
- Severity: Medium
- Status: Confirmed -> FIXED (repro test added)
- Invariant: work-order sec.19 - out-of-scope content never reads as 'locked future feature'
- Preconditions: `betaSkillTreeFor(player, foreignCatalog)` - the tree param explicitly invites other catalogs
- Evidence: a `requiredWay:'sword_pathway'`-stamped node evaluated for a spell player fell to 'prerequisites-unmet' progression-locked; node-stamp gate added - non-beta requiredWay -> 'scope-hidden' 'non-beta-way' for every beta player.
- Test file: game/tests/architecture/betaScopeSkillDomain.test.ts (foreign-catalog case, kept as regression)
- Owner subsystem: core/betaScopeSkillDomain.ts
- Blast radius: none on the current PHAP_TU_NODES catalog (all spell_pathway-stamped); defensive coverage for future catalogs.

## New or Changed QA Tests

- `corrupt mortal + cultivationPath save fails closed (mortalBoundaryContractViolation pairing)` - rail repro -> regression.
- `corrupt mortal + cultivationPath save: every node is scope-hidden, nothing purchasable` - tree repro -> regression.
- `foreign-catalog nodes stamped for a non-beta way are scope-hidden, never locked branches` - sec.19 repro -> regression.

## Gaps and Residual Risk

- `betaSkillTreeFor.way` header reports the honest resolved way for a corrupt mortal+way save ('spell_pathway'); nodes all scope-hidden, element nulled. Header is informational, nodes are the contract surface - accepted residual.
- `affordable`/`canUpgrade` fields on scope-hidden/progression-locked nodes are raw authority reads (canUpgradeNode); they are display hints, not state - covered by `canUpgrade===false` assertion on the corrupt case; other states' hints left to frontend display policy.
- Purity is SOURCE_PROOF (inspection), not executed - a freeze-probe test could tighten this later.

## Pre-existing Failures

- `electron/main.ts(217,63)` TS2307 'electron-updater' - missing from node_modules; verified identical on base checkout (not caused by this task).

## Learned-Defect Recommendation

Pattern worth noting for the ledger (recommendation only, no ledger edit - defect class already covered by F-INT-05 pairing knowledge): read-models that gate on "legal shape == A && !B" must enumerate the corrupt complement (A && B) explicitly; the mortal-boundary contract's face-level pairing is `realmId==='mortal' xor committed-pair-present`, and any read checking only the legal side leaks the corrupt side into whatever branch resolves next.
