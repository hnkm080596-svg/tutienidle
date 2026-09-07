# Phase A2 — Boss Enrage Content + Talent Passive-Conversion Rewiring

**Status:** Approved design, ready for implementation planning.

**Roadmap context:** `game/docs/roadmap.md` mục 0, Phase A2. A2 was originally
described as "buff content migrate + wire registry thật vào TurnBattleSystem."
Survey during this brainstorm found the registry wiring is **already done**
(`GameManager.ts` wires `TURN_BUFF_REGISTRY` into both `TurnBattleSystem`
constructor sites, 2026-09-06/07) — the roadmap's "0 consumer" note was
stale and has been corrected in the same session as this doc. What actually
remains is narrower and more concrete than the original one-line
description: two independent pieces of work, described below.

**Reference:** combat mechanics referenced here (turn-based state machine,
`TurnBuffSystem`, P17 runtime/logic/presentation split) are governed by
`docs/superpowers/specs/2026-09-07-turn-based-combat-reference.md`. This
spec does not change anything in that document's scope — no new combat
mechanic, no Break/Toughness-style system, no per-path elemental
requirement. It populates and fixes existing mechanisms only.

## Goals

1. Give the 3 realm-final-floor bosses (the only structurally "hard
   stops" before a realm transition, within the Trúc Cơ beta cap) working
   enrage content on the turn-based engine.
2. Fix a silent wiring gap: talent passive-conversion buffs
   (`passiveConvertsTo`) currently never fire during real (turn-based)
   combat because the code that applies them still targets the legacy
   real-time battle system, which isn't running during actual gameplay.

## Non-Goals

- **Equipment-granted buffs.** Explicitly decided out of scope this
  session: equipment is a stats-only source. `Affix` gets no new field.
  If wanted later, it is a separate, future brainstorm.
- **Extending Tribulation's multi-phase-HP mechanic** to more bosses.
  Multi-phase HP thresholds (`TribulationPhase[]`) are not being ported to
  the turn-based engine at all — only the simpler "boss enrage after N
  turns → one buff" pattern (`TurnBossTrigger`), matching the existing
  roadmap decision "Boss enrage content bằng buff thủ công (KHÔNG
  phase-system)."
- **New elemental/Break/toughness mechanics.** Out of scope per the
  combat reference doc's Design Principle 4 — not touched here.
- **Deleting `battle/legacy/`** (roadmap C1). That is blocked on this
  work (A2) plus A1, not part of it — legacy code stays in place after
  this ships, just with fewer live call sites feeding it.

## Component 1: Boss Enrage Content (3 bosses)

### Current state

`Enemies.ts:1441-1455` has one existing example, `FLOOD_DRAGON_ENRAGE`
(the Trúc Cơ tầng-10 boss, "Giao Sủng" / `foundation_ferocious_flood_dragon_whelp`),
typed as legacy `BossEnrage { afterSeconds: number; buff: BuffDefinition }`.
It is explicitly commented as a template ("boss mẫu... làm hình mẫu") that
was never extended to other bosses. It is consumed only by the legacy
engine's `BattleSystem.updateEnrage()` — the turn-based engine has no
reader for `Enemy.enrage` at all today.

The turn-based engine already has the mechanism this needs:
`TurnBossTrigger { afterTurns: number; buffDefinitionId: string;
firedAlready: boolean }` on `TurnBattleParticipant.bossTrigger`
(`TurnBattleSystem.ts:50-54,101`). Every turn, if a participant has a
`bossTrigger` that hasn't fired and `battle.totalTurnsElapsed` has reached
`afterTurns`, the engine looks up `buffDefinitionId` in the injected
`TurnBuffRegistry`, applies it via `TurnBuffSystem`, and marks it fired
(`TurnBattleSystem.ts:666-677`). This is already tested and live — it is
simply never populated with real data for any enemy today.

### The 3 bosses in scope

Confirmed via `Stages.ts` (each is the `bossEnemyId` of realm's floor 10,
the beta's structural end-of-realm checkpoint):

| Realm | Stage | Boss enemy id |
|---|---|---|
| Phàm Nhân | `mortal_dong_10` (Động 10) | `mortal_ferocious_giant_crocodile` |
| Luyện Khí | `qi_refining_abyssal_pool` (Quật 10) | `ferocious_flood_serpent` |
| Trúc Cơ | `foundation_floor_10` (Màn 3.10) | `foundation_ferocious_flood_dragon_whelp` (already has the legacy template) |

### Design

1. Add a `TurnBuffDefinition`-typed enrage buff per boss to
   `game/src/data/buff/` (or co-located with enemy data, following
   whatever the implementer finds is the established pattern for
   enemy-specific buff definitions — check before assuming). Content
   template, following the existing Giao Sủng shape (same field values
   for Giao Sủng itself — this is a type change, not a content change,
   for that one boss):
   - `polarity: 'buff'`, `duration: Infinity`, `stackMode: 'replace'`
   - Effects: `statModifier` on `attack` and `speed` (percent-based,
     matching Giao Sủng's +50%/+20% as the reference magnitude — exact
     per-boss tuning is an implementation/balance-pass decision, not a
     brainstorm decision, since these are 3 different realms with
     different power baselines)
   - Trigger: 60 turns (carrying over the existing "X giây → X lượt,
     number preserved" policy already locked for buff duration
     conversion — see roadmap.md's "Buff turn-count policy" note)
2. Add an `enrage` (or equivalently named) field to the relevant `Enemy`
   data entries carrying `{ afterTurns, buffDefinitionId }`, or reuse
   existing `Enemy.bossTrigger`-shaped data if such a field already
   exists closer to the turn-based side — implementer confirms exact
   current `Enemy` type shape before deciding where this lives.
3. Wherever enemy participants are constructed for the turn-based engine
   (spawn path in `TurnBattleSystem.ts`/`GameManager.ts` — implementer
   locates by reading the existing `spawnEnemy`/participant-construction
   code, since exact line numbers will have shifted since the
   combat-runtime-separation work), populate
   `participant.bossTrigger = { afterTurns, buffDefinitionId, firedAlready: false }`
   when the enemy data has enrage content, mirroring how other optional
   participant fields (skills, resources) are already populated
   conditionally.
4. Remove/retire `FLOOD_DRAGON_ENRAGE`'s legacy `BossEnrage` typing once
   the turn-based version is live for that boss, OR leave the legacy
   field in place if `battle/legacy/` still reads it for some reachable
   path — implementer verifies whether legacy `battleSystem` is still
   reachable in production before deciding whether the old field is now
   dead code safe to delete or must stay for a still-live legacy path.

## Component 2: Talent Passive-Conversion Rewiring

### Current state (the bug)

`GameManager.ts` constructs `passiveSystem` (`:314-337`) with a
`buffApplier` callback used for Talent v4's "stack hits max → convert to
a burst buff" mechanic (`passiveConvertsTo` on `Skill`, consumed by
`PassiveSystem.tryConvertAtThreshold()`). That callback does:

```ts
(buffId) => {
  const battle = this.battleSystem.getBattle()   // legacy real-time battle
  const definition = this.buffRegistry.get(buffId) // legacy registry

  if (!battle || !definition) {
    return
  }

  const buffs = new BuffSystem(battle.playerBuffs)  // legacy BuffSystem
  buffs.apply(definition, battle.player, battle.player, this.buffRegistry)
}
```

`this.battleSystem` is the legacy engine, imported from `battle/legacy/`.
It is not started for real (turn-based) gameplay. `passiveSystem.tick(deltaSeconds)`
runs on every real tick regardless (`GameManager.ts:3427`, immediately
before `updateBattleFixedStep`), so `tryConvertAtThreshold` does get
called during real combat — but its `buffApplier` always hits the
`if (!battle || !definition) return` guard silently, because
`this.battleSystem.getBattle()` returns null/stale. **The player-facing
symptom: talent-triggered burst buffs never actually apply in real
gameplay today**, with no error, no log — a true P17-adjacent silent gap
(logic reads the wrong system's state instead of failing loudly).

The `hpReader` callback (`GameManager.ts:~335`, used for HP-gated passive
conditions) has the same shape of bug — reads from legacy `battleSystem`.

### Design

1. Change `buffApplier` to target the turn-based battle: read
   `this.getTurnBattle()`/`this.turnBattle` (implementer confirms exact
   current accessor — this session's combat-runtime-separation work
   changed several of these to live getters), find the player
   `TurnBattleParticipant`, and apply the buff via `TurnBuffSystem` +
   `TURN_BUFF_REGISTRY` instead of legacy `BuffSystem`/`buffRegistry`.
   No dual-target/fallback-to-legacy shim — this project's locked policy
   for buff-system conversions is a full cutover, not a back-compat
   layer (see the BuffSystem turn-duration conversion precedent).
2. Change `hpReader` the same way — read HP off the turn-based player
   participant/entity, not the legacy battle's player.
3. `Talents.test.ts` currently validates `passiveConvertsTo.buffId`
   values against the legacy `BuffRegistry`/`buffs.ts` data
   (`Talents.test.ts:119-124`). Since `TURN_BUFF_REGISTRY` is a 1:1
   `id`-preserving conversion of the same `buffs.ts` array
   (`toTurnBuffDefinition()`), these ids should already resolve
   correctly — but the test should validate against `TURN_BUFF_REGISTRY`
   directly (the registry actually consulted at runtime now), not the
   legacy one, so a future edit to either registry can't silently drift
   from what's tested.
4. New test coverage (did not exist before, because the gap was never
   exercised): a real end-to-end style test that drives a turn-based
   battle until a passive stack hits its `maxStacks` threshold and
   asserts the conversion buff is actually present on the player's
   `TurnBuffPool` afterward — proving the fix closes the gap, not just
   that the callback was rewired.

## Testing Strategy

- **Component 1**: extend `TurnBattleSystem.test.ts`'s existing
  boss-trigger test pattern (already covers the mechanism generically)
  with one test per new/migrated boss enrage buff — enrage does not fire
  before `afterTurns`, fires exactly at `afterTurns`, `firedAlready`
  prevents re-application.
- **Component 2**: unit test for the rewired `buffApplier`/`hpReader`
  callbacks in isolation (mock/fixture turn battle), plus the new
  integration-style test described above (Component 2, point 4) that
  proves the previously-silent gap is closed.
- Full suite + type-check + build, per this project's standing P3/E-series
  verification requirements. No P14 (visual) trigger here — this is pure
  data/logic, no rendering/animation/interaction change.

## Open Items For The Implementation Plan (not decided here)

- Exact `TurnBuffDefinition` id/name/description copy for the 2 new boss
  enrage buffs (Phàm Nhân, Luyện Khí) — content-writing detail, not a
  design decision.
- Exact percent values for the 2 new bosses' `attack`/`speed` modifiers —
  balance-tuning detail; the plan should default to reusing Giao Sủng's
  +50%/+20% as a starting point (already an established in-game
  magnitude) unless the plan author has a specific reason to diverge, and
  should flag this as "starting point for playtesting" the same way the
  earlier animation-timing plan did.
- Where exactly `Enemy`'s new enrage-trigger field lives in the type
  hierarchy, and whether `FLOOD_DRAGON_ENRAGE`'s old legacy field is
  deleted or left dormant — both are implementer-verified-at-write-time
  facts (per Component 1, point 4), not open design questions.
