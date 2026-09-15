# Phap Tu Reimagined Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Phap Tu path per the reimagined spec — one element mutex + switchable route (dot/no), a single The pool burned by a two-form ultimate, and the hidden Phap Tu An path unlocked by mortal-skill mastery — while retiring the realtime-era chain/per-element-The/authored-reaction machinery.

**Architecture:** All persistent Phap Tu path-choice state lives on `PlayerData.phapTu` (one authority); combat-runtime state (`currentThe`, `maxThe`, multicast depth…) lives only on battle entities/actions; route behavior lives in one module `PhapTuRoutes`; the turn engine executes only declarative turn-skill fields (`empowerment`, `compositePicks`, `repeatCasts`, `multicast`, `theGain*`, `detonateDoT`, `theScaling`); reactions become 2 sinh/khac rule classes on a new `WuxingRelations` primitive. Presentation consumes resolved state — never computes it.

**Tech Stack:** Vue 3 + TypeScript + Vite + Vitest + Pinia. Headless core (no Vue/Phaser imports in `src/core`).

**Spec:** `game/docs/superpowers/specs/2026-09-14-phap-tu-reimagined-design.md` (P1–P16, INV-1..12). Read it before each task — the plan argues from the spec.

**Base:** Worktree `.agent-worktrees/phap-tu-reimagined` branched from the LATEST `origin/master` at execution start (P12). Do NOT branch from `stat-system-reimagined` — it is already merged, and master carries post-merge stat/combat correctness fixes this design requires (domain gating, `activeDomains`, `CULTIVATION_PATH_STAT_DOMAINS`, actual-amount damage events). Create via `using-git-worktrees` at execution start.

## Global Constraints

- Comments English ASCII only (P15). Vietnamese only in i18n strings/data (P16).
- No `any` (P8). Generic systems get declarative fields, never `if skillId === '…'` (A8).
- One rule, one owner (A2): route semantics only in `PhapTuRoutes`; The gains only via turn-skill `theGain*` fields; reactions only in `TurnReactionManager`.
- No save migration (P16): bump save version, reject old saves with clear error — no partial load.
- `currentThe` is BATTLE-RUNTIME ONLY: owned by `CombatEntity`, initialized to 0 at battle construction, never written to `PlayerData`, never persisted, never carried between battles. `phap_tu_an` never gains it — absence/`?? 0` is inert.
- Constants (all owned by `PhapTuRoutes` unless noted): `THE_ULT_THRESHOLD = 100`, `PHAP_TU_THE_GAIN_BASIC = 5`, `PHAP_TU_THE_GAIN_SPECIAL = 15`, `PHAP_TU_THE_GAIN_CRIT = 3`, `DETONATE_AMP` (first-pass 1.5), `NUKE_THE_COEFF` (first-pass 1.0), `MAX_MULTICAST = 3`, `AN_MULTICAST_CHANCE = 0.25`, `AN_SPECIAL_FIRES = 3`, `KHAC_CHE_COEFF` (first-pass 1.0, lives in the reaction module), `ROUTE_RESPEC_REFUND = 0.75`.
- Verify per task: `npm run type-check` + `npx vitest run <scope>` (quick mode, P3). Full mode at Task 17.
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

- [ ] **Step 1: failing test** — `createPhapTuState()` returns `{ element: null, route: null }`; `createDefaultPlayer().phapTu` deep-equals it.

```ts
import { describe, expect, it } from 'vitest'
import { createPhapTuState } from './PhapTuState'
import { createDefaultPlayer } from '../player/Player'

describe('PhapTuState', () => {
  it('defaults: no element, null route', () => {
    expect(createPhapTuState()).toEqual({ element: null, route: null })
  })
  it('player factory carries phapTu state', () => {
    expect(createDefaultPlayer().phapTu).toEqual(createPhapTuState())
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
  export function getCastLeveledSkillLevel(skillId: string, totalExperience: number): number | undefined
  // returns undefined for skills not in the table; recordCast uses it.
  // NO separate MORTAL_SKILL_L3_CASTS constant — Lv3 eligibility reads
  // CAST_LEVELING_THRESHOLDS.<skill>.lv3 directly (one number source;
  // HUY_KIEM_L3_CASTS re-aliases to CAST_LEVELING_THRESHOLDS.tram.lv3).
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
- Rename HERE (not Task 14): `CHAIN_SKILL_IDS` → `PHAP_TU_KIT_IDS` + migrate all consumers — the chain concept is already dead from this task on and no new code may be authored on the legacy name; Task 14 only sweeps for leftovers
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
           statModifiers: [  // full StatModifier shape — flat absolutes, domain-tagged
             { id: 'phap_tu_route_dot_potency', sourceId: 'phap_tu', sourceType: 'realm',
               stat: 'ailmentPotencyPercent', flat: 0.30, domain: 'phap_tu' },
             { id: 'phap_tu_route_dot_duration', sourceId: 'phap_tu', sourceType: 'realm',
               stat: 'ailmentDurationPercent', flat: 0.20, domain: 'phap_tu' },
           ],
           empoweredUlt: 'detonate' },
    no:  { directMultiplier: 1.15, ailmentChanceFactor: 0.50, ailmentStackBonus: 0,
           statModifiers: [
             { id: 'phap_tu_route_no_critrate', sourceId: 'phap_tu', sourceType: 'realm',
               stat: 'criticalRate', flat: 0.08, domain: 'phap_tu' },
             { id: 'phap_tu_route_no_critdmg', sourceId: 'phap_tu', sourceType: 'realm',
               stat: 'criticalDamage', flat: 0.25, domain: 'phap_tu' },
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
  // in SkillEffectSystem — no second clamp here). EffectiveSkill surface
  // ONLY — no stack writes here.
  export function applyRouteToTurnSkill(turnSkill: TurnSkillDefinition, profile: RouteProfile): TurnSkillDefinition
  // post-conversion seam: adds ailmentStackBonus to appliesAilments stacks
  // (TurnSkillAilmentApplication only exists on the built definition).
  ```
  `SkillSystem` gains `setRouteProfileProvider(fn: (skillId: string) => RouteProfile)` — the provider signature carries `skillId` so the GameManager-side closure does ALL scoping (SkillSystem keeps no PlayerData dependency — dependency direction stays clean):

  ```ts
  // GameManager wiring (closure does the kit-scope check):
  skillSystem.setRouteProfileProvider((skillId) => {
    const player = activePlayer
    if (player?.cultivationPath !== 'phap_tu') return NEUTRAL_PROFILE
    const element = player.phapTu.element
    if (!element) return NEUTRAL_PROFILE
    if (!PHAP_TU_KIT_IDS[element].includes(skillId)) return NEUTRAL_PROFILE
    return resolveRouteProfile(player.phapTu)
  })
  // getEffectiveSkill ends with:
  //   applyRouteToEffectiveSkill(result, this.routeProfileProvider?.(skill.id) ?? NEUTRAL_PROFILE)
  ```

  `tram`/`linh_bao`/`huy_quyen`, passives, talents, and any non-kit skill must never see route factors — a route is the Phap Tu KIT's stance, not a character stance.

  **Two seams, not one** (ailmentStackBonus has no home on `EffectiveSkill` — `TurnSkillAilmentApplication` only exists after conversion):
  - `applyRouteToEffectiveSkill(effective, profile)` — EffectiveSkill surface only: `directMultiplier` on damage effects, `ailmentChanceFactor` on ailment chances. Never fake `+1 stack` by injecting an `add_stack` effect — that would mix route behavior into authored skill-effect semantics.
  - `applyRouteToTurnSkill(turnSkill, profile)` — post-conversion seam on the built `TurnSkillDefinition`: adds `ailmentStackBonus` onto `appliesAilments` entries (+ future turn-runtime fields). The converter itself STAYS GENERIC — `toTurnSkillDefinition(skill, effective)` gains no `RouteProfile` param and `SkillToTurnSkillConverter.ts` is not modified. The orchestration call site applies it:

    ```ts
    const effective = skillSystem.getEffectiveSkill(skill.id)   // effective-surface route applied inside
    const turnSkill = toTurnSkillDefinition(skill, effective)   // pure generic mapping
    return applyRouteToTurnSkill(turnSkill, routeProfileProvider?.(skill.id) ?? NEUTRAL_PROFILE)
    ```

    Pipeline ownership stays clean: SkillSystem never sees PlayerData, converter never sees Phap Tu, `PhapTuRoutes` owns all route semantics, GameManager only orchestrates.
  Route `statModifiers` enter the character modifier pipeline via a new `getRouteStatModifiers(player)` exported here — injected NEXT TO the existing `getCultivationPathStatModifiers(player)` call in BOTH lists inside `GameManagerPersistentEffectOps.ts`: `getAggregatedModifiers()` (~line 89, menu/persistent) AND `getBattleBaseModifiers()` (~line 116, battle base). Route mods belong to the STATIC partition (route can't change mid-battle — never `getLiveBattleModifiers`). Adding to only one list makes UI stats and combat stats diverge.
  **Post-stat-rework `StatModifier` contract (verified against stat-system-reimagined):** every route modifier is a full `StatModifier` — required `id`/`sourceId`/`sourceType`/`stat`; use `sourceType: 'realm'`, `sourceId: 'phap_tu'` (same convention as `CULTIVATION_PATH_KITS` grants — `ModifierSourceType` has no 'route' value and none is added) and always set `domain: 'phap_tu'` so the D10 gate keeps accepting them if a target stat is ever gated. Stat lines use `flat` absolute values: spec "+30% ailmentPotencyPercent" means +0.30 flat — `percent` on a zero-base stat (`ailmentPotencyPercent`, `ailmentDurationPercent`) is a no-op when no other flat source exists.

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

- [ ] **Step 2:** FAIL. **Step 3:** implement module + provider + kit-scoped gate + BOTH aggregator calls. **Step 4:** PASS + run `src/core/skill` scope (existing getEffectiveSkill tests must stay green — no provider = neutral) + a scoping test: `linh_bao` and a passive skill's effective values are identical under `dot` vs `no` + **domain-gate tests: route modifiers pass the StatDomain gate in BOTH `getAggregatedModifiers()` (menu/persistent) and `getBattleBaseModifiers()` (battle base), and NO route modifier appears in `getLiveBattleModifiers()`** (route is static during battle — a live-partition leak would double-apply). **Step 5:** type-check. Commit.

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
  `canPurchaseNode`/`canUpgradeNode` add `isNodeRouteActive` check. Both aggregators skip inactive-route nodes. `GameManagerProgressionOps.switchRoute(route, player)` rejects while a turn battle is active — the class currently has NO `getTurnBattle` dep (constructor is registry + skill templates/system/manager + `getActivePlayer`): add it to the constructor and wire it in GameManager — don't leave Astra to invent a combat flag. No explicit The-clear step is needed: The is battle-scoped (INV-14) and switching is out-of-combat, so banked The cannot exist at switch time (INV-16 holds by construction — pinned in spec so no future persistence change resurrects the exploit).

- [ ] **Step 1: failing test** — new file with: routeTag node unpurchasable when route mismatches; switch refunds floor(paid×0.75) and zeroes levels; switch rejected while a turn battle is active; A→B→A pays the tax twice; untagged nodes untouched.

```ts
it('switchRoute refunds 75% of actual paid and clears route-tagged levels', () => {
  const player = createDefaultPlayer()
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
  `BuffDefinition` gains `element?: ElementType`. Author it on: `bong`→fire, `trung_doc`→wood, `chay_mau`→metal, `te_cong`→water, `hoai_tu`/`thach_hoa`/`troi_chan`→earth, `dung_nham`→fire, `huyet_doc`→metal, `cau_mang_can`→**wood** (verified: it's the debuff applied by `cau_mang_can_tri`, the wood special — Skills.ts:27 `wood: [doc_chuong, cau_mang_can_tri, doc_vien_bao_can]`; "bản dài của troi_chan" describes duration, not element), plus any `phap_tu` ailment in `ThuanHeBuffs.ts`. Non-elemental buffs get no field.

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

### Task 6: New node tree — mutex roots, growth, route-tagged, unlocks

**Files:**
- Rewrite: `game/src/data/progression/PhapTuNodes.builders.ts`
- Rewrite: `game/src/data/progression/PhapTuNodes.ts`
- Modify: `game/src/core/progression/NodeSystem.ts` — `canPurchaseNode` mutex + routeTag gating only (no `visibleWhen` machinery — the hidden path is a path, not a node)
- Modify: `game/src/core/game/GameManagerRealmAdvanceOps.ts` — **REMOVE the legacy auto-Fire starter**: delete `PHAP_TU_STARTER_NODE_ID`/`PHAP_TU_STARTER_SKILL_ID` constants and the `else` branch that purchases `hoa_linh_ngo` + equips `hoa_cau_thuat` on path choice. Choosing `phap_tu` must leave `phapTu.element === null && phapTu.route === null` until `selectPhapTuElement` commits — otherwise the ritual silently grants Fire while the player later picks e.g. Moc, leaving a purchased fire root + learned fire skill next to `element='wood'` and breaking mono-element.
- Test: `game/src/data/progression/PhapTuNodes.reimagined.test.ts` (new)

**Interfaces:**
- Consumes: Task 1 node fields, Task 4 routeTag gating.
- Produces tree per spec §7:
  - 5 element roots — KEEP the existing ids `hoa_linh_ngo` / `moc_linh_ngo` / `thuy_linh_ngo` / `kim_linh_ngo` / `tho_linh_ngo` (same semantics, no gratuitous id churn — "no migration" is not a license for pointless renames). Each gains pairwise `excludesNode` + `elementTag` + `unlocksSkillIds: [basicId]` (P1 mutex). **NO `unlocksElement`** — that effect feeds `player.unlockedElements`, a second authority; `phapTu.element` is the ONLY element source (INV-21 — `unlockedElements`/`equippedElements`/`unlocksElement`/`kind:'element'`/`canEquipElement`/`equipElement` all retire in Task 14 after the Task 6B consumer migration — `equippedElements` currently feeds ArtifactSystem's Ngu Hanh rotation).
  - **Atomic pick, no bypass:** new `GameManagerProgressionOps.selectPhapTuElement(player, element, route)` — ONE transaction: validates the root is purchasable + route ∈ {dot,no}, purchases the root, sets `element` and `route` together (INV-13 — `element!=null → route!=null` can never exist via API; the UI's blocking modal is only an input collector). It is the SOLE writer of `player.phapTu.element`. AND the bypass must be closed — at the ORCHESTRATION layer, not the primitive: `GameManagerProgressionOps.purchaseNode()` (the public API) rejects the 5 element roots (`isPhapTuElementRoot(nodeId)` → false). `NodeSystem.purchaseNode()` stays a generic primitive — `selectPhapTuElement` calls it internally AFTER its atomic-choice validation (route/element/path/canPurchase/mutex), then runs the unlock effects and commits `player.phapTu = {element, route}`. Privileged orchestration, not a special flag inside the domain system. Without this the "sole writer" claim is convention, not contract.
  - **Tu The lane — pinned (no open "pick"):** do NOT add `theGainOnLandedCast` to `SkillResourceStatKey` (those keys feed the GLOBAL `SkillRuntimeStats` bag — `getSkillRuntimeStats` flattens `aggregateNodeSkillModifiers`' `{skillId, statModifiers}` and drops the skillId). Create a separate lane:
    ```ts
    interface TurnSkillResourceModifier { skillId: string; theGainOnLandedCast?: number; theGainOnCrit?: number }
    aggregateTurnSkillResourceModifiers(registry, player): Map<string, TurnSkillResourceModifier>
    // at TurnSkillDefinition build: turnSkill.theGainOnLandedCast = base + (mods.get(skill.id)?.theGainOnLandedCast ?? 0)
    ```
    Tu The Hoa buffs `hoa_cau_thuat`/`hoa special` only — cannot leak to Moc, Kiem, or mortal skills.
  - Per-element branch (`elementTag` on every node): power growth ~10lv, ailment-leaning + damage-leaning growth, `buildUnlockNode('special'|'godUlt', element)` (new generic builder — `unlocksSkillIds` for special; god-ult node is the empowerment GATE, no skill grant needed beyond marking ownership), The nodes `tu_the_<el>` (emit `TurnSkillResourceModifier`s on the element's basic/special via the lane defined above), `truong_the_<el>` (raises cap — `routeTag: 'no'` — cap-growth is `no`-route payoff per spec §7; `maxThe` is a separate player/battle resource-cap lane with its own owner, not a per-skill field).
  - Route-tagged, EXACT counts per element: exactly 3 `dot` specialization nodes + exactly 3 `no` specialization nodes + `truong_the_<el>` which is ALSO tagged `routeTag:'no'` — total nodes with `routeTag:'no'` per element = **4** (3 specialization + truong_the), total `routeTag:'dot'` = 3. 5 lv each.
  - `phap_tu_an` has NO node here — it is a separate CultivationPathId (Task 7); this tree is hien-only.
- Deletes: `buildThuanBranch`, `THUAN_VARIANTS`, `keystoneReaction`/`keystonePure`, `lap_dao_thuan_*`, B/D-position chain unlock nodes, `reaction_path_unlock_*`, Thế Mãn nodes. `lap_dao_thuan_<el>` ids are RETIRED — `getPhapTuThuanElement` migrates to `player.phapTu.element` in Task 6B below (the tree task removes the nodes; 6B moves the readers).
- **Task 6B — migrate Phap Tu element consumers NOW, not at kill-list time:** before combat tasks (8-13) run, every Phap Tu reader of the legacy element state must read `player.phapTu.element`. Audit + migrate: ArtifactSystem's Ngu Hanh rotation (`equippedElements` → derive `[player.phapTu.element]` for a phap_tu holder; decide per-consumer whether non-phap_tu paths still need the field), `getPhapTuThuanElement` call-sites, `authoredBasicSkillId` phap_tu branch, `canEquipElement`/`equipElement` callers. Rationale: leaving both authorities alive through Tasks 7-13 creates an unsafe coexistence window — Task 14 becomes residual deletion, not first migration.

- [ ] **Step 1: failing tests** — mutex (buy fire root → `canPurchaseNode(wood root)` false), `selectPhapTuElement` commits element+route atomically (INV-13: no `element!=null && route==null` reachable), **`purchaseNode('hoa_linh_ngo', player)` returns false while `selectPhapTuElement(player,'fire','dot')` returns true and yields `{element:'fire', route:'dot'}`** (bypass closed), `chooseCultivationPath('phap_tu')` leaves element AND route null with no auto-purchased root/auto-equipped skill, every prerequisite `node`/`excludesNode` target exists (reuse the dao.test.ts:258 integrity pattern), **no shared node lists a route-tagged prerequisite** (INV-19 topology test), route-tagged node count per element branch = exactly 3 `dot` + exactly 4 `no`-tagged (3 specialization + `truong_the_<el>`).
- [ ] **Step 2:** FAIL. **Step 3:** rewrite builders + data. **Step 4:** PASS; expect `PhapTuNodes.dao.test.ts`/`*.vanDao` etc. to break — UPDATE or delete the tests asserting removed content (they test the old tree; keep the integrity-checker ones, repoint). **Step 5:** type-check. Commit.

---

### Task 7: `phap_tu_an` as a first-class path (ritual offer)

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` — `CultivationPathId` union gains `'phap_tu_an'`; `CULTIVATION_PATH_KITS['phap_tu_an']` entry (name, own technique `ngo_dao_chan_quyet`, kit `statModifiers` — MP-shield line mirroring phap_tu's + `attunement` base; **every modifier carries `domain: 'phap_tu'`** — `maxMp`/`manaShieldPercent`/`manaRegenPerTurn` are all gated to that domain, the D10 gate throws in dev/test without it; `skillIds` UNUSED — the kit is granted in a bespoke branch like kiem_tu's, since the ult slot is a passive)
- Modify: `game/src/core/stats/StatDomain.ts` — `CULTIVATION_PATH_STAT_DOMAINS['phap_tu_an'] = ['phap_tu']` (the map's own comment reserves this row; without it a phap_tu_an participant gets `activeDomains: undefined` and the attunement→MP domain deltaDeriver never runs for them mid-battle)
- Create: `game/src/data/technique/` entry `ngo_dao_chan_quyet` — minimal technique for the an path; carries `innateSkillId: 'ngo_dao_hon_don'` so the existing `equipTechnique` machinery auto-learns + `equipWithoutSlot`s the dao passive (zero new wiring)
- Modify: `game/src/core/player/CultivationPathSystem.ts` — new `getOfferableCultivationPaths(player): CultivationPathId[]` — enforces the FULL ritual state itself (`!player.cultivationPath && realmId === 'mortal' && realmLevel >= CORE_REALM_LEVEL` — same conditions `chooseCultivationPath` guards, so display and authority can never disagree), then base paths + `'phap_tu_an'` iff `(player.skillCastCounts?.['linh_bao'] ?? 0) >= CAST_LEVELING_THRESHOLDS.linh_bao.lv3`.
- Modify: `game/src/core/game/GameManagerRealmAdvanceOps.ts` (`chooseCultivationPath`) — the eligibility check runs with the COMMON guards at the top, BEFORE ANY mutation: `player.cultivationPath = pathId` + technique learn/equip happen at ~line 163-166, so a check placed "before the generic kit branch" is already too late (partial mutation then return false = dirty state). Order must be:

  ```ts
  chooseCultivationPath(pathId, player) {
    // existing common ritual guards first (cultivationPath unset,
    // realmId === 'mortal', realmLevel >= CORE_REALM_LEVEL)
    if (pathId === 'phap_tu_an' && !isPhapTuAnEligible(player)) return false
    // NO MUTATION above this line
    const kit = CULTIVATION_PATH_KITS[pathId]
    player.cultivationPath = pathId
    ...
  }
  ```

  Then a `pathId === 'phap_tu_an'` grant branch (sibling of the kiem_tu branch): `van_phap_tuy_tam`→slot 0 / `da_phap_lien_tuyen`→slot 1 via `learnSkill`/`equipToSlot`; the passive arrives via the technique's `innateSkillId`.
- Create: `game/src/data/progression/PhapTuAnNodes.ts` — STUB module (empty root); An's real tree gets its own deeper spec later (user ruling)
- Modify: wherever the node-tree UI/registry maps `cultivationPath` → tree module — route `'phap_tu_an'` → `PhapTuAnNodes` (stub) instead of `PhapTuNodes`
- Modify: `game/src/core/skill/SkillSystem.ts` — `HUY_KIEM_L3_CASTS` re-aliases to `CAST_LEVELING_THRESHOLDS.tram.lv3`; the an-gate reads `CAST_LEVELING_THRESHOLDS.linh_bao.lv3` directly (no parallel constant — one threshold source)
- Test: `game/src/core/game/GameManager.phapTuAnPath.test.ts` (new)

**Interfaces:**
- Produces: `getOfferableCultivationPaths`; `CultivationPathId` extension.
- Consumes: Task 2's `linh_bao` skill + `CAST_LEVELING_THRESHOLDS`; existing `skillCastCounts` mirror; existing `innateSkillId` machinery.
- Also authors the three an-skill DATA SHELLS (`van_phap_tuy_tam`, `da_phap_lien_tuyen`, `ngo_dao_hon_don`) — ids, slots, targeting, labels — needed for the grant; their RESOLUTION semantics (composite pick / repeat / multicast) are Task 11.
- The persisted record is `player.cultivationPath === 'phap_tu_an'` itself — NO eligibility/mode field is stored (spec §5.1, P11).

- [ ] **Step 1: failing test** — `getOfferableCultivationPaths` hides `phap_tu_an` at 9999 `linh_bao` casts, shows it at 10000 (and returns empty/hides it once a path is already chosen or ritual state unmet); `chooseCultivationPath('phap_tu_an', …)` below Lv3 returns false AND leaves state **bit-for-bit unchanged** — `player.cultivationPath` still undefined, no technique learned/equipped, no skill touched (the reject happens before any mutation); succeeds at Lv3 (path set, technique equipped, passive learned-and-equipped without a slot, the two actives in slots 0/1); post-ritual `linh_bao` casts change nothing; a kiem_tu player with `linh_bao` Lv3 was never offered it.

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

Plus the stat-domain activation contract (post-stat-rework): a `phap_tu_an` battle participant's `activeDomains` CONTAINS `'phap_tu'` (via `CULTIVATION_PATH_STAT_DOMAINS`); the gated stats `maxMp`/`manaRegenPerTurn`/`manaShieldPercent`/`reactionEffectPercent` accept the kit's `domain:'phap_tu'` modifiers without a gate violation; and the attunement→MP domain deltaDeriver emits for a phap_tu_an entity mid-battle (same as phap_tu — the domain is shared, the path id is not).

- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + progression scope. **Step 5:** type-check. Commit.

---

### Task 8: The-loop rework — per-skill `theGain*` fields

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (`TurnSkillDefinition`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (lines ~1092-1099, ~1265-1274 — the slot-position LINK/FINISHER hooks)
- Modify: `game/src/core/combat/CombatTypes.ts:89-91` (constants)
- Modify: `game/src/core/combat/CombatEntity.ts` (~line 77 — add `maxThe?: number` beside `currentThe`; undefined = `MAX_THE`)
- Modify: `game/src/core/phap-tu/PhapTuRoutes.ts` (or sibling phap-tu query module — `resolveMaxThe(player)`: `MAX_THE` + active `truong_the_<element>` contribution, query-derived from `nodeLevels`, never persisted)
- Modify: `game/src/data/skill/BatKiemThuat.ts` (kiem skills keep their gains via the new fields — `THE_GAIN_PER_LINK`/`FINISHER` values move onto the skill defs, NOT deleted: bat kiem still uses this pool)
- Modify: `game/src/core/game/GameManager.ts` (attach `theGainOnLandedCast` when building phap_tu basics/specials; `theGainOnCrit` when route==='no'; apply `aggregateTurnSkillResourceModifiers` deltas per skill.id)
- Modify: `game/src/core/game/GameManagerTurnBattleOps.ts` (~line 1041 — `resetBattleScopedResources` call for each carried-over entity in `restartTurnBattleCycle`; helper lives beside `playerToCombatEntity`)
- Test: `game/src/core/battle/turn/TurnBattleSystem.theResource.test.ts` (rewrite)

**Interfaces:**
- Produces on `TurnSkillDefinition`: `theGainOnLandedCast?: number`, `theGainOnCrit?: number`. **Pinned semantics (no ambiguity left to the implementer):** `theGainOnLandedCast` grants ONCE per cast action that lands on ≥1 valid target — target count and hit count never multiply it (5-target AoE = +5, not +25). Same per-cast rule as `theGainOnCrit` (INV-15). The field name says "cast" on purpose — do not implement per-hit.
- Engine rule replaces slot constants: on a cast that lands ≥1 valid target, `actor.currentThe += action.skill.theGainOnLandedCast ?? 0` — once, clamped at `actor`'s cap (`actor.entity.maxThe ?? MAX_THE`). Crit hook: on `isCrit` of the cast's direct hit, add `theGainOnCrit` — ONCE per cast action regardless of target/hit count (INV-15 — a 5-target AoE crit is +3, not +15).
- **BREAKING LIFECYCLE CHANGE (call out deliberately):** legacy semantics let `currentThe` survive entity reuse across a farm session and reset mainly around ult behavior. NEW contract — `currentThe` is battle-instance scoped and resets to 0: on every fresh battle participant construction; on every `restartTurnBattleCycle`; for Phap Tu; for Bat Kiem and ANY other path sharing `currentThe`. No PlayerData persistence, no cross-cycle carry. An implementer must not "preserve" the old carry-over.
- **`maxThe` data path — pinned (it has no owner today):** `CombatEntity` currently has `currentThe` only and the engine hard-codes `Math.min(MAX_THE, …)`. Add `maxThe?: number` to `CombatEntity` (undefined → `MAX_THE`). Ownership chain: `player.nodeLevels` → `resolveMaxThe(player)` (query-derived: `MAX_THE` + active `truong_the_<el>` contribution — NEVER stored on PlayerData) → `entity.maxThe` snapshot at battle participant build (`phap_tu` → resolved; everyone else incl. Bat Kiem → `MAX_THE`) → engine clamps `currentThe = Math.min(actor.entity.maxThe ?? MAX_THE, …)`.
- **Battle-scoped (INV-14):** `currentThe` resets to 0 at every battle start — AND every auto-repeat cycle counts as a new battle: `restartTurnBattleCycle` (GameManagerTurnBattleOps:1041) reuses `previous.players` wholesale (same `CombatEntity` objects — "HP/resources carry over" by design), so entity-construction init does NOT cover it. Add `resetBattleScopedResources(entity)` (currentThe → 0; one home for any future battle-scoped fields) invoked at BOTH fresh `startStage`/`playerToCombatEntity` build AND `restartTurnBattleCycle` for each carried-over player entity.
- **Shared contract, not phap_tu-local:** `currentThe` is also Bat Kiem's pool — the reset applies to it identically (a Bat Kiem auto-repeat starts at 0 The too). This is a deliberate lifecycle change for a shared field; both paths get the same test.
- Constants: `PHAP_TU_THE_GAIN_*` live in `PhapTuRoutes.ts` (imported by GameManager at build time); `THE_GAIN_PER_LINK`/`FINISHER` stay in CombatTypes but are now referenced ONLY by kiem skill data.

- [ ] **Step 1: failing test** — phap_tu basic hit +5, special +15, ult +0; `no`-route crit adds +3 once per cast (multi-target crit still +3); cap clamps; `currentThe` is 0 at battle start even if a previous battle left the pool high (INV-14); **auto-repeat cycle resets it too** — after `restartTurnBattleCycle` with a carried-over entity at 80 The, the new battle's entity reads 0 (and the same holds for a Bat Kiem participant — shared lifecycle contract).

```ts
it('phap_tu basic landed cast grants PHAP_TU_THE_GAIN_BASIC once', () => {
  // build battle with a basic carrying theGainOnLandedCast: 5,
  // force a 5-target AoE landing -> still +5, not +25
  …expect(player.entity.currentThe).toBe(5)
})
it('no-route crit grants theGainOnCrit on top', () => { … })
```

- [ ] **Step 2:** FAIL. **Step 3:** implement fields + engine hook + GameManager attach + migrate bat_kiem defs to carry their old values as `theGainOnLandedCast`. **Step 4:** PASS + `theResource`/kiem scopes. **Step 5:** type-check. Commit.

---

### Task 9: Generic `TurnSkillExecution` identity — root skill vs resolved payload

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` (new type + execution plumbing)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (cast path creates the execution record; cast-count/cooldown writes go through `rootSkillId` ONLY)
- Test: `game/src/core/battle/turn/TurnSkillExecution.test.ts` (new)

**Interfaces:**
- Produces — one primitive separating "the skill that owns the cast" from "the payload being resolved":

  ```ts
  export interface TurnSkillExecution {
    rootSkillId: string                 // progression/cooldown identity
    resolvedSkill: TurnSkillDefinition  // payload actually resolving
    source: 'original' | 'empowered' | 'composite' | 'repeat' | 'multicast'
  }
  ```

- Ownership rule (INV-18 generalizes): `rootSkillId` owns cast count, cooldown, equipped-slot identity, progression identity. `resolvedSkill` owns damage payload, ailment payload, targeting, runtime combat fields.
- Why now: empowerment (Task 10), composite picks + repeat + multicast (Task 11), detonate/nuke payloads (Task 13) ALL need this distinction — landing it first prevents each of those tasks from inventing its own ad-hoc "don't count this cast" flag.
- Contract points: composite-picked elemental skills never increment their own cast counts; empowered ult payload never gains cast count (root = equipped chain-E id); repeat/multicast follow-ups carry `source` and must NOT re-consume the slot cooldown or re-roll the cast-count; multicast-sourced basic executions may roll multicast again until `MAX_MULTICAST` depth cap (spec S6); repeat-sourced executions NEVER roll multicast.

- [ ] **Step 1: failing tests** — a plain cast produces `{rootSkillId: X, resolvedSkill: X's def, source: 'original'}`; cast count + cooldown land under `rootSkillId`; a forced-`source:'repeat'` execution does not touch cooldown/cast-count.
- [ ] **Step 2:** FAIL. **Step 3:** implement the type + plumb the cast path (all current casts are `source:'original'` — no behavior change yet). **Step 4:** PASS + turn scope. **Step 5:** type-check. Commit.

---

### Task 10: Ultimate empowerment — same slot, two forms, consume-all

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
- Engine rule (INV-4): at cast, `skill.empowerment && (actor.currentThe ?? 0) >= empowerment.theThreshold` → resolve `empowerment.empowered` as the action; that skill's `consumesAllThe` zeroes the pool AFTER capture (theBurned value flows into `theScaling` — Task 13). Below threshold or no empowerment → base form, The untouched.
- Execution identity (consumes Task 9): the empowered cast is `TurnSkillExecution { rootSkillId: equipped chain-E id, resolvedSkill: god-ult payload def, source: 'empowered' }` — cast count/cooldown land on `rootSkillId`; the god-ult id must never appear in `skillCastCounts` and never gets its own cooldown (INV-18 made structural, not just tested).
- GameManager: `resolvePlayerSpecialUltimate` attaches `empowerment` ONLY when `player.nodeLevels['linh_ngo_<godUltId>'] > 0` (node-owned gate — engine stays dumb, A8) AND picks the empowered skill variant by `resolveRouteProfile().empoweredUlt` (detonate vs nuke data — Task 13 fields).

- [ ] **Step 1: failing test** — 4 branches: <100 → base, no consume; ≥100 without empowerment → base, no consume; ≥100 with empowerment → empowered id resolves + currentThe===0; ≥100 with raised cap (150) → consumes ALL 150. **Cast identity (INV-18):** the empowered cast increments `skillCastCounts` under the EQUIPPED chain-E id only — the god-ult payload id never gains a cast count; cooldown is the slot's, consumed once.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 11: An kit — generalized composite picks, repeat, multicast

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts` + `TurnBattleSystem.ts` (follow-up queue ~line 390-650)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` constructor — gains `rng: () => number` (default `Math.random`) stored once; ALL new An-kit rolls (composite pick, multicast) AND `applyAilments` (~line 1473) route through it — INV-20, tests inject a seeded/deterministic rng. NOTE: `selectRandomDistinctElementPair` lives in `TurnSkillAction.ts` (~line 263) as a free function calling `Math.random()` — it is `poolType:'reaction_path'` machinery that DIES with the kill list; do not migrate it to `this.rng` (it can't see the system anyway). If any pick helper survives, its signature becomes `(pool, rng)` — rng passed in, never a global.
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
- `van_phap_tuy_tam`: `compositePicks { poolType:'element_basic', count:1 }` — engine picks uniformly among the 5 element-basic TurnSkillDefinitions (build the pool from `PHAP_TU_KIT_IDS[*][0]` converted defs) and executes the PICKED skill as the cast (damage type/ailment from the picked def — spec S7). The execution is `TurnSkillExecution { rootSkillId: 'van_phap_tuy_tam', resolvedSkill: <picked def>, source: 'composite' }` — cast records under `van_phap_tuy_tam` only (S8 — the picked id never gains cast counts).
- `da_phap_lien_tuyen`: `compositePicks {element_basic,1}` + `repeatCasts: AN_SPECIAL_FIRES - 1` — each repeat re-rolls the pick, enqueued as `source:'repeat'` executions (root stays `da_phap_lien_tuyen`). Repeat executions are NOT basic-slot casts, never roll multicast, and never touch slot cooldown again (P15 + Task 9 contract).
- `ngo_dao_hon_don`: passive — implemented as `multicast` attached to the An BASIC turn-skill (participant snapshot): after a basic-slot or multicast-sourced execution, roll chance → enqueue multicast follow-up (`source:'multicast'`, root `van_phap_tuy_tam`) of the same basic (re-rolls its own composite pick), depth-capped `MAX_MULTICAST`. Only `original` and `multicast`-sourced basic executions roll again.
- GameManager: `cultivationPath === 'phap_tu_an'` → basic=`van_phap_tuy_tam` (with multicast attached), special=`da_phap_lien_tuyen`, ultimate slot EMPTY (dao passive — no button; it arrived via `innateSkillId` at the ritual).

- [ ] **Step 1: failing tests** — basic resolves one of the 5 element defs (assert the resolved cast's damage kind is elemental, cast count recorded under `van_phap_tuy_tam`); special fires exactly 3 executions, each an element pick, zero multicast rolls (inject `chance:1` and assert still exactly 3); multicast with `chance:1` chains to the `MAX_MULTICAST` cap; picked element ids never appear in `skillCastCounts`; all picks/rolls consume the injected `rng` — a scripted rng sequence fully determines the outcome (no `Math.random()` in the resolution path).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 12: Reaction rule engine — sinh/khac classes replace authored pairs

**Files:**
- Modify: `game/src/core/battle/turn/TurnReactionManager.ts` (rewrite `checkAndTrigger`)
- Modify: `game/src/core/element/ElementReaction.ts` (retire `ELEMENT_REACTIONS` — keep `ElementReactionDefinition` type if reused; delete the table)
- Test: `game/src/core/battle/turn/TurnReactionManager.rules.test.ts` (new); update `TurnReactionManager.test.ts` + `reactionPathE2E`/`r3Content` tests that assert old pairs

**Interfaces:**
- Consumes: `relationOf`/`khacOvercomer`/`ELEMENT_ORDER` (Task 5), `BuffDefinition.element`, `elementalBasePower` (existing), `BuffPool` instance consumption (existing ARCH-009 contract).
- New `checkAndTrigger` semantics per spec §6:
  ```ts
  // called after a successful ailment application (newcomer)
  // TWO PHASES (INV-17): all sinh pairs first (ELEMENT_ORDER), then
  // all khac pairs (ELEMENT_ORDER) — generation before destruction
  for (const incumbent of sinhPairsFirst):  // phase 1
    // SINH beneficiary pinned by wuxing direction, NOT arrival order:
    // for pair (A,B) where SINH_CYCLE[A] === B, B is ALWAYS the child —
    // A incumbent + B newcomer buffs B; B incumbent + A newcomer buffs B.
    // child ailment gains +potency/+duration for remaining life
  for (const incumbent of khacPairsSecond): // phase 2
    consume BOTH instances; burst =
      (stacks(newcomer) + stacks(incumbent))   // consumedStacks pinned
      × elementalBasePower(source, khacOvercomer) × KHAC_CHE_COEFF
      × (1 + reactionEffectPercent); damage element = overcomer
      (target's resistance to that element applies)
    a consumed newcomer ends its remaining pairs
  ```
  Provenance-agnostic incumbents, initiate-vs-participate (spec §6): a pair forms on coexisting elements regardless of applier. **The player-origin gate does NOT exist today** — `applySkillAilments` (~TurnBattleSystem:1491) calls `checkAndTrigger` for player AND enemy sources alike; this task ADDS it: only an application whose source entity is the player may initiate `checkAndTrigger`. Enemy-origin ailments participate as incumbents but never initiate.
- `KHAC_CHE_COEFF` constant exported from the reaction module (first-pass 1.0).

- [ ] **Step 1: failing tests** — khac pair consumes both + burst element = overcomer (Kim cast into Hoa target bursts as Hoa — spec R5 example) + `consumedStacks = stacks(newcomer)+stacks(incumbent)`; sinh pair doesn't consume and grants potency+duration only (no zone/self-buff — v1 locked); **Sinh direction test BOTH orders: for SINH_CYCLE[A]===B, A-incumbent+B-newcomer buffs B AND B-incumbent+A-newcomer buffs B — the beneficiary never depends on application order**; 3-ailment target resolves sinh-phase-then-khac-phase each in ELEMENT_ORDER with dead-pair skip; two-direction gate test: enemy Fire application → NO reaction; enemy Fire incumbent + player Metal application → reaction resolves.
- [ ] **Step 2:** FAIL. **Step 3:** rewrite. **Step 4:** PASS + migrate affected old tests (they assert authored-pair semantics — repoint to rule semantics or delete where the content died). **Step 5:** type-check. Commit.

---

### Task 13: Detonate + nuke resolution

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
      // TurnReactionManager (spec O2/R2); potency RECOMPUTED vs the
      // caster's current stats at re-seed (never the consumed stack's
      // stale snapshot — spec §4)
  theScaling?: { coeff: number }  // final damage × (1 + theBurned/100 × coeff);
      // theBurned captured pre-consume from consumesAllThe
  ```
- Detonate constraints (spec §4): utility ailments (no `dot` effect) are never consumed; ALWAYS resolves direct component + normal ailment application first — a clean target means consume+re-seed is 0, cast never wasted; mono-element ceiling noted.
- Authoring: god-ult skills (`PHAP_TU_ULTIMATE_IDS` — `tat_phuong_giang_the`, `kim_phat_thu_sat`, … — DISTINCT ids from chain-E ults) get `dot`/`no` variants selected at battle build (Task 10's route-picked empowerment). Strip realtime-only fields (`grantsZone`, `swordZone*`, `hitCount`, `remove_buff`…) — converter must stop reporting them; keep what the turn engine executes.
- Constants `DETONATE_AMP`, `NUKE_THE_COEFF` imported from `PhapTuRoutes`.

- [ ] **Step 1: failing tests** — detonate consumes all dot ailments (utility left), re-seeds fixed-1 at authored duration with potency recomputed from current stats, no reaction fires; clean target still deals direct+application; nuke scales with theBurned including excess above 100.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS. **Step 5:** type-check. Commit.

---

### Task 14: Kill list execution — residual deletion + dead-reference sweep ONLY

**Contract:** by the time this task runs, every live consumer already reads the new authorities (element consumers migrated in Task 6B, call-site swaps in earlier tasks). This task deletes symbols and sweeps leftovers — it must NOT be the first place a major consumer gets migrated. If a real consumer still reads a legacy field here, that's a task-ordering bug: stop, migrate it in the owning domain's terms, then delete.

**Files:**
- Delete: `game/src/core/element/ElementLoadout.ts` (+test), `AdjacencySystem` stub file, `game/src/data/skill/TurnReactionPathSkills.ts`, `ChainStateSystem`/`TheResourceSystem` files (locate under `core/` — `grep -l ChainStateSystem`)
- Modify: `game/src/core/skill/SkillRuntimeStats.ts` (remove The/legacy fields — `hoaTheGainPerCast`, `kimThe*`, `huyetPha*`, `thoThe*`, `thuyThe*`, `poisonRoot*`, `earthAoe*`, `skillImpactPercent`)
- Modify: `game/src/core/game/SkillToTurnSkillConverter.ts` (`UNSUPPORTED_*_FIELDS` lists shrink accordingly)
- Modify: `game/src/core/game/GameManager.ts` — remove `reaction_path_unlock_*` branch in `resolvePlayerSpecialUltimate`; `getPhapTuThuanElement()` → read `player.phapTu.element` (repoint in GameManagerProgressionOps); `authoredBasicSkillId` phap_tu branch → `player.phapTu.element` (an → `van_phap_tuy_tam` handled by Task 11 path; these two call-site migrations should already be DONE in Task 6B — here they are verify-only)
- Modify: `game/src/data/buff/BossBuffs.ts` (`reaction_empowerment` reference — replace with a boss-owned buff or remove), `game/src/data/companion/Companions.ts` (comment), `TurnSkillDisplayMeta.ts` (dead ids)
- Retire the OLD element authority (INV-21) — consumers already migrated in Task 6B (ArtifactSystem Ngu Hanh rotation derives `[player.phapTu.element]`, `getPhapTuThuanElement`/`authoredBasicSkillId` repointed); this task DELETES what is now unreferenced: `PlayerData.unlockedElements`, `PlayerData.equippedElements`, `core/element/ElementLoadout.ts`, `NodeEffect.unlocksElement`, `NodePrerequisite kind:'element'` (NodeSystem:50 check + purchaseNode:163 push), `canEquipElement`/`equipElement`/`GameManager.equipElement`. If a live reader still exists here, stop and migrate first — do not delete under a live consumer.
- Modify: `game/src/core/player/CultivationPathKit.ts` — phap_tu kit static modifiers to post-stat names (`maxMp`, `manaShieldPercent`, `manaRegenPerTurn`; drop `manaRegenPerSecond`)
- Verify: `CHAIN_SKILL_IDS` has zero remaining references (rename happened in Task 3 — this is a leftover sweep, not the rename)
- Modify: `game/src/core/stats/StatDomain.ts` — sweep `DOMAIN_SOURCE_WHITELIST.phap_tu` entries whose target files die in this task: `data/skill/TurnReactionPathSkills.ts` (deleted), the `data/buff/BossBuffs.ts` `reactionEffectPercent` row (reaction_empowerment dies), `ThuanHeBuffs.ts`/`LegacyBuffs.ts` `manaRegenPerTurn` rows (chain regen buffs retire with the chain model — remove the entries if the files/grants die). `statDomainWhitelist.test.ts` fails on whitelist rows pointing at files/grants that no longer exist. New node files must keep matching the `data/progression/PhapTu*` glob — stay under `PhapTu*` naming.
- Test: `game/src/core/game/GameManager.deadIds.test.ts` (new — INV-12)

**Interfaces:**
- Dead-id invariant test: assert no retired id (`phap_tu_reaction_special`, `phap_tu_reaction_ultimate`, `reaction_empowerment`, `reaction_path_unlock_*`, `lap_dao_thuan_*`, `thuan_*` node ids, ElementLoadout symbols) appears in: `SKILLS`/`CORE_SKILLS` registries, buff registries, node registry, default loadouts, `TurnSkillDisplayMeta`, or any `data/**` content a fresh save loads.

- [ ] **Step 1: failing test** — dead-id sweep fails while references exist.
- [ ] **Step 2:** FAIL expected. **Step 3:** delete every confirmed-dead symbol/reference the test lists — NO migration here. If the sweep reveals a live consumer, that is a prerequisite failure: do NOT migrate it in this task; move the consumer migration back to its owning earlier task (Task 6B for element state, the task that introduced the new authority for anything else), then resume Task 14. **Step 4:** PASS + run `src/core/game` scope — several old tests (reactionPath, phapTuChain, dao) will need repointing/removal. **Step 5:** type-check. Commit.

---

### Task 15: Save version reject

**Files:**
- Modify: `game/src/services/save/saveVersion.ts`
- Modify: `game/src/services/save/SaveSystem.ts` (load path)
- Test: `game/src/services/save/saveVersion.test.ts`

- [ ] **Step 1: failing test** — a save payload stamped with the pre-rework version is rejected with a clear error (no partial load); current version loads.
- [ ] **Step 2:** FAIL. **Step 3:** bump `CURRENT_SAVE_VERSION` (the repo's actual export — no `SAVE_VERSION` exists; read its current value then +1 — plan-review snapshot: master is currently v61, but stat-reimagine or other work may bump it first, never hard-code a number) + reject guard on the load path (fail-safe: error surfaces to UI, state untouched). **Step 4:** PASS + save scope. **Step 5:** type-check. Commit.

---

### Task 16: Presentation wiring

**Files:**
- Modify: `game/src/components/panels/skill-path/` (route pick at element-root purchase — blocking choice, no dismiss; route toggle + refund preview "regain X / lose Y")
- Modify: `game/src/components/panels/QuanKhiPanel.vue` + path-choice surface — the sealed `phap_tu_an` path card renders via `getOfferableCultivationPaths` (appears only when eligible; names the kit; permanent warning; no node-tree entry point). Element-root purchase flow calls `selectPhapTuElement(element, route)` — the modal collects input, the core transaction is the authority (INV-13).
- Add: one in-game discoverability hint for the hidden path (NPC/lore/tutorial line per spec §11 — "one who pushes Linh Bao to its limit before the Initiation Ritual may see a road others cannot"; no locked card tease)
- Modify: `game/src/components/game/combat/` (The bar — threshold marker at 100 vs raised `maxThe` cap; phap-tuong state indicator; An HUD: `ngo_dao_hon_don` emblem, no dead ult button, tooltip explains basic-slot-only multicast)
- Modify: Pham Nhan surface — `linh_bao`/`huy_quyen` Lv progress (cast-count → Lv3) wherever `tram`'s progress shows
- i18n keys via `useI18n()` (P16)

**Interfaces:**
- Consumes: `player.phapTu`, `resolveRouteProfile`, `nodeLevels`, `skillCastCounts`. Presentation reads only — all state already authoritative in core.

- [ ] **Step 1:** implement components + i18n keys. (UI tasks don't fit unit-test TDD — cover logic with store-level tests where a selector computes refund preview.)
- [ ] **Step 2:** `npm run type-check` + component tests.
- [ ] **Step 3:** P14 visual check — `npm run dev`, verify The bar/cap, route flow, ritual path card (defer to main checkout if worktree browser is unreliable — note it).
- [ ] **Step 4:** Commit.

---

### Task 17: Verification sweep

- [ ] **Step 1:** `npm run type-check` + `npm run build` + `npx vitest run` (FULL mode — major architecture).
- [ ] **Step 2:** `tutienidle-adversarial-qa` quick pass over the diff (peak-payload case: An multicast×reaction storm; detonate re-seed; A→B→A respec tax; `phap_tu_an` ritual gate — 9999 vs 10000 casts, post-ritual casts, save/load of `cultivationPath === 'phap_tu_an'`). **Balance methodology (spec §11):** dot-vs-no compared as damage-per-action over 5/10/20-turn windows, never single casts — dot's multipliers compound.
- [ ] **Step 3:** `code-review` on the aggregate diff (P5).
- [ ] **Step 4:** Report: changed files, test evidence, remaining limitations (balance numbers first-pass, Thuy defensive lever deferred to balance pass, P14 visual state).

---

## Self-review notes (checked against spec)

- P1–P16 coverage: mutex(6), routes(3-4), The(8,10,13), execution identity(9-11), An path offer(2,7,11), reactions(5,12), mortal skills(2), element migration(6B), kill list(14), save reject(15), UI(16), verification(17).
- INV-1..21 each maps to a task's tests: 1→T6, 2→T3, 3→T4, 4→T8/10, 5→T6/7, 6/7→T11, 8→T12, 9→T2, 10→kept(kit statModifiers T7), 11→T3, 12→T14, 13→T6, 14→T8, 15→T8, 16→T4(subsumed by 14→T8), 17→T12, 18→T9/10, 19→T6, 20→T11, 21→T6B/14.
- Spec-vs-code correction discovered during planning: `WuxingRelations` did not exist — created as Task 5 (spec §6 referenced it as "already implemented"; the truth was `ELEMENT_REACTIONS.relation` metadata).
- `bat_kiem_thuat` (Kiem An) shares `currentThe` — preserved via `theGainOnLandedCast` field values, not constants.
