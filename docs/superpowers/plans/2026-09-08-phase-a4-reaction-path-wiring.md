# Phase A4 — Wire Pháp Tu Reaction Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player who unlocks the Pháp Tu Reaction Path keystone actually gets the reaction special/ultimate in turn-based combat, using the real 2-element-pick mechanism instead of the inert placeholder branch.

**Architecture:** Pure wiring — populate an already-built optional constructor parameter (`reactionPathPool`) with its real value, add one resolver branch (mirroring an existing one) so a Reaction-path player's participant gets the already-authored static skill content, and move `reaction_empowerment`'s buff definition into the one array every other turn-based buff already originates from.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-phase-a4-reaction-path-wiring-design.md`

## Global Constraints

- **This plan assumes `docs/superpowers/plans/2026-09-07-phase-a3-special-ultimate-content.md`
  has already executed** — Task 2 of this plan edits
  `GameManager.resolvePlayerSpecialUltimate()`, which that plan's Task 3
  introduces. If it hasn't executed yet when this plan starts, add
  `resolvePlayerSpecialUltimate()` fresh in Task 2, incorporating both
  the Thuần-element branch (from A3) and the Reaction-path branch (this
  plan) together, rather than blocking.
- **No rebalancing.** `REACTION_EMPOWERMENT_BUFF`'s numbers move file but
  don't change value.
- Run tests from `game/`: `cd game && npx vitest run <path>`.

---

## Task 1: Move `reaction_empowerment` into `buffs.ts` (fix the registry-miss crash)

**Files:**
- Modify: `game/src/data/buff/buffs.ts`
- Modify: `game/src/data/skill/TurnReactionPathSkills.ts`
- Modify: `game/src/data/skill/TurnReactionPathSkills.test.ts`
- Test: `game/src/data/buff/buffs.registryConsistency.test.ts` (extend if it exists — this repo has a test by this name per earlier codegraph output; otherwise add assertions to an existing `buffs.ts` test file)

**Interfaces:**
- Consumes: `BuffDefinition` shape (`game/src/core/buff/BuffDefinition.ts`,
  same shape every other entry in `buffs.ts` uses).
- Produces: `TURN_BUFF_REGISTRY.get('reaction_empowerment')` resolves
  without throwing.

- [ ] **Step 1: Write the failing test**

```typescript
// game/src/data/buff/buffs.registryConsistency.test.ts — add to existing file
// (or a new test file colocated with buffs.ts if no such file exists —
// check first)
import { TURN_BUFF_REGISTRY } from './TurnBuffRegistry'

describe('reaction_empowerment (Phase A4)', () => {
  it('resolves through TURN_BUFF_REGISTRY without throwing', () => {
    expect(() => TURN_BUFF_REGISTRY.get('reaction_empowerment')).not.toThrow()
  })

  it('carries the authored reactionEffectPercent bonus', () => {
    const definition = TURN_BUFF_REGISTRY.get('reaction_empowerment')

    expect(definition.effects).toContainEqual({ type: 'statModifier', stat: 'reactionEffectPercent', percent: 0.25 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd game && npx vitest run src/data/buff/buffs.registryConsistency.test.ts -t "reaction_empowerment"`
Expected: FAIL — `TURN_BUFF_REGISTRY.get('reaction_empowerment')` throws
`TurnBuffRegistry: unknown buff id "reaction_empowerment"`.

- [ ] **Step 3: Add the definition to `buffs.ts`**

Read the end of `game/src/data/buff/buffs.ts` (the array closes with the
2 boss enrage entries added by A2, per `buffs.ts`'s current tail) and add
a new entry before the closing `]`:

```typescript
  {
    id: 'reaction_empowerment',
    name: 'Cộng Minh Phản Ứng',
    description: 'Cường hóa sát thương phản ứng nguyên tố N lượt (số liệu tune khi reaction turn-cutover).',
    polarity: 'buff',
    duration: 4,
    stackMode: 'refresh',
    effects: [{ type: 'statModifier', stat: 'reactionEffectPercent', percent: 0.25 }],
  },
```

(Same content as the old `REACTION_EMPOWERMENT_BUFF`, copied verbatim —
no rebalance.) Confirm `BuffDefinition`'s field names match exactly
(`duration` in real seconds for legacy entries generally, but this
buff's `duration: 4` was already authored as a turn-count-preserving
value directly on the `TurnBuffDefinition` — since it now becomes a
legacy `BuffDefinition` first, converted by `toTurnBuffDefinition()`
which passes `duration` straight through unchanged, `4` staying `4`
turns is correct and requires no unit conversion here).

- [ ] **Step 4: Remove the now-duplicate `REACTION_EMPOWERMENT_BUFF` export**

In `game/src/data/skill/TurnReactionPathSkills.ts`, delete the
`REACTION_EMPOWERMENT_BUFF` constant (lines 54-62) and its now-unused
`TurnBuffDefinition` import if nothing else in the file needs it.
`PHAP_TU_REACTION_ULTIMATE.appliesBuff.definitionId` already references
`'reaction_empowerment'` by string id — no change needed there, it now
resolves through `TURN_BUFF_REGISTRY` instead of the deleted constant.

- [ ] **Step 5: Update the test that imported the deleted export**

Read `game/src/data/skill/TurnReactionPathSkills.test.ts:37-48` (per the
survey, this is where `REACTION_EMPOWERMENT_BUFF` was covered) and
change its assertions to read the buff via `TURN_BUFF_REGISTRY.get('reaction_empowerment')`
instead of the deleted local export.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd game && npx vitest run src/data/buff/buffs.registryConsistency.test.ts src/data/skill/TurnReactionPathSkills.test.ts -t "reaction_empowerment"`
Expected: PASS

- [ ] **Step 7: Run the full existing `buffs.ts`/`TurnReactionPathSkills` test suites**

Run: `cd game && npx vitest run src/data/buff src/data/skill/TurnReactionPathSkills.test.ts`
Expected: All existing tests PASS.

- [ ] **Step 8: Commit**

```bash
git add game/src/data/buff/buffs.ts game/src/data/skill/TurnReactionPathSkills.ts game/src/data/skill/TurnReactionPathSkills.test.ts game/src/data/buff/buffs.registryConsistency.test.ts
git commit -m "fix(turn-combat): register reaction_empowerment in buffs.ts (was unreachable via TURN_BUFF_REGISTRY)"
```

---

## Task 2: Wire `reactionPathPool` + resolve Reaction Path as special/ultimate

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (`:2533`, `:3095` constructor sites; `resolvePlayerSpecialUltimate()` from A3 Task 3; new `getPhapTuReactionElement()` accessor near `getPhapTuThuanElement()` at `:500-514`)
- Test: extend `game/src/core/game/TurnBattleAdapter.test.ts` or `GameManager.talentv4.qa.test.ts` (whichever already covers `resolvePlayerSpecialUltimate`/`buildTurnBattle` per A3's plan — check first)
- Test: `game/src/core/battle/turn/TurnBattleSystem.test.ts` (extend existing Reaction Path coverage at `:1841-1891`)

**Interfaces:**
- Consumes: `REACTION_PATH_POOL`, `PHAP_TU_REACTION_SPECIAL`,
  `PHAP_TU_REACTION_ULTIMATE`, `REACTION_PATH_SPECIAL_ID` (all from
  `game/src/data/skill/TurnReactionPathSkills.ts`). A3's
  `resolvePlayerSpecialUltimate()` and `CHAIN_SKILL_IDS` (already
  imported per A3 Task 3).
- Produces: `GameManager.getPhapTuReactionElement(): ElementType | undefined`.

- [ ] **Step 1: Write the failing test for `reactionPathPool` wiring**

```typescript
// game/src/core/battle/turn/TurnBattleSystem.test.ts — extend existing
// Reaction Path describe block (around line 1841)
it('resolves 2 real distinct elements when constructed with the real production pool (A4)', () => {
  // Reuse this describe block's existing fixture pattern, but construct
  // TurnBattleSystem with REACTION_PATH_POOL (imported from
  // '../../../data/skill/TurnReactionPathSkills') instead of a
  // hand-built 2-entry test pool, to prove the real production content
  // works end to end, not just the mechanism in the abstract.
})
```

Read the existing describe block in full first — reuse its exact
fixture/assertion style rather than inventing a new one.

- [ ] **Step 2: Run test to verify it fails or passes trivially**

Run: `cd game && npx vitest run src/core/battle/turn/TurnBattleSystem.test.ts -t "real production pool"`
This test may already pass even before Task 2's `GameManager.ts` changes
(it constructs `TurnBattleSystem` directly, bypassing `GameManager`) —
if so, it's still valuable as regression coverage; note in the commit
message that this step primarily documents/locks the real-content case
rather than proving a bug fix.

- [ ] **Step 3: Wire the real pool into both `GameManager.ts` constructor sites**

Add the import:
```typescript
import { REACTION_PATH_POOL, PHAP_TU_REACTION_SPECIAL, PHAP_TU_REACTION_ULTIMATE } from '../../data/skill/TurnReactionPathSkills'
```

At `GameManager.ts:2533`, change:
```typescript
      undefined, // reactionPathPool — not populated until roadmap A4
```
to:
```typescript
      REACTION_PATH_POOL,
```

At `GameManager.ts:3095`, apply the identical change.

- [ ] **Step 4: Add `getPhapTuReactionElement()`**

Add near `getPhapTuThuanElement()` (`GameManager.ts:500-514`):

```typescript
  /**
   * Phase A4 — hành ĐẦU TIÊN tìm thấy có node `reaction_path_unlock_<el>`
   * đã mua (mỗi element có instance riêng của node này, nhưng nội dung
   * Reaction Path là GLOBAL — element nào unlock không ảnh hưởng nội
   * dung, chỉ cần biết CÓ hay KHÔNG). undefined = chưa unlock Reaction
   * Path ở bất kỳ hành nào.
   */
  getPhapTuReactionElement(): ElementType | undefined {
    if (!this.activePlayer) {
      return undefined
    }

    for (const element of Object.keys(CHAIN_SKILL_IDS) as ElementType[]) {
      const level = this.activePlayer.nodeLevels[`reaction_path_unlock_${element}`]

      if (level !== undefined && level > 0) {
        return element
      }
    }

    return undefined
  }
```

- [ ] **Step 5: Add the Reaction Path branch to `resolvePlayerSpecialUltimate()`**

Locate `resolvePlayerSpecialUltimate()` (added by A3 Task 3 Step 7 — if
it doesn't exist yet per this plan's Global Constraints, write it fresh
with both branches together). Add the Reaction Path check as the FIRST
branch, before the Thuần-element fallback:

```typescript
  private resolvePlayerSpecialUltimate(
    player: PlayerData,
  ): { special?: TurnSkillDefinition; ultimate?: TurnSkillDefinition } {
    if (player.cultivationPath !== 'phap_tu') {
      return {}
    }

    if (this.getPhapTuReactionElement() !== undefined) {
      return { special: PHAP_TU_REACTION_SPECIAL, ultimate: PHAP_TU_REACTION_ULTIMATE }
    }

    const element = this.getPhapTuThuanElement() ?? 'fire'
    const [, specialId, ultimateId] = CHAIN_SKILL_IDS[element]

    const specialSkill = this.skillManager.get(specialId)
    const ultimateSkill = this.skillManager.get(ultimateId)

    return {
      special: specialSkill
        ? toTurnSkillDefinition(specialSkill, this.skillSystem.getEffectiveSkill(specialSkill))
        : undefined,
      ultimate: ultimateSkill
        ? toTurnSkillDefinition(ultimateSkill, this.skillSystem.getEffectiveSkill(ultimateSkill))
        : undefined,
    }
  }
```

(The body below the Reaction Path check is A3 Task 3 Step 7's existing
code, shown here only so the insertion point is unambiguous — do not
duplicate it if it already exists, just add the new `if` block above it.)

- [ ] **Step 6: Write the failing end-to-end test**

```typescript
// extend whichever test file A3's plan used for resolvePlayerSpecialUltimate coverage
it('gives a Reaction Path player the reaction special/ultimate, not an element default (A4)', () => {
  // Build a minimal PlayerData with cultivationPath: 'phap_tu' and
  // nodeLevels: { reaction_path_unlock_fire: 1 } (reuse this test
  // suite's existing player-fixture builder).
  // Act: manager.startBattleWithPlayer(player, stats, enemy) or
  // equivalent production entry point this test file already uses.
  // Assert: manager.getTurnBattle()!.players[0]!.special?.skill.id === 'phap_tu_reaction_special'
  // Assert: manager.getTurnBattle()!.players[0]!.ultimate?.skill.id === 'phap_tu_reaction_ultimate'
})

it('casting the reaction ultimate applies reaction_empowerment without crashing (A4)', () => {
  // Same setup, force the player to cast their ultimate through the
  // real engine, assert 'reaction_empowerment' appears in
  // turnBattle.players[0].buffs.getAll() afterward (proves Task 1's
  // registry fix, not just that the id string is correct).
})
```

- [ ] **Step 7: Run test to verify it fails, then implement until it passes**

Run: `cd game && npx vitest run -t "Reaction Path player"`
Expected: FAIL before Steps 3-5, PASS after.

- [ ] **Step 8: Run the full existing `GameManager`/`TurnBattleSystem`/`TurnBattleAdapter` test suites**

Run: `cd game && npx vitest run src/core/game/GameManager src/core/battle/turn/TurnBattleSystem.test.ts src/core/game/TurnBattleAdapter.test.ts`
Expected: All existing tests PASS.

- [ ] **Step 9: Type-check and build**

Run: `cd game && npx vue-tsc --noEmit && npm run build`
Expected: No new errors.

- [ ] **Step 10: Commit**

```bash
git add game/src/core/game/GameManager.ts game/src/core/battle/turn/TurnBattleSystem.test.ts
git commit -m "feat(turn-combat): wire Phap Tu Reaction Path pool + resolver (Phase A4)"
```

---

## Final Verification

- [ ] Full suite: `cd game && npx vitest run`
- [ ] Type-check: `cd game && npx vue-tsc --noEmit`
- [ ] Build: `cd game && npm run build`
- [ ] No P14 trigger — no new render surface introduced.
