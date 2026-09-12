# QA Review: Turn-based status VFX feed (Phase A6 / roadmap 9.5 #7)

- Date: 2026-09-13
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - `game/src/core/battle/turn/TurnStatusPresentationEvents.ts` (new)
  - `game/src/core/battle/turn/TurnStatusPresentationEvents.test.ts` (new)
  - `game/src/core/game/GameManagerTurnBattleOps.ts` (wiring + persistent snapshot fields)
  - `game/src/core/game/GameManager.turnStatusVfx.test.ts` (new)
  - `game/src/game/scenes/combat/combat-status-tooltip.ts` ("Ns" → "N lượt")
  - `game/src/game/scenes/combat/combat-status-tooltip.test.ts` (expectation update)

## Scope and Risk Map

Changed systems: turn-battle tick (`fighting` branch of `updateBattleFixedStep`), new
snapshot/diff-emit helper for `status_vfx_*` events, Phaser tooltip label.

One-hop consumers: `CombatScene` (existing `status_vfx_attached/updated/removed`
handlers at CombatScene.ts:638-640), `CombatVfxSpawner` (`onStatusAttached/
onStatusUpdated/onStatusRemoved`), `StatusTooltip` (reads `remainingTime` snapshot).

Risk-mapper output: domains `combat-and-tribulation` + `pinia-phaser-sync`,
`deepAuditCandidate: true` ("cross-system change: 2 domains"),
`unmappedPaths: [GameManagerTurnBattleOps.ts]`.

Escalation decision — NOT escalated to deep: the change is a read-only
presentation feed. `GameManagerTurnBattleOps.ts` is manually routed to
combat-and-tribulation (it is the GameManager battle-tick orchestrator). No
persistence, economy, progression, clock-ownership, or save/cloud path is
touched. The Vue/Phaser lifecycle surface is unchanged — the scene already
subscribes to these events and already clears `statuses` on battle transition
(CombatScene.ts:1485-1491, 2465-2470). Material risk is bounded by code
inspection plus the two new integration tests.

Exclusions: none — all dirty paths in the worktree belong to this task.

## Invariant Ledger

| # | Invariant | Oracle | Result |
| --- | --- | --- | --- |
| I1 | First observation of a visible buff emits exactly one `status_vfx_attached` carrying turn duration | `GameManager.turnStatusVfx.test.ts` (ailment + formation grants) | Holds |
| I2 | Stack change or upward duration refresh emits `status_vfx_updated` | `TurnStatusPresentationEvents.test.ts` | Holds |
| I3 | Plain decay and no-change emit nothing (no per-step spam) | same file, decay/match cases | Holds |
| I4 | A buff leaving the pool emits `status_vfx_removed` with reason `expired` (living holder) or `target_dead` (dead/absent holder) | same file, both cases | Holds |
| I5 | `hidden` buffs never produce events or icons | same file | Holds |
| I6 | Presentation feed is read-only over `TurnBuffPool` (P17) | code inspection — helper only calls `getAll()` and reads fields | Holds |
| I7 | Event payload shape unchanged (field names/types) — only the duration unit changes seconds→turns | type-check + tooltip test | Holds |
| I8 | Canonical buff name resolves via `TURN_BUFF_REGISTRY`, unknown ids fall back to raw id | unit test both cases | Holds |
| I9 | `statusInstanceId` key granularity matches pool granularity `(id, sourceId)`; pool merges same-source reapplications | `BuffPool.getFromSource`/`removeInstance` + `BuffSystem.handleExisting` inspection | Holds |
| I10 | Battle replacement (auto-repeat) resets the diff baseline — no stale keys leaking attach/update into the new battle | identity check `statusVfxBattle === turnBattle`; scene clears icons on transition | Holds |
| I11 | Tooltip renders non-permanent duration as turns, permanent as "vĩnh viễn" | `combat-status-tooltip.test.ts` | Holds |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` | exit 0 | clean |
| `npm run build` | `✓ built in 5.12s` | clean (chunk-size warnings pre-existing) |
| `npx vitest run` (full suite) | 518 files / 3468 tests, all pass | includes new tests |
| Repro before fix: formation-grant test | failed for intended reason (`grant` undefined) | proved H1 defect, kept as regression |
| `durationSeconds` consumer audit | `combat-vfx-spawner.ts` maps it to `remainingTime`, consumed only by tooltip text | no other time-math consumer exists |

## Findings

### QA-2026-09-13-1: Construction-time buffs never emitted attach (found during review, fixed pre-report)

- Severity: Medium
- Status: Confirmed → fixed within this task (repro kept as regression)
- Invariant: I1
- Preconditions: a buff applied before the first `fighting` step (e.g. formation
  grant inside `buildTurnBattle()`, or any future intro/countdown grant).
- Reproduction: stage battle with `player.formationLoadout = { formationId:
  'hon_don_tran', assignments: [] }` → advance past countdown → no
  `status_vfx_attached` for `hon_don_tran_test_buff`.
- Expected: first observation emits attach (icon spawns).
- Actual (pre-fix): the step-start `before` snapshot already contained the buff
  → diff silent → icon permanently missing.
- Evidence: failing test `GameManager.turnStatusVfx.test.ts` case 2 (failed
  `expected undefined to be defined`, passes after fix).
- Test file: `game/src/core/game/GameManager.turnStatusVfx.test.ts`
- Owner subsystem: `GameManagerTurnBattleOps` status-feed wiring.
- Blast radius: any buff applied outside the `fighting` state — today only the
  TEST-ONLY `hon_don_tran` formation, but the same hole would hide every future
  construction-time buff.
- Fix: persistent last-emitted snapshot (`statusVfxSnapshot` + `statusVfxBattle`
  identity) replaces the per-step pre-capture; `diffAndEmitTurnStatusVfx`
  returns the `after` map for the next step.

### QA-2026-09-13-2: Downward refresh keeps stale tooltip duration (bounded, accepted)

- Severity: Low
- Status: Suspected (static analysis; no runtime evidence gathered)
- Invariant: I2/I3 boundary
- Preconditions: `stack`/`replace`/`refresh` reapplication where the new computed
  duration is shorter than the current `remainingTurns` (e.g. target has
  `ailmentResistPercent`), without a stack change.
- Reproduction: not automated — would need a resist-stat fixture.
- Expected: tooltip shows the lowered duration.
- Actual: `remainingTurns > previous` gate stays silent; tooltip keeps the old
  value until the next qualifying update or removal.
- Evidence: `BuffSystem.handleExisting` assigns `remainingTurns = duration`
  unconditionally; the diff intentionally ignores downward moves (same
  semantics as the retired real-time feed, and the tooltip is a documented
  snapshot — spec §5 limitation).
- Test file: none
- Owner subsystem: `TurnStatusPresentationEvents` diff policy.
- Blast radius: cosmetic staleness on a tooltip; gameplay state unaffected.

## New or Changed QA Tests

- `TurnStatusPresentationEvents.test.ts` (8): snapshot keys/hidden filter,
  attach payload with turn duration + registry name, unknown-id fallback,
  update on stack/refresh, silence on decay and on identical state, removal
  reasons `expired`/`target_dead`.
- `GameManager.turnStatusVfx.test.ts` (2): end-to-end `doc_chuong` → `trung_doc`
  attach through a real `startStage` battle; formation construction-grant
  attach regression for QA-2026-09-13-1.
- `combat-status-tooltip.test.ts`: updated to the turn label "N lượt".

## Gaps and Residual Risk

- Non-stage battles (`startBattleWithPlayer` — tribulation/devtools) run the
  registry-less engine: `applySkillAilments` no-ops there, so no buff events
  exist to emit. Pre-existing behavior on master, unchanged by this task; the
  status feed itself is wired identically for both paths and would light up
  automatically if a registry is ever supplied.
- Buff icons on a dead participant persist until scene battle-transition
  cleanup (pools are not cleared on death — same as legacy semantics).
- QA-2026-09-13-2 downward-refresh staleness is accepted as bounded cosmetic.
- P14 live-browser check deferred per the isolated-worktree exception; event
  feed and tooltip are covered headlessly.

## Pre-existing Failures

None observed during this review (full suite green; the earlier
`selfBuff.qa` flake documented in the 2026-09-12 legacy-cast-count report was
not reproduced).
