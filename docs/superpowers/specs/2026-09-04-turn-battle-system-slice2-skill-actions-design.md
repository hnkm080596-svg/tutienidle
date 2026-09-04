# Turn Battle System — Slice 2: 3-Skill Action Model — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written

## 1. Motivation

Slice 1 (`TurnBattleSystem.ts`, merged) only has basic attack via
`CombatSystem.resolveActionHit()` — no skill selection at all. This
slice adds real skill actions, replacing the free-form N-slot loadout
model entirely with a much smaller, symmetric **3-skill model**
decided this session (superseding the earlier 6-slot loadout draft
from the same brainstorming pass, which is not carried forward).

## 2. Decision: 3-Skill Model (locked, 2026-09-04)

Every combatant — **player and enemy alike, fully symmetric** — has
exactly 3 skill references for the whole battle:

- `basicSkillId` — no cooldown, no resource cost, always available.
  Functions as the guaranteed fallback action (equivalent to Slice 1's
  hardcoded basic attack, now data-driven).
- `specialSkillId` — cooldown in turns, may have a resource cost.
- `ultimateSkillId` — cooldown in turns (longer), may have a higher
  resource cost.

Turn action selection priority: ultimate (if off cooldown and
affordable) → special (if off cooldown and affordable) → basic
(always available). This replaces the earlier "pick from up to 6
loadout slots" model — no player choice of which slot to use, only
which skill sits in which of the 3 fixed roles (a content/data
decision, not a runtime one).

### 2.1 Pháp Tu Thuần (single-element mage)

Confirmed against existing code: `GameManager.getPhapTuThuanElement()`
+ `CHAIN_SKILL_IDS[thuanElement]` already gate a per-element skill
chain (A→B→C→D→E) for Pháp Tu players who committed to "Lập Đạo
Thuần" (single-element specialization). The 3-skill model maps
directly onto this existing mechanic: a Thuần mage's 3 skill roles are
3 skills from their one committed element's chain. No new "book" or
element-switching mechanic is needed for this build.

### 2.2 Deferred: Book mechanic + Reaction path (roadmap only, not this slice)

The user's original idea (a "book" slot holding multiple sub-skills,
picked at cast time, plus a situational AI that reads board state to
trigger elemental reactions) is **not part of Slice 2**. It belongs to
a future **hidden Reaction path** for Pháp Tu — structurally analogous
to Kiếm Tu's hidden Bạt Kiếm Thuật path (a secondary route unlocked
separately from the mainline path, not exposed to every player). This
is recorded in the roadmap as a deferred future item; Slice 2's 3-skill
model does not need to accommodate it structurally beyond "some future
build might have `specialSkillId` resolve to something other than a
single fixed skill" — not designed now.

## 3. Scope

**In scope:**
- Extend `TurnBattleParticipant` (or equivalent) with `basicSkillId`,
  `specialSkillId`, `ultimateSkillId` and per-slot cooldown state
  (`specialCooldownTurns`/`remainingSpecialCooldownTurns`,
  `ultimateCooldownTurns`/`remainingUltimateCooldownTurns`).
  Cooldown values are converted from the existing real-seconds
  `Skill.cooldown` field **1:1 as a turn count** — same numeric value,
  no rebalance (matches the policy already applied to every other
  seconds→turns conversion in this rework).
- Resource-cost gating: reuse `Skill.resourceType`/`Skill.cost` as-is,
  checked against the entity's existing resource fields on
  `CombatEntity` (`currentMp`, `currentSwordIntent`, `currentMomentum`,
  etc. — already present, no new fields needed).
- Turn action selection: ultimate → special → basic priority, as §2.
- Damage resolution: pure-damage skills only (no buff/debuff — same
  boundary as originally scoped, still holds under the 3-skill model).
  Reuses `CombatSystem.resolveActionHit()` (Slice 1's existing call)
  with the chosen skill's damage/targeting instead of the hardcoded
  physical basic-attack info.
- Targeting: reuses `areaFor()`/`isCellInShape()` (pure functions,
  already extended with cross/row/column shapes, merged to master) for
  AOE skills; single-target skills use Slice 1's existing
  `selectTarget()`.
- API shape: replace `runToCompletion()` with a step-oriented
  `resolveNextStep(battle): TurnStepResult` (locked in the
  [overview spec](2026-09-04-battlesystem-replacement-slices-overview.md)
  §3.3) — this slice is where that change happens.
- Symmetric application: the mechanism (given any participant's 3
  skill refs, resolve their turn) works identically for player and
  enemy — no player-only special-casing in `TurnBattleSystem`.

**Explicitly out of scope:**
- Book mechanic, element-switching, situational reaction AI — deferred
  per §2.2.
- Buff/debuff application (→ Slice 3, `TurnBuffSystem`).
- Content migration: deciding which real skill ID fills `basicSkillId`/
  `specialSkillId`/`ultimateSkillId` for every existing build (5 Pháp
  Tu elements × Thuần chain, Kiếm Tu, Thể Tu, Phàm Nhân) is **separate
  data work**, not part of this runtime plan. The plan's tests use
  fixture skills; real content mapping happens later, tracked
  separately in the roadmap.
- Enemy content migration: existing `Enemy.specialAttacks[]` data (used
  by live `BattleSystem.ts`) is not converted to the 3-skill shape in
  this slice — that is real content work across every enemy definition
  in `Enemies.ts`, sized for its own future item. This slice only
  proves the engine-side mechanism is symmetric; it does not migrate
  existing enemy data.
- Node Tree / Element Slot / ProgressionNode redesign — user confirmed
  (2026-09-04) this is a real future need ("đổi cả node tree để phù
  hợp") but explicitly deferred, tracked in the roadmap, not designed
  here. Today's learn/upgrade system continues to produce `Skill`
  objects; only which 3 of them are "in play" during a turn-based
  battle changes.
- `cast_time`/`channel`/`attack_speed`/`attack_speed_cast` execution
  policies — still deferred per the already-locked "only `cooldown` or
  no-cooldown" scope boundary from the original Slice 2 brainstorm.

## 4. What This Slice Proves

`TurnBattleSystem` can resolve a full battle where every combatant
picks from exactly 3 fixed skill roles each turn, respecting cooldown
(in turns) and resource cost, using the existing damage/targeting
pipeline — with the calling convention already in its final
step-oriented shape for every slice after this one.

## 5. Roadmap Additions (recorded here, to be copied into the roadmap doc)

- **Pháp Tu Reaction Path (hidden path, like Bạt Kiếm Thuật)** — book
  mechanic (multiple sub-skills in one slot, picked at cast time) +
  situational Element AI (reads board state/existing debuffs to choose
  a sub-skill that completes a reaction, e.g. auto-casting Thủy into an
  existing Hỏa debuff to trigger "Bốc Hơi"). Not designed, not
  scheduled — flagged for a future dedicated brainstorming session.
- **Node Tree / Element Slot redesign for the 3-skill model** — current
  progression system (learn/upgrade via `ProgressionNode`) stays
  structurally unchanged for now; user confirmed this needs to change
  eventually to match 3-skill roles cleanly, deferred to a future
  session.
- **Enemy content migration** (`Enemy.specialAttacks[]` → 3-skill
  shape) — real data work across every enemy definition, separate from
  this slice's engine mechanism.
