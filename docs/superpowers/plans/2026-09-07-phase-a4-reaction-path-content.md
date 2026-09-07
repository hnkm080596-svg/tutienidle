# Phase A4 — Reaction Path Content Implementation Plan

> **For agentic workers:** Inline execution (opencode — no subagent
> dispatch). TDD task-by-task, steps use checkbox syntax.

**Goal:** Make the Reaction Path hidden path actually playable: unlock
gating → participant slots → empowerment buff resolvable → pool wired.

**Spec:** `docs/superpowers/specs/2026-09-07-phase-a4-reaction-path-content-design.md`

## Global Constraints

- Number-preserved units (A1/A2/A3 precedent).
- No chain-gating port; no `ELEMENT_REACTIONS` changes.
- Gating reads `player.nodeLevels` (§6.8 authority), NOT skillManager
  learned-state.
- P15 English comments; `TurnBuffRegistry.get()` throws — keep lookups
  guarded where content could drift.

---

## Task 1: `reaction_empowerment` in `buffs.ts` (registry resolvable)

**Files:** `game/src/data/buff/buffs.ts` (+ test count in buffs.test.ts)

- [ ] Add `reaction_empowerment` BuffDefinition (duration 4, refresh,
  statModifier reactionEffectPercent +25%) with cross-link comment to
  `REACTION_EMPOWERMENT_BUFF` (twin-until-C1 precedent).
- [ ] Update `buffs.test.ts` count 51 → 52.
- [ ] Test FAIL (no id) → add → PASS. Commit.

## Task 2: Gating + slot population in GameManager

**Files:** `game/src/core/game/GameManager.ts`,
`game/src/core/game/GameManager.reactionPath.test.ts` (new)

- [ ] Test: player with `nodeLevels['reaction_path_unlock_fire'] = 1` +
  path phap_tu → `resolvePlayerSpecialUltimate` equivalent wiring yields
  marker special/ultimate ids on the participant. Without → element
  chain trio. Drive through `buildTurnBattle()` via `startStage`/battle
  start helpers (reuse talentv4.qa fixture pattern).
- [ ] Implement `hasReactionPathUnlock(player)` (any
  `reaction_path_unlock_*` nodeLevels > 0) + branch in
  `resolvePlayerSpecialUltimate()` returning
  `PHAP_TU_REACTION_SPECIAL`/`PHAP_TU_REACTION_ULTIMATE` (import from
  TurnReactionPathSkills).
- [ ] FAIL → implement → PASS. Commit.

## Task 3: Wire `REACTION_PATH_POOL` into both TurnBattleSystem sites

**Files:** `game/src/core/game/GameManager.ts`,
`game/src/core/battle/turn/TurnBattleSystem.reactionPathE2E.test.ts`
(new)

- [ ] E2E test: reaction-awakened player battles a dummy; resolve until
  the special casts → TWO distinct elemental hits land on the same turn
  (hp delta > single-hit max, and no throw); ultimate cast →
  `hasAny('reaction_empowerment')` true + `recomputeEffectiveStats`
  folds +25% (assert via `TurnBuffSystem(player.buffs).getActiveModifiers()`
  containing reactionEffectPercent). Pool wiring FAIL first (marker
  0-hit) → pass `REACTION_PATH_POOL` at both sites → PASS.
- [ ] Full suite + type-check. Commit.

## Final Verification

- Full suite, type-check, build. No P14.
