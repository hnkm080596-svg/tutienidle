# Phase A1 — Wire ReactionManager into TurnBattleSystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make elemental reactions actually fire during real (turn-based)
combat by porting `ReactionManager` to a turn-native
`TurnReactionManager`, giving `TurnSkillDefinition` the ability to apply
an ailment with a chance (mirroring the legacy `'debuff'` skill effect),
and wiring the 5 base Pháp Tu skills to use it.

**Architecture:** Four independent-but-sequential pieces: (1) add 3
missing verbatim-port methods to `TurnBuffSystem` that `TurnReactionManager`
needs, (2) port `ReactionManager` itself, wire it into `TurnBattleSystem`'s
constructor, (3) add the `appliesAilment` field + resolution hook, (4)
wire real content (5 skills) + the 2 `GameManager.ts` construction sites
+ prove it end-to-end.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a1-reaction-manager-wiring-design.md`

## Global Constraints

- No new reaction pairings, no rebalancing `ELEMENT_REACTIONS` — reused
  unchanged from `game/src/core/element/ElementReaction.ts`.
- No `spawnLavaZone`/AoE zone mechanic — dropped entirely from the
  ported manager. `appliesAilmentId: 'dung_nham'` alone produces the DoT
  (zone-as-buff, already decided).
- No `SkillEffectSystem` port — only its one relevant behavior
  (roll ailment chance → apply → check reaction) is replicated inline.
- No new buff content — all 11 buffs needed already exist in
  `game/src/data/buff/buffs.ts` and are already in `TURN_BUFF_REGISTRY`.
- `TurnBuffRegistry.get(id)` throws on an unknown id — every runtime
  lookup must be prepared for that (either the caller already guarantees
  the id exists, matching `TurnBattleSystem.ts`'s existing un-guarded
  `this.registry.get(...)` calls for boss triggers/appliesBuff, or wraps
  in try/catch if the id could plausibly be wrong — match whichever
  precedent the specific call site's neighboring code already uses).
- Every new/changed comment must be in English (P15) unless it is a
  verbatim move of existing Vietnamese text.
- `appliesAilment` is a NEW, separate field from the existing
  `appliesBuff` on `TurnSkillDefinition` — never repurpose `appliesBuff`
  for chance-gated application (different semantics, "one field one
  meaning").

---

### Task 1: Add `getActiveIds`, `remove`, `renewWithExtension` to `TurnBuffSystem`

**Files:**
- Modify: `game/src/core/battle/turn/TurnBuffSystem.ts` (add 3 methods)
- Test: `game/src/core/battle/turn/TurnBuffSystem.test.ts` (existing
  file, add new tests)

**Interfaces:**
- Produces: `TurnBuffSystem.getActiveIds(): string[]`,
  `TurnBuffSystem.remove(id: string, sourceId: string): void`,
  `TurnBuffSystem.renewWithExtension(id: string, sourceId: string, extraTurns: number): void`.
  These are the turn-typed ports of `BuffSystem.getActiveIds()`/`.remove()`/`.renewWithExtension()`
  (`game/src/core/buff/BuffSystem.ts:415-448`), needed by Task 2's
  `TurnReactionManager` port. `extraTurns` replaces legacy's
  `extraSeconds` naming (turns, not seconds — matching this file's own
  established `remainingTurns` naming).
- Consumes: `TurnBuffPool.getAll()`, `.getFromSource()`,
  `.removeInstance()`, `.add()` — all already exist (`TurnBuffPool.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `game/src/core/battle/turn/TurnBuffSystem.test.ts` (reuse
whatever fixture helpers the file already has for building a
`TurnBuffDefinition`/`CombatEntity` — read the top of the file first):

```ts
describe('TurnBuffSystem port additions for ReactionManager (Phase A1)', () => {
  it('getActiveIds returns the id of every active buff instance', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = /* reuse this file's existing entity fixture helper */
    const target = /* same */

    system.apply(/* a fixture TurnBuffDefinition with id 'fixture_a' */, source, target)
    system.apply(/* a fixture TurnBuffDefinition with id 'fixture_b' */, source, target)

    expect(system.getActiveIds().sort()).toEqual(['fixture_a', 'fixture_b'])
  })

  it('remove deletes only the matching (id, sourceId) instance', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = /* fixture */
    const target = /* fixture */

    system.apply(/* fixture definition id 'fixture_a' */, source, target)
    system.remove('fixture_a', source.id)

    expect(system.getActiveIds()).toEqual([])
  })

  it('renewWithExtension adds to remainingTurns without resetting stacks/other fields', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)
    const source = /* fixture */
    const target = /* fixture */

    system.apply(/* fixture definition id 'fixture_a', duration 5 */, source, target)
    system.renewWithExtension('fixture_a', source.id, 3)

    const buff = pool.getFromSource('fixture_a', source.id)
    expect(buff?.remainingTurns).toBe(8)
  })

  it('renewWithExtension is a no-op when no matching instance exists', () => {
    const pool = new TurnBuffPool()
    const system = new TurnBuffSystem(pool)

    expect(() => system.renewWithExtension('nonexistent', 'nobody', 3)).not.toThrow()
    expect(pool.getAll()).toEqual([])
  })
})
```

Fill in the fixture calls using whatever this file's existing tests
already use to build a `TurnBuffDefinition`/source/target `CombatEntity`
— do not invent a second fixture style in the same file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnBuffSystem.test.ts`
Expected: FAIL — `getActiveIds`/`remove`/`renewWithExtension` don't
exist on `TurnBuffSystem` yet (TS compile error).

- [ ] **Step 3: Add the 3 methods**

In `game/src/core/battle/turn/TurnBuffSystem.ts`, add after the existing
`getStacks()` method (the class's last method):

```ts
  /**
   * Port verbatim từ BuffSystem.getActiveIds() (BuffSystem.ts:415-417) —
   * mọi id đang active, KHÔNG dedupe (nhiều sourceId có thể cùng 1 id).
   */
  getActiveIds(): string[] {
    return this.pool.getAll().map((buff) => buff.id)
  }

  /**
   * Port verbatim từ BuffSystem.remove() (BuffSystem.ts:426-428).
   */
  remove(id: string, sourceId: string): void {
    this.pool.removeInstance(id, sourceId)
  }

  /**
   * Port verbatim từ BuffSystem.renewWithExtension() (BuffSystem.ts:440-448),
   * đổi remainingTime -> remainingTurns. No-op nếu không có instance khớp
   * (id, sourceId).
   */
  renewWithExtension(id: string, sourceId: string, extraTurns: number): void {
    const existing = this.pool.getFromSource(id, sourceId)

    if (!existing) {
      return
    }

    this.pool.removeInstance(id, sourceId)
    this.pool.add({ ...existing, remainingTurns: existing.remainingTurns + extraTurns })
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBuffSystem.test.ts`
Expected: PASS

- [ ] **Step 5: Run type-check**

Run: `npm --prefix game run type-check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add game/src/core/battle/turn/TurnBuffSystem.ts game/src/core/battle/turn/TurnBuffSystem.test.ts
git commit -m "feat(combat): port getActiveIds/remove/renewWithExtension to TurnBuffSystem"
```

---

### Task 2: Port `ReactionManager` → `TurnReactionManager`, wire into `TurnBattleSystem`

**Files:**
- Create: `game/src/core/battle/turn/TurnReactionManager.ts`
- Test: `game/src/core/battle/turn/TurnReactionManager.test.ts` (new,
  ported from `game/src/core/element/ReactionManager.test.ts`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (constructor,
  ~line 256-262 — add a 6th optional param)

**Interfaces:**
- Consumes: Task 1's `TurnBuffSystem.getActiveIds/remove/renewWithExtension`,
  `ELEMENT_REACTIONS`/`ElementReactionDefinition` (unchanged, imported
  from `game/src/core/element/ElementReaction.ts`), `TurnBuffPool`,
  `TurnBuffRegistry`, `CombatSystem`, `CombatEntity` (all shared,
  already used by `TurnBattleSystem.ts`).
- Produces: `TurnReactionManager` class with
  `checkAndTrigger(targetBuffs: TurnBuffPool, newBuffId: string, source: CombatEntity, target: CombatEntity, combatSystem: CombatSystem, buffRegistry?: TurnBuffRegistry, sourceBuffs?: TurnBuffPool, reactionKeepChance = 0)`
  — same as legacy MINUS the `spawnLavaZone` parameter (dropped, Global
  Constraints). `TurnBattleSystem`'s constructor gains
  `private readonly reactionManager?: TurnReactionManager` as its 6th
  parameter (after `reactionPathPool`).

**IMPORTANT — read first:** `ReactionManager.ts`'s full current source is
reproduced in Step 3 below (already read in full during planning) — the
port is a mechanical type/method substitution, not a redesign. Do not
change any damage formula, ordering, or branch logic.

- [ ] **Step 1: Write the failing tests**

Create `game/src/core/battle/turn/TurnReactionManager.test.ts`. Port
ALL 18 tests from `game/src/core/element/ReactionManager.test.ts`
(verified count at plan-writing time — re-count before starting in case
this drifts) using this exact type-substitution table:

| Legacy | Turn-based |
|---|---|
| `import { ReactionManager } from './ReactionManager'` | `import { TurnReactionManager } from './TurnReactionManager'` |
| `import { BuffSystem } from '../buff/BuffSystem'` | `import { TurnBuffSystem } from './TurnBuffSystem'` |
| `import { BuffPool } from '../buff/BuffPool'` | `import { TurnBuffPool } from './TurnBuffPool'` |
| `import { BuffRegistry } from '../buff/BuffRegistry'` | `import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'` (production registry — already has all 11 buffs, no local fixture registry needed; adjust relative path to match this test file's actual location) |
| `new ReactionManager(eventBus)` | `new TurnReactionManager(eventBus)` |
| `new BuffSystem(new BuffPool())` | `new TurnBuffSystem(new TurnBuffPool())` |
| `getBuffDefinition(id)` / local `createBuffRegistry()` helper | delete both — use `TURN_BUFF_REGISTRY.get(id)` directly, or just pass buff ids as strings where the legacy test passed a resolved definition object into `targetBuffs.apply(...)` (check each call site: `TurnBuffSystem.apply()` takes a `TurnBuffDefinition`, so replace `targetBuffs.apply(getBuffDefinition('bong'), source, target)` with `targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)`) |
| `createCombatant()` fixture helper | reuse verbatim (same `CombatEntity` shape, no changes needed — confirm by comparing against this file's own combatant fixture if `TurnReactionManager.test.ts` needs one, or copy the legacy one's body since `CombatEntity` is a shared type) |
| `combatSystem.applyModifiedDirectDamage`/`.killIfDead`/`.vitals.clampToMaxHp` | unchanged — `CombatSystem` is shared between both engines |
| Every `spawnLavaZone` parameter/argument | DELETE — the ported manager has no such parameter |

**Two tests need special handling, not a straight port** (both concern
the deleted `spawnLavaZone` parameter):
- `'Thổ (Thạch Hóa) + Hỏa (Bỏng) khớp cặp "Dung Nham" — CŨNG gọi
  spawnLavaZone tại vị trí target'` (legacy line 289) — **drop this test
  entirely**, the behavior it tests no longer exists.
- `'không truyền spawnLavaZone — "Dung Nham" vẫn hoạt động bình thường
  (buff/debuff + không crash)'` (legacy line 319) — **keep, but simplify**:
  since there's no `spawnLavaZone` parameter to omit anymore, this
  becomes just the normal "Dung Nham reaction applies the ailment"
  assertion with no special no-crash framing needed — merge its
  assertions into whatever the base "reaction applies appliesAilmentId"
  coverage already looks like once ported, or keep as its own smaller
  test if that reads more clearly. Use judgment; the point is "Dung Nham
  reaction still works" must remain covered, "still works without a now
  nonexistent parameter" does not need its own test.

Worked example — 3 fully-written ported tests (apply the same
transformation to the other 13 tests: `'tra bảng phản ứng theo CẢ 2
CHIỀU...'`, `'không có buff/debuff nào khớp bảng...'`, `'cùng 1 buff
refresh lại chính nó...'`, `'reactionEffectPercent khuếch đại...'`,
`'Thủy + Mộc khớp cặp "Độc Thủy"'`, `'waterReactionExtensionSeconds —
GIỮ LẠI Tê Cóng...'`, `'Mộc + Hỏa khớp cặp "Độc Viêm"...'`, `'Thổ +
Thủy khớp cặp "Trói Chân"...'`, `'Thổ + Mộc khớp cặp "Độc Thế"...'`,
`'Kim + Hỏa khớp cặp "Thiêu Huyết"...'`, `'"Thiêu Huyết" nhiều lần liên
tiếp...'`, `'Kim + Mộc khớp cặp "Huyết Độc"...'`,
`'waterReactionExtensionSeconds=0...'` — read each legacy test's exact
body from `ReactionManager.test.ts` and apply the table above; every
one of these already exists in full, working form, this is transcription
with type substitution, not new test design):

```ts
import { describe, expect, it } from 'vitest'
import { TurnReactionManager } from './TurnReactionManager'
import { TurnBuffSystem } from './TurnBuffSystem'
import { TurnBuffPool } from './TurnBuffPool'
import { CombatSystem } from '../../combat/CombatSystem'
import { EventBus } from '../../events/EventBus'
import { createBaseStats } from '../../stats/StatBlock'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'
import type { CombatEntity } from '../../combat/CombatEntity'

function createCombatant(overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats()

  return {
    id: 'id',
    name: 'name',
    type: 'enemy',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  }
}

describe('TurnReactionManager (Phase A1 port of ReactionManager)', () => {
  it('2 buff/debuff hành khác nhau khớp bảng phản ứng — gây damage MỘT LẦN rồi tiêu cả 2', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    const reactionEvents: unknown[] = []
    eventBus.on('reaction', (event) => reactionEvents.push(event))

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('te_cong'), source, target)
    reactionManager.checkAndTrigger(targetBuffPool, 'te_cong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBeLessThan(1000)
    expect(reactionEvents).toHaveLength(1)
  })

  it('Thổ (Thạch Hóa) + Hỏa (Bỏng) khớp cặp "Dung Nham" — sinh debuff DoT mới trên target, không phải true damage', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('thach_hoa'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(targetBuffPool.hasAny('dung_nham')).toBe(true)
    expect(targetBuffPool.hasAny('thach_hoa')).toBe(false)
    expect(targetBuffPool.hasAny('bong')).toBe(false)
  })

  it('Kim (Chảy Máu) + Hỏa (Bỏng) khớp cặp "Thiêu Huyết" — trừ currentHp thường + trừ VĨNH VIỄN % maxHp', () => {
    const eventBus = new EventBus()
    const reactionManager = new TurnReactionManager(eventBus)
    const combatSystem = new CombatSystem(eventBus)

    const source = createCombatant({ id: 'source', type: 'player' })
    const target = createCombatant({ id: 'target', currentHp: 1000, maxHp: 1000 })

    const targetBuffPool = new TurnBuffPool()
    const targetBuffs = new TurnBuffSystem(targetBuffPool)

    targetBuffs.apply(TURN_BUFF_REGISTRY.get('chay_mau'), source, target)
    targetBuffs.apply(TURN_BUFF_REGISTRY.get('bong'), source, target)

    reactionManager.checkAndTrigger(targetBuffPool, 'bong', source, target, combatSystem, TURN_BUFF_REGISTRY)

    expect(target.currentHp).toBeLessThan(1000)
    expect(target.maxHp).toBeLessThan(1000)
    expect(target.totalMaxHpReductionPercent).toBeGreaterThan(0)
  })
})
```

Re-read each remaining legacy test's exact assertions before porting —
the 3 above are worked examples of the pattern (plain-damage shape,
appliesAilmentId shape, maxHpReductionPercent shape), not the complete
set. Every legacy test name is listed above; port all of them (minus the
one dropped per the special-handling note).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnReactionManager.test.ts`
Expected: FAIL — `TurnReactionManager` doesn't exist yet.

- [ ] **Step 3: Create `TurnReactionManager.ts`**

Full current source of `game/src/core/element/ReactionManager.ts` (249
lines, already read in full during planning) — port with these EXACT
substitutions and nothing else:

- File header comment: adapt to note this is the turn-based port
  (English, per P15).
- `import type { BuffSystem } from '../buff/BuffSystem'` → `import { TurnBuffSystem } from './TurnBuffSystem'` (note: value import,
  not type-only, since the port constructs `new TurnBuffSystem(pool)`
  wrapper instances inline — see below)
- `import type { BuffRegistry } from '../buff/BuffRegistry'` → `import type { TurnBuffRegistry } from './TurnBuffTypes'`
- Constructor parameter `targetBuffs: BuffSystem` → `targetBuffs: TurnBuffPool` (the pool, not a system wrapper — matches
  Task 2's Interfaces section; every legacy `targetBuffs.<method>(...)`
  call becomes `new TurnBuffSystem(targetBuffs).<method>(...)` at each
  use site, since the pool itself doesn't have `getActiveIds`/`remove`/
  `renewWithExtension`/`apply` — those live on `TurnBuffSystem` per
  Task 1)
- Constructor parameter `sourceBuffs?: BuffSystem` → `sourceBuffs?: TurnBuffPool` (same wrapping pattern at its one use site,
  the `appliesBuffId` branch)
- Constructor parameter `buffRegistry?: BuffRegistry` → `buffRegistry?: TurnBuffRegistry`
- DELETE the entire `spawnLavaZone` parameter (with its inline type) and
  the `if (reaction.spawnsLavaZone && spawnLavaZone) { ... }` block
  inside the `appliesAilmentId` branch (Global Constraints).
- `import { ELEMENT_REACTIONS } from './ElementReaction'` → adjust
  relative path only (`'../../element/ElementReaction'` from this file's
  new location `battle/turn/`) — otherwise unchanged, same import.
- `import { getSkillRuntimeStat } from '../skill/SkillRuntimeStats'` →
  adjust relative path only (`'../../skill/SkillRuntimeStats'`) —
  confirmed at planning time this function and `source.skillStats` work
  identically for turn-based `CombatEntity` (already used by
  `TurnBuffSystem.ts`'s `resolveMaxStacks`), no adaptation needed.
- `import { elementalBasePower } from '../combat/ElementDamageCalculator'` →
  adjust relative path only (`'../../combat/ElementDamageCalculator'`).
- Every other line (the damage formula, the 3-way branch on
  `appliesBuffId`/`appliesAilmentId`/else, the `keepsAilmentId`/
  `reactionKeepChance` logic, the `'reaction'` event emission,
  `combatSystem.killIfDead`, the single-reaction-per-call `return`) is
  UNCHANGED logic — only the buff-pool method calls get wrapped in
  `new TurnBuffSystem(pool)` as noted above, and `MAX_HP_REDUCTION_CAP_PERCENT`
  stays the same constant/value.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnReactionManager.test.ts`
Expected: PASS (17/17 — 18 legacy tests minus 1 dropped)

- [ ] **Step 5: Wire into `TurnBattleSystem`'s constructor**

Current constructor (`game/src/core/battle/turn/TurnBattleSystem.ts:256-262`):

```ts
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
    private readonly spawnEnemy?: (occupiedSlots?: Set<string>) => TurnBattleParticipant,
    private readonly reactionPathPool?: readonly TurnSkillDefinition[],
  ) {}
```

Add a 6th parameter:

```ts
  constructor(
    private readonly combat: CombatSystem,
    private readonly maxTurns: number = DEFAULT_MAX_TURNS,
    private readonly registry?: TurnBuffRegistry,
    private readonly spawnEnemy?: (occupiedSlots?: Set<string>) => TurnBattleParticipant,
    private readonly reactionPathPool?: readonly TurnSkillDefinition[],
    private readonly reactionManager?: TurnReactionManager,
  ) {}
```

Add the import at the top of the file:

```ts
import { TurnReactionManager } from './TurnReactionManager'
```

This parameter is not consumed yet (Task 3 wires the actual call) —
this step only makes it constructable. Existing call sites (production
and tests) that don't pass a 6th argument continue to compile
(`reactionManager` is `undefined`, and every consumer in Task 3 will be
written to no-op safely when it's absent, matching the existing
`registry`/`spawnEnemy` optional-collaborator pattern already used
throughout this class).

- [ ] **Step 6: Run the full suite + type-check**

Run: `npm --prefix game run test && npm --prefix game run type-check`
Expected: PASS, 0 errors (confirms the new constructor parameter doesn't
break any existing `new TurnBattleSystem(...)` call site)

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnReactionManager.ts game/src/core/battle/turn/TurnReactionManager.test.ts game/src/core/battle/turn/TurnBattleSystem.ts
git commit -m "feat(combat): port ReactionManager to TurnReactionManager, wire into TurnBattleSystem constructor"
```

---

### Task 3: `appliesAilment` field + resolution hook

**Files:**
- Modify: `game/src/core/battle/turn/TurnSkillAction.ts:22-34` (add
  `appliesAilment` field to `TurnSkillDefinition`)
- Modify: `game/src/core/battle/turn/TurnBattleSystem.ts` (`applyActionImpact()`'s
  per-target loop, ~line 835-857)
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts` (existing
  file, add new tests)

**Interfaces:**
- Produces: `TurnSkillDefinition.appliesAilment?: { buffDefinitionId: string; chance: number }`.
- Consumes: Task 2's `this.reactionManager` (now wired but unused),
  `this.registry`, `TurnBuffSystem`.

**IMPORTANT — read first:** re-read the CURRENT
`applyActionImpact()`/`declared.scaledDamage` per-target loop before
editing — Task 2 only added a constructor parameter, it did not touch
this method, so the loop's shape should be unchanged from what's shown
below, but confirm before assuming line numbers still match.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/battle/turn/TurnBattleSystem.test.ts` (find a
`describe` block that already exercises `resolveNextStep`/`applyActionImpact`
with real damage resolution — likely near the existing
`'TurnBattleSystem.runToCompletion'` or the boss-trigger block's
neighbors — and follow its established fixture style: `createCombatant`,
`makeParticipant`, a `TurnBuffRegistry` fixture):

```ts
describe('TurnBattleSystem appliesAilment (Phase A1)', () => {
  it('applies the ailment buff to the target on a successful chance roll and checks for a reaction', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
    })
    const enemyEntity = createCombatant({
      id: 'enemy',
      currentHp: 1_000_000,
      maxHp: 1_000_000,
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const playerParticipant = makeParticipant('player', player, 100, 0)
    playerParticipant.basic = {
      id: 'fixture_ailment_skill',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
      appliesAilment: { buffDefinitionId: 'fixture_ailment', chance: 1 },
    }

    const enemyParticipant = makeParticipant('enemy', enemyEntity, 1, 1)

    const battle: TurnBattle = {
      players: [playerParticipant],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const registry = new FixtureBuffRegistry([
      { id: 'fixture_ailment', name: 'Fixture Ailment', polarity: 'debuff', duration: 5, stackMode: 'refresh', effects: [{ type: 'dot', dpsRatio: 0.1, element: 'physical' }] },
    ])

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, registry)

    system.resolveNextStep(battle) // player's turn — hits the enemy

    expect(enemyParticipant.buffs.hasAny('fixture_ailment')).toBe(true)
  })

  it('does not apply the ailment when the chance roll fails', () => {
    // Same setup as above but chance: 0 — assert enemyParticipant.buffs.hasAny('fixture_ailment') is false.
  })

  it('does not throw when appliesAilment is set but no registry was provided', () => {
    // Same setup, construct TurnBattleSystem with no registry argument — assert resolveNextStep doesn't throw.
  })
})
```

Reuse this file's existing `FixtureBuffRegistry` class (already defined
for the boss-trigger tests, ~line 327-343) rather than redefining it —
confirm it's in scope for this new `describe` block (same file, should
already be visible). Fill in the two abbreviated tests with the same
level of completeness as the first, following its exact structure with
the noted single change (chance value / missing registry argument).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: FAIL — TS error (`appliesAilment` doesn't exist on
`TurnSkillDefinition` yet) or, once that's stubbed, a runtime failure
(nothing applies the ailment yet).

- [ ] **Step 3: Add `appliesAilment` to `TurnSkillDefinition`**

In `game/src/core/battle/turn/TurnSkillAction.ts`, add directly after
the existing `appliesBuff` field (~line 29):

```ts
  /**
   * Phase A1 (2026-09-07) — chance-gated ailment application, checked
   * against TurnReactionManager after applying. Deliberately separate
   * from appliesBuff (unconditional, no reaction check) - different
   * semantics, do not merge the two fields.
   */
  appliesAilment?: { buffDefinitionId: string; chance: number }
```

- [ ] **Step 4: Add the resolution hook**

In `game/src/core/battle/turn/TurnBattleSystem.ts`'s `applyActionImpact()`,
current per-target loop (~line 835-857):

```ts
      } else if (declared.scaledDamage) {
        for (const target of declared.affected) {
          if (!target.entity.alive) continue

          this.combat.resolveActionHit(actor.entity, target.entity, declared.scaledDamage)
          targetIds.push(target.id)

          if (this.registry) {
            new TurnBuffSystem(actor.buffs).rollOnHitEffects(actor.entity, target.entity, this.registry)

            const { firedFollowUp } = new TurnBuffSystem(target.buffs).rollReactiveTrigger(target.entity, 'onImpactLanded', this.registry)

            if (firedFollowUp) {
              battle.queuedFollowUpActorIds = battle.queuedFollowUpActorIds ?? []
              battle.queuedFollowUpActorIds.push(target.id)
            }
          }
        }
      }
```

Add the ailment-application block directly after the existing
`rollOnHitEffects`/`rollReactiveTrigger` block, still inside the
`if (this.registry)` guard and still inside the `for (const target of
declared.affected)` loop:

```ts
            const ailment = action.skill?.appliesAilment

            if (ailment && Math.random() < ailment.chance) {
              const definition = this.registry.get(ailment.buffDefinitionId)

              new TurnBuffSystem(target.buffs).apply(definition, actor.entity, target.entity, this.registry)

              this.reactionManager?.checkAndTrigger(
                target.buffs,
                ailment.buffDefinitionId,
                actor.entity,
                target.entity,
                this.combat,
                this.registry,
                actor.buffs,
              )
            }
```

Note `action` here refers to the same `const action = declared.action`
already in scope earlier in this method (confirm the exact variable
name/scope by reading the surrounding code — the boss-trigger and
`appliesBuff` blocks later in the same method already reference
`action.skill?.appliesBuff` the same way, so `action.skill?.appliesAilment`
follows the identical established pattern).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite + type-check**

Run: `npm --prefix game run test && npm --prefix game run type-check`
Expected: PASS, 0 errors

- [ ] **Step 7: Commit**

```bash
git add game/src/core/battle/turn/TurnSkillAction.ts game/src/core/battle/turn/TurnBattleSystem.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(combat): add appliesAilment field + resolution hook, wired to TurnReactionManager"
```

---

### Task 4: Wire real content + production `TurnReactionManager` instance + end-to-end proof

**Files:**
- Modify: `game/src/data/skill/TurnBasicAttacks.ts:23-29` (add
  `appliesAilment` to each of `PHAP_TU_BASICS`'s 5 entries)
- Modify: `game/src/core/game/GameManager.ts` (both `new TurnBattleSystem(...)`
  production call sites — ~line 2497 and ~line 3052 at planning time —
  pass a real `TurnReactionManager` instance as the 6th argument)
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts` (one new
  end-to-end test using real production content)

**Interfaces:**
- Consumes: Task 2's `TurnReactionManager`, Task 3's `appliesAilment`.
- Produces: nothing new — this task is content + wiring only.

**IMPORTANT — read first:** re-locate both `new TurnBattleSystem(...)`
call sites by searching for the literal string before editing — this
session's other in-flight work (Phase A2) may have shifted
`GameManager.ts`'s line numbers by the time this task runs.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/battle/turn/TurnBattleSystem.test.ts`, using real
production imports (mirrors the Phase A2 plan's Task 3 Step 7 pattern —
real data driven through the real engine):

```ts
import { PHAP_TU_BASICS } from '../../../data/skill/TurnBasicAttacks'
import { TurnReactionManager } from './TurnReactionManager'

it('real production content: Hỏa (hoa_cau_thuat) then Thủy (thuy_tien_thuat) triggers Bốc Hơi', () => {
  const eventBus = new EventBus()
  const combatSystem = new CombatSystem(eventBus)
  const reactionManager = new TurnReactionManager(eventBus)

  const firePlayer = createCombatant({
    id: 'fire_player',
    type: 'player',
    stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 100 },
  })
  const target = createCombatant({ id: 'target', currentHp: 1_000_000, maxHp: 1_000_000, stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 } })

  const firePlayerParticipant = makeParticipant('fire_player', firePlayer, 100, 0)
  firePlayerParticipant.basic = PHAP_TU_BASICS.fire

  const enemyParticipant = makeParticipant('target', target, 1, 1)

  const battle: TurnBattle = {
    players: [firePlayerParticipant],
    enemies: [enemyParticipant],
    state: 'fighting',
  }

  const system = new TurnBattleSystem(combatSystem, 10, TURN_BUFF_REGISTRY, undefined, undefined, reactionManager)

  const reactionEvents: unknown[] = []
  eventBus.on('reaction', (event) => reactionEvents.push(event))

  // hoa_cau_thuat's ailmentChance is 0.5 - loop resolveNextStep enough
  // times that a fire hit lands with overwhelming probability, matching
  // this file's existing convention of using enough iterations to make
  // probabilistic content deterministic-in-practice for a test (check
  // how other chance-based tests in this file handle this, e.g. any
  // existing onHitProc test, and match that convention rather than
  // inventing a new one). Then manually apply 'te_cong' to force the
  // second ailment (this test's purpose is proving the WIRING works
  // end-to-end with real data, not re-testing RNG).
  new TurnBuffSystem(enemyParticipant.buffs).apply(TURN_BUFF_REGISTRY.get('te_cong'), firePlayer, target, TURN_BUFF_REGISTRY)

  for (let i = 0; i < 50; i++) {
    if (enemyParticipant.buffs.hasAny('bong')) break
    system.resolveNextStep(battle)
  }

  expect(reactionEvents.length).toBeGreaterThan(0)
})
```

If `resolveNextStep` in this fixture shape doesn't reliably land a hit
within 50 iterations (e.g. because gauge/priority mechanics in this
file's fixtures behave differently than assumed), read a neighboring
working test in the same file that already drives `resolveNextStep` to
a guaranteed hit and match its exact gauge/speed fixture values instead
of guessing new ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: FAIL — `PHAP_TU_BASICS.fire` has no `appliesAilment` yet, no
reaction ever fires.

- [ ] **Step 3: Wire the 5 base elemental skills**

In `game/src/data/skill/TurnBasicAttacks.ts`, update `PHAP_TU_BASICS`
(current, lines 23-29) — add `appliesAilment` to each entry using the
exact chances confirmed against legacy `Skills.ts` during planning:

```ts
export const PHAP_TU_BASICS: Record<'fire' | 'water' | 'wood' | 'metal' | 'earth', TurnSkillDefinition> = {
  fire: { id: 'hoa_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'fire', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'bong', chance: 0.5 } },
  water: { id: 'thuy_tien_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'water', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'te_cong', chance: 0.5 } },
  wood: { id: 'doc_chuong', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'wood', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'trung_doc', chance: 1 } },
  metal: { id: 'diem_kim_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'metal', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'chay_mau', chance: 0.4 } },
  earth: { id: 'tho_cau_thuat', cooldownTurns: 0, damage: { kind: 'elemental', components: [{ kind: 'element', element: 'earth', ratio: 1 }], multiplier: 1 }, targeting: { shape: 'single' }, appliesAilment: { buffDefinitionId: 'thach_hoa', chance: 1 } },
}
```

- [ ] **Step 4: Wire production `TurnReactionManager` instances**

In `game/src/core/game/GameManager.ts`, locate both `new TurnBattleSystem(...)`
call sites that construct a real battle (the two multi-line ones that
pass `TURN_BUFF_REGISTRY` and a `spawnEnemy` factory — NOT the
single-argument field initializer at the top of the class, which stays
as-is since it's immediately replaced before any real battle starts).
Add a `TurnReactionManager` import and construct one instance per call
site (or hoist a single shared instance if the class already has a
pattern of holding long-lived collaborators like this — check
`this.eventBus`'s existing usages nearby before deciding field vs.
inline):

```ts
import { TurnReactionManager } from '../battle/turn/TurnReactionManager'
```

At each of the 2 call sites, add a 6th argument after the closing of the
`spawnEnemy` factory function (5th argument) — `reactionPathPool` (5th
positional slot) stays `undefined` since A4 hasn't populated it yet:

```ts
      undefined, // reactionPathPool — not populated until roadmap A4
      new TurnReactionManager(this.eventBus),
```

Confirm `this.eventBus` is accessible at each call site (it's a
`readonly` field declared near the top of `GameManager`, should be in
scope anywhere in the class).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite + type-check + build**

Run: `npm --prefix game run test && npm --prefix game run type-check && npm --prefix game run build`
Expected: PASS, 0 errors, build succeeds

- [ ] **Step 7: Commit**

```bash
git add game/src/data/skill/TurnBasicAttacks.ts game/src/core/game/GameManager.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(combat): wire real elemental ailment content + production TurnReactionManager instances"
```

---

## Verification

After all 4 tasks are complete:

- [ ] Full suite: `npm --prefix game run test` — all green. Specifically
  confirm `TurnReactionManager.test.ts` (17 tests), the new
  `TurnBattleSystem.test.ts` additions (Task 3's 3 tests + Task 4's 1
  end-to-end test), and `TurnBuffSystem.test.ts`'s Task 1 additions.
- [ ] `npm --prefix game run type-check` — 0 errors.
- [ ] `npm --prefix game run build` — succeeds.
- [ ] No P14 (visual/Playwright) verification required — this plan is
  pure combat logic/data. If a reaction VFX/toast already exists and is
  wired to the `'reaction'` event (check `game/src/game/scenes/CombatScene.ts`
  for an existing `'reaction'` event listener before assuming none —
  this change may make a dormant visual newly reachable in production),
  escalate to add a P14 pass rather than silently skipping it.
- [ ] Confirm roadmap.md's Phase A1 row can be marked done, and that A4
  (Reaction Path content, which depends on A1) and C1 (depends on
  A1+A2) still read correctly given this work.
