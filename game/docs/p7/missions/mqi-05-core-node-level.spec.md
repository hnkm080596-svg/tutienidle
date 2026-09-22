# M-QI-05 — Canonical Core Node Level authority (QI-D3)

Status: spec v6 for external review — v6 resolves r5 findings: H1 (explicit detail/tree center mode — a Detail affordance reaches `levelUpSkill` for ordinary Skill templates on tree-owning ways incl. `spell_pathway`, closing the pre-existing `SkillDetailView` unreachability the Core cut would make total), L1 (`progressionOwnerId` catalog integrity — owner must resolve to a registered `levelsSkillId` node, ownerless internal defs must have no Core).
Branch: `p7/mqi-05-core-node-level`. Worktree: `.agent-worktrees/mqi-05-core-node-level`.
Depends on: none. Blocks M-QI-06 (technique node gates) — graph ruling: no mission may author Skill-level content before this lands.

## 1. Locked contract (QI-D3, `docs/p7/decisions.md` L143-154)

- Canonical Skill Level = **Core Node Level**: a real Core Node per levelled authored Skill (`Skill → Core Node → level`).
- `Skill.level` / `upgradeSkill` as independent authority is **deprecated**; persisted `skillLevels` is handled by the save policy — **version bump rejects old saves, no field translators** (decisions.md L203).
- Skill Insight raises levels of unlocked nodes only. Cast-levelled skills (`tram`/`linh_bao`/`huy_quyen`) keep one canonical level whose only valid input channel is casts — Insight can never raise them.
- Passives: the mechanism supports `passive + levelled`, but **no levelled passive is authored** — all current passives stay fixed Lv1.
- `skillCastCounts` mirror semantics kept. Per-node `maxLevel`/`currentLevel`/per-level cost shape exists (final numbers deferred to the balance phase).
- `TurnSkillDefinition` ways are not exempt: combat resolves canonical node state through the existing entity snapshot; the execution definition stays behavior-only.

## 2. Current state (G0 evidence)

Two writable level authorities exist today:

**Authority A — `Skill.level` (runtime entry, `SkillManager`)**

- Writers: `SkillSystem.upgradeSkill` (`skill.level++`, Insight, `SkillSystem.ts:274-293`) and `SkillSystem.recordCast` cast-channel auto-level (`skill.level = targetLevel`, `SkillSystem.ts:338-349`).
- Readers: `GameManager.getSkillLevels` dep (`skillManager.getAll().map(s => [id, s.level])`, `GameManager.ts:812-813`) → `playerToCombatEntity` → `CombatEntity.skillLevels` snapshot → `TurnSkillPlanRuntime.progressionStub` → `SkillResolver` `skill_level` scalar. **Live +5%/level damage scaling**: `SkillSystem.getEffectiveSkill` (`:117-123` — `1 + (level-1) × ACTIVE_SKILL_DAMAGE_PERCENT_PER_LEVEL`, applied to damage effects/triggers, baked into turn-skill coefficients by `LegacySkillAdapter`; `tram` uses the flat `totalExperience` bonus instead). **Projection**: `SkillSystem.progressionOf` (`:190` — `SkillProgressionState.level` → resolver). **Passives**: `getScaledPassiveModifiers` (`:235-237` — `perLevelFlat/perLevelPercent × (skill.level-1)`). UI: `SkillDetailView.vue` (`skill.level` display, `isMaxLevel`, cast-next-threshold), `SkillPathList.vue` (`Lv. x/y`). Notification: `onLevelUp` callback reads `skill.level` (`GameManager.ts:256-270`).
- Persisted inside `save.skills[]` entries (`SaveSystem.ts:337`); restore clones the saved entry and **preserves saved `level`** (`GameManagerSaveRestore.ts:304-358` — re-derives name/description/effects but keeps `level`).

**Authority B — `PlayerData.skillLevels` (PlayerData mirror)**

- Writer: `castCountSink` in `GameManager.ts:476-477` (fires only on casts — an insight-levelled skill never cast has no mirror entry; the mirror is *stale-by-design* for authority A's other channel — the duplicate-authority defect this mission kills).
- Readers: `CultivationPathKit.requiresSkillLevel` offer gates (`:455-461` — linh_bao Lv3 → hidden_spell_pathway, huy_quyen Lv3 → hidden_body_pathway, tram Lv3 → kiem_tu Bạt Kiếm), `NodeSystem` `skillCastCount.level` prerequisite (`:79-84`), `BalanceBaselines.ts:54` (sim seed). Validator: `saveShapeValidation.ts:306-308` (record-pair check with `skillCastCounts`).

**`PlayerData.skillCastCounts`** — cast-count mirror, same sink. Kept per contract (`skillCastCount.count` prereq + `SkillDetailView` cast progress).

**`PlayerData.nodeLevels`** — canonical node state (`NodeSystem.getNodeLevel`); `purchaseNode`/`upgradeNode` write it; `purchasedNodeIds` is a read-compat list synced "level ≥ 1 ⇒ member". No skill-level linkage exists — no `NodeEffect`/node kind binds a node to a skill's level.

**Levelled-skill census (maxLevel > 1, `Skill` templates only):** `CoreSkills.ts` (3 × Lv3 cast-channel + 7 × Lv10), `PhapTuChainSkills.ts` (20 × Lv10 + 5 × Lv5), `PhapTuRouteSkills.ts` (4 × Lv10) — **39 templates**. All `PassiveSkills.ts`/`TalentPassives` entries are `maxLevel: 1` (fixed, no core node).

**Native `TurnSkillDefinition` top-level census (QI-D3.149/150):** eligible top-level actions — body_pathway kits: `cuong_quyen`, `loan_dau`, `bat_tu_ba_the` (cuong_chien kit) + `tran_ap`, `son_nhac` (tran_the kit); hidden_body_pathway fixed kit: `tham_the`, `tu_the`, `bach_ung`; hidden_sword provider action: `ngu_kiem_thuat`; sword orb actions: `orb_dam`, `orb_chem`, `orb_bo`, `orb_hat`, `orb_quet` — **14 defs** (10 damage-bearing). Internal/exempt per QI-D3.150: `phan_chinh` (emblem-only), `phan_kich`/`tro_kich`/`trong_phan_kich` (reactive payloads), `ngu_kiem` emblem defs, KiemPho combo extras — never receive cores.

**Reset/refund surfaces:** `devResetBranch` filters by `branchTag`; `switchRoute` clears `routeTag`-tagged nodes; orphan cascade removes nodes whose `kind:'node'` prereq hits 0. Core nodes carry none of these tags/prereqs → naturally excluded from all three paths.

**Restore:** `GameManagerSaveRestore.ts:304-358` re-adds entries via `skillManager.restore` (bypasses `learn()`); `nodeLevels` persists on PlayerData — a v73 save already carries core levels, no re-grant needed at restore.

## 3. Target architecture

`player.nodeLevels[skillCoreNodeId(skillId)]` is the **only** writable authority for a levelled skill's level. `Skill.level` stays as a frozen authored field (always `1`, never written, never read as live authority). `PlayerData.skillLevels` is deleted.

Two input channels write the canonical level:

- **Insight channel** — `upgradeNode(player, coreNode)` (the existing single node-upgrade writer), reached through `progressionOps`. Grants (`learn()`) write the 0→1 transition; `purchaseNode` never touches cores.
- **Cast channel** — `recordCast` computes the threshold target (unchanged `CAST_LEVELING_THRESHOLDS`/`getCastLeveledSkillLevel`), the existing `castCountSink` writes `nodeLevels[core]` (and keeps the `skillCastCounts` mirror).

## 4. Decisions

### D1 — Leaf module `src/core/progression/SkillCoreLevel.ts` (imports nothing, `CastLeveling.ts` pattern)

- `skillCoreNodeId(skillId): string` — id convention `core_<skillId>` (pure, PlayerData-only readers need no registry).
- `getSkillCoreLevel(player, skillId): number` — `player.nodeLevels?.[skillCoreNodeId(skillId)] ?? 0` (0 = unlearned/never granted).
- `getSkillCoreUpgradeCost(level): number` — cost to go `level → level+1`, re-homed curve `5 + 3 × (level − 1)` from `SkillUpgradeBalance.getSkillUpgradeInsightCost` (identical numbers — balance deferred). `SkillUpgradeBalance.ts` is deleted.

### D2 — `ProgressionNode.levelsSkillId?: string` marker + catalog `src/data/progression/SkillCoreNodes.ts`

- One node per authored skill template with `maxLevel > 1` (census: 39 — 3 cast-channel Lv3, 31 Lv10, 5 Lv5): `id: core_<skillId>`, `levelsSkillId: <skillId>`, `maxLevel === skill.maxLevel` (integrity test), `effect: {}` (the canonical level feeds the existing consumption seams — D6; no duplicated stat payload), `type: 'major'` (semantic only), `insightCost: 0` (never purchased), no `upgradeCost` (cost resolves through `getNextLevelCost` → D4), **no** `branchTag`/`elementTag`/`routeTag`/`requiredCultivationPath`/`requiredWay`/`prerequisites`/`revealWhen` (path/way-agnostic — learning ownership scopes them; untagged nodes pass every `*Applies`/active check; excluded from all refund filters).
- Registered into `nodeRegistry` alongside the path catalogs so `upgradeNode`/`getNodeLevel`/aggregators resolve them uniformly.
- **Native `TurnSkillDefinition` cores are authored NOW (QI-D3.149):** the `levelsSkillId` catalog IS the progression-metadata source — the catalog authors `core_<defId>` for each of the 14 eligible top-level native defs (census §2). Damage-bearing defs (`cuong_quyen`, `loan_dau`, `tran_ap`, `tham_the`, `ngu_kiem_thuat`, `orb_*` ×5) also get `levelScaling` on their `damage` (D11). Non-damage cores (`bat_tu_ba_the`, `son_nhac`, `tu_the`, `bach_ung`) track level under the same authority; their non-damage progression channels are deferred content.
- **Internal sub-action ban:** `levelsSkillId` must never target an internal chained/emblem/reactive/generated sub-action id (`phan_chinh`, `phan_kich`, `tro_kich`, `trong_phan_kich`, `ngu_kiem` emblem defs, combo extras) — per QI-D3.150 those scale through the parent's Core/authored Variation node. Pinned as a docblock rule in `SkillCoreNodes.ts`; the integrity test asserts every `levelsSkillId` resolves to a registered `Skill` template **or** an explicitly listed native-def id in the eligible set (the census list is the whitelist — extending it later requires an eligibility note in the catalog docblock).

### D3 — Learn-grant (0→1) owned by `progressionOps.learnSkill(skillId, player)` — atomic preflight

- `SkillSystem.learn(skill)` keeps its signature and stays learned-set ownership only (no PlayerData, no registry — SkillSystem's dependency set is unchanged).
- `progressionOps.learnSkill` gains the `player: PlayerData` param and a **preflight-before-mutation** contract: (1) resolve template — missing → false; (2) for `template.maxLevel > 1`, resolve `core_<skillId>` in `nodeRegistry` and require `levelsSkillId === skillId` + `node.maxLevel === template.maxLevel` — missing/mismatched → `false` BEFORE any `SkillManager` mutation (a levelled skill without an authored core is a data integrity failure, oracle 9); (3) `skillSystem.learn` → (4) `grantSkillCore` — `player.nodeLevels[core] = 1` (idempotent — existing key untouched) + `purchasedNodeIds` push.
- `purchaseNode`/`selectSpellPathElement` extend their existing pre-purchase template preflight (`:243-247`) to each `unlocksSkillIds` member's expected core metadata — a missing core fails the whole purchase BEFORE insight is spent (atomic across the composition).
- **All production learn paths route through `progressionOps.learnSkill`** — `RealmAdvanceOps.ts:416` direct `skillSystem.learn(template)` reroutes (its passive template has no core — behavior identical); `syncTalentCombatPassive`'s direct `skillManager.add` (`:98-106`) reroutes to `learnSkill` after `TALENT_PASSIVES` joins the `SKILLS` template catalog (`learn()`'s `structuredClone` covers the per-battle shallow-copy requirement). Grep oracle: zero non-test `skillSystem.learn(`/`skillManager.add(` hits outside `progressionOps.learnSkill`/SkillManager internals.
- Callers threading `player`: `EarlyGameBootstrap` (param exists), `progressionOps` internal grants, `GameManagerRealmAdvanceOps` sites, `App.vue` callbacks (player store), `syncTalentCombatPassive` (param exists).

### D4 — Insight channel through `upgradeNode`

- `getNextLevelCost(node, level)`: `levelsSkillId` nodes delegate to `getSkillCoreUpgradeCost(level)` — `NodeSystem` imports the D1 leaf only.
- `canPurchaseNode`: rejects `levelsSkillId` nodes outright (grant-only — no tree purchase path).
- `canUpgradeNode`: for `levelsSkillId` nodes, additionally rejects when `CAST_LEVELING_THRESHOLDS[node.levelsSkillId]` exists — Insight can never raise a cast-channel skill, enforced at the shared gate (not just UI).
- `upgradeNode` unchanged except: `rollVanDaoWaive` is skipped for `levelsSkillId` nodes — parity: skill upgrades never rolled the waive, and `nodeFreePurchaseRecord` stays a tree-purchase concept.
- `progressionOps` exposes `levelUpSkill(skillId, player)` (resolve core node → `upgradeNode`) and `getSkillLevel(skillId, player)` / `getSkillCoreUpgradeCost(skillId, player)` read accessors for UI. `SkillSystem.upgradeSkill` and `SkillSystem.getSkillUpgradeInsightCost` are **deleted**.

### D5 — Cast channel via the existing sink; sink owns advancement + notification

- `recordCast(skillId)` stops writing `skill.level`; it still increments `totalExperience`, keeps the tram `experience` tick, computes `targetLevel` via `getCastLeveledSkillLevel`, and reports it through the sink. It can no longer detect advancement itself (frozen `skill.level` — comparison needs canonical state).
- `castCountSink(skillId, totalCasts, targetLevel | undefined)` in `GameManager` — the canonical owner of the cast-channel write: always `player.skillCastCounts[skillId] = totalCasts`; for a defined `targetLevel`, reads `prior = player.nodeLevels?.[core_id] ?? 0` and only when `target > prior` writes `player.nodeLevels[core_id] = target` **and** emits the level-up notification `(skill, newLevel: target, levelsGained: target − prior)` through the existing `notifications.push` pattern — cast at an already-reached level emits nothing, a restored/multi-level jump reports the true delta. The `skillLevels` write is removed.
- `SkillSystem.onLevelUp` constructor param deleted (SkillSystem can no longer detect advancement); `progressionOps` gains an `onSkillLevelUp?: (skill, newLevel, levelsGained) => void` dep (wired to the same `notifications.push` in GameManager) emitted on successful `levelUpSkill` — one notification owner per channel, both at the GameManager seam.
- `PlayerData.skillLevels` field deleted (`Player.ts` type + default + restore param); `saveShapeValidation` record check drops `skillLevels` (keeps `skillCastCounts`).

### D6 — Reader migration (every live level read → canonical)

- **`SkillSystem` level provider seam** (the +5%/level + passive-scaling + `skill_level` preservation — same injection pattern as `routeProfileProvider`/`castCountSink`): constructor gains `skillLevelProvider?: (skillId: string) => number`; GameManager wires `(skillId) => Math.max(1, activePlayer ? getSkillCoreLevel(activePlayer, skillId) : 1)`. Inside SkillSystem:
  - `getEffectiveSkill(skill, levelOverride?)` → `effectiveLevel = levelOverride ?? this.skillLevelProvider?.(skill.id) ?? 1` — the +5%/level multiplier and tram flat bonus resolve identically, now from canonical level. All existing callers (CultivationPathRegistry kit build, PassiveSystem, route conversion) work unchanged.
  - `progressionOf(skill)` → `level: provider(id)` — `SkillProgressionState.level` stays the resolver-facing field, now canonical-sourced (not vestigial — the `Skill.level` *instance field* is what froze).
  - `getScaledPassiveModifiers` per-skill level → `provider(id)` — mechanism supports a future levelled passive verbatim (D10).
- `GameManager.getSkillLevels` dep → **registered-metadata projection**: iterate `nodeRegistry` — for every node with `levelsSkillId`, if `nodeLevels[node.id] > 0` project `{[node.levelsSkillId]: level}`; then learned skills without a registered core → `1`. Raw `core_*` keys in `nodeLevels` contribute NOTHING unless their node is registered (string-prefix inference is never the authority); restore preflight (D9) rejects such entries on a legal save anyway. `CombatEntity.skillLevels` snapshot shape unchanged → `progressionStub`, `SkillResolver.skill_level`, `SkillExecutor` unchanged; a granted `core_orb_dam`/`core_tran_ap`/etc. reaches `progressionStub` by def id automatically (same map drives native levelKey resolution).
- `CultivationPathKit.requiresSkillLevel` gate → `getSkillCoreLevel(player, skillId) >= required.level`.
- `NodeSystem` `skillCastCount.level` prereq → `getSkillCoreLevel(player, skillId)` (its `count` half stays on `skillCastCounts`).
- `BalanceBaselines.ts:54` seed → `player.nodeLevels = { core_tram: 3, core_huy_quyen: 3 }`.
- `SkillDetailView.vue`/`SkillPathList.vue`: level display, `isMaxLevel`, cast-next-threshold compare → `progressionOps.getSkillLevel`; upgrade button → `progressionOps.levelUpSkill`; cost preview → `getSkillCoreUpgradeCost` accessor.

### D7 — UI/tree exclusion + native presentation seam

- `NodeTreePanel` filters `levelsSkillId` nodes out of the rendered set (cores are skill-panel content, not tree content). `tests/architecture/nodeBranchCoverage.test.ts` updated to pin the exclusion.
- **Native-core presentation seam — `SkillPathEntry` view-model:** `SkillPathPanel` builds a discriminated union `SkillPathEntry = {kind:'skill'; skill: Skill} | {kind:'native'; id; name; description; level; maxLevel; upgradeCost; canUpgrade}` — skill entries wrap the SkillManager list verbatim; native entries project every registered `levelsSkillId` node NOT resolving to a SkillManager member with `nodeLevels[core] >= 1`, display name/desc from `TurnSkillDisplayMeta` (**no fake `Skill` objects minted**). `SkillPathList` consumes `SkillPathEntry[]` (native section appended after skill groups); selection emits the entry. **Selection rule — explicit detail/tree center mode:** the center column gains `centerMode: 'tree' | 'detail'` with a visible tab affordance whenever `showTree` is true (this includes `spell_pathway` via `spell.elemental_casting` — closing the pre-existing hole where `SkillDetailView`'s upgrade button was unreachable on tree ways). Selecting a `kind:'native'` entry forces `detail` (natives own no tree) rendering `NativeCoreDetail` (name/desc/Lv/max/cost + `levelUpSkill` reusing `SkillDetailView`'s affordance styles — `SkillDetailView` stays `Skill`-typed); selecting a `kind:'skill'` entry keeps the current mode but the Detail tab is always reachable and renders `SkillDetailView` with its canonical-level upgrade affordance; default mode stays `tree` on tree ways / `detail` on non-tree ways (today's behavior preserved). Insight is the only channel — no cast-progress display on native entries; `maxLevel: 1` cores render a maxed state with no enabled affordance.

### D8 — `Skill.level` frozen (not deleted)

- Stays on the type and in templates (`level: 1` authored); zero runtime writes remain; zero live reads remain. Deleting the field is a follow-up cleanup — this mission kills the *authority*, not the field (smallest coherent cut; serialized v73 entries carry `level: 1` and validators do not depend on it).

### D9 — Save version 73 + restore re-derivation

- `saveVersion.ts` → 73 with the changelog comment (canonical skill level moves to `nodeLevels[core_*]`; `PlayerData.skillLevels` removed; `Skill.level` frozen). v72 saves rejected — locked policy, no translator.
- **Restore re-derives `skill.level = template.level`** — alongside the existing name/description/effects re-derivation in `GameManagerSaveRestore.ts:336-353`; the saved value is never trusted as progression (a v73 payload with `skills[i].level = 99` restores the entry at authored 1 and cannot affect any live read — all reads are canonical anyway). `experience`/`totalExperience` stay instance progression (cast counter). Emitted v73 entries always carry authored `level: 1`.
- Restore preflight (same seam as the M5 bodyProgression integrity assert): (a) every learned skill whose core node exists must satisfy `nodeLevels[core] >= 1`; (b) every `core_*`-shaped key in `nodeLevels` must resolve to a **registered** node whose `levelsSkillId` exists and whose `node.id === skillCoreNodeId(levelsSkillId)` — unknown keys rejected; (c) every core-state level must be an integer within `[1, node.maxLevel]` — non-integer/zero/negative/over-max rejected; (d) **required native membership** — for every owned node (`nodeLevels[id] >= 1`) whose `effect.grantsSkillCoreIds` exists, each listed core must have `nodeLevels[core] >= 1`; for the active `cultivationWay`, every `way.coreSkillIds` member's core must have `nodeLevels[core] >= 1`; (e) every granted core satisfies the existing mirror invariant (`purchasedNodeIds` membership — same rule as all level ≥ 1 nodes); (f) **inverse membership** — every owned core must have at least one satisfied declared source: its `levelsSkillId` is a learned `Skill` template, OR some owned node's `effect.grantsSkillCoreIds` lists it, OR the active way's `coreSkillIds` lists it (an owned core with no satisfied source is a state no legal path can produce — e.g. a `core_cuong_quyen` surviving its `cuong_chien` reset). Violations = corrupt v73 payload → reject, never clamp or tolerate.

### D10 — Passives

- All currently authored passives are `maxLevel: 1` → no core nodes authored. The mechanism (`levelsSkillId` + grant + insight channel) already supports a levelled passive with zero new machinery when one is authored later.

### D11 — Native top-level cores: grant seams + behavior consumption

- **Grant seam 1 — node effect:** `NodeEffect` gains `grantsSkillCoreIds?: readonly string[]` (skill ids, `unlocksSkillIds`-style). `purchaseNode`/`selectSpellPathElement` apply it inside the same post-purchase grant loop — preflight resolves each member's registered core BEFORE spending (D3 atomicity). Authored on the body-kit roots: `cuong_chien` → `[cuong_quyen, loan_dau, bat_tu_ba_the]`; `tran_the` → `[tran_ap, son_nhac]` (kit members per `THE_TU_KIT_BY_ROOT`; `phan_chinh` excluded — internal emblem).
- **Grant seam 2 — way commit:** `PathWayDefinition` gains `coreSkillIds?: readonly string[]`; the way-commit flow (same loop site as `way.skillIds` learns in `GameManagerRealmAdvanceOps`) grants each resolved core. Authored: `hidden_body_pathway` → `[tham_the, tu_the, bach_ung]` (fixed kit at commit); `hidden_sword_pathway` → `[ngu_kiem_thuat]`; `sword_pathway` → `[orb_dam, orb_chem, orb_bo, orb_hat, orb_quet]` (cores exist at commit; orb availability stays realm-gated separately — Insight may raise a locked orb's core, same "invest ahead" rule as any unlocked node). **Ritual atomicity:** `chooseCultivationPath`'s existing pre-commit registry census extends to every `way.coreSkillIds` member — each must resolve a registered core (`levelsSkillId` + `core_<id>` id + `maxLevel`) BEFORE `applyPathChoice`; a missing/mismatched member returns `false` with path/way/realm/mortal pick/SkillManager/`nodeLevels` untouched (same transaction discipline as the `skillIds`/`passiveSkillIds`/starter preflight).
- **Consumption seam — `ActionDamageInfo.levelScaling?: number`:** when authored, `adaptDamageOp` wraps the constant coefficient into `multiplier × (1 + (max(1, skill_level) − 1) × levelScaling)` as a `ScalarExpression` tree (`statScalars.skill_level` is already always captured; the `max(1, …)` clamp keeps an ungranted/level-0 cast at ×1). Authored `levelScaling: 0.05` on the 10 damage-bearing eligible defs — identical +5%/level rule as the `Skill`-template path (parity documented; two seams, one formula, each applied once per def class — no engine branching on ids).
- **Field-propagation rule:** `levelScaling` is adapter-only metadata (only `adaptDamageOp` reads it), but no `ActionDamageInfo` rebuild may silently drop authored fields — `scaleActionDamage` carries it in both return branches, and `NguKiemDaoProvider.resolveDef` preserves base damage metadata: `damage: { ...NGU_KIEM_THUAT.damage, multiplier: player.swordPath?.kiemDaoBase ?? 1 }` (spread-then-override — currently replaces the whole object, which would strip `levelScaling`). The census of **non-spread/manual** `ActionDamageInfo` reconstruction seams (the only kind that can drop fields) = `scaleActionDamage` + `NguKiemDaoProvider` — both pinned; spread-preserving rebuilds (`applyMissingHpScalar`, companion overrides) carry the field automatically and need no change.
- **Behavior oracle (not transport):** resolve a native def's adapted plan at core Lv1 vs Lv4 → damage coefficient ratio exactly `1 + 3 × 0.05`; asserted on a static def (`orb_dam`/`cuong_quyen`) AND on the **provider-resolved** `ngu_kiem_thuat` (proves the provider seam preserves the metadata); a def without `levelScaling` keeps its constant coefficient at any level.
- **Non-damage native cores** (`bat_tu_ba_the`, `son_nhac`, `tu_the`, `bach_ung`): `maxLevel: 1` — registered, granted, canonical at Lv1 (projection + restore invariants apply identically), but `canUpgradeNode` rejects them as maxed — **no Insight can be consumed for an inert level**. Their direct progression channels (duration/ward/proc) are deferred content: authoring a channel later = bump `maxLevel` + author the channel expression in the same change.
- **Insight-upgrade policy:** the 10 damage-bearing cores are Insight-upgradeable (`maxLevel: 10`, active parity; balance phase owns final numbers); the 4 non-damage cores are fixed-Lv1 this mission.
- **Internal-action inheritance (QI-D3:150 — parent Core, not own Core):** `TurnSkillDefinition` gains `progressionOwnerId?: string`. `progressionLevelKey(def) = def.progressionOwnerId ?? def.id` (leaf helper) feeds the `levelKey` argument at BOTH `TurnSkillPlanRuntime` call sites (`routeCast` :262, `routeExtraCast` :322) — the stub still reads `entity.skillLevels[levelKey]`, so an internal def resolves at its owner Core's canonical level. Authored owners: `phan_kich`/`tro_kich`/`trong_phan_kich` → `tham_the` (the basic stance whose `grantsBuffsAtBuild` carries the `*_mon` markers that proc them); Kiem Pho combo extras → stamped `ctx.resolvedSkillId` (the triggering orb) inside `comboToExtraDef` — `onCastResolved` threads the id. `levelScaling: 0.05` is authored on the three payloads' damage and stamped on generated combo damage so the inherited level has a real effect. Internal defs still receive NO core nodes — inheritance is the only channel (QI-D3 verbatim).
- **Grant-owned-core lifecycle (reverse direction):** any path that removes node ownership (`devResetBranch` tag selection AND its orphan cascade — the shared `revokeNodeOwnership(player, nodeId)` seam in `NodeSystem`) also revokes every `effect.grantsSkillCoreIds` member of the removed node: delete `nodeLevels[core]` + `purchasedNodeIds` entry, and add the core's spent Insight (`Σ getSkillCoreUpgradeCost(1→level−1)` — deterministic from the frozen curve) into the reset refund. Ownership is NOT permanent-after-grant: it is lifecycle-tied to the granting node (and for `way.coreSkillIds`, to the active way — a way cannot be un-committed in this codebase, so no way-revoke path exists). Re-buying a root re-grants its cores at Lv1 fresh.

## 5. Explicitly unchanged

- `Skill.totalExperience` (cast counter) + `skillCastCounts` PlayerData mirror + `skillCastCount.count` prereq.
- `Skill.experience` tram tick → `getHuyKiemFlatDamageBonus` — untouched; tram's flat cast bonus in `getEffectiveSkill` unchanged.
- `SkillExecutor`/`SkillResolver`/`CombatBuild` internals — the level source changes (`skillLevelProvider` + snapshot projection); the +5%/level formula and `skill_level` scalar plumbing do not. `TurnSkillPlanRuntime` gains only the `progressionLevelKey` call-site swap (owner inheritance) — `progressionStub`/`SkillResolveInput.progression` shape unchanged. `LegacySkillAdapter` gains only the `levelScaling` coefficient wrap (D11) — no other conversion change.
- `CAST_LEVELING_THRESHOLDS` values, `HUY_KIEM_L3_CASTS`, `HUY_QUYEN_L3_CASTS` — untouched.
- `purchaseNode`/`switchRoute` semantics unchanged. `devResetBranch`/orphan-cascade gain ONLY the `grantsSkillCoreIds` revoke + core-Insight refund — tag selection, `kind:'node'` cascade logic, and ordinary refund math unchanged.
- Specialization/Variation nodes — not this mission (QI-D3 describes them; authoring is future content).
- No balance numbers changed (cost curve re-homed verbatim; thresholds verbatim; `levelScaling: 0.05` = the existing +5%/level rule applied to native defs per QI-D3).

## 6. Acceptance oracles

1. **Single authority grep oracle**: zero non-test hits for `player.skillLevels`/`skillLevels` (field deleted — type error if referenced); zero `skill.level =`/`skill.level++`/`skill.level <`/`skill.level >` mutation-or-gate reads outside the frozen field decl; `upgradeSkill`/`getSkillUpgradeInsightCost` zero hits outside history docs; zero non-test `skillSystem.learn(`/`skillManager.add(` hits outside `progressionOps.learnSkill`/SkillManager internals.
2. **Learn-grant + atomicity**: `learnSkill('tram', player)` writes `nodeLevels['core_tram'] === 1` + `purchasedNodeIds` membership; re-learn is a no-op on the key. A tampered-registry learn (core missing/mismatched for a `maxLevel > 1` template) returns `false` with `SkillManager` membership UNCHANGED (preflight before mutation). `purchaseNode` on an `unlocksSkillIds` node whose member's core is missing fails BEFORE insight is spent. `syncTalentCombatPassive` routes through `learnSkill` (grep oracle: no `skillManager.add`/`skillSystem.learn` outside the canonical seam).
3. **Cast channel**: `recordCast` at `lv2`/`lv3` thresholds advances `nodeLevels[core_tram]` (incl. multi-level jump); `skillCastCounts.tram` mirrors casts; `skillLevels` never written; notification reports the true new level/delta; **cast at already-reached level emits no notification**.
4. **Insight channel**: `levelUpSkill` on a learned Lv10-max skill deducts `5 + 3×(L−1)` and increments `nodeLevels[core]`; rejects on unlearned (level 0), maxed, insufficient insight; **rejects on cast-channel skills** at `canUpgradeNode` level; Van Dao waive never fires for cores.
5. **Gate reads**: `requiresSkillLevel` (linh_bao Lv3 offer) and `skillCastCount.level` prereq evaluate against `nodeLevels[core]` — pass when levelled via casts, fail before.
6. **Combat parity (characterization, not level-equality)**: `getEffectiveSkill` damage value at core Lv1 vs LvN differs by exactly `1 + (N−1)×0.05` (the preserved +5%/level rule — adapter-baked coefficient parity); `getScaledPassiveModifiers` magnitude scales with provider level; `skill_level` scalar resolves the node level; tram's flat `totalExperience` bonus unchanged.
7. **UI**: `SkillDetailView` shows canonical `Lv. x/max`, disables upgrade on cast-channel skills with cast-progress readout, and `levelUpSkill` click bumps state; `SkillPathList` same level source. `NodeTreePanel` renders zero `core_*` nodes.
8. **Save**: `CURRENT_SAVE_VERSION === 73`; v72-shape payload rejected; validator no longer references `skillLevels`; restore preflight rejects a v73 save whose learned levelled skill lacks `nodeLevels[core] ≥ 1`; **a v73 payload with `skills[i].level = 99` restores the entry at authored `template.level`** (non-1 value cannot resurrect); emitted v73 entries carry authored level.
9. **Data integrity**: every authored template `maxLevel > 1` has exactly one `core_<id>` node (`levelsSkillId` matches, `maxLevel` equal, no tags/effect payload); every `levelsSkillId` maps to a registered template with `maxLevel > 1` **or** to the whitelisted 14-id native-def set (the census list — extending it requires a catalog docblock note); no two nodes share `levelsSkillId`; `levelsSkillId` never targets an internal sub-action id (`phan_chinh`, `phan_kich`, `tro_kich`, `trong_phan_kich`, `ngu_kiem` emblem defs, combo extras — negative-list assert). **`progressionOwnerId` integrity**: every authored def carrying the field has its owner resolve to a registered `levelsSkillId` node (an eligible top-level owner), AND the def itself has no `core_<defId>` node (internal defs are never dual-keyed); generated Kiem Pho owners are runtime-validated by the orb-id source (`isOrbId` gate).
10. **Passives**: zero `levelsSkillId` nodes reference a `maxLevel: 1` template.
11. **Native cores — census, grants, behavior**: all 14 eligible native defs have authored `core_<id>` nodes (10 damage-bearing `maxLevel: 10`; 4 non-damage `maxLevel: 1`); the negative-list internal ids have none. Purchasing `cuong_chien`/`tran_the` root grants its kit cores (nodeLevels 1); committing `hidden_body_pathway`/`hidden_sword_pathway`/`sword_pathway` grants `way.coreSkillIds` cores. `adaptDamageOp` on a `levelScaling`-authored def yields coefficient ratio `1 + (L−1)×0.05` between core Lv1 and LvN — asserted on a static def AND on the **provider-resolved** `ngu_kiem_thuat`; a def without `levelScaling` keeps a constant coefficient at any level. `canUpgradeNode` rejects the 4 `maxLevel: 1` cores (no Insight sink for inert levels). **Owner inheritance**: a combo extra generated by an orb at `core_orb_*` Lv4 resolves its plan at level 4 (coefficient ratio `1+3×0.05`) with NO `core_<comboId>` existing; `phan_kich`/`tro_kich`/`trong_phan_kich` resolve at `core_tham_the`'s level.
12. **Registered-only projection + restore validation**: `getSkillLevels` projects only registered `levelsSkillId` nodes — a synthetic unregistered `nodeLevels['core_ghost'] = 4` does NOT surface `ghost` in the snapshot; a learned fixed-Lv1 skill without a core projects `1`. Restore preflight rejects a v73 save containing: an unregistered `core_*` key, a non-integer/zero/negative core level, a level above `maxLevel`, a hidden-way save missing a required `way.coreSkillIds` core, a body-root save missing a `grantsSkillCoreIds`-listed core, **or an owned core whose only declared sources are absent** (orphaned grant-owned core — e.g. `core_cuong_quyen` with `cuong_chien` unowned).
13. **Ritual atomicity**: tampered/missing `way.coreSkillIds` core metadata → `chooseCultivationPath` returns `false` with path/way/realm/mortal pick/technique/SkillManager/`nodeLevels` unchanged.
14. **UI surface — native + ordinary**: mounted `SkillPathPanel` on a sword-pathway (or hidden-body) player shows the owned native cores section — `orb_dam` displays canonical `Lv 1/10` + cost; **selecting the native entry swaps the center column to its detail/upgrade view even though the way owns a tree**; invoking upgrade calls `levelUpSkill` and bumps `nodeLevels[core_orb_dam]`; a `maxLevel: 1` core renders its maxed state with no enabled Insight affordance; re-selecting a tree node restores the node view. **On `spell_pathway`** (tree-owning via `spell.elemental_casting`): a learned Insight-levelled `Skill` template is selectable → the Detail tab shows canonical `Lv x/max` + cost → `levelUpSkill` click increments `nodeLevels[core_<skill>]`; the Core stays absent from `NodeTreePanel`; the Tree tab still works.
15. **Revoke lifecycle**: purchase `cuong_chien` → cores granted → `levelUpSkill` a kit core to Lv3 (Insight spent `5+8`) → `devResetBranch('the_tu')` → root AND all three kit cores deleted from `nodeLevels`+`purchasedNodeIds`, and the refund includes the core-spent Insight (`13`); re-purchasing the root re-grants cores at Lv1.

## 7. Affected-test census (preliminary — plan enumerates fully)

- `SkillSystem` tests — `upgradeSkill`/cost-fn removals; `recordCast` level assertions re-keyed to `nodeLevels`.
- `GameManager` save/restore tests — `skillLevels` field gone; `skills` entries' `level` ignored; v73.
- `CultivationPathKit`/KiemTuPath gate tests — seed `nodeLevels` instead of `skillLevels`.
- `NodeSystem` tests — `skillCastCount.level` prereq seeding; core-node `canPurchase`/`canUpgrade`/`upgradeNode` cases.
- `CombatBuild`/turn tests — entity `skillLevels` snapshot provenance.
- `BalanceBaselines` consumers (sim/benchmark tests) — seed shape.
- `SkillDetailView`/`SkillPathList`/`NodeTreePanel` component tests.
- `saveShapeValidation` tests.
- `tests/architecture/nodeBranchCoverage.test.ts`.
- `LegacySkillAdapter`/native-def resolution tests — `levelScaling` wrap, internal-exclusion census.
- `NguKiemDaoProvider` tests — provider-resolved def preserves `levelScaling`.
- `ActionImpactSystem.scaleActionDamage` tests — field preservation.
- `TheTuPath`/`KiemTuPath`/`GameManagerRealmAdvanceOps` way-commit tests — `coreSkillIds` grant + pre-commit atomicity; kit-root `grantsSkillCoreIds` purchase tests.
- `SkillPathPanel`/`SkillPathList` tests — `SkillPathEntry` union render, native selection→detail swap; `NativeCoreDetail` upgrade; `SkillDetailView` unchanged.
- `TurnSkillPlanRuntime`/turn tests — `progressionOwnerId` levelKey (combo extra at parent level; payload at `tham_the` level).
- `KiemPhoProvider` tests — combo extra carries `progressionOwnerId` + `levelScaling`.
- `NodeSystem`/`devResetBranch` tests — `grantsSkillCoreIds` revoke + spent-Insight refund.
- `GameManagerProgressionOps` — `syncTalentCombatPassive` funnel + learnSkill preflight tests.

## 8. Non-goals

- No `Skill` type field deletion; no Variation-node authoring; no technique gates (M-QI-06); no balance/cost/threshold changes beyond the authored `levelScaling: 0.05` parity value; no levelled passives; no translator/migration; no Kiem Pho combo work (M-QI-11); no non-damage native progression channels (mechanism precedent set — content deferred).
