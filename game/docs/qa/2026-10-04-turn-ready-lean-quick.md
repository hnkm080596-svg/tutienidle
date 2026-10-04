# QA Review: turn_ready lean replaces scale pulse

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/game/scenes/combat/combat-action-feedback.ts`, `game/src/game/scenes/combat/combatConstants.ts`, `game/src/game/scenes/CombatScene.ts` (docblock only), `game/tests/e2e/combat-idle-motion-capture.spec.ts` (comment only)

## Scope and Risk Map

User report: on `codex/hoa-cau-fireball-vfx`, every actor (player AND monsters) visibly grows then shrinks when its turn arrives. Root cause confirmed by inspection: `CombatActionFeedback.onTurnReady` tweened `sprite.boost.value` 1 -> 1.15 -> 1 (yoyo, 2 x 250 ms); `combat-grid-view` multiplies `boost` into entity size in BOTH render modes (`applyEntityDepthScale` perspective, `setScale` flat). The tween's `onComplete` also carried `acknowledgeTurnReady` (5-phase machine step 1 -> 2).

Change: the scale punch was replaced by a forward lean on the shared `offsetX` impulse channel (`playHorizontalImpulse`, +x for `PLAYER_ID`, -x for enemies, 8 px, 250 ms/leg) plus `scene.time.delayedCall(500)` carrying the same ack on the same wall-clock beat. `CombatScene.ts` and the e2e spec carry comment-only updates.

Mapper flagged `deepAuditCandidate: true` ("cross-system: 2 domains") and `unmappedPaths: [spec file]`. Escalation waived, documented: the only `CombatScene.ts` edit is a JSDoc comment, the spec edit is a comment, and the behavioral change sits in one presentation seam already owned by `CombatActionFeedback`. No save/economy/progression/persistence surface is touched; combat domain risk is bounded to the ready-phase ack pacing, which the runtime probe below resolves conclusively.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-TR-1 | `pendingReadyActor` / CombatAnimationRuntime | turn_ready -> ack -> declare | Exactly-once ack lands with captured token, ~500 ms beat | Value mutation (token null/stale) | `turn_cast_start` emitted; battle advances | browser probe | High - stall would freeze the turn engine |
| INV-TR-2 | `sprite.boost` / CombatGridViewHost | turn_ready -> size over time | Boundedness: no scale modulation at turn start (user-visible defect) | Repeat (every actor, every turn) | `boost===1`, `displayHeight`/`scaleX` constant across the window | browser probe | High - the reported bug itself |
| INV-TR-3 | `sprite.offsetX` / vfx-spawner impulse channel | lean vs hit recoil/dodge/cast impulse overlap | Recoverability: channel returns to 0, no drift accumulation | Concurrency + interrupt | `offsetX` ends at 0 (onComplete resets; killTweensOf before start) | code + probe | Medium |
| INV-TR-4 | lean direction | actor side -> sign | Synchronization with scene facing convention | Value mutation (enemy vs player) | player +8 px, boars -8 px | browser probe | Medium |
| INV-TR-5 | manual-mode `pauseForManualActor` | turn_ready with no pending actor | Idempotency: late ack is a no-op | Reorder (ack after manual park) | ack hits `!pendingReadyActor` -> no-op; same as before | code | Medium |
| INV-TR-6 | scene lifecycle | shutdown mid-beat | Lifecycle: delayedCall dies with scene clock; drain covers pending phases | Interruption | `handlePresentationDeactivated`/`drainPendingPlayback` unchanged | code | Medium |
| INV-TR-7 | concurrent boost owners (crit pop, spawn fade) | turn_ready no longer kills boost tweens | Atomicity: foreign channel untouched | Concurrency | `killTweensOf(sprite.boost)` removed; crit/spawn tweens own their lifecycle | code | Low |
| INV-TR-8 | non-player ally on player side | lean sign for non-PLAYER_ID allies | Monotonicity of facing convention | Value mutation (roster edge) | allies lean -1 (backward) | code | Low |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc) | clean | worktree `game/` |
| `npx vitest run src/game/scenes src/core/battle/turn` | 113 files / 916 tests pass | scoped P3 quick |
| Playwright probe in real stage battle (worktree dev server) | 17 `turn_ready` events (5 player incl. manual-park + 12 across 3 boar species): `boost` [1,1] at every RAF sample, `displayHeight`/`scaleX` constant; `offsetX` peaks ±8 px per facing convention; 18 `turn_cast_start` fired -> ack lands, engine advances | headless chromium, 40 s live battle; lean tail can be re-anchored by the actor's own cast impulse (same channel, same direction) |
| `ocr delegate preview` + self-review | clean pass, 4/4 reviewable files, coverage 100% | delegation mode |

## Findings

### QA-2026-10-04-1: non-PLAYER_ID ally would lean backward
- Severity: Low
- Status: Suspected
- Invariant: INV-TR-8
- Preconditions: a non-`player` participant on the player side (summon/ally) reaching turn_ready.
- Reproduction: none reachable in beta scope (single player unit); code inspection only.
- Expected: ally leans toward the enemy side (+x).
- Actual: `actorId === PLAYER_ID ? 1 : -1` leans every non-player actor -x.
- Evidence: source only; the identical simplification already lives in the `actorImpulse` fallback (`CombatScene.ts` ~line 711, `fact.entityId === PLAYER_ID ? 1 : -1`) and in `onHit`/`onDodge` direction picks in this same file, so the change adds no new class of assumption.
- Test file: none
- Owner subsystem: combat presentation
- Blast radius: cosmetic direction flip on a hypothetical ally roster.

## New or Changed QA Tests

None - runtime probe evidence already confirms the reported defect's removal; the change keeps all existing green seams.

## Gaps and Residual Risk

- The lean's tail can be pre-empted by the actor's own cast impulse (identical channel and direction for forward attacks) - visually continuous, self-healing; recorded, not a defect.
- Probe sampled ~6-7 RAF frames per event under headless throttling; `displayHeight`/`scaleX` constancy across every sample still rules out any size modulation.

## Pre-existing Failures

None observed.
