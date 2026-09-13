# M11 — Per-lane offline production settlement (ARCH-007)

Worker result for mission M11 of `docs/architecture/2026-09-14-arch-repair-program.md`.
Finding: `docs/qa/2026-09-14-full-project-engineering-audit.md` ARCH-007,
oracle `docs/qa/2026-09-14-audit-economy-review.md` AUD-E01.

## G0 — Task card

```text
TASK CARD
Task / user request: M11 — per-lane offline production settlement (ARCH-007, P1, HIGH economy)
Assigned worktree / branch: E:\tutienidle\.agent-worktrees\arch-m11-production-lane / arch/m11-production-lane (fork 81c30e04)
Requested observable behavior: each worker lane completes independently; partial work across lanes never
  synthesizes a completed cycle; identical saved state + elapsed yields identical completed-cycle counts
  online vs offline within PRODUCTION_OFFLINE_CAP; retained future cycles keep lane capacity + deadlines.
Single responsibility / invariant: worker-lane time advancement — one mechanism, two drivers (A9).
Current owner (path + symbol): core/production/ProductionOffline.ts settleWorkersOffline (pooled
  floor(windowMs * slots / cycleMs) + backdated synthetic cycles, lines ~238-260 at fork);
  online: ProductionSystem.tickWorkers (inline top-up + settle loop, ~363-376 at fork).
Target owner (path + symbol): core/production/WorkerLaneAdvance.ts advanceWorkerLanes (NEW leaf
  mechanism); consumed by ProductionSystem.tickWorkers ('observe') and
  ProductionOffline.settleWorkersOffline ('deadline' + budget).
Existing primitive/mechanism to reuse: allocateWorkerSlots (R7 slot distribution — unchanged),
  buildProductionCycle (cycle factory), grantCycleRewards (reward + settlement-event owner — unchanged),
  computeCycleSeconds / CYCLE_BASE_SECONDS_BY_REALM / PRODUCTION_OFFLINE_CAP_SECONDS.
Missing capability: a per-lane chain-advancement primitive preserving each lane's deadline/remainder.
  Real callers: tickWorkers + settleWorkersOffline.
Production chain: online  GameManager.update -> GameManagerTickOps.tick (~161) -> productionSystem.tickWorkers;
  offline GameManagerSaveRestore.restoreFromSave (~349, PINNED) -> productionSystem.settleOffline
  -> settleProductionOffline -> settleWorkersOffline.
State: ProductionSiteState.workerCycles — writer ProductionSystem (mechanism output in both drivers);
  reader SaveSystem.buildGameSave (~355); reset/replace via restoreStates; persisted as
  ProductionSiteStateSave.workerCycles (saveTypes.ts ~251). No schema change.
Expected files:
  src/core/production/WorkerLaneAdvance.ts (NEW — owns the lane-advance rule)
  src/core/production/ProductionOffline.ts (settleWorkersOffline consumes mechanism; drops pooled formula)
  src/core/production/ProductionSystem.ts (tickWorkers consumes same mechanism)
  src/core/production/ProductionSystem.offlineParity.test.ts (NEW — E01 port + parity coverage)
  docs/qa/2026-09-14-m11-production-lane.md (this report)
Explicit non-goals: manual activeCycle path (already sequential per-lane); notification consumers
  (AUD-E04 → M12); yields/cycle durations/offline cap values; restoreFromSave structure (M1);
  ProductionOfflineOptions shape (no extension needed — offlineSinceMs already carried the save
  timestamp, workerCycles already persisted per-lane remainders; pinned call site unchanged).
Applicable roadmap phase: §0.8a M11 row; R7 worker-allocation (DONE) supplied the shared allocator.
Tests and gates selected: QUICK P3 (type-check + vitest production/save/game scopes);
  no save-schema or Pinia root change -> full P3 not triggered. P13/P14: not wiring-critical
  (domain-only; GameManager.update already calls tickWorkers — unchanged call site).
Stop condition: E01 oracle green + online/offline count parity test green + suite no new failures.
Unresolved material assumptions: none.
```

## Behavior before -> after

- **Before:** `settleWorkersOffline` settled saved pending cycles, then synthesized
  `floor(windowMs * slots / cycleMs)` cycles backdated from `nowMs` — pooling fractional lane
  time across lanes and granting output ahead of every lane's own deadline. AUD-E01: 2 lanes
  due T+100s, settle at T+65s granted 1 extra cycle while keeping both pending (verified red:
  `settled=1`, `pending=2`).
- **After:** each of the site's `slots` lanes is an independent chain. A lane completes only
  when its own in-flight cycle's `completesAtMs <= nowMs`; a completed lane's next cycle starts
  at the completion instant (continuous-observation limit of the online tick); lanes beyond the
  slot budget drain without respawning; empty lanes produce only from `offlineSinceMs`; kept
  cycles retain their original `startedAtMs`/`completesAtMs`/identity. The same mechanism
  (`advanceWorkerLanes`) drives `tickWorkers` in 'observe' mode — due heads grant once, freed
  lanes refill on the next tick (top-up-then-settle order preserved 1:1).
- **Cap/forfeit:** completions cost their own full duration against the shared remaining budget
  (unchanged accounting). Over-budget completions are forfeited and the lane still advances —
  no past-due pending cycle is ever left for a free online grant (same rule as the manual
  backlog forfeit; also fixes a latent cap-bypass where a 0-slot site's due cycles lingered).
- **Notification contract:** `grantCycleRewards` and `ProductionSettlementEvent` untouched —
  delivered-vs-overflow fields and event emission identical; TickOps consumer unchanged (M12 scope).

## G1 — Q1-Q12 with evidence

| ID | Answer — evidence |
|---|---|
| Q1 | 2 lanes due T+100s settle at T+65s -> 0 grants, both pending kept (test `AUD-E01 oracle`); identical counts online vs offline (`online tick and offline settle...` asserts settled=12=onlineCompleted and equal pending deadlines). Failure mode: over-cap completions forfeit, never double-grant. |
| Q2 | `WorkerLaneAdvance.ts:advanceWorkerLanes` owns the whole completion/keep/respawn/forfeit rule; `ProductionSystem.grantCycleRewards` remains the sole reward+event owner — callers consume `result.completed`/`result.pending`, no reconstruction. |
| Q3 | `workerCycles`: written only via `state.workerCycles = result.pending` in both drivers; read by `SaveSystem.ts:355`; replaced by `restoreStates`; no second mutable copy introduced (mechanism is pure — input `pending` array is not mutated). |
| Q4 | Online: `GameManagerTickOps.ts:161` -> `tickWorkers`. Offline: `GameManagerSaveRestore.ts:349` pinned call -> `settleOffline` -> `settleProductionOffline` -> `settleWorkersOffline`. Verified by `GameManager.sharedWorkerPool`/`workerCapacity` tests driving real `update()`. |
| Q5 | Reused: `allocateWorkerSlots`, `buildProductionCycle`, `grantCycleRewards`, balance constants. New leaf adds one mechanism with two present consumers — removes the duplicated divergent advancement rule (real complexity removed, not abstraction for its own sake). |
| Q6 | `WorkerLaneAdvance.ts` imports only `ProductionTypes` (type) + `ProductionCycles` (leaf factory) — same dependency level as the old code; no upward/presentation imports; no cycle (ProductionSystem & ProductionOffline both already depend on these leaves). |
| Q7 | Timing advance is pure domain; rewards still roll only at completion via `grantCycleRewards`; no presentation involvement. |
| Q8 | Both drivers pass the site snapshot inputs (current realm/level/base for spawned cycles; saved cycles keep snapshot duration for cost). `workerCapacity<=0` mirrors online freeze (early return after slot zeroing — same order as tickWorkers). `offlineSinceMs` undefined -> no empty-lane seeding (conservative, unchanged intent). |
| Q9 | No query/preview path touched. `getSiteView` unchanged. |
| Q10 | Duplicate settle: kept lanes retain identity/deadlines -> re-settle is a no-op for them (test `kept future cycles are not re-granted`). Stale past-due cycles settle once or forfeit under budget — never linger (cap test asserts all kept dues > nowMs). Repeated save/settle converges (test asserts totals 0+2+2=4 across three absences). |
| Q11 | Old pooled block removed inside `settleWorkersOffline` — no alternate path retained. Manual `activeCycle` offline path unchanged (already per-lane sequential). |
| Q12 | Files map 1:1 to the invariant above. Verification commands + results below. Stop: parity tests green; unrelated debt reported only. |

## Triggered domain modules

- **E1 (balances on failure):** over-budget completions forfeit without grant; saved pending keep
  their lane — covered by cap test. PASS.
- **E2 (receipts):** `amount`/`overflow` emission unchanged in `grantCycleRewards`; settlement
  event count equals granted cycles. PASS (consumer-side display remains M12/AUD-E04).
- **E5 (online/offline shared allocation semantics):** same allocator + same advancement mechanism;
  explicit time units (ms timestamps vs cycleMs). Covered by parity tests incl. all-manual and
  retained-lanes cases. PASS.
- **E6 (production-configured instance):** tests build the real `ProductionSystem` with the real
  THANH_VAN catalog + authored material registry — no friendlier reconstruction. PASS.
- **E7 (economics preserved):** yields, cycle durations, and the 10h cap untouched; granted counts
  now bounded by true per-lane completions (removes an inflation source, never adds one). PASS.
- **S1/S2:** workerCycles snapshot detach/replace belongs to M1 (ARCH-001); this mission only
  reads/writes the state field through the same owner API. N/A beyond noting the boundary.
- C/S/L/U modules: not triggered (no combat, save-schema, quest-lifecycle, or UI changes).

## Migration ledger

| Rule/state | Current authority | Target authority | Real consumers | Migrated/evidence | Retained path and reason | Remaining work |
|---|---|---|---|---|---|---|
| Worker-lane time advancement | split: tickWorkers inline loop + settleWorkersOffline pooled formula | WorkerLaneAdvance.advanceWorkerLanes | tickWorkers (TickOps), settleOffline (SaveRestore) | YES — both drivers consume it; parity tests green | none (old formula deleted) | none |
| Slot distribution | allocateWorkerSlots | unchanged | both drivers | already shared (R7) | retained | none |
| Cycle reward grant + events | grantCycleRewards | unchanged | tick/tickWorkers/settle | already shared | retained | M12 consumes receipts |
| Manual activeCycle offline | settleProductionOffline loop | unchanged | settleOffline | already per-lane sequential | retained | none |

## Verification (P3 quick)

- `npm run type-check` (vue-tsc --build): exit 0.
- `npx vitest run src/core/production src/services/save src/core/game`:
  114 files / 714 tests — **710 pass, 4 fail**, all 4 in
  `GameManager.perfectClear.feasibility.test.ts` multi-hit floors 1/5/9/10 — the documented
  baseline failures flagged for wave-4 quarantine (`it.fails`, playtest debt per user ruling);
  unrelated to this diff (no battle/feasibility code touched). P12: pre-existing, non-blocking.
- `npx eslint` on all touched files: clean.
- Red-first evidence: the new spec file scored 7/8 failing against the pre-change implementation
  (E01 oracle `settled=1`, parity `settled=13 vs online=12`, missing kept tails); 1/8
  (retained-lanes) was characterization-pass by design.

## P4 / P5 record

Subagent-dispatched `tutienidle-adversarial-qa` / `code-review` skills are not invocable in this
worker context (mission forbids subagents). In-scope adversarial self-check performed instead:
found and fixed one real defect before submission (virtual empty lanes were appended after the
sorted saved lanes, breaking earliest-deadline processing — now re-sorted; regression-visible via
the empty-lane test). Edge matrix reviewed: pending>slots drain, slots=0 settle-without-respawn,
budget=0 forfeit sweep, missing site definition, `offlineSinceMs` undefined/>nowMs, repeated
settle idempotence, per-site shared budget order. Verdict: PASS WITH EVIDENCE (self-reviewed).

## P13/P14

Not triggered: no `App.vue`/boot/`GameManager.update` wiring change — the tick call site and the
pinned restore call site are untouched; behavior change is inside the domain mechanism. The real
`update()` path remains covered by `GameManager.sharedWorkerPool.test.ts` (drives production
tickWorkers through the real manager). No visual surface changed; worktree P14 deferral noted.

## Notes / Suggestions (out of scope, evidence only)

- `tickWorkers` 'observe' order means a lane freed at tick T refills at the next tick — retained
  exactly as before; offline models the dense limit. The resulting per-tick dead time (~1 frame
  per completion) is inherent to tick observation and identical to pre-M11 behavior.
- `ProductionSiteStateSave` does not persist `activeWorkerSlots`/`assignedWorkers` is persisted?
  `assignedWorkers` IS persisted via `getWorkerAssignments()` snapshot at call time — unchanged.
- Budget forfeit order across lanes is global earliest-deadline-first within a site (was:
  all saved heads first, then synthesized). Both honor the cap; ordering difference only affects
  which same-cost completions forfeit when the cap binds mid-window.
- M14-class remote/multi-device save replay not evaluated — out of scope.
