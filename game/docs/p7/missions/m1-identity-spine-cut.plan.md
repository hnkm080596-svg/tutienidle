# P7-M1 — English Identity-Spine Cut (implementation plan)

> **Spec:** `game/docs/p7/missions/m1-identity-spine-cut.spec.md` (SPEC_PASS v4). This plan argues from the spec — read both.
> **Mode:** ONE atomic cut. The tree is intentionally type-broken between Tasks 2–8; the only green gate is Task 9/10 (`npm run verify`). Per-task verification = scoped grep-zero + targeted vitest where the task's slice is self-contained.

**Goal:** Migrate the `(cultivationPath, cultivationWay)` identity spine to semantic English with a strict six-way union — values, types, persisted fields, identity-facing names — with zero behavior change.

**Global constraints (from spec, verbatim):**

- No behavior/balance change of any kind; no file/directory renames (incl. test files); no leaf-id translation; no technique-id migration; no save-field add/remove — only renames + value changes; `CURRENT_SAVE_VERSION` 67→68, no translators.
- Display strings / i18n keys / lore names unchanged. Comments: only lines that would become factually wrong are updated (identifier names inside comments update mechanically; prose stays).
- `TuLinhTranBalance` must NOT be touched. `Skill.loadoutSlot(s)` untouched (M4). `unequipSkillIds`/`realmRewards`/`techniqueId` values untouched (M2/M3/M4 own).
- `MORTAL_PRECURSOR_SKILL_IDS`, way `skillIds`/`unequipSkillIds`, `branchTag`/`nodeTreeTag` values (`kiem_pho`, `ngu_kiem`, `the_tu`, `the_tu_an`, element tags), element/route/orb ids — **leaf, unchanged**.

---

## Rename tables (the complete mapping — every task cites these)

### T1 — Value literals (quoted-string swaps)

| Old literal | New literal | Context rule |
|---|---|---|
| `'kiem_tu'` | `'sword'` | scripted global EXCEPT visual-profile files (see VP note below) |
| `'phap_tu'` | `'spell'` | scripted global EXCEPT visual-profile files (exact-quote only; `phap_tu_linh_luc` etc. are different strings) |
| capability literals | see cap table | **EXACT 7 mappings — NO blanket prefix sweep** (suffixes change too): `'phap_tu.elemental_casting'`→`'spell.elemental_casting'`, `'phap_tu.the_pool'`→`'spell.essence_pool'`, `'phap_tu.empowered_ult'`→`'spell.empowered_ult'`, `'phap_tu.reaction_aura'`→`'spell.reaction_aura'`, `'kiem_tu.kiem_pho'`→`'sword.sword_scroll'`, `'kiem_tu.ngu_kiem_dao'`→`'sword.sword_riding'`, `'the_tu.the_economy'`→`'body.essence_economy'` |
| `'the_tu'` | `'body'` | **CONTEXT-SENSITIVE** — path id AND leaf `branchTag`/`nodeTreeTag`/visual-profile value. Manual per occurrence; leaf contexts keep it |
| `'the_tu_an'` | `'hidden_body'` | **CONTEXT-SENSITIVE** — `StatDomain` value changes; `branchTag`/`nodeTreeTag` `'the_tu_an'` stays; legacy-path-rejection fixtures stay (negative sentinel) |
| `'kiem_tu_an'` / `'phap_tu_an'` | *(unchanged)* | **LEGACY SENTINELS — do NOT migrate.** Retired node-id sentinel (`KiemTuPath.way.test.ts`, `KiemTuNodes.test.ts`) and legacy path-id rejection fixtures in save tests are intentional negative contracts — they assert the OLD id is rejected. Any *positive* (non-negative-fixture) use is a stale miss |
| `'hien'` | `'sword_pathway'` / `'body_pathway'` / `'kiem_pho'` | **CONTEXT-SENSITIVE + PAIR-DRIVEN** — canonical-way contexts resolve by the adjacent/constructed `cultivationPath` (`'sword'`→`'sword_pathway'`, `'body'`→`'body_pathway'`; invalid-pair tests pick a wrong-path valid way); `KiemBarSnapshot.mode` contexts map to leaf `'kiem_pho'` per the mode contract. Matrices expand to the pair table |
| `'ngu'` | `'hidden_sword_pathway'` / `'ngu_kiem'` | **CONTEXT-SENSITIVE** — canonical-way contexts → `'hidden_sword_pathway'`; `KiemBarSnapshot.mode` contexts → leaf `'ngu_kiem'` |
| `'ngu_hanh'` | `'spell_pathway'` | way value only (exact-quote; `dai_ngu_hanh_quyet`, `NguHanhChau` differ) |
| `'ngo_dao'` | `'hidden_spell_pathway'` | **CONTEXT-SENSITIVE** — migrate only way-identity contexts (`cultivationWay`, catalog way ids, `requiredWay`, pair tests); `'ngo_dao'` is ALSO a leaf talent id (`Talents.ts:186`, `selectedTalentIds`) — those uses STAY |
| `'ung_the'` | `'hidden_body_pathway'` | **CONTEXT-SENSITIVE** — migrate only way-identity contexts (`cultivationWay`, catalog way ids, `requiredWay`, pair tests); `'ung_the'` is ALSO a leaf buff id (`applyBuff('ung_the')`, `buffId: 'ung_the'`, marker fixtures) — those uses STAY |

**VP note — visual-profile contract (M1 boundary pinned):** `PlayerVisualProfileId = 'mortal'|'phap_tu'|'kiem_tu'|'the_tu'` and the `PLAYER_VISUAL_PROFILES` catalog keys are a **separate presentation contract** — NOT migrated in M1. In `PlayerVisualForm.ts`/`PlayerVisualProfiles.ts`/visual-profile tests: `cultivationPath` switch *inputs* migrate (`case 'phap_tu':`→`case 'spell':`) while profile-id *outputs* (`return 'phap_tu'`) and catalog keys stay. These files are manual, not scripted.

### T2 — Identifier renames (camel/Pascal/SCREAMING, applied longest-first)

**HARD RULE — symbols only, never module specifiers:** T2 sweeps rename *bindings/usages*, never the string inside `from '…'`/`import('…')`, file basenames, or directory names (spec §7: no file renames). Correct result: `import { SpellPathState } from '../phap-tu/PhapTuState'` — binding renamed, specifier unchanged. Scripted sweeps MUST exclude import specifier strings (match `from '…'` lines and protect them, or post-sweep grep `from '.*(SpellPath|SwordPath|Body|HiddenBody|HiddenSpell|SPELL_|SWORD_|BODY_).*/'`→0).

Semantic-pinned (spec examples + this plan's pins — applied BEFORE generic prefixes):

| Old | New |
|---|---|
| `isPhapTuNguHanh` | `isSpellPathway` |
| `isPhapTuNgoDao` | `isHiddenSpellPathway` |
| `isKiemTuHien` | `isSwordPathway` |
| `isKiemTuNgu` | `isHiddenSwordPathway` |
| `isTheTuHien` | `isBodyPathway` |
| `isTheTuUngThe` | `isHiddenBodyPathway` |
| `PHAP_TU_NGU_HANH_WAY` | `SPELL_PATHWAY` |
| `PHAP_TU_NGO_DAO_WAY` | `HIDDEN_SPELL_PATHWAY` |
| `KIEM_TU_HIEN_WAY` | `SWORD_PATHWAY` |
| `KIEM_TU_NGU_WAY` | `HIDDEN_SWORD_PATHWAY` |
| `THE_TU_HIEN_WAY` | `BODY_PATHWAY` |
| `THE_TU_UNG_THE_WAY` | `HIDDEN_BODY_PATHWAY` |
| `PathWayId` | `CultivationWayId` (deleted — no alias kept) |
| `getKiemTuPreset` | `getSwordScrollPreset` (semantic-English mechanic API — N1/N3; reads the kiem_pho preset) |

Generic prefix sweeps (substring-safe morphemes, longest-first):

| Old morpheme | New |
|---|---|
| `TheTuAn` | `HiddenBody` |
| `theTuAn` | `hiddenBody` |
| `THE_TU_AN` | `HIDDEN_BODY` (SCREAMING context — check `the_tu_an` leaf exceptions first) |
| `PhapTuAn` | `HiddenSpell` |
| `phapTuAn` | `hiddenSpell` |
| `PHAP_TU_AN` | `HIDDEN_SPELL` |
| `KiemTuAn` | `HiddenSword` |
| `kiemTuAn` | `hiddenSword` |
| `KIEM_TU_AN` | `HIDDEN_SWORD` |
| `TheTu` | `Body` |
| `theTu` | `body` |
| `THE_TU` | `BODY` (**CONTEXT-SENSITIVE** — same `the_tu` leaf exceptions) |
| `PhapTu` | `SpellPath` |
| `phapTu` | `spellPath` |
| `PHAP_TU` | `SPELL` |
| `KiemTu` | `SwordPath` |
| `kiemTu` | `swordPath` |
| `KIEM_TU` | `SWORD` |

Consequences of the generic rule (verify, don't hand-pick): `PhapTuState`→`SpellPathState`, `KiemTuState`→`SwordPathState`, `PhapTuWayRead`→`SpellPathWayRead`, `KiemTuWayRead`→`SwordPathWayRead`, `TheTuWayRead`→`BodyWayRead`, `createPhapTuState`→`createSpellPathState`, `freshKiemTuState`→`freshSwordPathState`, `createKiemTuInitialState`→`createSwordPathInitialState`, `validatePhapTuPersistedState`→`validateSpellPathPersistedState`, `validateKiemTuPersistedState`→`validateSwordPathPersistedState`, `PhapTuRoute`→`SpellPathRoute`, `PHAP_TU_ROUTES`→`SPELL_PATH_ROUTES`, `PHAP_TU_THE_GAIN_*`→`SPELL_ESSENCE_GAIN_*`, `PHAP_TU_EMPOWERMENT_THE_THRESHOLD`→`SPELL_EMPOWERMENT_ESSENCE_THRESHOLD` (the `THE` morpheme is the Thế essence resource — translate fully, never `SPELL_THE_*` mixed-language), `PHAP_TU_AN_*`→`HIDDEN_SPELL_*`, `theTuAnReactiveModifiers`→`hiddenBodyReactiveModifiers`, `resolveTheTuKit`→`resolveBodyKit`, `resolveTheTuAnKit`→`resolveHiddenBodyKit`, `player.phapTu`→`player.spellPath`, `player.kiemTu`→`player.swordPath`, `KiemBarPlayerState.kiemTu`→`.swordPath`, `TheBarPlayerState.phapTu`→`.spellPath`, `KiemBarSnapshot.mode: 'hien'|'ngu'` → `'kiem_pho'|'ngu_kiem'` (leaf presentation contract selecting which sword bar renders — leaf vocab, NOT the canonical way).

**Leaf identifier exceptions (MUST NOT rename):** `KiemPho*`, `NguKiemDao*`, `TheEconomy`/`TheEconomy.ts` exports, `OrbId`, `KIEM_PHO_ORB_IDS`, `TheTuSkills`/`TheTuBuffs` **data-export names** (leaf content files — their internal const names like `THE_TU_BUFFS` are also leaf), `TuLinhTran*`, `tram`/`linh_bao`/`huy_quyen`, all skill/node/material/enemy/quest/technique id strings, `ngo_dao_*`/`ngu_hanh`-containing content ids, `kiemY`/`kiemDao*`/`kiemDaoCount`/`kiemDaoBase` inner fields.

Wait — boundary check: `KIEM_TU`→`SWORD` would corrupt `KIEM_TU` inside… none — `KIEM_PHO`/`KIEM_Y` don't contain `KIEM_TU`. `PHAP_TU`→`SPELL` is safe (`PHAP_TU_KIT_IDS`→`SPELL_KIT_IDS` desired). `THE_TU`→`BODY`: `THE_TU_BUFFS`→`BODY_BUFFS` — but TheTuBuffs exports are leaf content… pin: **rename `TheTu*`/`THE_TU*` only in mechanic/type positions; data-catalog const names in `data/buff/TheTuBuffs.ts`, `data/skill/TheTuSkills.ts`, `data/skill/TurnAnKitSkills.ts`, `data/progression/TheTu*Nodes.ts`, `data/progression/PhapTu*Nodes.ts`, `data/skill/PhapTu*.ts`, `data/skill/KiemPho*.ts` stay leaf (file name + export names both keep)** — these files' *internal* path/way literal values still migrate.

### T3 — New canonical constants added to `CultivationPathKit.ts`

```ts
export type SwordWayId = 'sword_pathway' | 'hidden_sword_pathway'
export type SpellWayId = 'spell_pathway' | 'hidden_spell_pathway'
export type BodyWayId  = 'body_pathway' | 'hidden_body_pathway'
export type CultivationWayId = SwordWayId | SpellWayId | BodyWayId

export const CULTIVATION_PATH_WAY_IDS = {
  sword: ['sword_pathway', 'hidden_sword_pathway'],
  spell: ['spell_pathway', 'hidden_spell_pathway'],
  body:  ['body_pathway', 'hidden_body_pathway'],
} as const satisfies Record<CultivationPathId, readonly CultivationWayId[]>
```

`CultivationPathModule.ways` → `Readonly<Partial<Record<CultivationWayId, PathWayDefinition>>>` (spec-pinned sparse contract; `getActiveWayDefinition` already returns `| undefined`).

`PathCapability` → `'spell.elemental_casting' | 'spell.essence_pool' | 'spell.empowered_ult' | 'spell.reaction_aura' | 'sword.sword_scroll' | 'sword.sword_riding' | 'body.essence_economy'`.

`StatDomain` → `'spell' | 'sword' | 'body' | 'hidden_body'` (replacing the four path members; meta domains unchanged).

`PathConditionalRead` picks → `'nodeLevels' | 'spellPath' | 'swordPath'`. `PathSubpathAxis.state` literals → `'player.spellPath.element'`, `'player.spellPath.route'`, `'player.swordPath.preset'` (+ `root` doc strings).

---

## Task 0: Architecture workflow — G0 scope lock + G1 evidence (required)

This is an architecture migration → `game/docs/architecture/architecture-worker-workflow.md` G0–G5 applies in full.

- [ ] **G0 task card** (record in mission notes — this plan's header already carries scope/authority/non-goals; restate as: authorized outcome = identity-spine vocabulary migration with strict six-way union, zero behavior change; owner = `CultivationPathKit`/`CultivationPathSystem`; stop condition = Task 10 gates).
- [ ] **G1 — Q1–Q12 evidence answers recorded** (table, source-cited). **Triggered domain modules (every row, PASS/GAP/N/A with evidence):** C1–C7 (combat/stat pipeline — way stat facets, domain derivers, capability-gated combat branches), S1–S6 (save/persistence — schema v68, field renames, shape validation), L1–L4 (lifecycle — ritual commit, realm-entry reward channel), U1–U6 (UI/presentation — way-gated panels, bridges, visual profiles). Answers come from the spec §4 invariants + rename tables — write them explicitly, don't defer.
- [ ] G2 = Task 1 (invariants → contract test); G3 = Tasks 2–8; G4 = Tasks 9–10 gates; G5 = Task 10 evidence report.

## Task 1: Catalog-contract test (fails first)

**Files:** `src/core/player/CultivationPathContract.test.ts` (extend existing suite).

- [ ] Write the failing tests:

```ts
describe('P7-M1 identity spine', () => {
  it('each path module declares exactly its canonical way set', () => {
    for (const pathId of Object.keys(CULTIVATION_PATH_MODULES) as CultivationPathId[]) {
      const module = CULTIVATION_PATH_MODULES[pathId]
      expect([...Object.keys(module.ways)].sort())
        .toEqual([...CULTIVATION_PATH_WAY_IDS[pathId]].sort())
      for (const wayId of Object.keys(module.ways)) {
        expect(module.ways[wayId as CultivationWayId]?.pathId).toBe(pathId)
      }
    }
  })

  it('covers all six CultivationWayId members exactly once', () => {
    const all = Object.values(CULTIVATION_PATH_MODULES).flatMap(m => Object.keys(m.ways))
    expect(all.sort()).toEqual([
      'body_pathway', 'hidden_body_pathway',
      'hidden_spell_pathway', 'hidden_sword_pathway',
      'spell_pathway', 'sword_pathway',
    ])
  })

  it('getActiveWayDefinition resolves all six pairs and fails closed cross-path', () => {
    for (const [pathId, wayIds] of Object.entries(CULTIVATION_PATH_WAY_IDS)) {
      for (const wayId of wayIds) {
        expect(getActiveWayDefinition({
          cultivationPath: pathId as CultivationPathId,
          cultivationWay: wayId,
        })).toBeDefined()
      }
    }
    expect(getActiveWayDefinition({ cultivationPath: 'sword', cultivationWay: 'spell_pathway' }))
      .toBeUndefined()
    expect(getActiveWayDefinition({ cultivationPath: 'sword', cultivationWay: undefined }))
      .toBeUndefined()
  })
})
```

- [ ] Run `npx vitest run src/core/player/CultivationPathContract.test.ts -t "P7-M1 identity spine"` → **FAIL** (new ids don't exist yet). Keep it failing — it flips green in Task 3.

## Task 2: Identity core (kit + path modules + states + Player)

**Files:**
- `src/core/player/CultivationPathKit.ts` — unions + `CULTIVATION_PATH_WAY_IDS` + capability union + `CULTIVATION_PATH_MODULES` keys/way-keys + `PathConditionalRead` + `PathSubpathAxis.state` literals + re-exported `PHAP_TU_AN_*`→`HIDDEN_SPELL_*` names + all comments with identifier refs.
- `src/core/player/Player.ts` — `phapTu`→`spellPath` (field, type `SpellPathState`, `createSpellPathState()`), `kiemTu?`→`swordPath?` (`SwordPathState`), `cultivationWay?: CultivationWayId`, `createDefaultPlayer` declarations (Pinia toRefs contract — every renamed field must stay explicitly declared).
- `src/core/phap-tu/PhapTuState.ts`, `PhapTuPath.ts`, `PhapTuRoutes.ts` — T1/T2 renames; way `id`/`pathId` literals; `PhapTuRoute`→`SpellPathRoute`; validators' issue paths `'player.phapTu…'`→`'player.spellPath…'`; `subpaths.state` literals.
- `src/core/kiem-tu/KiemTuPath.ts`, `KiemTuState.ts` — same class; `createKiemTuInitialState`→`createSwordPathInitialState` writing `player.swordPath`.
- `src/core/the-tu/TheTuPath.ts` — way ids, `pathId: 'body'`, predicates, `theTuAnReactiveModifiers`→`hiddenBodyReactiveModifiers`, `theTuEnduranceModifiers`→`bodyEnduranceModifiers`, domain tags `'the_tu'`→`'body'`/`'the_tu_an'`→`'hidden_body'` inside stat facets.
- Module tests: `CultivationPathKit.test.ts`, `PhapTuPath.way.test.ts`, `KiemTuPath.way.test.ts`, `TheTuPath.way.test.ts`, `PhapTuState.test.ts`, `PhapTuRoutes.test.ts`, `kiem-tu/invariants.test.ts`, `KiemPhoProvider.test.ts`, `KiemPhoSystem.test.ts`, `NguKiemDao*.test.ts` (mechanical literal updates only).

**Steps:** apply T1 literals + T2 names per file → verify `PHAP_TU_AN_BASIC_ID` etc. values (`'van_phap_tuy_tam'`…) unchanged → scoped greps zero: `PathWayId`, `phapTu`, `kiemTu`, `PhapTu`, `KiemTu`, `TheTu`, `'kiem_tu'`, `'phap_tu'`, `phap_tu.`, `kiem_tu.` in the task's files (excluding leaf exceptions).

**Verify:** greps only — tree is type-red by design; do NOT run suite yet.

## Task 3: Path authority systems

**Files:** `src/core/player/CultivationPathSystem.ts` (`applyPathChoice`, `getActiveElement`/`getActiveRoute`/`getKiemTuPreset`→`getSwordScrollPreset`, `resolveActiveWayStatDomains`, `resolvePathCapabilities`, `hasStaticPathCapability`, `grantCultivationPathRealmReward`, domain-deriver registration), `CultivationPathRegistry.ts` (mortal slot-0 basic read — unchanged logic; `resolveTheTuKit`→`resolveBodyKit`, `resolveTheTuAnKit`→`resolveHiddenBodyKit`, build-id branches `'kiem_tu'`→`'sword'` etc.), `CultivationPathRuntime.ts` + their tests (`CultivationPathSystem.test.ts`, `CultivationPathRuntime.test.ts`, `CultivationPathContract.test.ts` — Task-1 block now flips green on the module catalog).

**Verify:** `npx vitest run src/core/player/CultivationPathContract.test.ts -t "P7-M1 identity spine"` — name-filtered, must pass (the rest of that suite exercises node/data catalogs migrated in Tasks 5–6; run the full file green in Task 9).

## Task 4: Stat domains + battle

**Files:** `src/core/stats/{StatDomain,StatCalculator,StatBlock,StatTypes,StatMetadata,TheTuStatChannels}.ts` (file name stays `TheTuStatChannels.ts`; only its mechanic export identifiers rename per T2), `src/core/game/CombatBuild.ts`, `src/core/battle/{CombatAction.ts,runtime/capability/DefaultCapabilityValidators.ts}`, `src/core/battle/turn/{TurnBattleSystem,TurnStatsRecompute,TurnSkillAction,TurnSkillPlanRuntime}.ts`, `src/core/the-tu/{TheTuCapabilities,TheTuKitModifiers,TheTuAnMechanicModifiers,TheTuBatTuSurvival,TheEconomy}.ts` (`TheEconomy` name stays — leaf system; internal `theTu*`/`TheTu*` mechanic names migrate), `src/core/combat/CombatEntity.ts`, `src/core/enemy/EnemyStatInput.ts` + all their tests (`StatDomain.test.ts`, `StatCalculator.theTu.test.ts`, `CombatBuild.test.ts`, `TurnBattleSystem.*.test.ts`, `EnemyStatInput.test.ts`, `TheTuBuffs.test.ts` data-side in Task 5).

**Key edits:** `StatDomain` union members; `STAT_DOMAIN` registry keys (`maxMp`→`'spell'` etc., `counterChance`→`'hidden_body'`…); every `includes('phap_tu')`/`=== 'kiem_tu'` domain check; way-stat-facet `domains` arrays; `deltaDerivers` record keys; `activeDomains` literals.

**Verify:** greps zero on `'phap_tu'|'kiem_tu'|'the_tu'|'the_tu_an'` inside stats/battle files EXCEPT `branchTag`/`nodeTreeTag` occurrences (none expected here — flag any found for review).

## Task 5: Game ops + progression + remaining core

**Files:** `src/core/game/{GameManager,GameManagerRealmAdvanceOps,GameManagerProgressionOps,GameManagerPersistentEffectOps,GameManagerPillOps,GameManagerTurnBattleOps,EarlyGameBootstrap}.ts`, `src/core/progression/{NodeSystem,ProgressionNode,NodeBranchViews}.ts` (`requiredWay`/`requiredCultivationPath` field types → new unions; `nodePathApplies`/`nodeWayApplies` logic unchanged), `src/core/tribulation/{BreakthroughOutcomeService,TribulationOutcomeService}.ts`, `src/core/skill/{SkillSystem,SkillEffect,CastLeveling}.ts`, `src/core/skilldef/{LegacySkillAdapter,SkillDefinition,SkillDefinitionRegistry}.ts`, `src/core/{pill/PillSystem,equipment/EquipmentStatPolicy,artifact/Artifact,artifact/ArtifactRuntime,player/PlayerVisualForm,cultivation/CultivationTick}.ts`, `src/core/simulation/**` (BattleSimulation, EarlyGame*, BalanceBaselines, probes), `src/core/kiem-tu/{KiemPhoSystem,KiemPhoProvider,NguKiemDao,NguKiemDaoProvider}.ts` (read `player.swordPath` now) + all their tests.

**Verify:** grep-zero sweep per file class; confirm `unequipSkillIds`/`techniqueId`/`skillIds` values untouched (diff spot-check).

## Task 6: Data files

**Files:** `src/data/progression/{PhapTuNodes,PhapTuNodes.builders,PhapTuAnNodes,KiemTuNodes,TheTuNodes,TheTuAnNodes,RealmPassives}.ts` + their tests — `requiredCultivationPath`/`requiredWay` literals per T1 (remember: `requiredWay: 'hien'`→`'sword_pathway'` in KiemTuNodes, `'body_pathway'` in TheTuNodes; `branchTag` untouched); `src/data/skill/TurnBasicAttacks.ts` — `BASIC_ATTACKS_BY_BUILD` → `Partial<Record<CultivationPathId, TurnSkillDefinition>>`, key `'kiem_tu'`→`'sword'`, `REQUIRED_BUILD_IDS = ['sword']`; `src/data/skill/*` (PhapTu*/KiemPho*/TheTu*/TurnAnKit/Skills/CoreSkills/TurnSkillDisplayMeta — internal mechanic names per T2, leaf export names stay); `src/data/{artifact,buff,formation,talent,technique,vfx}/**` + tests.

**Verify:** `nodePathApplies`/`nodeWayApplies` semantics proven by existing NodeSystem tests once suite runs; greps.

## Task 7: Save boundary

**Files:** `src/services/save/saveVersion.ts` (`CURRENT_SAVE_VERSION = 68`), `saveShapeValidation.ts` (issue paths `'player.phapTu'`→`'player.spellPath'`, `'player.kiemTu'`→`'player.swordPath'`; enum-membership + pair-coherence already generic — verify way-membership check still resolves through `CULTIVATION_PATH_MODULES`), `saveTypes.ts`, `SaveSystem.ts` (mechanical refs), `SaveRoundTrip.test.ts`, `saveShapeValidation.test.ts`, `stores/player.restoreFromSave.test.ts` fixtures.

**Verify (exact, not diagnostic):** `npx vitest run src/services/save/saveShapeValidation.test.ts src/services/save/SaveRoundTrip.test.ts` must be green. `src/stores/player.restoreFromSave.test.ts` is classified diagnostic-only until Task 9 (depends on systems migrated in Tasks 4–5) — record its failures as expected-red, not skipped.

## Task 8: UI + presentation

**Files:** `src/App.vue` (path refs only — `tu_linh_quyet` grant untouched), `src/components/panels/**` (SkillPathPanel way-gated tree selection, CharacterPanel ritual/aura, QuanKhiPanel offers, TurnCombatSkillBar branches, SkillLoadoutStrip text mentions, ArtifactPanel, PillBagSection, NodeTreePanel/NodeInspector/SkillDetailView), `src/composables/{useBreakthrough,useLoadoutActions,useTechniqueSections}.ts`, `src/presentation/bridges/{kiemBarBridge→fields .swordPath/'sword.sword_scroll'/'sword.sword_riding',theBarBridge→.spellPath/spell.*}.ts`, `src/presentation/art/{PlayerVisualProfiles,CombatPresentationCatalogue}.ts`, `src/core/player/PlayerVisualForm.ts`, `src/data/vfx/CombatVfxPresets.ts`, `src/data/skill/TurnSkillDisplayMeta.ts`, `src/game/scenes/{CombatScene,TranPhapCombatPreviewScene}.ts`, `src/game/scenes/combat/PlayerHudLayer.ts`, `src/game/support/CombatPreload.ts` + component/composable tests.

**Verify:** greps; no visual change intended (P14 deferred to Task 10 runtime check).

## Task 9: Residue sweep → type-check green → suite green

- [ ] `grep -rn "PathWayId" src` → 0 hits.
- [ ] `grep -rEn "(phapTu|kiemTu|theTu|theTuAn|phapTuAn|kiemTuAn|PhapTu|KiemTu|TheTu|TheTuAn|PhapTuAn|KiemTuAn|PHAP_TU|KIEM_TU|THE_TU)" src` → every hit manually classified as leaf-exception (`TheEconomy`, `TheTuSkills`/`TheTuBuffs`/`TheTu*Nodes`/`PhapTu*`/`KiemPho*`/`TurnAnKitSkills` data exports + filenames-in-comments) or fixed — no unclassified survivors.
- [ ] `grep -rEn "'(kiem_tu|phap_tu|ngu_hanh|hien|ngu)'" src` → 0 hits outside visual-profile files; visual-profile hits classified per the VP note (catalog keys/returns allowed, inputs must have migrated).
- [ ] `grep -rEn "'(kiem_tu_an|phap_tu_an)'" src` → EVERY hit classified: allowed only as retired-id/legacy-rejection negative sentinels; positive use = stale miss.
- [ ] `grep -rEn "'ngo_dao'" src` → EVERY hit classified: allowed only as leaf talent/content id (`Talents.ts`, `selectedTalentIds`, talent tests); any way-identity context is a stale migration miss — fix it.
- [ ] `grep -rEn "'ung_the'" src` → EVERY hit classified: allowed only as leaf buff/content id (`applyBuff`, `buffId`, marker fixtures, buff definitions); any way-identity context is a stale migration miss — fix it.
- [ ] `grep -rEn "'the_tu(_an)?'" src` → EVERY hit manually classified: allowed inside `branchTag`/`nodeTreeTag` fields, visual-profile catalog positions (VP note), and legacy-path-rejection negative fixtures; any other site (path/domain/source usage) is a stale migration miss — fix it.
- [ ] `grep -rEn "'(phap_tu|kiem_tu|the_tu)\." src` → 0 unclassified mechanic hits (old capability family gone; any survivor is a stale miss — fix it).
- [ ] `npm run type-check` → fix stragglers until clean.
- [ ] `npx vitest run` → fix remaining test literals/fixtures until fully green (zero behavioral assertion changes).

## Task 10: Gates + commit (mandatory P5 sequence — order is fixed)

`implement (T1–T8) → simplify (E3) → verify (P3 full) → OCR (P18) → runtime (P13/P14) → adversarial QA (P4) → sequential review passes ≥3 (P5) → external review → G5 evidence → commit`

- [ ] **E3 simplify:** run `code-simplifier` over the mission diff before verify.
- [ ] **P3 full:** `npm run verify` (type-check + build + full vitest — save schema + Pinia root state touched).
- [ ] **P18 OCR gate** over the mission diff.
- [ ] **P13/P14 runtime (real, not boot-only):** dev server from THIS worktree on its printed port; Playwright drives an actual initiation/path-choice flow: reach the mortal-cap state (devtools/save injection acceptable to stage the player), complete the ritual, assert `player.cultivationPath`+`cultivationWay` hold the new pair values at runtime, and inspect the affected surfaces (SkillPathPanel tree selection, CharacterPanel ritual entry, TurnCombatSkillBar branches, kiem/the bar bridges). P14: record the actual rendered state inspected (screenshots/DOM), not just "no console errors". An environment blocker stays a blocker — no downgrade to boot smoke.
- [ ] **P4 adversarial QA (quick)** via `tutienidle-adversarial-qa`.
- [ ] **P5 sequential passes ≥3** per AGENTS.md (Pass 1 local correctness → Pass 2 architecture/authority → Pass 3 adversarial integration; each over the post-fix state, Medium+ fixes force another pass, evidence blocks recorded).
- [ ] **External review:** send diff summary to ChatGPT until PASS. **Gate re-entry:** if external review causes ANY production-code change, re-enter the affected gates — P3 (scope-appropriate) → P18 → triggered P13/P14 → P4 → sequential P5 → external re-review → G5/commit. The committed code must be the state that was verified and reviewed.
- [ ] **G5 evidence report** (per architecture-worker-workflow): task card disposition, Q1–Q12 + triggered modules PASS/GAP/N/A with evidence, files-changed ↔ invariant mapping, verification evidence, remaining limitations.
- [ ] **Mission commit:** `feat(p7-m1): english identity-spine cut — strict six-way union` (include spec + plan + all source changes).

## Execution notes

- **Sed ordering** for scripted sweeps (git-bash, `sed -i`): T2 pinned names first, then `TheTuAn`/`theTuAn`/`PhapTuAn`/`phapTuAn`/`KiemTuAn`/`kiemTuAn`, then `TheTu`/`theTu`, `PhapTu`/`phapTu`, `KiemTu`/`kiemTu`, then `PHAP_TU_AN`/`KIEM_TU_AN`/`THE_TU_AN`, then `PHAP_TU`/`KIEM_TU`/`THE_TU` (skip leaf-exception files for `THE_TU`), then T1 **scripted-safe literals only**: `'ngu_hanh'`, plus `'kiem_tu'`/`'phap_tu'` EXCLUDING visual-profile files — then the **seven exact capability mappings as their own pinned step** (never a `'phap_tu.'` blanket sweep — `'phap_tu.'` is fully excluded from scripted literals) — then hand-fix ALL context-sensitive literals (`'the_tu'`, `'the_tu_an'`, `'hien'`, `'ngu'`, `'ngo_dao'`, `'ung_the'`) per the T1 context rules, and leave `'kiem_tu_an'`/`'phap_tu_an'` sentinels untouched.
- **Never** run `s/hien/…/` unquoted — `hien`/`ngu` appear inside prose and longer ids.
- Vietnamese messages inside `saveShapeValidation`/validators stay Vietnamese — only embedded identifier paths change.
- If a site stores an ad-hoc way string that isn't a union member (spec §12 risk), resolve to the real member — do not add new union members.
- Unrelated defects found during sweeps → record in mission notes; do NOT fix in M1 (P10).
