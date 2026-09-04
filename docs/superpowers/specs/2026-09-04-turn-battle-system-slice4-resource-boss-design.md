# Turn Battle System — Slice 4: Resource / Boss Triggers — Design Spec

Date: 2026-09-04
Status: Approved (design), plan not yet written

## 1. Motivation

3 Foundation primitives (Milestone 1, already merged/tested) were
reserved for this slice: `ResourceTurnHook.ts`, `MomentumBreak.ts`,
`BossTurnTriggers.ts`. Survey + brainstorming this session found
`MomentumBreak.ts`'s state model ambiguous against 2 different existing
concepts (`currentMomentum`/`MAX_MOMENTUM` resource-gating Ultimate vs.
`currentBreakGauge`/`breakGaugeMax` enemy stagger) — resolved by the
user dropping the Break mechanic entirely (§2). This slice therefore
wires only 2 of the 3 primitives.

## 2. Decision: Drop MomentumBreak entirely (locked, 2026-09-04)

`MomentumBreak.ts` is not used by this slice, and not deferred for
later — the mechanic itself is cut from the redesign. Per the user:
*"bỏ hẳn cơ chế break, boss giờ cũng chỉ là quái với các mechanic riêng
từ buff"* (drop the Break mechanic entirely; a boss is now just an
enemy with its own mechanics driven by buffs). Boss-specific behavior
(what used to be "enrage") is now expressed as: after N total turns
elapsed, the boss applies a buff to itself via `TurnBuffSystem` (Slice
3) — no separate stagger/vulnerability-window system. `MomentumBreak.ts`
stays in the codebase (already merged, tested, harmless dead code) but
nothing in `TurnBattleSystem` calls it.

## 3. Scope

**In scope:**

### 3.1 `ResourceTurnHook` wiring (regen/decay)

`TurnBattleParticipant` gains an optional resource pool:

```typescript
interface TurnResourcePool {
  values: Record<string, number>
  deltasPerTurn: TurnResourceDelta[]
}
```

`TurnBattleParticipant.resources?: TurnResourcePool`. At the START of a
participant's own turn (same point Slice 3 ticks buffs), if `resources`
is set, `applyTurnStartDeltas(resources.values, resources.deltasPerTurn)`
replaces `resources.values`. This proves the mechanism generically —
it does NOT read/write `CombatEntity`'s real named resource fields
(`currentHoaThe`/`currentThoThe`/`currentKimThe`/`currentSwordIntent`/
`currentKiemYTemp`) — mapping real Pháp Tu/Kiếm Tu resource regen rules
onto this pool is separate content work (§5).

This tick is **unconditional** — it runs even if the participant ends
up CC-blocked this turn (a stunned entity's resource still regenerates/
decays; CC only blocks taking an action, matching how Slice 3's buff
tick is also unconditional).

### 3.2 `BossTurnTriggers` wiring (buff-based boss mechanic)

`TurnBattle` gains an optional global turn counter:
`totalTurnsElapsed?: number` (optional so no existing test object
literal needs updating — defaults to 0 via `??` at the increment site,
same pattern Slice 2 used for `basic`/`special`/`ultimate` staying
optional). Incremented by 1 at the top of every `resolveNextStep()`
call, right after an actor is resolved — this counts total actions
resolved across the whole battle (any actor's turn), matching
`BossTurnTriggers.ts`'s own doc comment ("không phải lượt riêng của
boss").

`TurnBattleParticipant` gains an optional boss trigger config:

```typescript
interface TurnBossTrigger {
  afterTurns: number
  buffDefinitionId: string
  firedAlready: boolean
}
```

`TurnBattleParticipant.bossTrigger?: TurnBossTrigger`. At the start of
the configured participant's own turn (same point as §3.1, also
unconditional of CC block), if `!bossTrigger.firedAlready` and
`isTurnTriggerReady({ afterTurns: bossTrigger.afterTurns },
battle.totalTurnsElapsed)` and a `TurnBuffRegistry` was provided
(Slice 3's existing constructor param), the configured buff is applied
to the participant itself via `TurnBuffSystem.apply()`, and
`firedAlready` is set `true` (one-shot — `isTurnTriggerReady()` is a
stateless `>=` check, so the caller owns not re-firing every
subsequent turn once the threshold has passed).

**Ordering within `resolveNextStep()`** (extends Slice 3's ordering):
resolve actor → increment `totalTurnsElapsed` → tick buffs (Slice 3) →
tick resource pool (§3.1) → check boss trigger (§3.2) → CC check
(Slice 3) → (if alive and not CC-blocked) select/resolve action as
before.

**Explicitly out of scope (deferred, tracked in roadmap):**
- `MomentumBreak.ts` wiring — dropped entirely, not deferred (§2).
- Real content: mapping Pháp Tu/Kiếm Tu resource regen rules onto
  `CombatEntity`'s real named fields, and real boss enrage data
  (`TribulationPhase.ts`'s `BossEnrage`) into `TurnBossTrigger`/real
  `TurnBuffDefinition`s. This slice's tests use fixture pools/triggers,
  same pattern as Slices 2-3.
- Any change to `BattleSystem.ts`, `HazardZoneSystem.ts`,
  `TribulationPhase.ts`, or `GameManager.ts`.

## 4. What This Slice Proves

A participant can passively regenerate/decay a named resource pool and
a designated boss-like participant can self-apply a real turn-based
buff once a global turn-count threshold passes — both hooked into the
same "at the holder's own turn" timing convention already established
by Slice 3's buff tick and CC check.

## 5. Roadmap Note (to be copied into the roadmap doc)

- **MomentumBreak dropped** — `MomentumBreak.ts` (Foundation, Milestone
  1) is no longer part of the plan for any future slice; boss/stagger
  mechanics are buff-driven only.
- **Resource content migration** — mapping real Pháp Tu (Hỏa/Thổ/Kim
  Thế) and Kiếm Tu (Kiếm Ý/Kiếm Thế) regen/decay rules onto
  `TurnResourcePool` — deferred, separate content work.
- **Boss enrage content migration** — converting `TribulationPhase.ts`'s
  real `BossEnrage` data (`afterSeconds` → `afterTurns`) and real
  enrage effects into `TurnBossTrigger` + real `TurnBuffDefinition`s —
  deferred, separate content work.
