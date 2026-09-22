# M-QI-05 — Canonical Core Node Level authority — plan

Spec: `mqi-05-core-node-level.spec.md` (**v6 — `MQI05_SPEC_REVIEWED`**). Implements QI-D3: `player.nodeLevels[core_<skillId>]` becomes the only writable skill-level authority; native top-level defs get authored cores + `levelScaling` consumption; internal actions inherit `progressionOwnerId` levels; grant-owned cores revoke+refund on reset; restore validates bidirectional membership; `SkillPathEntry` union + `centerMode` tab make both upgrade surfaces reachable.

## Step 0 — census (done during spec)

- **39 `Skill` templates with `maxLevel > 1`**: `CoreSkills.ts` (3 × Lv3 cast-channel `tram`/`linh_bao`/`huy_quyen` + 7 × Lv10), `PhapTuChainSkills.ts` (20 × Lv10 + 5 × Lv5), `PhapTuRouteSkills.ts` (4 × Lv10). Re-verify at TDD time via a template scan — oracle 9 pins it.
- **14 eligible native defs** (census §2): body kits `cuong_quyen`/`loan_dau`/`bat_tu_ba_the` (cuong_chien), `tran_ap`/`son_nhac` (tran_the); hidden_body `tham_the`/`tu_the`/`bach_ung`; hidden_sword `ngu_kiem_thuat`; orbs `orb_dam`/`orb_chem`/`orb_bo`/`orb_hat`/`orb_quet`. Damage-bearing (`maxLevel: 10`, `levelScaling: 0.05`): `cuong_quyen`, `loan_dau`, `tran_ap`, `tham_the`, `ngu_kiem_thuat`, `orb_*` ×5. Non-damage (`maxLevel: 1`, no Insight sink): `bat_tu_ba_the`, `son_nhac`, `tu_the`, `bach_ung`.
- **Internal negative-list**: `phan_chinh`, `ngu_kiem` emblem defs, combo extras (no cores). **Owner-inherited internals**: `phan_kich`/`tro_kich`/`trong_phan_kich` → `tham_the`; Kiem Pho combos → stamped triggering orb id; payloads/combo damage get `levelScaling: 0.05`.

## Step 1 — TDD failing tests first

1. `src/core/progression/SkillCoreLevel.test.ts` (new): `skillCoreNodeId` convention, `getSkillCoreLevel`, `getSkillCoreUpgradeCost` curve (5,8,11,…).
2. `src/data/progression/SkillCoreNodes.test.ts` (new): integrity — every `maxLevel > 1` template ↔ exactly one `core_<id>`; `maxLevel` equality; no tags/effect payload; `levelsSkillId` uniqueness; whitelist check (template OR the 14-id native set); negative-list assert (internal ids have none); zero cores for `maxLevel: 1`.
3. `NodeSystem` tests: `canPurchaseNode` rejects `levelsSkillId`; `canUpgradeNode` rejects cast-channel/unlearned/maxed/poor; `upgradeNode` deducts `5+3(L−1)`, increments, skips Van Dao waive; `grantsSkillCoreIds` effect grants listed cores at purchase; `grantSkillCore` idempotent.
4. `progressionOps.learnSkill` tests: grants `nodeLevels[core]=1` + `purchasedNodeIds`, idempotent; **preflight atomicity** — tampered registry (missing/mismatched core for `maxLevel>1` template) → `false` + membership unchanged; `purchaseNode` preflight fails before spend on missing member core; `syncTalentCombatPassive` inserts via `learnSkill`.
5. `SkillSystem` tests: `skillLevelProvider` — `getEffectiveSkill`/`progressionOf`/`getScaledPassiveModifiers` read provider; `recordCast` drops `skill.level` write; `upgradeSkill`/`getSkillUpgradeInsightCost` deleted (re-key tests to ops API).
6. Cast-channel tests: sink advances `nodeLevels[core]` at thresholds incl. multi-level jump; `skillCastCounts` mirror; no-op cast emits nothing; notification reports true delta via `onSkillLevelUp`.
7. Way-commit tests: `hidden_body_pathway`/`hidden_sword_pathway`/`sword_pathway` commit grants `coreSkillIds`; kit-root purchase grants.
8. `LegacySkillAdapter`/resolver tests: `levelScaling` def → resolved plan coefficient ratio `1+(L−1)×0.05` Lv1-vs-LvN (static `orb_dam` + provider-resolved `ngu_kiem_thuat`); unflagged def constant; `scaleActionDamage` preserves `levelScaling`.
9. `progressionOwnerId` tests: payloads authored `tham_the`; combo extra stamped triggering orb + `levelScaling`; `routeCast`/`routeExtraCast` resolve owner level; owner integrity (registered `levelsSkillId`, no own core).
10. `getSkillLevels` projection tests: registered cores project; unregistered `core_ghost` does NOT; learned fixed-L1 → 1.
11. Save tests: v73; `skillLevels` absent; restore rejects unregistered `core_*`/non-integer/over-max/missing required core/orphaned grant-owned core; `skills[i].level=99` → authored 1; emitted entries carry authored level.
12. `devResetBranch` revoke tests: root purchase → core Lv3 → reset → cores revoked + refund includes `Σ core costs`; re-buy re-grants Lv1.
13. Ritual atomicity: tampered `way.coreSkillIds` → `chooseCultivationPath` false, nothing mutated.
14. Gate tests: `requiresSkillLevel` + `skillCastCount.level` re-seeded via `nodeLevels`.
15. UI tests: `SkillDetailView`/`SkillPathList` canonical level/cost/cast-progress; `SkillPathEntry` union; native selection → `NativeCoreDetail`; `centerMode` tab reaches `SkillDetailView` upgrade on `spell_pathway`; `NodeTreePanel` excludes `core_*`.
16. `BalanceBaselines` seed shape.

## Step 2 — core leaf + node schema

- New `src/core/progression/SkillCoreLevel.ts` (imports nothing): `skillCoreNodeId`, `getSkillCoreLevel`, `getSkillCoreUpgradeCost`.
- `ProgressionNode.levelsSkillId?: string` + doc; `NodeEffect.grantsSkillCoreIds?: readonly string[]` + doc.
- `NodeSystem`: `getNextLevelCost` → core curve; `canPurchaseNode` rejects cores; `canUpgradeNode` rejects cast-channel cores; `upgradeNode` skips waive; `grantSkillCore(player, node)` idempotent write; `revokeNodeOwnership(player, nodeId)` — deletes level/membership + cascades `effect.grantsSkillCoreIds` members + returns spent core Insight (used by `devResetBranch` selection AND orphan cascade — refund adds it).

## Step 3 — catalog + registry + authored grants

- New `src/data/progression/SkillCoreNodes.ts` — 39 template cores (maxLevel = template) + 14 native cores (maxLevel 10) = 53.
- Register into `nodeRegistry` at path-catalog composition.
- `TheTuNodes`/`TheTuAnNodes`: `grantsSkillCoreIds` on `cuong_chien`/`tran_the` roots.
- `PathWayDefinition.coreSkillIds?: readonly string[]`; authored on `hidden_body_pathway` (3), `hidden_sword_pathway` (1), `sword_pathway` (5 orbs).

## Step 4 — SkillSystem cut

- `skillLevelProvider?: (skillId) => number` dep; `getEffectiveSkill`/`progressionOf`/`getScaledPassiveModifiers` read it.
- `learn(skill)` unchanged signature; `recordCast` drops `skill.level` write (keeps `totalExperience`, tram tick, threshold compute → sink reports `targetLevel`); `onLevelUp` param deleted; `upgradeSkill`/`getSkillUpgradeInsightCost`/`SkillUpgradeBalance.ts` deleted.

## Step 5 — ops + GameManager + grants

- `progressionOps.learnSkill(skillId, player)`: preflight template → preflight core (maxLevel>1) → learn → `grantSkillCore`.
- `progressionOps.levelUpSkill`/`getSkillLevel`/`getSkillCoreUpgradeCost` accessors; `onSkillLevelUp` dep → `notifications.push`.
- `purchaseNode`/`selectSpellPathElement`: extend member preflight to cores; apply `grantsSkillCoreIds` post-purchase.
- `chooseCultivationPath`: pre-commit census extends to `way.coreSkillIds` members BEFORE `applyPathChoice`; commit loop grants them.
- `RealmAdvanceOps.ts:416` `skillSystem.learn` → `learnSkill`; `syncTalentCombatPassive` → `learnSkill` (+ `TALENT_PASSIVES` into `SKILLS` catalog).
- `castCountSink`: `skillCastCounts` always; `target > prior` → `nodeLevels[core]=target` + notification `(skill, target, target−prior)`; `skillLevels` write removed.
- `getSkillLevels` dep → registered-node projection + learned-without-core → 1.

## Step 6 — readers + PlayerData + native consumption

- `Player.ts`: drop `skillLevels` field/default/restore param.
- `CultivationPathKit.requiresSkillLevel`, `NodeSystem` `skillCastCount.level` → `getSkillCoreLevel`.
- `ActionDamageInfo.levelScaling?: number`; `adaptDamageOp` wraps coefficient with `max(1, skill_level)` clamp; author `0.05` on the 10 damage-bearing defs + 3 payloads; `scaleActionDamage` + `NguKiemDaoProvider.resolveDef` preserve the field.
- `TurnSkillDefinition.progressionOwnerId?: string` + `progressionLevelKey(def)`; `routeCast`/`routeExtraCast` levelKey swap; `comboToExtraDef` stamps `ctx.resolvedSkillId` + `levelScaling`.
- `BalanceBaselines` seed → `nodeLevels`.

## Step 7 — save

- `saveVersion.ts` → 73 + changelog.
- `saveShapeValidation`: `skillCastCounts` only.
- `GameManagerSaveRestore`: re-derive `skill.level = template.level`; preflight — (a) learned-levelled-skill ⇒ `nodeLevels[core] ≥ 1`; (b) every `core_*` key registered + id convention; (c) integer ∈ [1, maxLevel]; (d) forward required membership (owned `grantsSkillCoreIds` nodes + active `way.coreSkillIds`); (e) `purchasedNodeIds` mirror; (f) inverse — every owned core has ≥1 satisfied declared source (learned template / owned declaring node / active declaring way).

## Step 8 — UI

- `SkillPathEntry` discriminated union in `SkillPathPanel`; `SkillPathList` consumes entries (native section appended).
- `centerMode: 'tree' | 'detail'` + visible tab when `showTree`; native selection forces detail; `NativeCoreDetail` (name/desc/Lv/max/cost + `levelUpSkill`); `SkillDetailView` stays `Skill`-typed → canonical level/cost/`levelUpSkill` + cast-progress readout.
- `NodeTreePanel.vue` → exclude `levelsSkillId`; `nodeBranchCoverage` guard updated.

## Step 9 — verify + gates

- `npm run type-check` + affected-scope vitest → `npm run verify` (full — architecture + save contract).
- OCR gate → P4 adversarial QA → P5 sequential passes → external impl review → merge → ledger.

## Open review risks (track through external rounds)

- Waive-skip parity vs. letting Van Dao waive apply to cores (chose skip).
- Insight on realm-locked orb cores (allowed — "invest ahead", uniform unlocked-node rule).
- `levelScaling` covers damage only; non-damage native channels deferred by design.
