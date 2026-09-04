# Turn-Based Combat — Future Systems (Node Tree, Reaction Path, Gauge-Delta Buff, Channel Skill, Party) — Design Spec

Date: 2026-09-04
Status: Approved (design)

## 1. Motivation

These 5 items were explicitly deferred to "future specs" throughout
the turn-based combat rework
([roadmap](../../game/docs/turn-based-combat-roadmap.md), "Ngoài phạm
vi" table). **Per explicit user instruction (2026-09-04)**, all 5 are
brainstormed and specced together in one document — a deliberate,
one-time departure from the "one spec per system" convention, same as
the two prior consolidations this session (Combat Fairness Guards,
Turn-Based Combat Completion). None of the 5 items below has an
implementation plan yet — this spec locks design only; each gets its
own plan when its turn comes (not consolidated into one mega-plan,
unlike Completion — these 5 are independent enough in timing that
bundling their plans wouldn't help the way it did for Completion's
tightly-sequenced items).

## 2. Node Tree / Element Slot / ProgressionNode Redesign

### 2.1 Current system (surveyed 2026-09-04)

`ProgressionNode` (`game/src/core/progression/ProgressionNode.ts`) is
generic infra shared by every path. Per Pháp Tu element,
`buildBranch()` (`PhapTuNodes.ts:111-254`) generates ~9-10 node
definitions: 1 root, 1 power node (10 levels), 2 growth nodes (cadence,
mechanic; 5 levels each), a Pure-vs-Reaction keystone (mutually
exclusive), and 2-3 specializations per keystone side (5 levels each).
Nodes currently unlock skills into the OLD N-slot loadout
(`GameManager.purchaseNode()` → `learnSkill()` → `equipToSlot()`,
`GameManager.ts:1006-1040`) — this call chain is retired by Slice 6
regardless of this spec, since the loadout model itself is gone.

### 2.2 Decisions (locked, 2026-09-04)

- **5-skill chain (`CHAIN_SKILL_IDS`) redesigned down to exactly 3
  skills per element** — real content redesign (not just a mechanism
  change), matching the 3-skill model's `basic`/`special`/`ultimate`
  roles directly. The 2 dropped chain positions per element are gone,
  not repurposed as passive-only nodes. Actual per-element skill
  content (which of the old 5 abilities becomes which of the 3 new
  roles, or whether entirely new abilities are designed) is deferred
  to this item's own future implementation plan — this spec locks the
  *shape* (3 skills, not 5), not the specific abilities.
- **Keystone (Pure vs Reaction) is kept** as the mainline Node Tree's
  one meaningful branch choice, but the Reaction side no longer builds
  its own in-tree specializations — choosing Reaction instead
  **unlocks the hidden Reaction Path system** (§3). Pure side keeps its
  existing specialization-node shape (unaffected by this redesign
  beyond the 5→3 chain change).
- **Cadence growth node repurposed** to grant flat `speed`/`dexterity`
  bonus instead of the old real-time attack-cadence concept (which has
  no turn-based meaning — `cooldownReduction` is already retired per
  the Stat System conversion, and `speed` already IS "acts more often"
  in ATB terms). Same node slot, same level curve, new effect target.
- The power node, root node, and general `ProgressionNode` role
  taxonomy (`root`/`growth`/`keystone`/`specialization`) are unchanged
  — this redesign is scoped to the 3 items above, not a rewrite of the
  progression infra itself.

## 3. Pháp Tu Reaction Path (Hidden Path)

### 3.1 Decisions (locked, 2026-09-04)

**No "book" mechanic** (the original idea from Slice 2's brainstorm —
1 slot containing N sub-skills, chosen at cast time) — dropped in favor
of a simpler, AI-free design:

- **`special` role**: each cast fires **2 randomly-selected DISTINCT
  elements** (drawn without replacement from whichever elements the
  player has unlocked) — guarantees every `special` cast has some
  chance of triggering an elemental reaction (never rolls the same
  element twice). No manual choice UI, no AI decision logic needed —
  auto and manual modes behave identically (both are the same random
  roll), eliminating the entire "situational reaction AI" problem the
  original book idea would have required.
- **`basic` role**: unaffected by this path — a normal fixed single
  skill, same as every other build (per the standing 3-skill model).
- **`ultimate` role**: applies a self-buff for N turns that boosts the
  damage of any reaction triggered during that window (exact %/N
  values are content/balance decisions, deferred to implementation) —
  does not deal direct damage itself. Forms a deliberate 3-part loop:
  `special` gambles on a reaction proc, `ultimate` is a burst window
  that pays off successful procs.
- Unlocked via the Node Tree's Reaction keystone (§2.2) — choosing it
  swaps the player's `special`/`ultimate` skill content for this hidden
  path's mechanics instead of Pure's deterministic single-element
  skills.

### 3.2 What this replaces

The original Slice 2 brainstorm's "book" and "situational AI" ideas
(recorded in
[Slice 2's design spec §5](2026-09-04-turn-battle-system-slice2-skill-actions-design.md))
are both superseded by this simpler design — no book UI, no AI logic,
ever needs to be built.

## 4. Gauge-Delta Buff Effect Type

### 4.1 Decision (locked, 2026-09-04)

A new `TurnBuffTypes.ts` effect kind, e.g.
`{type: 'gaugeDelta', percentOfMax: number}` — **fires once,
instantly**, at the moment the buff is applied (inside the same
`appliesBuff` resolution Slice 3 already wires — no new tick loop,
no duration/remainingTurns semantics needed for this effect kind
specifically, though the buff carrying it may still have a cosmetic
duration for VFX/tooltip purposes). `percentOfMax` is a signed
percentage of `ActionGauge.GAUGE_MAX` added directly to
`actor.actionGauge` (positive = Haste, advances the target toward
its next turn; negative = Slow, pushes it back), clamped to
`[0, GAUGE_MAX]`. Distinct from `statModifier` on `speed` (which is
already a sustained fill-RATE change, not an instant position jump) —
the two effect kinds solve different problems and can coexist on the
same buff if content ever wants both.

## 5. Channel Skill Support (Bạt Kiếm Thuật)

### 5.1 Decisions (locked, 2026-09-04)

Bạt Kiếm Thuật splits into **2 separate skills** instead of one
real-time hold-to-charge skill:

- **"Thế"** (Posture) — occupies the `basic` role, auto-used (no
  cooldown, standard basic-attack behavior), and **also accumulates a
  dedicated resource** each time it's used (reusing the
  `TurnResourcePool`/`ResourceTurnHook` mechanism already built in
  Slice 4 — no new resource primitive needed).
- **"Trảm"** (Strike) — occupies the `special` role. Two ways to fire:
  (a) manually cast by the player/AI at any time once resource-gated
  readiness is met (normal `special` cooldown+resource-cost rules,
  same as every other build), or (b) **auto-fires** the instant the
  Thế-built resource reaches its cap — reusing Slice 2's existing
  priority-selection pattern (special > basic when ready), just gated
  on resource-full instead of the usual cooldown-only readiness check.

### 5.2 New engine primitive: charging state (locked, 2026-09-04)

Per explicit user requirement: **casting a charge-type skill puts the
actor into a "charging" state that blocks its own normal action
selection for X turns**, deliberately mimicking a hard-CC block from
the player-facing/mechanical perspective (no counter/follow-up-attack
triggers can fire off it during the window) — **but this is
self-imposed, not enemy-imposed CC**, and must NOT feed into Bá Thể's
`consecutiveHardCcTurns` counter (Bá Thể exists specifically to guard
against unfair enemy-inflicted lockout — a voluntary charge windup is
not that, and must never accidentally trigger Bá Thể's "clear all
CC" behavior mid-charge). Design:

- New field on `TurnBattleParticipant`: `chargingTurnsRemaining?: number`.
- Set when a charge-type skill (a new `TurnSkillDefinition` flag, e.g.
  `chargeTurns?: number`) is cast, instead of resolving immediately.
- At the CC-check step in `resolveActorTurn()` (Slice 3's existing
  branch point), a **separate** check runs BEFORE the CC branch: if
  `chargingTurnsRemaining > 0`, decrement it, skip normal action
  selection for this turn (same effective outcome as `ccBlocked`, but
  tracked through a wholly separate field so Bá Thề's counter logic
  never sees it), and if it just reached 0, resolve the charged skill's
  actual effect automatically this turn instead of normal action
  selection.
- This is a generic primitive (any future skill can flag itself as a
  charge-type skill with its own `chargeTurns`), not Bạt Kiếm
  Thuật-specific — Kiếm Tu's Trảm is simply the first (and currently
  only) content using it.

## 6. Party/Companion System

### 6.1 Decisions (locked, 2026-09-04)

- **`TurnBattle.player: TurnBattleParticipant` (singular) becomes
  `TurnBattle.players: TurnBattleParticipant[]`** — the structural
  redesign the Deep Review session already flagged as necessary
  (roadmap Deep Review §1). Main character is `players[0]` by
  convention, companions fill the rest, up to 4 total (per the
  original party spec's "main + up to 4" cap — recruitment/UI for
  actually acquiring companions stays out of this combat-engine spec's
  scope, per the standing "party has its own spec later" boundary,
  narrowed here to just what the combat engine itself needs).
- **Turn order: one shared ATB queue with enemies** — every party
  member is just another `TurnBattleParticipant` in the same
  `TurnQueue`/`resolveNextTurn()` mechanism already built (Slice 1),
  ticking interleaved with enemies purely by each unit's own `speed`.
  No "party turn block"/faction-grouped turn concept — this requires
  zero new primitives, `TurnQueue` already treats every participant
  identically regardless of side.
- **Targeting already generalizes**: `selectTarget(actor, opposingSide: TurnBattleParticipant[])`
  (Slice 1) already takes an array — an enemy's `opposingSide` becomes
  `battle.players` (was already an implicit array-of-1 before), a
  party member's `opposingSide` stays `battle.enemies`. No targeting
  redesign needed beyond the type change itself.
- **Defeat condition**: battle is lost when `battle.players.every(p => !p.entity.alive)`
  — symmetric with the existing victory condition
  (`battle.enemies.every(...)`). A downed companion doesn't end the
  battle; the main character dying doesn't either, as long as any
  party member still lives and can eventually defeat every enemy.

### 6.2 Explicitly out of scope (stays deferred)

Recruitment flow, companion acquisition/UI, per-companion
progression/leveling, companion skill CONTENT (each companion still
gets the same 3-skill model per §above, but which specific
basic/special/ultimate each companion build uses is content work, not
engine work) — all still belong to Party's own future spec, this
section only locks what `TurnBattleSystem` itself needs to
structurally support N player-side units.

## 7. Sequencing Notes

These 5 items have no forced ordering relative to each other (unlike
Turn-Based Combat Completion's items, which had real dependencies) —
each can be planned and implemented independently, whenever its turn
comes:

- **Node Tree** (§2) has no engine dependency — it's UI + data
  reshaping, can start once the 3-skill content redesign for each
  element (needed regardless, for Slice 6) exists.
- **Reaction Path** (§3) depends on Node Tree's keystone existing
  (§2.2) as its unlock gate, and depends on `TurnBuffSystem` (merged)
  for the ultimate's damage-boost buff.
- **Gauge-Delta** (§4) is a small, independent `TurnBuffTypes.ts`
  addition — no dependency on anything in this spec.
- **Channel Skill** (§5) depends on Slice 4's `TurnResourcePool`
  (merged) — otherwise independent.
- **Party** (§6) is the largest structural change (touches
  `TurnBattle`'s core shape) — best done whenever convenient, but
  every other slice/system built so far assumed `player` singular, so
  this item's actual implementation will require re-touching most of
  `TurnBattleSystem.ts`'s call sites (`battle.player` → iterate
  `battle.players`) — a real, non-trivial migration, not a
  drop-in addition, flagged honestly here rather than understated.

## 8. What This Spec Does Not Cover

Actual implementation plans (each item gets its own when scheduled),
exact per-element skill content for the Node Tree's 3-skill redesign
(§2.2), exact %/turn-count balance numbers for Reaction Path's
ultimate (§3.1) or Channel's resource cap (§5.1), and Party's
recruitment/UI/content work (§6.2).
