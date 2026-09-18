# Deep Adversarial QA — Buff M4 cutover (buff2 authority + scheduler settlement)

Date: 2026-09-18
Mode: deep (mandatory escalation — buff lifecycle crosses combat, stats,
persistence, presentation, and proc consumers)
Scope: `core/buff2/**`, `core/battle/turn/**`, `core/battle/runtime/**`,
`core/game/GameManager*Ops*`, `core/proc/**`, `core/the-tu/**`,
`data/buff/**`, presentation read seams, persistence lane.
Diff base: worktree `feat/buff-core` vs main (task-owned paths only).

## Verdict

**PASS WITH EVIDENCE** — two Confirmed defects found and fixed inside the
QA loop; all other audited surfaces checked clean against current code.
Gaps recorded at the bottom; none block.

## System map (rebuilt from current code)

- `BuffDefinition` (immutable, `data/buff/**` + battle-local registry with
  `structuredClone`d kit clones shadowing canonical ids).
- `BuffInstance` runtime state in `BuffStore`; all mutation through
  `BuffSystem` — apply/remove/cleanse/lifecycle/periodic/settle.
- `CombatScheduler` = sole settlement authority. Global operationId
  reservation, faults on repeats; `run()` (quiescent-only) +
  `runIfQuiescent()` (event-listener safe early-return).
- `TurnBattleSystem` orchestrates; mints op roots with `nextOccurrence()`
  on every recurring lane (applybuff/ailments/detonate/reactive/TheTu/
  income/hit-proc).
- `GameManagerTurnBattleOps` = composition root: `mintCycleScheduler`
  builds runtime bundle + battle-local registry; survive-effects and
  passive-convert lanes mint ops through `scheduler.enqueueAuthored` +
  `runIfQuiescent`, or ride the in-flight `execCtx` when mid-settlement.
- `BuffPersistence` = separate out-of-battle lane; rejects periodic defs
  at construction; monotonic `buff.persistent.<owner>.<n>` ids.
- Presentation (`TurnStatusPresentationEvents`, `TurnOrderStrip`) reads
  snapshots only; `remaining` treated as turn counts.
- Reaction engine implemented through M5, production-inert at M-INT (no
  dispatcher registration, no `elemental_reaction_enabled` grants).

## Invariant ledger

| Invariant | Result |
|---|---|
| operationId/rootId uniqueness under repeated events | **VIOLATED x2 -> fixed** (QA-1, QA-2) |
| Lifecycle ordering (entry applies -> stat refresh -> turns -> sweeps) | holds |
| Periodic continuation: emit -> settle -> next-request, liveness revalidated per unit | holds |
| Death cleanup at quiescent boundaries before victory/defeat evaluation | holds |
| Persistent pool: no periodic defs, monotonic ids, seconds-clock only | holds |
| Stat fold: buff2 `getStatModifiers` + reconcileExternalWard single choke | holds |
| Presentation read-only, attach/update/remove parity | holds |
| Mid-drain enqueues join the active drain; reentrancy guarded | holds |
| Reaction wiring production-inert | holds |
| Kit clones never mutate canonical defs (`structuredClone`, id-shadow) | holds |
| Clock census: 39 holder_turns / 15 permanent / 1 seconds (kiep_thuong, persistent-only) | consistent |

## Findings

### QA-1 — Confirmed (Critical) -> FIXED — survive-lane operationId collision

`GameManagerTurnBattleOps` minted `survive.<battleGeneration>.<entityId>`
with no occurrence discriminator. The DESIGNED Bat Tu -> talent-charge
pairing (ultimate first line, talent charge the extra life) mints
`survive.1.player.grant` twice on one entity in one battle; the scheduler
rejects the repeat (`operationId ... is already reserved`), faults the
scheduler, and bricks every later buff op and lifecycle boundary.

Repro (fails pre-fix, passes post-fix):
`src/core/game/GameManager.surviveOpIds.qa.test.ts` — "Bat Tu grant then
talent-charge grant on the same entity settles both survive events".

Fix: monotonic `nextOpOccurrence()` appended to the mint —
`survive.<gen>.<entity>.<seq>`.

### QA-2 — Confirmed (High) -> FIXED — passive-convert operationId collision

Same class, second lane: `passive.<gen>.<turn>.<buffId>` had no
discriminator. A threshold convert fires `buffApplier` and resets stacks
to 0; >=2x threshold trigger events inside one `totalTurnsElapsed` (e.g.
Vo Anh, dodge trigger, max 5 — a 10+ hit flurry fully dodged) mints the
identical apply id twice -> same scheduler fault.

Repro: same file — "two threshold converts of the same buff inside one
turn settle both applies" (10 `dodge` events -> 2 converts of `sat_na`).

Fix: same `nextOpOccurrence()` discriminator —
`passive.<gen>.<turn>.<buffId>.<seq>`.

### Audited clean (evidence: source + suite)

- All TBS recurring mint lanes carry `nextOccurrence()`
  (`skill.applybuff`, `skill.ailments`, `skill.detonate`, `reactive`,
  `the.outcome`, `hit.proc`, round income keyed by round+participant,
  consume/clearHardCc keyed by instanceId).
- `handlePeriodicSettled`: per-unit `store.get` + `entities.isAlive`
  revalidation; `pendingUses` marks filtered on `removeInstance`;
  `pendingSeries` re-keyed/deleted on settle; event-scoped sink, no
  reentrant `lctx.settle`.
- `emitAndSettle` uses `run()` — TBS lanes are quiescent-only by
  construction; survive lane uses `runIfQuiescent` + `execCtx` split.
- `completeAction`: gauge consume -> unconditional `drainPending` ->
  defeat/victory eval -> log (legacy push-on-top-of-reset parity).
- `applyEntryBuffs` runs post-mint, pre-`refreshEffectiveStats`; unknown
  formation ids graceful-skipped via `registry.tryGet`.
- `detonate` burst ops mint `statSourceId` per consumed instance's own
  source (legacy per-tick parity), one op per damage periodic (element
  routing preserved).
- `BuffPersistence` ctor rejects periodic defs; `kiep_thuong` (the sole
  seconds-clock def) is non-periodic and persistent-only.
- `Buff2ActionValidator` reads live instances; expiry/removal lifts
  restrictions immediately.
- Scheduler reserves operationIds globally; the collision class is now
  unreachable-by-design (every recurring mint carries a discriminator).

## Gaps / deferred

- `pendingSeries` entry lingers if a settle event never arrives —
  unreachable (every emitted request settles or the drain faults).
  Low, no fix.
- `onBattleEnd` is never invoked; the per-battle store is discarded with
  the battle. Post-victory `getBattleBuffs` can report stale statuses to
  a retained battle — same behavior as legacy participant-local pools.
  Low, parity.
- `test:e2e` (Playwright): VERIFIED — 27/27 passed (10.8m), incl.
  create-to-combat, turn-combat-hud refight, presentation-routing,
  wave-vfx-capture, tribulation-flow (persistent lane).
- Mid-settlement survive path mints no ops (rides `execCtx`) — by design.

## Verification

- `npx vitest run src/core/game/ src/core/battle/` — 207 files, 1379
  passed + 4 expected-fail (post-fix).
- `npm run type-check` — clean (post-fix).
- Prior full gate this milestone: type-check + `vite build` + full vitest
  (665 files, 5633 passed + 4 expected-fail) — all green pre-QA-fix; the
  fix touches only mint strings + one counter, scope-verified above.
