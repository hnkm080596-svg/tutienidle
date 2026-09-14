# Phap Tu Reimagined Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Phap Tu path per the reimagined spec — one element mutex + switchable route (dot/no), a single The pool burned by a two-form ultimate, and the hidden Phap Tu An path unlocked by mortal-skill mastery — while retiring the realtime-era chain/per-element-The/authored-reaction machinery.

**Architecture:** All new rule state lives on `PlayerData.phapTu` (one authority); route behavior lives in one module `PhapTuRoutes`; the turn engine executes only declarative turn-skill fields (`empowerment`, `compositePicks`, `repeatCasts`, `multicast`, `theGain*`, `detonateDoT`, `theScaling`); reactions become 2 sinh/khac rule classes on a new `WuxingRelations` primitive. Presentation consumes resolved state — never computes it.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia. Headless core (no Vue/Phaser imports in `src/core`).

**Spec:** `game/docs/superpowers/specs/2026-09-14-phap-tu-reimagined-design.md` (P1–P16, INV-1..12). Read it before each task — the plan argues from the spec.

**Base:** Worktree `.agent-worktrees/phap-tu-reimagined` branched from `stat-system-reimagined` (P12 — the design targets the post-stat-reimagine codebase). Create via `using-git-worktrees` at execution start.

## Global Constraints

- Comments English ASCII only (P15). Vietnamese only in i18n strings/data (P16).
- No `any` (P8). Generic systems get declarative fields, never `if skillId === '…'` (A8).
- One rule, one owner (A2): route semantics only in `PhapTuRoutes`; The gains only via turn-skill `theGain*` fields; reactions only in `TurnReactionManager`.
- No save migration (P16): bump save version, reject old saves with clear error — no partial load.
- `currentThe` stays `number | undefined` on `CombatEntity` (undefined reads as 0) — but PlayerData always carries it; An players hold 0, never absent.
- Constants (all owned by `PhapTuRoutes` unless noted): `THE_ULT_THRESHOLD = 100`, `PHAP_TU_THE_GAIN_BASIC = 5`, `PHAP_TU_THE_GAIN_SPECIAL = 15`, `PHAP_TU_THE_GAIN_CRIT = 3`, `DETONATE_AMP` (first-pass 1.5), `NUKE_THE_COEFF` (first-pass 1.0), `MAX_MULTICAST = 3`, `AN_MULTICAST_CHANCE = 0.25`, `AN_SPECIAL_FIRES = 3`, `KHAC_CHE_COEFF` (first-pass 1.0, lives in the reaction module), `ROUTE_RESPEC_REFUND = 0.75`.
- Verify per task: `npm run type-check` + `npx vitest run <scope>` (quick mode, P3). Full mode at Task 16.
- Every task ends with a commit (`feat:`/`refactor:`/`data:` style matching `git log`).

---

### Task 1: Path state + node-type extensions

**Files:**
- Modify: `game/src/core/player/Player.ts` (PlayerData ~line 101-300, factory ~line 400)
- Modify: `game/src/core/progression/ProgressionNode.ts` (~line 118-155)
- Create: `game/src/core/phap-tu/PhapTuState.ts`
- Test: `game/src/core/phap-tu/PhapTuState.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // core/phap-tu/PhapTuState.ts
  export type PhapTuRoute = 'dot' | 'no'
  export interface PhapTuState {
    element: ElementType | null
    route: PhapTuRoute | null
  }
  export function createPhapTuState(): PhapTuState
  // { element: null, route: null } — phap_tu-path state only;
  // 'phap_tu_an' is a separate CultivationPathId (Task 7), not a mode
  ```
  `PlayerData.phapTu: PhapTuState` (required field, default `createPhapTuState()` in the factory alongside `cultivationPath: undefined`).
  `ProgressionNode` gains: `routeTag?: 'dot' | 'no'`, `elementTag?: ElementType` (marks membership of an element branch).

- [ ] **Step 1: failing test** — `createPhapTuState()` returns `{ element: null, route: null }`; `createPlayerData().phapTu` deep-equals it.

```ts
import { describe, expect, it } from 'vitest'
import { createPhapTuState } from './PhapTuState'
import { createPlayerData } from '../player/Player'

describe('PhapTuState', () => {
  it('defaults: no element, null route', () => {
    expect(createPhapTuState()).toEqual({ element: null, route: null })
  })
  it('player factory carries phapTu state', () => {
    expect(createPlayerData().phapTu).toEqual(createPhapTuState())
  })
})
```

- [ ] **Step 2:** run `npx vitest run src/core/phap-tu` — FAIL (module missing).
- [ ] **Step 3:** create `PhapTuState.ts`; add `phapTu: PhapTuState` to `PlayerData` + factory; add `routeTag`/`elementTag` to `ProgressionNode`.
- [ ] **Step 4:** rerun — PASS. Then `npx vitest run src/services/save src/core/player` — fix save-shape validation for the new required field (`saveShapeValidation.ts` — add `isObject(player.phapTu)` check + `element`/`route` member checks).
- [ ] **Step 5:** `npm run type-check`. Commit.

---

### Task 2: Mortal skills `linh_bao` + `huy_quyen` and generalized cast-leveling

**Files:**
- Modify: `game/src/core/skill/SkillSystem.ts` (lines 24-40, 338-365)
- Modify: `game/src/data/skill/CoreSkills.ts` (near `tram`)
- Modify: `game/src/App.vue:518,536` (the two `learnSkill('tram')` creation call sites)
- Test: `game/src/core/skill/SkillSystem.castCount.test.ts`

**Interfaces:**
- Consumes: `castCountSink`, `player.skillCastCounts`/`skillLevels` mirror (existing).
- Produces:
  ```ts
  // SkillSystem.ts — replaces the tram-specific gate
  export const CAST_LEVELING_THRESHOLDS: Record<string, { lv2: number; lv3: number }> = {
    tram:      { lv2: 1000, lv3: 10000 },
    linh_bao:  { lv2: 1000, lv3: 10000 },
    huy_quyen: { lv2: 1000, lv3: 10000 },
  }
  export const MORTAL_SKILL_L3_CASTS = 10000
  export function getCastLeveledSkillLevel(skillId: string, totalExperience: number): number | undefined
  // returns undefined for skills not in the table; recordCast uses it.
  ```
  New skills in `CoreSkills.ts`:
  - `linh_bao` — active, `damageType: 'primordial'` (EXISTING type — the converter maps it to `kind: 'primordial'`), `maxLevel: 3`, single-target damage + `onCast → dealDamage` trigger mirroring `tram`'s shape. Vietnamese label **Linh Bạo** (pinned, spec §11).
  - `huy_quyen` — same shape, physical damage. Label **Huy Quyền**.
  Both: `upgradeSkill` must reject them exactly like `tram` (INV-9) — the rejection currently keys on `maxLevel`-by-cast leveling; extend whatever predicate `tram` uses to the table.

- [ ] **Step 1: failing tests** — append to `SkillSystem.castCount.test.ts`:

```ts
it.each(['linh_bao', 'huy_quyen'])('%s auto-levels Lv2 at 1000, Lv3 at 10000 casts', (id) => {
  const system = new SkillSystem(new SkillManager())
  system.learn(SKILLS.find(s => s.id === id)!)
  for (let i = 0; i < 999; i++) system.recordCast(id)
  expect(system.get(id)!.level).toBe(1)
  system.recordCast(id)
  expect(system.get(id)!.level).toBe(2)
})
```

- [ ] **Step 2:** run — FAIL (skills don't exist).
- [ ] **Step 3:** implement — `CAST_LEVELING_THRESHOLDS` table; `recordCast` reads `getCastLeveledSkillLevel(skill.id, skill.totalExperience)` instead of the `tram`-only branch (keep `getHuyKiemFlatDamageBonus` — it is tram-specific scaling, unchanged); author the two skills; add `learnSkill('linh_bao')` + `learnSkill('huy_quyen')` at both `App.vue` creation sites next to `learnSkill('tram')`.
- [ ] **Step 4:** rerun scope + `npx vitest run src/core/game/GameManager.castCount` — PASS. Check `upgradeSkill` rejection test still green (`SkillSystem.huyKiem` scope).
- [ ] **Step 5:** type-check. Commit.

---

### Task 3: `PhapTuRoutes` module — route profiles + effective-skill wiring

**Files:**
- Create: `game/src/core/phap-tu/PhapTuRoutes.ts`
- Modify: `game/src/core/skill/SkillSystem.ts` (`getEffectiveSkill` ~line 90-147)
- Modify: `game/src/core/game/GameManager.ts` (constructor — wire provider; find where `setCastCountSink` is called)
- Test: `game/src/core/phap-tu/PhapTuRoutes.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RouteProfile {
    directMultiplier: number
    ailmentChanceFactor: number
    ailmentStackBonus: number
    empoweredUlt: 'detonate' | 'nuke'
    statModifiers: StatModifier[]
    critTheGain?: number
  }
  export const PHAP_TU_ROUTES: Record<PhapTuRoute, RouteProfile> = {
    dot: { directMultiplier: 0.85, ailmentChanceFactor: 1.25, ailmentStackBonus: 1,
           statModifiers: [
             { stat: 'ailmentPotencyPercent', percent: 0.30 },
             { stat: 'ailmentDurationPercent', percent: 0.20 },
           ],
           empoweredUlt: 'detonate' },
    no:  { directMultiplier: 1.15, ailmentChanceFactor: 0.50, ailmentStackBonus: 0,
           statModifiers: [
             { stat: 'criticalRate', percent: 0.08 },
             { stat: 'criticalDamage', percent: 0.25 },
           ],
           critTheGain: PHAP_TU_THE_GAIN_CRIT, empoweredUlt: 'nuke' },
  }
  export function resolveRouteProfile(state?: PhapTuState): RouteProfile
  // neutral ×1.0/[] profile when !state || route===null (INV-11);
  // phap_tu_an players never reach this — route state is not theirs
  export function applyRouteToEffectiveSkill(effective: EffectiveSkill, profile: RouteProfile): EffectiveSkill
  // multiplies every damage effect/trigger value by directMultiplier;
  // multiplies debuff ailmentChance by ailmentChanceFactor (result still
  // flows through the existing +elementApplicationPercent / min(1,…) clamp
  // in SkillEffectSystem — no second clamp here);
  // adds ailmentStackBonus to TurnSkillAilmentApplication stacks at convert
  // time via the same effective-skill surface.
  ```
  `SkillSystem` gains `setRouteProfileProvider(fn: () => RouteProfile)`; `getEffectiveSkill` ends with `return applyRouteToEffectiveSkill(result, this.routeProfileProvider?.() ?? NEUTRAL)`. GameManager wires the provider to `() => resolveRouteProfile(activePlayer?.phapTu)` next to the existing `setCastCountSink` call.
  Route `statModifiers` enter the character modifier pipeline via a new `getRouteStatModifiers(player)` exported here, called from the same aggregation that consumes `aggregateNodeStatModifiers` (GameManagerPersistentEffectOps — find the caller at ~line 91).

- [ ] **Step 1: failing test**:

```ts
it('dot route scales damage down and ailment chance up', () => {
  const eff = applyRouteToEffectiveSkill(
    { effects: [{ type: 'damage', value: 100 }, { type: 'debuff', buffId: 'bong', ailmentChance: 0.5 }] } as EffectiveSkill,
    PHAP_TU_ROUTES.dot,
  )
  expect(eff.effects[0]).toMatchObject({ value: 85 })
  expect(eff.effects[1]).toMatchObject({ ailmentChance: 0.625 })
})
it('neutral when route null', () => {
  expect(resolveRouteProfile({ element: 'fire', route: null }).directMultiplier).toBe(1)
  expect(resolveRouteProfile({ element: 'fire', route: 'dot' }).statModifiers).not.toEqual([])
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement module + provider + aggregator call. **Step 4:** PASS + run `src/core/skill` scope (existing getEffectiveSkill tests must stay green — no provider = neutral). **Step 5:** type-check. Commit.

---

### Task 4: `switchRoute` + `routeTag` gating + 75% refund

**Files:**
- Modify: `game/src/core/progression/NodeSystem.ts` (`canPurchaseNode`, `canUpgradeNode`, `aggregateNodeStatModifiers`, `aggregateNodeSkillModifiers`, onHit aggregation ~lines 142-360)
- Modify: `game/src/core/game/GameManagerProgressionOps.ts` (add `switchRoute` op ~line 271 next to `devResetBranch`)
- Test: `game/src/core/progression/NodeSystem.route.test.ts` (new)

**Interfaces:**
- Consumes: `ProgressionNode.routeTag` (Task 1), `nodeFreePurchaseRecord` refund accounting (existing `devResetBranch` pattern at NodeSystem:282-360).
- Produces:
  ```ts
  // NodeSystem.ts
  export function switchRoute(player: PlayerData, registry: { getAll(): ProgressionNode[] }, route: PhapTuRoute): number
  // for every node with routeTag === old route: level→0, delete nodeLevels entry,
  // purchasedNodeIds entry; refund floor(actualPaid × 0.75) using
  // nodeFreePurchaseRecord exactly like devResetBranch; sets player.phapTu.route.
  // Returns total refunded.
  export function isNodeRouteActive(player: PlayerData, node: ProgressionNode): boolean
  // routeTag undefined → true; else player.phapTu.route === routeTag
  ```
  `canPurchaseNode`/`canUpgradeNode` add `isNodeRouteActive` check. Both aggregators skip inactive-route nodes. `GameManagerProgressionOps.switchRoute(route, player)` rejects while a turn battle is active (`this.deps.getTurnBattle?.()`-style check or the existing combat flag — mirror how other out-of-combat ops guard).

- [ ] **Step 1: failing test** — new file with: routeTag node unpurchasable when route mismatches; switch refunds floor(paid×0.75) and zeroes levels; A→B→A pays the tax twice; untagged nodes untouched.

```ts
it('switchRoute refunds 75% of actual paid and clears route-tagged levels', () => {
  const player = createPlayerData()
  player.skillInsight = 100
  player.phapTu = { element: 'fire', route: 'dot' }
  purchaseNode(player, registry.get('dot_spec_1'))       // cost 2
  upgradeNode(player, registry.get('dot_spec_1'))        // +2 → paid 4
  const refunded = switchRoute(player, registry, 'no')
  expect(refunded).toBe(3)                                // floor(4 × 0.75)
  expect(player.nodeLevels['dot_spec_1']).toBeUndefined()
  expect(player.phapTu.route).toBe('no')
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + `src/core/progression` scope green. **Step 5:** type-check. Commit.

---

### Task 5: `WuxingRelations` primitive + ailment element tags

**Spec correction noted:** the spec assumes `WuxingRelations` exists — it does NOT. This task creates it.

**Files:**
- Create: `game/src/core/element/WuxingRelations.ts`
- Modify: `game/src/core/buff/BuffTypes.ts` (`BuffDefinition` ~line 84)
- Modify: `game/src/data/buff/LegacyBuffs.ts` + `ThuanHeBuffs.ts` (author `element` on elemental ailments)
- Test: `game/src/core/element/WuxingRelations.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // ELEMENT_ORDER already exists: ['wood','fire','earth','metal','water'] (ElementLabels.ts:26)
  export const SINH_CYCLE: Record<ElementType, ElementType> =
    { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' }
  export const KHAC_OVERCOMES: Record<ElementType, ElementType> =
    { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' }
  export function relationOf(a: ElementType, b: ElementType): 'sinh' | 'khac' | null
  // sinh iff SINH_CYCLE[a]===b || SINH_CYCLE[b]===a; khac iff KHAC_OVERCOMES[a]===b || [b]===a
  export function khacOvercomer(a: ElementType, b: ElementType): ElementType
  // returns whichever of a/b overcomes the other (KHAC_OVERCOMES[x]===y → x)
  ```
  `BuffDefinition` gains `element?: ElementType`. Author it on: `bong`→fire, `trung_doc`→wood, `chay_mau`→metal, `te_cong`→water, `hoai_tu`/`thach_hoa`/`troi_chan`→earth, `dung_nham`→fire, `huyet_doc`→metal, `cau_mang_can`→(check its kit — metal or earth; read the def), plus any `phap_tu` ailment in `ThuanHeBuffs.ts`. Non-elemental buffs get no field.

- [ ] **Step 1: failing test**:

```ts
it('exactly 5 sinh + 5 khac unordered pairs over 5 elements', () => {
  let sinh = 0, khac = 0
  for (const a of ELEMENT_ORDER) for (const b of ELEMENT_ORDER) {
    if (ELEMENT_ORDER.indexOf(a) >= ELEMENT_ORDER.indexOf(b)) continue
    const r = relationOf(a, b); if (r === 'sinh') sinh++; else khac++
  }
  expect(sinh).toBe(5); expect(khac).toBe(5)
})
it('khacOvercomer: water beats fire either direction', () => {
  expect(khacOvercomer('fire', 'water')).toBe('water')
  expect(khacOvercomer('water', 'fire')).toBe('water')
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement + author `element` fields. **Step 4:** PASS + `src/data/buff` + `src/core/buff` scopes green. **Step 5:** type-check. Commit.

---

### Task 6: New node tree — mutex roots, growth, route-tagged, unlocks, hidden node

**Files:**
- Rewrite: `game/src/data/progression/PhapTuNodes.builders.ts`
- Rewrite: `game/src/data/progression/PhapTuNodes.ts`
- Modify: `game/src/core/progression/NodeSystem.ts` — `canPurchaseNode` mutex + routeTag gating only (no `visibleWhen` machinery — the hidden path is a path, not a node)
- Test: `game/src/data/progression/PhapTuNodes.reimagined.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 node fields, Task 4 routeTag gating.
- Produces tree per spec §7:
  - 5 element roots `phap_tu_linh_ngo_<el>` with pairwise `excludesNode` + `elementTag` + `unlocksElement` + `unlocksSkillIds: [basicId]` (P1 mutex).
  - Per-element branch (`elementTag` on every node): power growth ~10lv, ailment-leaning + damage-leaning growth, `buildUnlockNode('special'|'godUlt', element)` (new generic builder — `unlocksSkillIds` for special; god-ult node is the empowerment GATE, no skill grant needed beyond marking ownership), The nodes `tu_the_<el>` (theGain — needs a `SkillModifier`/`StatModifier` lane; use statModifiers on a new stat or the route-profile channel — simplest: statModifier on `theGainPercent`-style runtime field is NOT a stat; implement as `skillModifiers` on the element skills raising a new `theGainOnHit` skill field, OR node statModifier to a new stat `theGainFlat` — pick: `skillModifiers` on the basic/special skill, stat key `theGainOnHit` added to `SkillResourceStatKey`), `truong_the_<el>` (raises cap — `skillModifiers` on skills or a player-level stat `maxThe`; add `maxThe` to the same runtime lane).
  - Route-tagged: 3 nodes per route per element, 5 lv each (`routeTag` + `elementTag`).
  - `phap_tu_an` has NO node here — it is a separate CultivationPathId (Task 7); this tree is hien-only.
- Deletes: `buildThuanBranch`, `THUAN_VARIANTS`, `keystoneReaction`/`keystonePure`, `lap_dao_thuan_*`, B/D-position chain unlock nodes, `reaction_path_unlock_*`, Thế Mãn nodes. `lap_dao_thuan_<el>` ids are RETIRED — `getPhapTuThuanElement` migrates to `player.phapTu.element` (Task 13 owns that call-site swap; the tree task removes the nodes).

- [ ] **Step 1: failing tests** — mutex (buy fire root → `canPurchaseNode(wood root)` false), every prerequisite `node`/`excludesNode` target exists (reuse the dao.test.ts:258 integrity pattern), route-tagged node count = 6 per element branch.
- [ ] **Step 2:** FAIL. **Step 3:** rewrite builders + data. **Step 4:** PASS; expect `PhapTuNodes.dao.test.ts`/`*.vanDao` etc. to break — UPDATE or delete the tests asserting removed content (they test the old tree; keep the integrity-checker ones, repoint). **Step 5:** type-check. Commit.

---

### Task 7: `phap_tu_an` as a first-class path (ritual offer)

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — `CultivationPathId` union gains `'phap_tu_an'`; `CULTIVATION_PATH_KITS['phap_tu_an']` entry (name, own technique `ngo_dao_chan_quyet`, kit `statModifiers` — MP-shield line mirroring phap_tu's + `attunement` base; `skillIds` UNUSED — the kit is granted in a bespoke branch like kiem_tu's, since the ult slot is a passive)
- Create: `game/src/data/technique/` entry `ngo_dao_chan_quyet` — minimal technique for the an path; carries `innateSkillId: 'ngo_dao_hon_don'` so the existing `equipTechnique` machinery auto-learns + `equipWithoutSlot`s the dao passive (zero new wiring)
- Modify: `game/src/core/player/CultivationPathSystem.ts` — new `getOfferableCultivationPaths(player): CultivationPathId[]` — base paths + `'phap_tu_an'` iff `(player.skillCastCounts?.['linh_bao'] ?? 0) >= MORTAL_SKILL_L3_CASTS` (pre-choice only; UI consumes this)
- Modify: `game/src/core/game/GameManagerRealmAdvanceOps.ts` (`chooseCultivationPath` ~line 176) — new `pathId === 'phap_tu_an'` branch BEFORE the generic kit branch: re-checks the same linh_bao predicate and returns false if unmet; grants `van_phap_tuy_tam`→slot 0 / `da_phap_lien_tuyen`→slot 1 via `learnSkill`/`equipToSlot`; the passive arrives via the technique's `innateSkillId`
- Create: `game/src/data/progression/PhapTuAnNodes.ts` — STUB module (empty root); An's real tree gets its own deeper spec later (user ruling)
- Modify: wherever the node-tree UI/registry maps `cultivationPath` → tree module — route `'phap_tu_an'` → `PhapTuAnNodes` (stub) instead of `PhapTuNodes`
- Modify: `game/src/core/skill/SkillSystem.ts` — export `MORTAL_SKILL_L3_CASTS` (or the generalized constant from Task 2's `CAST_LEVELING_THRESHOLDS` — one constant, `HUY_KIEM_L3_CASTS` re-aliases to it)
- Test: `game/src/core/game/GameManager.phapTuAnPath.test.ts` (new)

**Interfaces:**
- Produces: `getOfferableCultivationPaths`; `CultivationPathId` extension; `MORTAL_SKILL_L3_CASTS`.
- Consumes: Task 2's `linh_bao` skill + `CAST_LEVELING_THRESHOLDS`; existing `skillCastCounts` mirror; existing `innateSkillId` machinery.
- Also authors the three an-skill DATA SHELLS (`van_phap_tuy_tam`, `da_phap_lien_tuyen`, `ngo_dao_hon_don`) — ids, slots, targeting, labels — needed for the grant; their RESOLUTION semantics (composite pick / repeat / multicast) are Task 10.
- The persisted record is `player.cultivationPath === 'phap_tu_an'` itself — NO eligibility/mode field is stored (spec §5.1, P11).

- [ ] **Step 1: failing test** — `getOfferableCultivationPaths` hides `phap_tu_an` at 9999 `linh_bao` casts, shows it at 10000; `chooseCultivationPath('phap_tu_an', …)` returns false below Lv3 and succeeds at Lv3 (path set, technique equipped, passive learned-and-equipped without a slot, the two actives in slots 0/1); post-ritual `linh_bao` casts change nothing (path already set — `chooseCultivationPath` rejects like any second choice); a kiem_tu player with `linh_bao` Lv3 was never offered it (offer evaluated inside the ritual only).

```ts
it('phap_tu_an offered only at the ritual and only at linh_bao Lv3', () => {
  player.skillCastCounts = { linh_bao: 9999 }
  expect(getOfferableCultivationPaths(player)).not.toContain('phap_tu_an')
  expect(realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(false)

  player.skillCastCounts.linh_bao = 10000
  expect(getOfferableCultivationPaths(player)).toContain('phap_tu_an')
  expect(realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(true)
  expect(player.cultivationPath).toBe('phap_tu_an')
  expect(skillManager.has('ngo_dao_hon_don')).toBe(true) // via innateSkillId
})
```

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + progression scope. **Step 5:** type-check. Commit.

---

### Task 8: The-loop rework — per-skill `theGain*` fields

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillDefinition`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (lines ~1092-1099, ~1265-1274 — the slot-position LINK/FINISHER hooks)
- Modify: `game/src/core/combat/CombatTypes.ts:89-91` (constants)
- Modify: `game/src/data/skill/BatKiemThuat.ts` (kiem skills keep their gains via the new fields — `THE_GAIN_PER_LINK`/`FINISHER` values move onto the skill defs, NOT deleted: bat kiem still uses this pool)
- Modify: `game/src/core/game/GameManager.ts` (attach `theGainOnHit` when building phap_tu basics/specials; `theGainOnCrit` when route==='no')
- Test: `game/src/core/battle/turn/TurnBattleSystem.theResource.test.ts` (rewrite)

**Interfaces:**
- Produces on `TurnSkillDefinition`: `theGainOnHit?: number` (granted per landed hit of this skill), `theGainOnCrit?: number` (extra on direct-hit crit only).
- Engine rule replaces slot constants: `if (action.skill.theGainOnHit) actor.currentThe += …` — clamped at `actor`'s cap (see `maxThe` snapshot; default `MAX_THE`). Crit hook: on `isCrit` flag of the landed hit, add `theGainOnCrit`.
- Constants: `PHAP_TU_THE_GAIN_*` live in `PhapTuRoutes.ts` (imported by GameManager at build time); `THE_GAIN_PER_LINK`/`FINISHER` stay in CombatTypes but are now referenced ONLY by kiem skill data.

- [ ] **Step 1: failing test** — phap_tu basic hit +5, special +15, ult +0; `no`-route crit adds +3; cap clamps.

```ts
it('phap_tu basic landed hit grants PHAP_TU_THE_GAIN_BASIC', () => {
  // build battle with a basic carrying theGainOnHit: 5
  …expect(player.entity.currentThe).toBe(5)
})
it('no-route crit grants theGainOnCrit on top', () => { … })
```

- [ ] **Step 2:** FAIL. **Step 3:** implement fields + engine hook + GameManager attach + migrate bat_kiem defs to carry their old values as `theGainOnHit`. **Step 4:** PASS + `theResource`/kiem scopes. **Step 5:** type-check. Commit.

---

### Task 9: Ultimate empowerment — same slot, two forms, consume-all

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` + `TurnBattleSystem.ts` (cast resolution)
- Modify: `game/src/core/game/GameManager.ts` (`resolvePlayerSpecialUltimate` — attach empowerment)
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts` (support authoring the empowered form)
- Test: `game/src/core/battle/turn/TurnBattleSystem.empowerment.test.ts` (new)

**Interfaces:**
- Produces on `TurnSkillDefinition`:
  ```ts
  empowerment?: { theThreshold: number; empowered: TurnSkillDefinition }
  consumesAllThe?: boolean   // empowered form carries this — burns ALL currentThe
  ```
- Engine rule (INV-4): at cast, `skill.empowerment && (actor.currentThe ?? 0) >= empowerment.theThreshold` → resolve `empowerment.empowered` as the action; that skill's `consumesAllThe` zeroes the pool AFTER capture (theBurned value flows into `theScaling` — Task 12). Below threshold or no empowerment → base form, The untouched.
- GameManager: `resolvePlayerSpecialUltimate` attaches `empowerment` ONLY when `player.nodeLevels['linh_ngo_<godUltId>'] > 0` (node-owned gate — engine stays dumb, A8) AND picks the empowered skill variant by `resolveRouteProfile().empoweredUlt` (detonate vs nuke data — Task 12 fields).

- [ ] **Step 1: failing test** — 4 branches: <100 → base, no consume; ≥100 without empowerment → base, no consume; ≥100 with empowerment → empowered id resolves + currentThe===0; ≥100 with raised cap (150) → consumes ALL 150.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 10: An kit — generalized composite picks, repeat, multicast

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` + `TurnBattleSystem.ts` (follow-up queue ~line 390-650)
- Modify: `game/src/data/skill/TurnAnKitSkills.ts` (Task 7 created the shells — this task implements their resolution semantics)
- Modify: `game/src/core/game/GameManager.ts` (resolve basic/special/ult when `player.cultivationPath === 'phap_tu_an'`)
- Test: `game/src/core/battle/turn/TurnBattleSystem.anKit.test.ts` (new)

**Interfaces:**
- Produces on `TurnSkillDefinition`:
  ```ts
  compositePicks?: { poolType: 'element_basic'; count: number }  // 'reaction_path' RETIRED (kill list)
  repeatCasts?: number          // extra executions of this action via follow-up queue
  multicast?: { chance: number; maxExtraCasts: number }
  ```
- `van_phap_tuy_tam`: `compositePicks { poolType:'element_basic', count:1 }` — engine picks uniformly among the 5 element-basic TurnSkillDefinitions (build the pool from `CHAIN_SKILL_IDS[*][0]` converted defs) and executes the PICKED skill as the cast (damage type/ailment from the picked def — spec S7). Cast records under `van_phap_tuy_tam` only (S8 — the picked id never gains cast counts).
- `da_phap_lien_tuyen`: `compositePicks {element_basic,1}` + `repeatCasts: AN_SPECIAL_FIRES - 1` — each repeat re-rolls the pick. Repeat executions are NOT basic-slot casts and never roll multicast (P15).
- `ngo_dao_hon_don`: passive — implemented as `multicast` attached to the An BASIC turn-skill (participant snapshot): after a basic-slot or multicast-sourced execution, roll chance → enqueue multicast follow-up of the same basic (re-rolls its own composite pick), depth-capped `MAX_MULTICAST`. Follow-up entries carry `source: 'repeat' | 'multicast'`; only `multicast`-sourced and original basic casts roll again.
- GameManager: `cultivationPath === 'phap_tu_an'` → basic=`van_phap_tuy_tam` (with multicast attached), special=`da_phap_lien_tuyen`, ultimate slot EMPTY (dao passive — no button; it arrived via `innateSkillId` at the ritual).

- [ ] **Step 1: failing tests** — basic resolves one of the 5 element defs (assert the resolved cast's damage kind is elemental, cast count recorded under `van_phap_tuy_tam`); special fires exactly 3 executions, each an element pick, zero multicast rolls (inject `chance:1` and assert still exactly 3); multicast with `chance:1` chains to the `MAX_MULTICAST` cap; picked element ids never appear in `skillCastCounts`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 11: Reaction rule engine — sinh/khac classes replace authored pairs

**Files:**
- Modify: `game/src/core/battle/turn/TurnReactionManager.ts` (rewrite `checkAndTrigger`)
- Modify: `game/src/core/element/ElementReaction.ts` (retire `ELEMENT_REACTIONS` — keep `ElementReactionDefinition` type if reused; delete the table)
- Test: `game/src/core/battle/turn/TurnReactionManager.rules.test.ts` (new); update `TurnReactionManager.test.ts` + `reactionPathE2E`/`r3Content` tests that assert old pairs

**Interfaces:**
- Consumes: `relationOf`/`khacOvercomer`/`ELEMENT_ORDER` (Task 5), `BuffDefinition.element`, `elementalBasePower` (existing), `BuffPool` instance consumption (existing ARCH-009 contract).
- New `checkAndTrigger` semantics per spec §6:
  ```ts
  // called after a successful ailment application (newcomer)
  for (const incumbent of targetBuffs distinct-element ailments, ELEMENT_ORDER):
    pair = relationOf(newcomer.element, incumbent.element); skip null/same
    khac → consume BOTH instances; burst = consumedStacks ×
           elementalBasePower(source, khacOvercomer) × KHAC_CHE_COEFF
           × (1 + reactionEffectPercent); damage element = overcomer
           (target's resistance to that element applies)
    sinh → no consume; child ailment (SINH_CYCLE[parent]===child side)
           gains +potency/+duration for remaining life
    a consumed newcomer ends its remaining pairs
  ```
  Provenance-agnostic incumbents (spec R4): pair forms on coexisting elements regardless of applier. Player-exclusive: keep the existing caller gate (reactions only evaluated for player-sourced applications — verify where TurnBattleSystem calls this and preserve/enforce the gate).
- `KHAC_CHE_COEFF` constant exported from the reaction module (first-pass 1.0).

- [ ] **Step 1: failing tests** — khac pair consumes both + burst element = overcomer (Kim cast into Hoa target bursts as Hoa — spec R5 example); sinh pair doesn't consume; 3-ailment target resolves in ELEMENT_ORDER with dead-pair skip; enemy-sourced ailments pair as incumbents but enemies never originate (existing gate test).
- [ ] **Step 2:** FAIL. **Step 3:** rewrite. **Step 4:** PASS + migrate affected old tests (they assert authored-pair semantics — repoint to rule semantics or delete where the content died). **Step 5:** type-check. Commit.

---

### Task 12: Detonate + nuke resolution

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` + `TurnBattleSystem.ts` (hit resolution)
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts` + `game/src/data/skill/PhapTuChainSkills.ts` (author empowered forms)
- Test: `game/src/core/battle/turn/TurnBattleSystem.detonate.test.ts` (new)

**Interfaces:**
- Produces on `TurnSkillDefinition`:
  ```ts
  detonateDoT?: { amp: number }   // consumes each target ailment whose
      // BuffDefinition has a `dot` effect: deals remaining tick damage
      // (per-tick × remainingTurns × stacks) × amp, then re-seeds a FIXED
      // 1 stack at AUTHORED duration — reaction-silent, never fires
      // TurnReactionManager (spec O2/R2)
  theScaling?: { coeff: number }  // final damage × (1 + theBurned/100 × coeff);
      // theBurned captured pre-consume from consumesAllThe
  ```
- Detonate constraints (spec §4): utility ailments (no `dot` effect) are never consumed; ALWAYS resolves direct component + normal ailment application first — a clean target means consume+re-seed is 0, cast never wasted; mono-element ceiling noted.
- Authoring: god-ult skills (`PHAP_TU_ULTIMATE_IDS` — `tat_phuong_giang_the`, `kim_phat_thu_sat`, … — DISTINCT ids from chain-E ults) get `dot`/`no` variants selected at battle build (Task 9's route-picked empowerment). Strip realtime-only fields (`grantsZone`, `swordZone*`, `hitCount`, `remove_buff`…) — converter must stop reporting them; keep what the turn engine executes.
- Constants `DETONATE_AMP`, `NUKE_THE_COEFF` imported from `PhapTuRoutes`.

- [ ] **Step 1: failing tests** — detonate consumes all dot ailments (utility left), re-seeds fixed-1 at authored duration, no reaction fires; clean target still deals direct+application; nuke scales with theBurned including excess above 100.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 13: Kill list execution + consumer migration

**Files:**
- Delete: `game/src/core/element/ElementLoadout.ts` (+test), `AdjacencySystem` stub file, `game/src/data/skill/TurnReactionPathSkills.ts`, `ChainStateSystem`/`TheResourceSystem` files (locate under `core/` — `grep -l ChainStateSystem`)
- Modify: `game/src/core/skill/SkillRuntimeStats.ts` (remove The/legacy fields — `hoaTheGainPerCast`, `kimThe*`, `huyetPha*`, `thoThe*`, `thuyThe*`, `poisonRoot*`, `earthAoe*`, `skillImpactPercent`)
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts` (`UNSUPPORTED_*_FIELDS` lists shrink accordingly)
- Modify: `game/src/core/game/GameManager.ts` — remove `reaction_path_unlock_*` branch in `resolvePlayerSpecialUltimate`; `getPhapTuThuanElement()` → read `player.phapTu.element` (repoint in GameManagerProgressionOps); `authoredBasicSkillId` phap_tu branch → `player.phapTu.element` (an → `van_phap_tuy_tam` handled by Task 10 path)
- Modify: `game/src/data/buff/BossBuffs.ts` (`reaction_empowerment` reference — replace with a boss-owned buff or remove), `game/src/data/companion/Companions.ts` (comment), `TurnSkillDisplayMeta.ts` (dead ids)
- Modify: `game/src/core/player/CultivationPathKit.ts` — phap_tu kit static modifiers to post-stat names (`maxMp`, `manaShieldPercent`, `manaRegenPerTurn`; drop `manaRegenPerSecond`)
- Test: `game/src/core/game/GameManager.deadIds.test.ts` (new — INV-12)

**Interfaces:**
- Dead-id invariant test: assert no retired id (`phap_tu_reaction_special`, `phap_tu_reaction_ultimate`, `reaction_empowerment`, `reaction_path_unlock_*`, `lap_dao_thuan_*`, `thuan_*` node ids, ElementLoadout symbols) appears in: `SKILLS`/`CORE_SKILLS` registries, buff registries, node registry, default loadouts, `TurnSkillDisplayMeta`, or any `data/**` content a fresh save loads.

- [ ] **Step 1: failing test** — dead-id sweep fails while references exist.
- [ ] **Step 2:** FAIL expected. **Step 3:** delete + migrate every reference the test lists. **Step 4:** PASS + run `src/core/game` scope — several old tests (reactionPath, phapTuChain, dao) will need repointing/removal. **Step 5:** type-check. Commit.

---

### Task 14: Save version reject

**Files:**
- Modify: `game/src/services/save/saveVersion.ts`
- Modify: `game/src/services/save/SaveSystem.ts` (load path)
- Test: `game/src/services/save/saveVersion.test.ts`

- [ ] **Step 1: failing test** — a save payload stamped with the pre-rework version is rejected with a clear error (no partial load); current version loads.
- [ ] **Step 2:** FAIL. **Step 3:** bump `SAVE_VERSION` + reject guard on the load path (fail-safe: error surfaces to UI, state untouched). **Step 4:** PASS + save scope. **Step 5:** type-check. Commit.

---

### Task 15: Presentation wiring

**Files:**
- Modify: `game/src/components/panels/skill-path/` (route pick at element-root purchase — blocking choice, no dismiss; route toggle + refund preview "regain X / lose Y")
- Modify: `game/src/components/panels/QuanKhiPanel.vue` + path-choice surface — the sealed `phap_tu_an` path card renders via `getOfferableCultivationPaths` (appears only when eligible; names the kit; permanent warning; no node-tree entry point)
- Modify: `game/src/components/game/combat/` (The bar — threshold marker at 100 vs raised `maxThe` cap; phap-tuong state indicator; An HUD: `ngo_dao_hon_don` emblem, no dead ult button, tooltip explains basic-slot-only multicast)
- Modify: Pham Nhan surface — `linh_bao`/`huy_quyen` Lv progress (cast-count → Lv3) wherever `tram`'s progress shows
- i18n keys via `useI18n()` (P16)

**Interfaces:**
- Consumes: `player.phapTu`, `resolveRouteProfile`, `nodeLevels`, `skillCastCounts`. Presentation reads only — all state already authoritative in core.

- [ ] **Step 1:** implement components + i18n keys. (UI tasks don't fit unit-test TDD — cover logic with store-level tests where a selector computes refund preview.)
- [ ] **Step 2:** `npm run type-check` + component tests.
- [ ] **Step 3:** P14 visual check — `npm run dev`, verify The bar/cap, route flow, hidden node reveal (defer to main checkout if worktree browser is unreliable — note it).
- [ ] **Step 4:** Commit.

---

### Task 16: Verification sweep

- [ ] **Step 1:** `npm run type-check` + `npm run build` + `npx vitest run` (FULL mode — major architecture).
- [ ] **Step 2:** `tutienidle-adversarial-qa` quick pass over the diff (peak-payload case: An multicast×reaction storm; detonate re-seed; A→B→A respec tax; `phap_tu_an` ritual gate — 9999 vs 10000 casts, post-ritual casts, save/load of `cultivationPath === 'phap_tu_an'`).
- [ ] **Step 3:** `code-review` on the aggregate diff (P5).
- [ ] **Step 4:** Report: changed files, test evidence, remaining limitations (balance numbers first-pass, Thuy defensive lever deferred to balance pass, P14 visual state).

---

## Self-review notes (checked against spec)

- P1–P16 coverage: mutex(6), routes(3-4), The(8-9,12), An path offer(2,7,10), reactions(5,11), mortal skills(2), migration(14), kill list(13), UI(15).
- INV-1..12 each maps to a task's tests (1→T6, 2→T3, 3→T4, 4→T8/9, 5→T6/7, 6/7→T10, 8→T11, 9→T2, 10→kept+T13, 11→T3, 12→T13).
- Spec-vs-code correction discovered during planning: `WuxingRelations` did not exist — created as Task 5 (spec §6 referenced it as "already implemented"; the truth was `ELEMENT_REACTIONS.relation` metadata).
- `bat_kiem_thuat` (Kiem An) shares `currentThe` — preserved via `theGainOnHit` field values, not constants.
