# Phase A6 — Turn-Based Buff/Debuff Status Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn-based combat shows real buff/debuff status icons + tooltips (with turn-count duration) on players and enemies — today it shows none, because the existing presentation pipeline is fed only by the dead legacy engine.

**Architecture:** Port `BattleSystem.snapshotStatuses()`/`emitStatusVfxDiff()`'s diff-and-emit logic to read `TurnBuffPool` instead of `BuffPool`, reusing the exact same 3 event names and payload shapes (`status_vfx_attached`/`updated`/`removed`) so `CombatVfxSpawner`/`CombatScene`/`StatusTooltip` need zero code changes — only a tooltip text-format update (seconds → turns).

**Tech Stack:** TypeScript, Vitest, Phaser (presentation layer untouched).

**Spec:** `docs/superpowers/specs/2026-09-08-phase-a6-buff-duration-presentation-design.md`

## Global Constraints

- **No changes to `CombatVfxSpawner`, `StatusTooltip`'s show/hide logic,
  or `CombatScene`'s event handlers** beyond the one tooltip text format
  in Task 2. They already consume plain event payloads.
- **Full cutover for the tooltip's duration unit label** — turns, not a
  seconds/turns conditional. No dual-mode shim.
- Run tests from `game/`: `cd game && npx vitest run <path>`.

---

## Task 1: Turn-based status snapshot + diff-emit

**Files:**
- Create: `game/src/core/battle/turn/TurnStatusPresentationEvents.ts`
- Modify: `game/src/core/game/GameManager.ts` (`updateBattleFixedStep()`'s `'fighting'` branch, `:3526-3563`)
- Test: `game/src/core/battle/turn/TurnStatusPresentationEvents.test.ts` (new file)

**Interfaces:**
- Consumes: `TurnBuffPool.getAll(): TurnBuff[]` (`TurnBuffPool.ts:17-19`,
  already exists). `TurnBuff` fields: `id`, `sourceId`, `targetId`,
  `polarity`, `hidden`, `duration`, `remainingTurns`, `stacks`
  (`TurnBuffTypes.ts:109-127`). `TurnBattle.players`/`.enemies:
  TurnBattleParticipant[]`, each with `.buffs: TurnBuffPool`,
  `.entity: CombatEntity` (`.id`, `.alive`). `TURN_BUFF_REGISTRY.get(id)`
  / `.has(id)` if available — confirm at Step 3 whether
  `TurnBuffRegistry` interface exposes `has()`; if not, wrap `get()` in
  try/catch instead (matching the guard style already used elsewhere in
  this codebase for unknown-id lookups, e.g. the A2 QA-found
  `TurnBossTrigger` guard fix).
- Produces: `snapshotTurnStatuses(battle: TurnBattle): Map<string, TurnStatusSnapshotEntry>`,
  `diffAndEmitTurnStatusVfx(eventBus: EventBus, battle: TurnBattle, before: Map<string, TurnStatusSnapshotEntry>): void`.

- [ ] **Step 1: Write the failing tests**

Read `game/src/core/battle/legacy/BattleSystem.ts:1564-1678`
(`snapshotStatuses`/`emitStatusVfxDiff`) in full immediately before
writing this — the tests below assert the turn-based port matches that
logic's shape exactly, field-for-field.

```typescript
// game/src/core/battle/turn/TurnStatusPresentationEvents.test.ts (new file)
import { describe, it, expect, vi } from 'vitest'
import { snapshotTurnStatuses, diffAndEmitTurnStatusVfx } from './TurnStatusPresentationEvents'
import { TurnBuffPool } from './TurnBuffPool'
import { TurnBuffSystem } from './TurnBuffSystem'
// import this test family's existing TurnBattle/TurnBattleParticipant/
// CombatEntity fixture builders — check TurnBattleSystem.test.ts or
// TurnActionPresentationEvents.test.ts (if it exists) for the pattern,
// reuse it rather than hand-rolling a new one.

describe('snapshotTurnStatuses', () => {
  it('keys entries by targetId:buffId:sourceId, reading remainingTurns/stacks/polarity/permanent', () => {
    // Arrange: a TurnBattle fixture with one player buff applied via
    // TurnBuffSystem.apply() (real apply, not a hand-built TurnBuff, so
    // the shape matches production exactly).
    // Act: snapshotTurnStatuses(battle)
    // Assert: map has exactly 1 entry keyed `player:<buffId>:<sourceId>`
    // with the expected stacks/remainingTurns/polarity/permanent fields.
  })
})

describe('diffAndEmitTurnStatusVfx', () => {
  it('emits status_vfx_attached for a buff present in after but not before', () => {
    const eventBus = { emit: vi.fn() } as any // or this test family's real EventBus fixture
    // Arrange: battle with 1 buff on the player; before = empty Map.
    diffAndEmitTurnStatusVfx(eventBus, battle, new Map())
    expect(eventBus.emit).toHaveBeenCalledWith('status_vfx_attached', expect.objectContaining({
      type: 'status_vfx_attached',
      targetId: 'player',
    }))
  })

  it('emits status_vfx_updated when stacks or remainingTurns change', () => {
    // Arrange: before has the buff at stacks:1; after (real battle state)
    // has stacks:2. Assert status_vfx_updated fires with stacks:2.
  })

  it('emits status_vfx_removed with reason "expired" when a living entity loses a buff', () => {
    // Arrange: before has the buff; after (battle state) has it removed,
    // entity still alive. Assert reason: 'expired'.
  })

  it('emits status_vfx_removed with reason "target_dead" when the buff holder died', () => {
    // Arrange: before has the buff on an enemy; after has the enemy
    // removed from battle.enemies or entity.alive === false.
    // Assert reason: 'target_dead'.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/core/battle/turn/TurnStatusPresentationEvents.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement `TurnStatusPresentationEvents.ts`**

```typescript
// game/src/core/battle/turn/TurnStatusPresentationEvents.ts
import type { EventBus } from '../../events/EventBus'
import type { TurnBattle, TurnBattleParticipant } from './TurnBattleSystem'
import type { TurnBuffPolarity } from './TurnBuffTypes'
import { TURN_BUFF_REGISTRY } from '../../../data/buff/TurnBuffRegistry'

// Phase A6 — port of legacy BattleSystem.snapshotStatuses()/
// emitStatusVfxDiff() (BattleSystem.ts:1564-1678), reading TurnBuffPool
// instead of BuffPool. Reuses the SAME event names/payload field names
// (status_vfx_attached/updated/removed) so CombatVfxSpawner/CombatScene
// need zero changes — see spec Component 1.

export interface TurnStatusSnapshotEntry {
  targetId: string
  dotType: string
  stacks: number
  remainingTurns: number
  polarity: TurnBuffPolarity
  permanent: boolean
}

function collectParticipantStatuses(
  participant: TurnBattleParticipant,
  snapshot: Map<string, TurnStatusSnapshotEntry>,
): void {
  for (const buff of participant.buffs.getAll()) {
    if (buff.hidden) {
      continue
    }

    snapshot.set(`${participant.id}:${buff.id}:${buff.sourceId}`, {
      targetId: participant.id,
      dotType: buff.id,
      stacks: buff.stacks,
      remainingTurns: buff.remainingTurns,
      polarity: buff.polarity,
      permanent: buff.duration === Infinity,
    })
  }
}

export function snapshotTurnStatuses(battle: TurnBattle): Map<string, TurnStatusSnapshotEntry> {
  const snapshot = new Map<string, TurnStatusSnapshotEntry>()

  for (const player of battle.players) {
    collectParticipantStatuses(player, snapshot)
  }

  for (const enemy of battle.enemies) {
    collectParticipantStatuses(enemy, snapshot)
  }

  return snapshot
}

function buffNameFor(id: string): string {
  try {
    return TURN_BUFF_REGISTRY.get(id).name
  } catch {
    return id
  }
}

export function diffAndEmitTurnStatusVfx(
  eventBus: EventBus,
  battle: TurnBattle,
  before: Map<string, TurnStatusSnapshotEntry>,
): void {
  const after = snapshotTurnStatuses(battle)

  for (const [key, current] of after) {
    const previous = before.get(key)

    if (!previous) {
      eventBus.emit('status_vfx_attached', {
        type: 'status_vfx_attached',
        statusInstanceId: key,
        targetId: current.targetId,
        dotType: current.dotType,
        stacks: current.stacks,
        durationSeconds: current.remainingTurns,
        buffName: buffNameFor(current.dotType),
        polarity: current.polarity,
        permanent: current.permanent,
      })
    } else if (current.stacks !== previous.stacks || current.remainingTurns >= previous.remainingTurns) {
      eventBus.emit('status_vfx_updated', {
        type: 'status_vfx_updated',
        statusInstanceId: key,
        stacks: current.stacks,
        durationSeconds: current.remainingTurns,
      })
    }
  }

  for (const [key, previous] of before) {
    if (after.has(key)) {
      continue
    }

    const allParticipants = [...battle.players, ...battle.enemies]
    const holder = allParticipants.find((participant) => participant.id === previous.targetId)
    const alive = holder?.entity.alive ?? false

    eventBus.emit('status_vfx_removed', {
      type: 'status_vfx_removed',
      statusInstanceId: key,
      reason: alive ? 'expired' : 'target_dead',
    })
  }
}
```

Confirm `TurnBuffPolarity`'s exact export name/location against
`TurnBuffTypes.ts` before finalizing the import — the spec's survey used
this name but re-verify at implementation time since this file is
actively edited by parallel plans (A1/A4).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/core/battle/turn/TurnStatusPresentationEvents.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into `GameManager.updateBattleFixedStep()`**

Read the current `'fighting'` branch (`GameManager.ts:3526-3563`) in
full first — line numbers will have shifted since other plans (A0/A4)
may have landed first. Add the "before" snapshot immediately at the top
of the branch (before `tickPacing()` runs) and the diff-emit call at the
same point `emitTurnBattleEntitySnapshot(...)` already fires:

```typescript
        } else if (this.turnBattle.state === 'fighting') {
          const statusesBefore = snapshotTurnStatuses(this.turnBattle)

          // ...existing manual-mode/pacing logic, UNCHANGED...

          emitTurnBattleEntitySnapshot(this.eventBus, this.turnBattle)
          diffAndEmitTurnStatusVfx(this.eventBus, this.turnBattle, statusesBefore)
        }
```

Add the import:
```typescript
import { snapshotTurnStatuses, diffAndEmitTurnStatusVfx } from '../battle/turn/TurnStatusPresentationEvents'
```

- [ ] **Step 6: Write the integration test**

```typescript
// extend an existing GameManager combat-integration test file, or add
// game/src/core/game/GameManager.turnStatusVfx.test.ts if none fits
it('emits status_vfx_attached when a real skill hit applies an ailment during a turn-based fight (A6)', () => {
  // Reuse a production Pháp Tu player fixture (an element with a real
  // appliesAilment basic attack, per A1's PHAP_TU_BASICS content) and a
  // spy/collector on the eventBus for 'status_vfx_attached'. Drive the
  // battle via manager.startBattleWithPlayer(...) + repeated
  // updateBattleFixedStep() calls (reuse however this test suite already
  // advances turn-based battles in existing tests) until the ailment
  // lands. Assert the event fired with the correct targetId/dotType.
})
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd game && npx vitest run -t "status_vfx_attached"`
Expected: PASS

- [ ] **Step 8: Run the full existing `GameManager`/turn-based test suites**

Run: `cd game && npx vitest run src/core/game/GameManager src/core/battle/turn`
Expected: All existing tests PASS.

- [ ] **Step 9: Commit**

```bash
git add game/src/core/battle/turn/TurnStatusPresentationEvents.ts game/src/core/battle/turn/TurnStatusPresentationEvents.test.ts game/src/core/game/GameManager.ts
git commit -m "feat(turn-combat): emit buff status VFX events from the live turn battle (Phase A6)"
```

---

## Task 2: Turn-count duration text in the status tooltip

**Files:**
- Modify: `game/src/game/scenes/combat/combat-status-tooltip.ts` (`:85-91`, `formatDetail()`)
- Test: `game/src/game/scenes/combat/combat-status-tooltip.test.ts`

**Interfaces:**
- Consumes: `StatusTooltipData.remainingTime` (unchanged field name,
  now populated with a turn count instead of seconds when the data
  originates from Task 1's turn-based emitter).
- Produces: `formatDetail()`'s non-permanent branch text changes from
  `` `×${stacks} · ${N}s` `` to `` `×${stacks} · ${N} lượt` ``.

- [ ] **Step 1: Write the failing test**

Read `combat-status-tooltip.test.ts` in full first for its existing
`formatDetail`/`show()` coverage and fixture pattern.

```typescript
// combat-status-tooltip.test.ts — extend existing file
it('formats non-permanent duration as turn count (Phase A6)', () => {
  const tooltip = new StatusTooltip(mockScene) // reuse this file's existing scene fixture
  tooltip.show(0, 0, 'test-status', { name: 'Bỏng', polarity: 'debuff', stacks: 2, remainingTime: 3 })

  // Reuse this file's existing pattern for asserting on the rendered
  // detail text (likely inspecting the mock scene's `add.text` calls).
  expect(/* rendered detail text */).toBe('×2 · 3 lượt')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/game/scenes/combat/combat-status-tooltip.test.ts -t "turn count"`
Expected: FAIL — current output is `'×2 · 3s'`.

- [ ] **Step 3: Update `formatDetail()`**

In `combat-status-tooltip.ts:85-91`:

```typescript
  private formatDetail(data: StatusTooltipData): string {
    if (data.permanent) {
      return `×${data.stacks} · vĩnh viễn`
    }

    return `×${data.stacks} · ${Math.max(0, Math.ceil(data.remainingTime ?? 0))} lượt`
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd game && npx vitest run src/game/scenes/combat/combat-status-tooltip.test.ts`
Expected: PASS (including any pre-existing test asserting the old `"Ns"`
format — update that assertion to the new `"N lượt"` text, since this is
a deliberate full-cutover text change, not a regression).

- [ ] **Step 5: Commit**

```bash
git add game/src/game/scenes/combat/combat-status-tooltip.ts game/src/game/scenes/combat/combat-status-tooltip.test.ts
git commit -m "fix(combat-ui): show buff duration as turn count, not seconds (Phase A6)"
```

- [ ] **Step 6: P14 visual verification**

Open the game via playwright-cli, start a real turn-based stage fight
with a Pháp Tu build (any element with a real `appliesAilment` basic
attack), let an ailment land on the enemy, and visually confirm: (a) a
status icon appears anchored to the enemy sprite, (b) hovering/tapping
it shows a tooltip with the buff name and `"N lượt"` duration text
(not seconds), (c) the icon disappears when the buff expires or the
enemy dies. Also verify a buff applied to the player (e.g. the Trận
Pháp formation buff, or a boss enrage buff from A2 if reachable within
test time) appears in the player's own status row near the HUD. Record
pass/fail + screenshot before considering this plan complete.

---

## Final Verification

- [ ] Full suite: `cd game && npx vitest run`
- [ ] Type-check: `cd game && npx vue-tsc --noEmit`
- [ ] Build: `cd game && npm run build`
- [ ] P14 pass recorded for Task 2 Step 6.
