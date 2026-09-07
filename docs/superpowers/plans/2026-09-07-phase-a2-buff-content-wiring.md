# Phase A2 — Boss Enrage Content + Talent Passive-Conversion Rewiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 3 realm-final-floor bosses real turn-based enrage
content, and fix a silent bug where talent passive-conversion buffs
never apply during real (turn-based) combat because the applier code
still targets the legacy real-time battle system.

**Architecture:** Thread a small static `bossTrigger` config
(`{ afterTurns, buffDefinitionId }`) from `Enemy` data through
`CombatEntity` into `TurnBattleParticipant.bossTrigger` — the engine
already reads and fires this field, it is simply never populated today.
Separately, rewire `GameManager`'s `PassiveSystem` callbacks off the
legacy `battleSystem`/`buffRegistry` onto the live `turnBattle`/
`TURN_BUFF_REGISTRY`. Both pieces are independent — thread-and-populate
for Component 1 (Tasks 1-3), read-and-rewire for Component 2 (Task 4).

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md`

## Global Constraints

- No dual-target / legacy-fallback shims. Component 2 cuts over fully to
  the turn-based system — this project's locked policy for buff-system
  conversions (see the spec's Component 2 design).
- No new elemental/Break/toughness mechanics, no equipment-buff field.
  Out of scope per the spec's Non-Goals.
- New buff content is authored as legacy `BuffDefinition` entries in
  `game/src/data/buff/buffs.ts` (NOT as native `TurnBuffDefinition` in
  `TurnBuffs.ts`) — confirmed by survey that `TURN_BUFF_REGISTRY` is
  built exclusively from `buffs.ts` via `toTurnBuffDefinition()`; the two
  existing hand-authored `TurnBuffDefinition` entries in `TurnBuffs.ts`
  are proven unreachable through this registry today. Do not repeat that
  gap.
- `TurnBuffRegistry.get(id)` throws on an unknown id (it does not return
  `undefined`) — every call site that looks up a buff by id at runtime
  must wrap it in try/catch, matching the established pattern at
  `GameManager.ts:2411-2417`.
- Every new/changed comment must be in English (P15) unless it is a
  verbatim move of existing Vietnamese text.
- Do not touch or remove the legacy `Enemy.enrage`/`BossEnrage` field or
  `FLOOD_DRAGON_ENRAGE` in this plan. Leave the legacy path exactly as it
  is — this plan adds the turn-based path alongside it, it does not clean
  up the legacy one (that is roadmap item C1, gated on this work, not
  part of it).

---

### Task 1: Thread a static `bossTrigger` config through Enemy data → CombatEntity

**Files:**
- Modify: `game/src/core/enemy/Enemy.ts:130` (after `enrage?: BossEnrage`
  on the `Enemy` interface, ~line 125-141 block)
- Modify: `game/src/core/enemy/Enemy.ts:172` (same field on
  `EnemyDefinition`, ~line 147-185 block)
- Modify: `game/src/core/enemy/Enemy.ts:213` (`defineEnemy()` pass-through,
  ~line 193-235)
- Modify: `game/src/core/enemy/Enemy.ts:365` (`enemyToCombatEntity()`
  pass-through, ~line 296-373)
- Modify: `game/src/core/combat/CombatEntity.ts:207` (new field on
  `CombatEntity`, next to `enrage?: BossEnrage`)
- Test: `game/src/core/enemy/Enemy.bossTrigger.test.ts` (new)

**Interfaces:**
- Produces: `Enemy.bossTrigger?: { afterTurns: number; buffDefinitionId: string }`,
  same shape on `EnemyDefinition` and `CombatEntity`. This is a STATIC
  config type (no `firedAlready` — that is runtime-only state, added by
  Task 2 when constructing the live `TurnBossTrigger`). Deliberately an
  inline object type, not an import of `TurnBossTrigger` from
  `TurnBattleSystem.ts` — avoids a battle-engine→enemy-data import
  direction that doesn't exist anywhere else in this codebase.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing test**

Create `game/src/core/enemy/Enemy.bossTrigger.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { defineEnemy, enemyToCombatEntity } from './Enemy'

describe('Enemy bossTrigger config threading', () => {
  it('carries bossTrigger from EnemyDefinition through defineEnemy() to Enemy', () => {
    const enemy = defineEnemy({
      id: 'fixture_boss',
      name: 'Fixture Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 100,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' },
    })

    expect(enemy.bossTrigger).toEqual({ afterTurns: 60, buffDefinitionId: 'fixture_enrage' })
  })

  it('carries bossTrigger from Enemy through enemyToCombatEntity() to CombatEntity', () => {
    const enemy = defineEnemy({
      id: 'fixture_boss',
      name: 'Fixture Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 100,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' },
    })

    const entity = enemyToCombatEntity(enemy)

    expect(entity.bossTrigger).toEqual({ afterTurns: 60, buffDefinitionId: 'fixture_enrage' })
  })

  it('leaves bossTrigger undefined for ordinary enemies', () => {
    const enemy = defineEnemy({
      id: 'fixture_mob',
      name: 'Fixture Mob',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 50,
        attack: 5,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
    })

    expect(enemy.bossTrigger).toBeUndefined()
    expect(enemyToCombatEntity(enemy).bossTrigger).toBeUndefined()
  })
})
```

Check `EnemyStatInput`'s exact required fields first (`game/src/core/enemy/EnemyStatInput.ts`)
before running — the fixture above lists the fields known from this
plan's survey, but confirm none are missing/renamed before treating a
failure as the expected "bossTrigger doesn't exist yet" failure.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- Enemy.bossTrigger.test.ts`
Expected: FAIL — `Object is possibly 'undefined'` or a TS error, since
`bossTrigger` isn't a valid `EnemyDefinition`/`Enemy`/`CombatEntity` field
yet (this will likely fail at type-check before even reaching a runtime
assertion — that's fine, it's still "failing for the right reason").

- [ ] **Step 3: Add the field to `Enemy`, `EnemyDefinition`, `defineEnemy()`, `enemyToCombatEntity()`**

In `game/src/core/enemy/Enemy.ts`, add to the `Enemy` interface
(directly after the existing `enrage?: BossEnrage` field, ~line 130):

```ts
  // Turn-based boss enrage (Phase A2, 2026-09-07) — static config only;
  // TurnBattleAdapter.toTurnBattleParticipant() turns this into a live
  // TurnBossTrigger (adds firedAlready: false) on spawn. Separate from
  // the legacy `enrage`/`tribulationPhases` fields above, which remain
  // consumed only by battle/legacy/BattleSystem and are untouched here.
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
```

Add the identical field (same comment) to `EnemyDefinition` (directly
after its own `enrage?: BossEnrage`, ~line 172):

```ts
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
```

In `defineEnemy()`, add the pass-through directly after the existing
`enrage: definition.enrage,` line (~line 213):

```ts
    bossTrigger: definition.bossTrigger,
```

In `enemyToCombatEntity()`, add the pass-through directly after the
existing `enrage: enemy.enrage,` line (~line 365):

```ts
    bossTrigger: enemy.bossTrigger,
```

In `game/src/core/combat/CombatEntity.ts`, add the same field directly
after the existing `enrage?: BossEnrage` field (~line 207):

```ts
  // Turn-based boss enrage (Phase A2, 2026-09-07) — see Enemy.ts's
  // bossTrigger for the full comment; threaded here unchanged via
  // enemyToCombatEntity(), read by TurnBattleAdapter.toTurnBattleParticipant().
  bossTrigger?: { afterTurns: number; buffDefinitionId: string }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- Enemy.bossTrigger.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Run type-check**

Run: `npm --prefix game run type-check`
Expected: 0 errors (this touches 2 widely-used types — confirm nothing
else broke)

- [ ] **Step 6: Commit**

```bash
git add game/src/core/enemy/Enemy.ts game/src/core/combat/CombatEntity.ts game/src/core/enemy/Enemy.bossTrigger.test.ts
git commit -m "feat(combat): thread static bossTrigger config through Enemy to CombatEntity"
```

---

### Task 2: `TurnBattleAdapter` populates `participant.bossTrigger` on spawn

**Files:**
- Modify: `game/src/core/game/TurnBattleAdapter.ts` (the
  `toTurnBattleParticipant()` function, full current body reproduced
  below)
- Test: `game/src/core/game/TurnBattleAdapter.test.ts` (existing file,
  add new tests)

**Interfaces:**
- Consumes: `CombatEntity.bossTrigger?: { afterTurns, buffDefinitionId }`
  (Task 1's output).
- Produces: `TurnBattleParticipant.bossTrigger?: TurnBossTrigger` populated
  with `firedAlready: false` whenever `entity.bossTrigger` is set — this
  is what `TurnBattleSystem.ts:666-677`'s existing, already-tested firing
  logic reads.

- [ ] **Step 1: Write the failing test**

Add to `game/src/core/game/TurnBattleAdapter.test.ts` (same file, inside
the existing `describe('toTurnBattleParticipant adapter', ...)` block —
add these two `it()`s alongside the existing two):

```ts
  it('populates bossTrigger with firedAlready: false when entity.bossTrigger is set', () => {
    const combatEntity = entity({ bossTrigger: { afterTurns: 60, buffDefinitionId: 'fixture_enrage' } })

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.bossTrigger).toEqual({
      afterTurns: 60,
      buffDefinitionId: 'fixture_enrage',
      firedAlready: false,
    })
  })

  it('leaves bossTrigger undefined when entity.bossTrigger is not set', () => {
    const combatEntity = entity()

    const participant = toTurnBattleParticipant(combatEntity, 0, BASIC)

    expect(participant.bossTrigger).toBeUndefined()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- TurnBattleAdapter.test.ts`
Expected: FAIL — `participant.bossTrigger` is `undefined` in the first
new test (the adapter doesn't read `entity.bossTrigger` yet).

- [ ] **Step 3: Update `toTurnBattleParticipant()`**

Current full body (`game/src/core/game/TurnBattleAdapter.ts`):

```ts
export function toTurnBattleParticipant(
  entity: CombatEntity,
  priority: number,
  basic: TurnSkillDefinition,
  buildId?: string,
): TurnBattleParticipant {
  const participant: TurnBattleParticipant = {
    id: entity.id,
    entity,
    speed: entity.stats.speed,
    priority,
    actionGauge: 0,
    alive: entity.alive,
    buffs: new TurnBuffPool(),
    consecutiveHardCcTurns: 0,
    basic,
  }

  const special = buildId !== undefined ? SPECIALS_BY_BUILD[buildId] : undefined

  if (special) {
    participant.special = {
      skill: special,
      remainingCooldownTurns: 0,
    } satisfies TurnSkillSlot
  }

  return participant
}
```

Add a `bossTrigger` block mirroring the existing `special` block, right
after it:

```ts
  if (entity.bossTrigger) {
    participant.bossTrigger = {
      afterTurns: entity.bossTrigger.afterTurns,
      buffDefinitionId: entity.bossTrigger.buffDefinitionId,
      firedAlready: false,
    }
  }
```

(`TurnBossTrigger` is already imported into `TurnBattleSystem.ts` where
`TurnBattleParticipant` is defined; no new import is needed in
`TurnBattleAdapter.ts` since this constructs a plain object literal
matching the existing `TurnBattleParticipant.bossTrigger` field's type —
confirm this compiles under the existing `TurnBattleParticipant` import
already present in the file; if TypeScript wants an explicit type
import for clarity, add `import type { TurnBossTrigger } from '../battle/turn/TurnBattleSystem'` — check whether it's already imported before assuming it's missing.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBattleAdapter.test.ts`
Expected: PASS (6/6 — the existing 4 plus the 2 new ones)

- [ ] **Step 5: Run type-check**

Run: `npm --prefix game run type-check`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add game/src/core/game/TurnBattleAdapter.ts game/src/core/game/TurnBattleAdapter.test.ts
git commit -m "feat(combat): TurnBattleAdapter populates bossTrigger from CombatEntity on spawn"
```

---

### Task 3: Boss enrage content for the 3 realm-final-floor bosses

**Files:**
- Modify: `game/src/data/buff/buffs.ts` (append 3 new `BuffDefinition`
  entries before the array's closing `]`, currently at line 801)
- Modify: `game/src/data/enemy/Enemies.ts` (add `bossTrigger: {...}` to 3
  `defineEnemy({...})` calls: `ferocious_flood_serpent` at line 745,
  `mortal_ferocious_giant_crocodile` at line 1347, and
  `foundation_ferocious_flood_dragon_whelp` — locate this one by id
  search, its exact current line has likely shifted since this plan was
  written)
- Test: `game/src/data/enemy/Enemies.test.ts` (existing file, add new
  tests)

**Interfaces:**
- Consumes: `Enemy.bossTrigger` (Task 1), `TurnBattleAdapter`'s
  populate-on-spawn behavior (Task 2), `TURN_BUFF_REGISTRY` (existing,
  already live).
- Produces: 3 new resolvable buff ids in `TURN_BUFF_REGISTRY`:
  `mortal_crocodile_enrage`, `qi_refining_serpent_enrage`, and
  `foundation_dragon_enrage` (this id is REUSED from the existing legacy
  `FLOOD_DRAGON_ENRAGE.buff.id` — same id, same content, intentionally —
  see Step 3's note).

**IMPORTANT — read first:** `defineEnemy({...})` call sites for these 3
enemies use plain object literals (not a shared factory function like
`foundationBeast()`) — confirmed at time of writing:
`Enemies.ts:744-745` (`ferocious_flood_serpent`) and `Enemies.ts:1346-1347`
(`mortal_ferocious_giant_crocodile`). Re-locate all 3 by searching for
their `id:` strings before editing — do not trust the line numbers below
if this plan is executed after other Enemies.ts edits have landed.

- [ ] **Step 1: Write the failing tests**

Add to `game/src/data/enemy/Enemies.test.ts` (the file already imports
`ENEMIES` from `./Enemies` at line 2 — reuse that same import, add the
`TURN_BUFF_REGISTRY` import alongside it):

```ts
import { TURN_BUFF_REGISTRY } from '../buff/TurnBuffRegistry'

describe('Phase A2 boss enrage content', () => {
  const bossIds = [
    'mortal_ferocious_giant_crocodile',
    'ferocious_flood_serpent',
    'foundation_ferocious_flood_dragon_whelp',
  ]

  it.each(bossIds)('%s has a bossTrigger with a resolvable buff in TURN_BUFF_REGISTRY', (id) => {
    const boss = ENEMIES.find((enemy) => enemy.id === id)
    expect(boss).toBeDefined()
    expect(boss?.bossTrigger).toBeDefined()
    expect(boss?.bossTrigger?.afterTurns).toBe(60)

    expect(() => TURN_BUFF_REGISTRY.get(boss!.bossTrigger!.buffDefinitionId)).not.toThrow()
  })

  it('each boss enrage buff is a permanent +attack/+speed statModifier', () => {
    for (const id of bossIds) {
      const boss = ENEMIES.find((enemy) => enemy.id === id)
      const definition = TURN_BUFF_REGISTRY.get(boss!.bossTrigger!.buffDefinitionId)

      expect(definition.duration).toBe(Infinity)
      expect(definition.effects.some((effect) => effect.type === 'statModifier' && effect.stat === 'attack')).toBe(true)
      expect(definition.effects.some((effect) => effect.type === 'statModifier' && effect.stat === 'speed')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- Enemies.test.ts`
Expected: FAIL — `boss?.bossTrigger` is `undefined` for all 3 (no content
yet).

- [ ] **Step 3: Add the 3 buff definitions to `buffs.ts`**

In `game/src/data/buff/buffs.ts`, insert directly before the array's
closing `]` (currently line 801, after the existing `tu_sinh_ngo` entry):

```ts
  // Phase A2 boss enrage content (2026-09-07) — turn-based twin of the
  // legacy FLOOD_DRAGON_ENRAGE constant in data/enemy/Enemies.ts (same
  // id, same values, intentionally kept as two separate definitions
  // until roadmap item C1 removes the legacy engine — see
  // docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md).
  // Fires via TurnBossTrigger after 60 turns (same magnitude as the
  // existing Trúc Cơ boss — starting point for playtesting, not a
  // derived balance formula).
  {
    id: 'foundation_dragon_enrage',
    name: 'Đại Vương Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Giao Sủng điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'attack', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
  {
    id: 'mortal_crocodile_enrage',
    name: 'Cự Ngạc Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Hung Cự Ngạc điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'attack', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
  {
    id: 'qi_refining_serpent_enrage',
    name: 'Giao Xà Bạo Nộ',
    description: 'Trận đấu kéo dài quá lâu — Hung Giao Xà điên cuồng.',
    polarity: 'buff',
    duration: Infinity,
    stackMode: 'replace',
    effects: [
      { type: 'statModifier', stat: 'attack', percent: 0.5 },
      { type: 'statModifier', stat: 'speed', percent: 0.2 },
    ],
  },
```

- [ ] **Step 4: Add `bossTrigger` to the 3 `defineEnemy({...})` calls**

In `game/src/data/enemy/Enemies.ts`, for `ferocious_flood_serpent`
(~line 744-751), add `bossTrigger` inside the object literal (position
doesn't matter — place it near `family:`, matching where `enrage` sits on
the Trúc Cơ boss for readability):

```ts
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'qi_refining_serpent_enrage' },
```

For `mortal_ferocious_giant_crocodile` (~line 1346-1352):

```ts
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
```

For `foundation_ferocious_flood_dragon_whelp` (find by id search — this
is the enemy whose `defineEnemy({...})` already has
`enrage: FLOOD_DRAGON_ENRAGE` at what was line 1759 at survey time; ADD
`bossTrigger` alongside the existing `enrage` field, do not remove
`enrage`):

```ts
    bossTrigger: { afterTurns: 60, buffDefinitionId: 'foundation_dragon_enrage' },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --prefix game run test -- Enemies.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite + type-check**

Run: `npm --prefix game run test && npm --prefix game run type-check`
Expected: PASS, 0 errors (confirms the new `buffs.ts` entries don't
collide with an existing id, and `TurnBuffRegistry.test.ts` — which
likely asserts something about the converted count/shape of
`TURN_BUFF_REGISTRY` — still passes; if it fails because it hardcodes
"46 buffs" or similar, update that expected count, it is expected to grow
by 3)

- [ ] **Step 7: Add one end-to-end engine test proving a boss enrage buff actually fires in a real battle**

This proves the full chain (Enemy → CombatEntity → TurnBattleParticipant
→ engine tick → buff applied) works for real production data, not just
that the data is shaped correctly. `totalTurnsElapsed` increments by 1
per `resolveNextStep()` call (confirmed by the existing sibling tests in
this same `describe` block — e.g. the first test's comment "Turn 1:
player acts... Turn 2: enemy acts" for 2 calls against `afterTurns: 1`),
so reaching `afterTurns: 60` needs 61 calls to have a safety margin the
same way the existing tests do.

Add this import at the top of `game/src/core/battle/turn/TurnBattleSystem.test.ts`
(alongside the file's existing imports):

```ts
import { defineEnemy, enemyToCombatEntity } from '../../enemy/Enemy'
import { toTurnBattleParticipant } from '../../game/TurnBattleAdapter'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'
```

Add this test inside the existing `describe('TurnBattleSystem.resolveNextStep
boss trigger', ...)` block (after the existing 4 tests), reusing the
file's own `createCombatant`/`makeParticipant` helpers for the player
side exactly like every sibling test in this block already does, and a
local minimal `basic` skill literal (same shape as
`TurnBattleAdapter.test.ts`'s own `BASIC` fixture) for the boss side,
since `toTurnBattleParticipant()` requires one:

```ts
  it('fires real production boss enrage content (mortal_crocodile_enrage) after 60 turns', () => {
    const player = createCombatant({
      id: 'player',
      type: 'player',
      stats: { ...createBaseStats(), evasionRate: 0, dexterity: 0, criticalRate: 0, attack: 0 },
    })

    const bossEnemy = defineEnemy({
      id: 'test_boss',
      name: 'Test Boss',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1_000_000,
        attack: 10,
        attackSpeed: 1,
        attackRangeRanks: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0,
      },
      rewards: { techniqueInsight: 1, spiritStone: 1 },
      bossTrigger: { afterTurns: 60, buffDefinitionId: 'mortal_crocodile_enrage' },
    })

    const basicSkill = {
      id: 'fixture_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical' as const, multiplier: 1 },
      targeting: { shape: 'single' as const },
    }

    const enemyParticipant = toTurnBattleParticipant(enemyToCombatEntity(bossEnemy), 1, basicSkill)

    const battle: TurnBattle = {
      players: [makeParticipant('player', player, 10, 0)],
      enemies: [enemyParticipant],
      state: 'fighting',
    }

    const system = new TurnBattleSystem(new CombatSystem(new EventBus()), 10, TURN_BUFF_REGISTRY)

    for (let i = 0; i < 61; i++) {
      system.resolveNextStep(battle)
    }

    expect(enemyParticipant.bossTrigger?.firedAlready).toBe(true)
    expect(enemyParticipant.buffs.getAll().some((buff) => buff.id === 'mortal_crocodile_enrage')).toBe(true)
  })
```

If `game/src/core/enemy/Enemy.ts`'s real `enemyToCombatEntity()` requires
more `EnemyDefinition` fields than shown above (e.g. `EnemyStatInput` has
required fields not listed here), read `EnemyStatInput.ts` first and
adjust `statsInput` to match — the same caveat as Task 1's fixture.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm --prefix game run test -- TurnBattleSystem.test.ts`
Expected: PASS

- [ ] **Step 9: Run the full suite + type-check**

Run: `npm --prefix game run test && npm --prefix game run type-check`
Expected: PASS, 0 errors

- [ ] **Step 10: Commit**

```bash
git add game/src/data/buff/buffs.ts game/src/data/enemy/Enemies.ts game/src/data/enemy/Enemies.test.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(combat): boss enrage content for 3 realm-final-floor bosses"
```

---

### Task 4: Rewire talent passive-conversion off the legacy battle system

**Files:**
- Modify: `game/src/core/game/GameManager.ts:314-344` (the `passiveSystem`
  construction's `buffApplier` and `hpReader` callbacks — full current
  text below)
- Modify: `game/src/data/talent/Talents.test.ts:119-127` (existing
  validation, switch target registry)
- Modify: `game/src/core/game/GameManager.talentv4.qa.test.ts` (add one
  new test after the existing `INV-2`/`INV-3` tests, ~line 77)

**Interfaces:**
- Consumes: `this.turnBattle` (`GameManager.ts:448`,
  `private turnBattle: TurnBattle | null`), `TURN_BUFF_REGISTRY` (already
  imported at `GameManager.ts:210`), `TurnBuffSystem` (constructor-style
  apply, exact call shape below).
- Produces: no new public interface — this is a behavior fix inside an
  existing private construction. `passiveSystem`'s public shape is
  unchanged.

**IMPORTANT — read first:** this session's earlier
combat-runtime-separation work changed several `GameManager` accessors
to live getters. Before editing, read the CURRENT
`GameManager.ts:300-345` region in full to confirm `this.turnBattle` is
still the correct direct field access (not, by the time this task runs,
replaced by a `getTurnBattle()`-only pattern) — the plan's code below
assumes direct field access is still valid and used elsewhere in the same
file (confirmed at time of writing at `GameManager.ts:2469,2481,2725,2956,3011`
and others), but re-verify since this file changes frequently.

- [ ] **Step 1: Write the failing test**

`GameManager.talentv4.qa.test.ts` already has the exact template to
adapt (`INV-2`, lines 44-77): it drives `talent_passive_kiem_quang`
(maxStacks 10, `passiveConvertsTo: { buffId: 'kiem_vuc' }`) to threshold
by emitting 10 raw `'critical'` events on `manager.eventBus` — no need to
drive real combat RNG, since `PassiveSystem` listens on the event bus
directly. The ONLY thing wrong with `INV-2`/`INV-3` is they start a
LEGACY battle (`manager.startBattleWithPlayer(...)`) and assert against
the legacy `battle.playerBuffs` pool — which is exactly why they pass
today despite the bug: they never exercise the turn-based path real
gameplay actually uses. Add this new test directly after `INV-3` (same
file, same `makeWiredManager()` helper, same imports already present —
no new imports needed beyond what's already at the top of the file):

```ts
  it('INV-2b (turn-based): buffApplier applies to the real turn-based player pool, not just the legacy one', () => {
    const manager = makeWiredManager()
    const player = createDefaultPlayer()

    player.selectedTalentIds = ['kiem_quang']
    manager.setActivePlayer(player)
    manager.syncTalentCombatPassive(player)

    const stage = STAGES[0]!
    const stats = calculateStats(player.baseStats, player.modifiers)

    manager.startStage(player, stats, stage)

    const bus = manager.eventBus

    for (let i = 0; i < 10; i++) {
      bus.emit('critical', { type: 'critical', sourceId: 'player', targetId: 'enemy_1' })
    }

    const turnPlayer = manager.getTurnBattle()?.players[0]

    expect(turnPlayer).toBeDefined()
    expect(turnPlayer!.buffs.hasAny('kiem_vuc')).toBe(true)
  })
```

Note this test does NOT call `syncTalentCombatPassive` redundantly nor
need any fixed-step ticking — `startStage()` synchronously constructs
`this.turnBattle` with `players: [playerParticipant, ...]` already
populated (confirmed in this session's earlier combat-runtime-separation
survey of `GameManager.ts`'s battle-construction code), so
`manager.getTurnBattle()!.players[0]` is available immediately, before
any `intro`/`countdown` ticking.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix game run test -- GameManager.talentv4.qa.test.ts`
Expected: FAIL — `turnPlayer!.buffs.hasAny('kiem_vuc')` is `false` (the
bug: `buffApplier` still targets the legacy battle, which was never
started in this test, so the converted buff never reaches the
turn-based player's pool).

- [ ] **Step 3: Rewire the callbacks**

Current full text (`GameManager.ts:314-344`):

```ts
readonly passiveSystem = new PassiveSystem(
  this.eventBus,
  this.skillManager,
  this.skillSystem,
  // Talent v4 (spec 2026-09-03 §3.3 E2) — buffApplier: apply buff
  // "bùng nổ" của passiveConvertsTo lên PLAYER trong trận hiện tại
  // (pool của player, source = player; ngoài trận thì bỏ qua —
  // passive combat chỉ chạy trong trận).
  (buffId) => {
    const battle = this.battleSystem.getBattle()
    const definition = this.buffRegistry.get(buffId)

    if (!battle || !definition) {
      return
    }

    const buffs = new BuffSystem(battle.playerBuffs)
    buffs.apply(definition, battle.player, battle.player, this.buffRegistry)
  },
  // hpReader — HP ratio của player entity trong trận; ngoài trận thì
  // undefined (passiveCondition coi như thông qua).
  () => {
    const battle = this.battleSystem.getBattle()

    if (!battle || battle.player.maxHp <= 0) {
      return undefined
    }

    return battle.player.currentHp / battle.player.maxHp
  },
)
```

Replace with (targeting the turn-based battle instead of legacy):

```ts
readonly passiveSystem = new PassiveSystem(
  this.eventBus,
  this.skillManager,
  this.skillSystem,
  // Talent v4 (spec 2026-09-03 §3.3 E2) — buffApplier: apply the
  // passiveConvertsTo "burst" buff to the PLAYER in the current battle.
  // Rewired 2026-09-07 (Phase A2) from the legacy real-time battle to
  // the turn-based one — the legacy battleSystem does not run during
  // real gameplay, so this previously never fired (silent gap, see
  // docs/superpowers/specs/2026-09-07-phase-a2-buff-content-wiring-design.md).
  (buffId) => {
    const player = this.turnBattle?.players[0]

    if (!player) {
      return
    }

    let definition: TurnBuffDefinition | undefined

    try {
      definition = TURN_BUFF_REGISTRY.get(buffId)
    } catch {
      definition = undefined
    }

    if (!definition) {
      return
    }

    new TurnBuffSystem(player.buffs).apply(definition, player.entity, player.entity, TURN_BUFF_REGISTRY)
  },
  // hpReader — player entity's HP ratio in the current turn-based
  // battle; undefined outside battle (passiveCondition treats this as
  // pass-through). Rewired alongside buffApplier, same reason.
  () => {
    const player = this.turnBattle?.players[0]

    if (!player || player.entity.maxHp <= 0) {
      return undefined
    }

    return player.entity.currentHp / player.entity.maxHp
  },
)
```

Confirm `TurnBuffDefinition` and `TurnBuffSystem` are already imported in
`GameManager.ts` (both are used elsewhere in the file per this plan's
survey — `TurnBuffSystem` at the formation-buff site shown in this task's
Global Constraints reference, `TurnBuffDefinition` as a type at the same
site) before adding new imports; add them only if genuinely missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix game run test -- GameManager.talentv4.qa.test.ts`
Expected: PASS

- [ ] **Step 5: Update `Talents.test.ts`'s validation target**

Current (`Talents.test.ts:119-127`, plus its imports):

```ts
import { buffs } from '../buff/buffs'
// ...
it('mọi passiveConvertsTo.buffId tham chiếu tồn tại trong BuffRegistry data', () => {
  const buffIds = new Set(buffs.map((buff) => buff.id))

  for (const skill of TALENT_PASSIVE_SKILLS) {
    if (skill.passiveConvertsTo) {
      expect(buffIds.has(skill.passiveConvertsTo.buffId)).toBe(true)
    }
  }
})
```

Replace the import and the test body to validate against the registry
actually consulted at runtime:

```ts
import { TURN_BUFF_REGISTRY } from '../buff/TurnBuffRegistry'
// ...
it('mọi passiveConvertsTo.buffId tham chiếu tồn tại trong TURN_BUFF_REGISTRY', () => {
  for (const skill of TALENT_PASSIVE_SKILLS) {
    if (skill.passiveConvertsTo) {
      expect(() => TURN_BUFF_REGISTRY.get(skill.passiveConvertsTo!.buffId)).not.toThrow()
    }
  }
})
```

Remove the `import { buffs } from '../buff/buffs'` line only if nothing
else in the file still uses `buffs` — check before deleting.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm --prefix game run test -- Talents.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full suite + type-check + build**

Run: `npm --prefix game run test && npm --prefix game run type-check && npm --prefix game run build`
Expected: PASS, 0 errors, build succeeds

- [ ] **Step 8: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/data/talent/Talents.test.ts game/src/core/game/GameManager.talentv4.qa.test.ts
git commit -m "fix(combat): talent passive-conversion buffs now apply during real turn-based combat"
```

---

## Verification

After all 4 tasks are complete:

- [ ] Full suite: `npm --prefix game run test` — all green, no
  regressions in `TurnBuffRegistry.test.ts` (buff count grew by 3),
  `Enemies.test.ts`, `Talents.test.ts`, `TurnBattleAdapter.test.ts`,
  `TurnBattleSystem.test.ts`.
- [ ] `npm --prefix game run type-check` — 0 errors.
- [ ] `npm --prefix game run build` — succeeds.
- [ ] No P14 (visual/Playwright) verification is required for this plan
  — every change here is data/logic, no rendering, animation, or user
  interaction changed. If a reviewer disagrees because the boss enrage
  buff is player-visible in a tooltip somewhere, escalate rather than
  silently adding a P14 pass — the spec's Testing Strategy section
  explicitly scoped this out.
- [ ] Confirm roadmap.md's Phase A2 row can be marked done once this
  lands, and that A5 (boss enrage content — which this plan actually
  IS) and the A1+A2→C1 dependency note stay accurate.
