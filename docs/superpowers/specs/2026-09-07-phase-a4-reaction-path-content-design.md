# Phase A4 — Reaction Path Content (Wiring the Hidden Path) Design

**Status:** Approved design, ready for implementation planning (written
2026-09-07, inline with execution per delegated authority).

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A4 — "Reaction
Path nội dung thật (pool element skill + ultimate %)". Depends on A1
(shipped): `TurnReactionManager` + the per-target ailment/reaction hook
exist. Reuses the Reaction Path scaffolding shipped in Future Systems
Task 4/5 (`TurnReactionPathSkills.ts`, marker id, distinct-pair selector)
— nothing there is rebuilt.

**Reference:** `docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`.

## Goals

1. A Pháp Tu player who purchased any `reaction_path_unlock_<tag>` node
   actually gets the hidden path's special (2 random distinct elemental
   hits) and ultimate (self-buff +25% `reactionEffectPercent`) populated
   into their turn battle participant.
2. The `reaction_empowerment` buff resolves through `TURN_BUFF_REGISTRY`
   (today it is a known-gap: the definition exists only as a turn-native
   `TurnBuffDefinition` in `TurnReactionPathSkills.ts`, so the
   `appliesBuff` registry lookup would throw).
3. `GameManager` passes `REACTION_PATH_POOL` as the
   `TurnBattleSystem`'s `reactionPathPool` (both constructor sites) — the
   pool param has been `undefined` since Slice 6, making the marker
   special a 0-hit placeholder.

## Non-Goals

- No new reaction pairings, no rebalancing `ELEMENT_REACTIONS` or the
  empowerment percentages (25% is the authored value; playtest later).
- No chain-gating port (per A3's locked divergence).
- No UI for the hidden path's skill bar beyond what `TurnCombatSkillBar`
  already renders from participant slots (special/ultimate are already
  rendered generically).

## Component 1: `reaction_empowerment` registry entry

Add a legacy `BuffDefinition` entry to `game/src/data/buff/buffs.ts` with
id `reaction_empowerment` (values copied 1:1 from
`REACTION_EMPOWERMENT_BUFF`: duration 4, stackMode refresh, statModifier
`reactionEffectPercent` +25%). `TURN_BUFF_REGISTRY` picks it up through
the standard converter — closing the roadmap mục 9.8 known gap. Keep the
turn-native constant in `TurnReactionPathSkills.ts` as the named export
tests assert against (same "twin definitions until C1" precedent as
A2's boss enrage buffs), with a comment cross-linking the pair.

## Component 2: Gate + populate the Reaction Path slots

`GameManager.resolvePlayerSpecialUltimate()` gains a Reaction Path
branch: if `player.nodeLevels` shows any `reaction_path_unlock_*` node
purchased (level > 0), the player's special/ultimate slots become the
Reaction Path's marker skills (`PHAP_TU_REACTION_SPECIAL` /
`PHAP_TU_REACTION_ULTIMATE`) instead of the element chain's
special/ultimate. This mirrors `getPhapTuThuanElement()`'s nodeLevels
read pattern (PlayerData is the authority; no Skill template needed —
the unlock node's `unlocksSkillIds` path stays as-is for learnSkill
bookkeeping but the combat wiring keys off nodeLevels, consistent with
§6.8's "mọi hiệu lực suy ra từ (registry, nodeLevels)").

Rationale for slot REPLACEMENT (not addition): the Reaction Path is a
hidden alternate path — the engine's participant supports exactly one
special + one ultimate slot, and the original design (Future Systems
spec §3) frames reaction skills as the player's special/ultimate once
awakened.

## Component 3: Wire the pool

`GameManager` passes `REACTION_PATH_POOL` as the 5th argument
(`reactionPathPool`) at both `new TurnBattleSystem(...)` production call
sites. The engine's marker interception (`declared.isReactionPath` → two
distinct elemental picks, each rolled through `resolveActionHit`) is
already tested and live — it just needs the pool to exist. The marker's
`markerNoPool` 0-hit fallback remains as the defensive backstop for
participants built without the pool (tests).

## Testing Strategy

- Unit: converter-free — Reaction Path markers are native definitions,
  assert gating logic (nodeLevels read) via a small GameManager
  integration test: purchase the unlock node → participant special id is
  `phap_tu_reaction_special`; without the node → element chain
  special/ultimate.
- Integration: battle where the participant's special casts the marker
  → two distinct elemental hits land (assert through
  `TURN_BUFF_REGISTRY`-resolved pool + engine, mirroring A1/A2's
  end-to-end convention), and the ultimate cast results in
  `actor.buffs.hasAny('reaction_empowerment')` with the +25% stat
  actually folded into `reactionEffectPercent` via
  `recomputeEffectiveStats`.
- Full suite + type-check + build. No P14 trigger (no new render
  surface; the skills render through the existing skill bar generically).
