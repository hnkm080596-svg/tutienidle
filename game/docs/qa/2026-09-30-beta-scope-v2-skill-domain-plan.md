# BETA SCOPE LOCK v2 Phase-3 — combat/skill-domain read-models — audit + plan

Branch `devin/1790787780-beta-scope-v2-skills` off `origin/devin/beta-scope-v2` (head cb8c003b, phase-1 authority merged). Worktree `.agent-worktrees/beta-scope-v2-skills`. Read-model/backend only — no frontend styling. Draft PR into `devin/beta-scope-v2`.

## TASK CARD (G0)

- **Task / user request**: Phase-3 canonical read-models for the combat/skill domain (spec §7, §8, §23-25, §32; work-order §4, §5, §18-19): (A) `betaCombatRolesFor(player)` role rail per realm; (B) `betaSkillTreeFor(player)`/`activeElementTree` node-state read-model; (C) `BetaScopeVerdict` tri-state reused consistently; precursor surfaces (sword orb-picker `dynamicBasic`, An `ngo_dao_hon_don` emblem) emit `scope-hidden` for beta players without deleting dormant systems.
- **Assigned worktree / branch**: `/home/ubuntu/repos/tutienidle/.agent-worktrees/beta-scope-v2-skills`, `devin/1790787780-beta-scope-v2-skills`.
- **Requested observable behavior**: for any legal beta player state the read-models return the canonical list the frontend renders — roles `[basic, special, ultimate]` with per-role `BetaScopeVerdict` + skillId; tree nodes with per-node state + cost/prereq display fields; ultimate and other-element branches always `scope-hidden`, never placeholder slots or `locked-future-feature` semantics.
- **Single responsibility / invariant**: "what does the beta combat/skill surface look like for this player" is decided ONCE, in the domain layer, off `betaScope.ts` verdicts — the frontend never rederives it from realm+skill registry.
- **Current owner (path + symbol)**: no owner — today `TurnCombatSkillBar.vue` + `useTurnCombatManual.ts` + `SkillPathPanel.vue`/`SkillRoleStrip.vue` each re-derive surfaces (`ROLE_ORDER`, `dynamicBasicOptions`, `hasPathCapability('spell.reaction_aura')`, `getResolvedSkillRoles`, `isNodeElementActive` etc. from multiple seams).
- **Target owner**: `game/src/core/betaScopeSkillDomain.ts` (new) exporting `betaCombatRolesFor`, `betaSkillTreeFor`, `activeElementTreeFor`, `betaCombatSurfacesFor`. `betaScope.ts` stays the policy authority (imported, not duplicated).
- **Existing primitive/mechanism to reuse**: `betaScopeVerdict`/`isBetaFeature`/`isBetaWay`/`BetaScopeVerdict` (`core/betaScope.ts`); `getActiveWay`/`getActiveElement`/`isActiveWay`/`hasPathCapability` (`core/player/CultivationPathSystem.ts`); NodeSystem predicates `getNodeLevel`/`canPurchaseNode`/`canUpgradeNode`/`getNextLevelCost`/`getEffectiveNodeMaxLevel`/`getBlockingNodeLevelGates`/`hasPrerequisite`/`isNodeElementActive` (`core/progression/NodeSystem.ts`); `getSkillCoreLevel` (`core/progression/SkillCoreLevel.ts`); `SPELL_KIT_IDS` (`data/skill/Skills.ts`); `PHAP_TU_NODES` (`data/progression/PhapTuNodes.ts`); `PHAP_TU_ELEMENT_ROOT_IDS` (`data/progression/PhapTuNodes.builders.ts`); `MORTAL_PRECURSOR_SKILL_IDS`/`MORTAL_DEFAULT_BASIC_ID`/`isMortalPrecursorSkillId` (`core/skill/MortalPrecursors.ts`); `getRealmIndex` (`core/realm/realmSystem.ts`); `turnSkillDisplayMetaOf` (`data/skill/TurnSkillDisplayMeta.ts`).
- **Missing capability**: none — every gate the read-models need already exists as a pure predicate. Deps needed beyond PlayerData: learned-skill membership (`SkillManager.has`) → injected as `PathCapabilityDeps`-shaped `{ hasSkill }` (same pattern as conditional capabilities).
- **Production chain**: `progressionOps.betaCombatRolesFor(player)` / `progressionOps.betaSkillTreeFor(player)` (thin GameManager bindings, same pattern as `getResolvedSkillRoles`) → pure `betaScopeSkillDomain` functions → `betaScope.ts` + NodeSystem + CultivationPathSystem.
- **State**: read-models are pure queries — no writes, no caches, no reset, no async (Q9).
- **Expected files**:
  - `game/src/core/betaScopeSkillDomain.ts` — owns the contract.
  - `game/src/core/game/GameManagerProgressionOps.ts` — binds deps (`skillManager.has`) so UI can reach the read-models (same seam as `getResolvedSkillRoles`/`hasPathCapability` facade).
  - `game/tests/architecture/betaScopeSkillDomain.test.ts` — spec-test pinning the contract (mirrors phase-1 test conventions).
  - this doc + the P4 quick QA report under `game/docs/qa/`.
- **Explicit non-goals**: no `.vue`/composable edits (frontend swap is a later phase); no behavior change to sword/hidden/body runtimes; no deletion of dormant precursor systems; no save migration; no changes to `betaScope.ts` itself.
- **Roadmap phase**: BETA SCOPE LOCK v2 phase-3 (phase-1 authority merged at cb8c003b).
- **Tests/gates**: P3 quick (`npm run type-check` + scoped vitest), P18 OCR delegation, P4 `tutienidle-adversarial-qa` quick, ≥3 sequential P5 passes, E3 simplify.
- **Stop condition**: read-models + bindings + spec tests green through P3→P5; draft PR up.
- **Unresolved assumptions**: none blocking; spec-table "Act I Basic (linh_bao)" resolved to the player's legal precursor pick (see Audit §A) — flagged in PR.

## Audit (read seams)

**A. Role rail truth today** — `CultivationPathRegistry.ts` per-way runtime factories compose the kit: mortal runtime resolves basic = `mortalBasicSkillId ∩ MORTAL_PRECURSOR_SKILL_IDS ∩ learned → 'tram'`; spell_pathway kit = `linh_bao` starter → element basic/special via `SPELL_KIT_IDS[el]`; sword ways = dynamicBasic provider (orb picker); hidden ways = emblem kit incl. `ngo_dao_hon_don`. Frontend rail: `ROLE_ORDER=['basic','special','ultimate']` in `TurnCombatSkillBar.vue`; `dynamicBasicOptions` from `battle.players[0].dynamicBasic.manualOptions()`; `isAnPath` emblem from `hasPathCapability('spell.reaction_aura')` rendered INTO the ultimate slot.

`SPELL_KIT_IDS` = §7 table verified 1:1 — `[0]` basic, `[1]` special: fire `hoa_cau_thuat`/`tam_muoi_chan_hoa`; water `thuy_tien_thuat`/`thanh_tuyen_duong_linh`; wood `doc_chuong`/`van_moc_sinh_co`; metal `diem_kim_thuat`/`kim_y_ngung_phong`; earth `tho_cau_thuat`/`trong_nhac`. No hidden kits, no ultimate entry (tuple is `[basic, special]`).

Act I note: `mortalBasicSkillId` is a REQUIRED creation pick among `['tram','linh_bao','huy_quyen']` (mortal-boundary save contract). Read-model reports the actual pick — `linh_bao` is the canonical family member (it doubles as the spell starter).

**B. Element commit** — `selectSpellPathElement` atomically purchases the element root (`insightCost 0`, `excludesNode` mutex on sibling roots) + learns the element basic + commits `spellPath.element`. Root purchase IS the commit; pre-commit `isNodeElementActive` treats all element nodes active while children stay gated by root prereq. Post-commit the other 4 roots' excludesNode prereq fails — generic logic would call them progression-locked; spec §8 mandates `scope-hidden`, so the element gate is applied BEFORE generic gating.

**C. Node surfaces** — `PHAP_TU_NODES` = 5 element branches × (root + ailment_mastery + `linh_ngo_<special>` keystone (realm `foundation_establishment` + insight 2)) + basic lanes (ailment nodes + 2 mutex capstones, foundation-gated, `techniqueRank` levelGates) + wayless `rewardOnly` realm-reward grants (never tree-rendered). All tree nodes stamped `requiredWay: 'spell_pathway'` — non-spell ways can't purchase.

**D. Verdict mapping** — `betaScopeVerdict({offered, progressionMet})` composes per-node/per-role. Tree node state adds `purchased`/`purchasable` on top of the tri-state: `purchased` (level≥1) > `purchasable` (canPurchaseNode) > `available` (all progression gates met, only insight short) > `progression-locked` (gate unmet) > `scope-hidden` (off-branch/grant-only/non-beta-way).

## Design decisions (contract)

1. **Rail is always 3 entries** `[basic, special, ultimate]` — `special` = `progression-locked` below Trúc Cơ (realm gate unmet but in-scope); `ultimate` = always `scope-hidden` reason `out-of-beta-scope`. Frontend renders by role+state; never an empty slot.
2. **Realm drives the rail shape; way gates admission.** Mortal realm → Act I rail (basic = pick, special progression-locked `realm-gate`, ultimate scope-hidden). `spell_pathway` player → basic `linh_bao` (pre-commit) or `SPELL_KIT_IDS[el][0]`; special `SPELL_KIT_IDS[el][1]` gated `element-uncommitted` → `realm-gate` → `not-learned` → available. Non-beta way or corrupt wayless non-mortal save → all `scope-hidden` (fail closed per project law).
3. **Tree = every `PHAP_TU_NODES` entry with a verdict**, so `scope-hidden` is an explicit emitted state (renderable nodes = `state !== 'scope-hidden'`), covering: other-element branches post-commit, `rewardOnly`/`grantedOnly`/`levelsSkillId` grants, non-beta-way and corrupt-state players. Mortal player → `progression-locked` (`initiation-pending`) — in-scope content behind an unmet gate, NOT hidden.
4. **Display fields per node**: `level`, `maxLevel` (authored), `effectiveMaxLevel` (levelGate-capped), `nextLevelCost` (null at effective cap), `prerequisites[]` ({kind,targetIds,required?,gate:'purchase'|'reveal',met}), `levelGates[]` ({atLevel,kind,targetIds,required?,met}), `grantsSkillIds[]`, `affordable`, `canUpgrade`. `activeElementTreeFor` = projection returning only the committed-element entries.
5. **Precursor surfaces**: `betaCombatSurfacesFor` emits verdicts keyed by stable ids `sword-dynamic-basic` (offered=`isBetaFeature('swordPath')`, progression=sword-path membership) and `an-ultimate-emblem` (offered=`isBetaFeature('hiddenContent')`, progression=`hasPathCapability('spell.reaction_aura')`) — both `scope-hidden` under current flags, flag-flip-ready by construction (offered flows from BETA_FEATURES, progression from canonical way/capability reads). Dormant providers untouched.
6. **Deps shape**: `betaCombatRolesFor(player, deps)`/`betaCombatSurfacesFor(player, deps)` take `{ hasSkill }` (learned membership is SkillManager's); `betaSkillTreeFor(player)` is PlayerData-pure (learned-ness in tree is not needed — `nodeLevels` owns levels; special-learned check for the rail uses deps).

## Q1–Q12 (G1)

- **Q1**: `betaCombatRolesFor(mortal player)` → `[{basic, skillId=pick, available}, {special, null, progression-locked}, {ultimate, null, scope-hidden}]`; `betaSkillTreeFor(committed fire player)` → other-element nodes all `scope-hidden`, fire branch states derived from NodeSystem predicates; corrupt/non-beta-way input fails closed to `scope-hidden`, never throws.
- **Q2**: `betaScopeSkillDomain.ts` owns the whole verdict chain — no caller reconstructs states.
- **Q3**: no state — pure queries over PlayerData + injected `hasSkill`.
- **Q4**: `progressionOps` bindings are the real caller seam (same shape as `getResolvedSkillRoles`); spec tests call the pure functions.
- **Q5**: reuses `betaScopeVerdict`, `hasPrerequisite`, `canPurchaseNode`, `getActiveElement`/`getActiveWay`, `getSkillCoreLevel`, `MORTAL_*` constants — no new primitive.
- **Q6**: imports point inward: `core/betaScopeSkillDomain` → `core/betaScope`, `core/progression`, `core/player`, `core/realm`, `data/skill`, `data/progression` (data is imported BY core modules elsewhere — same direction as `NodeSystem`→`SkillCoreLevel`/`data` registries used via injected registry; verify no presentation imports). `GameManagerProgressionOps`→domain (orchestration→domain ✓).
- **Q7**: presentation reads the verdict; no timing/gameplay coupling — combat runtime untouched.
- **Q8**: consumers keep semantics — spec test pins skillId sets vs `SPELL_KIT_IDS`, states vs `canPurchaseNode`/`hasPrerequisite` on crafted players.
- **Q9**: queries are observational only; no RNG/no writes (no `sessionRng`, no `purchaseNode` calls — read `canPurchaseNode` predicate only).
- **Q10**: corrupt inputs fail closed (`scope-hidden`), never throw; duplicate calls idempotent (pure).
- **Q11**: A2/A6/A13 — betaScope.ts imported, never duplicated; learned-membership via injected `hasSkill`, never `skillManager` direct, never inferred from owned skills; literal way/element checks only via `isBetaWay`/`isActiveWay`/`getActiveElement`.
- **Q12**: spec test `betaScopeSkillDomain.test.ts` mirrors phase-1 test conventions (crafted PlayerData via `createDefaultPlayer` + field overrides); PLANNED.
