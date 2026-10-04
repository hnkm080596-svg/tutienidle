# QA Review: combat HUD DOM overlay reskin (ui-combat.html mock)

- Date: 2026-10-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths:
  - game/src/components/game/combat/{CombatAiPanel,CombatSceneOverlay,CombatSkillDockPanel,CombatTopBar,TurnOrderStrip}.vue
  - game/src/components/game/combat/hud/{TurnCombatSkillBar,CombatPlayerCard}.vue
  - game/src/components/scenes/combat/{CombatAiRail,CombatTurnRail}.vue
  - game/src/core/battle/turn/CombatClock.ts
  - game/src/game/scenes/CombatScene.ts
  - game/src/game/scenes/combat/{combat-grid-view,combat-snapshot-reconcile,combatTextFormat}.ts (+ their .test.ts)
  - game/src/locales/{en,vi}.json
  - game/src/components/game/combat/CombatSceneOverlay.style.test.ts
- Exclusions: game/capture-combat.mjs (scratch screenshot helper, never committed).

## Scope and Risk Map

DOM overlay reskin to the huyen-kim chrome per the approved ui-combat.html
mock, plus three text-fit fixes (skill-slot truncation, turn-chip clipping,
enemy label collision) and the canvas PlayerHudLayer retiring in favor of a
DOM CombatPlayerCard.

Mapper domains: combat-and-tribulation, pinia-phaser-sync, ui-input-lifecycle
(deepAuditCandidate=true for "3 domains"). Escalation declined — risk is
bounded by inspection: this is a presentation-layer change; the only core
edit is a new FreezeReason literal composing exactly like the four existing
reasons; PlayerHudLayer retirement is bounded because every consumer is
`?.`-guarded and tests inject fakes through the setter. No save/cloud, no
time ownership, no economy/progression writes. Locales are the only
unmapped paths (i18n literals; parity verified).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-HUD-1 | `combatClock` reason set (ops-level CombatClock) | pause mid-battle, battle ends | Lifecycle: 'user-pause' must not leak into the next battle | Interruption | next battle paces normally | Unit + source | High — refuted: `stop()` clears `reasons` at every teardown path (CombatClock.ts:88, ops 999/1626/2004/2463) |
| INV-HUD-2 | `userPaused` latch (CombatTopBar) | pause, battle ends, new battle starts | Synchronization: seal pressed-state mirrors clock state | Stale state | aria-pressed vs getCombatClockState | Source | Medium — watch(battle) resets; isBattleFighting guard added |
| INV-HUD-3 | mode toggle write path | toggle Tự Động/Thủ Công mid-battle incl. AWAITING_INPUT | Atomicity: ui store + manager flag both written | Reorder | combatInputMode + manager flag + stranded-claim rescue | Unit | Medium — same write pair preserved (ui.setCombatInputMode + setBattleManualMode); AWAITING rescue path untouched |
| INV-HUD-4 | entity name label (grid-view) | long name on narrow column, missing projection | Boundedness: label width ≤ cell-8 | Value mutation | rendered label width | Unit + runtime | Medium — verified: 'HUD Te…' ellipsis in runtime capture |
| INV-HUD-5 | player vitals card (DOM) | entity vitals mutate in place each turn | Synchronization: card mirrors entity snapshot | Stale state | rendered hp/mp/ward/resource | Runtime | Medium — every computed reads stateVersion (reactivity law); capture shows 66/108 live |
| INV-HUD-6 | e2e selector contract | reskin renames/removes hooks | Lifecycle: hooks identical | — | spec assertions | Source + spec grep | High — `.turn-combat-skill-bar__slot-button`, `__orb-frame`, `__emblem`, `__member-hp`, `__mode-toggle`, `combat-scene-overlay__ai-panel`, `combat-skill-dock-panel` all retained |
| INV-HUD-7 | ai-panel vs player-card (overlay) | short viewport (~600px) | Boundedness: panels never overlap | Value mutation (viewport) | bounding boxes | Style test | Medium — defect found+fixed (max() floor) |
| INV-HUD-8 | turn-chip portrait per actor | ally/companion actor in queue | Synchronization: chip art = that actor's art | Cross-system | rendered avatar | Source | Medium — defect found+fixed (entity.id gate mirrors grid) |
| INV-HUD-9 | MP meter (player card) | entity with maxMp=0 | Boundedness: no dead 0/0 meter | Value mutation | rendered meter | Runtime | Low — defect found+fixed (v-if maxMp>0) |
| INV-HUD-10 | freeze composition | pause during turn-in-flight/awaiting | Idempotency: clock resumes only when all reasons clear | Timing boundary | getFreezeReasons | Unit (CombatClock suite green) | Medium — verified composition |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | clean | worktree, final state |
| `npx vitest run` scoped (12 files / 101 tests) | all green | grid-view, text-format, strip, clock, hud-wiring, style |
| Runtime captures (1600x900, in-worktree dev server :5417) | mock-faithful | /tmp/shots/after-combat.png etc.; shows framed card/plaque/rail/panel/dock, live vitals, ellipsized enemy label |
| `CombatClock.stop()` clears `reasons` | source-verified | user-pause cannot leak across battles |
| ai-panel/card geometry at 600px viewport | overlap confirmed by arithmetic | fixed via `max(28vh, 1.8vh + 190px)` floor + style-test pin |

## Findings

### QA-2026-10-04-001: ally/companion turn-chip renders the human player's avatar
- Severity: Medium
- Status: Confirmed (SOURCE_PROOF) — RESOLVED in-task
- Invariant: chip portrait must depict that actor (INV-HUD-8)
- Preconditions: a second player-type participant exists (companions get `type:'player'`, CompanionCombat.ts:21)
- Reproduction: static — `avatarUrlFor` branched on `entity.type==='player'` while grid-view branches on `id===PLAYER_ID`
- Expected: ally chip renders ally art
- Actual: ally chip renders the human player's profile art
- Evidence: grid-view.ts:492 id-gate vs TurnOrderStrip type-gate
- Fix: `entity.id === 'player'` gate (mirrors the CombatBuild partition gate)
- Owner subsystem: combat DOM overlay
- Blast radius: turn-order chips only

### QA-2026-10-04-002: MP meter renders "0/0" for entities without an MP pool
- Severity: Low
- Status: Confirmed (runtime capture) — RESOLVED in-task
- Invariant: no dead meters (INV-HUD-9)
- Reproduction: kiem-path player (maxMp=0) → second meter shows "0 / 0"
- Fix: `v-if="(entity.stats.maxMp ?? 0) > 0"`
- Owner subsystem: combat DOM overlay
- Blast radius: melee/no-mana player cards

### QA-2026-10-04-003: AI panel overlaps the player card at short viewports
- Severity: Medium
- Status: Confirmed (geometry proof) — RESOLVED in-task
- Invariant: panels never overlap (INV-HUD-7)
- Reproduction: viewport height ≤ ~640px → 28vh lands above the card's ~1.8vh+190px bottom while both sit on the left edge
- Fix: `top: calc(max(28vh, 1.8vh + 190px) - var(--combat-topbar-h))` + style-test pin
- Owner subsystem: combat DOM overlay
- Blast radius: small-viewport combat

### QA-2026-10-04-004: pause toggle latchable on a stopped clock (cosmetic)
- Severity: Low
- Status: Confirmed (source) — RESOLVED in-task
- Invariant: seal pressed-state mirrors a real freeze (INV-HUD-2)
- Reproduction: click pause on the result screen → latch set, nothing frozen
- Fix: `isBattleFighting` guard inside togglePause
- Owner subsystem: combat DOM overlay
- Blast radius: post-battle UI

## New or Changed QA Tests

- `combatTextFormat.test.ts` — `fitEntityLabelText`: full fit at 14px, shrink to 12px, ellipsize at smallest, bare-ellipsis floor, custom ladder. Proves INV-HUD-4 directly.
- `CombatSceneOverlay.style.test.ts` — ai-panel top rule updated to the reskin value incl. the max() floor. Pins INV-HUD-7's fix.
- `combat-grid-view.test.ts` — fixture gained Text hooks (setFontSize/setText/updateText/width) so the label-fit path executes under tests.

## Gaps and Residual Risk

- Pause-button runtime behavior (click → clock freezes, resume on re-click)
  is source-verified only; no Playwright run drove the click path (button is
  new; clock composition is the existing tested mechanism). Gap recorded —
  mitigated by the clock's existing reason-set tests staying green.
- Turn-strip chips intentionally keep actor names + ATB gauges under the
  portraits (mock shows bare portraits) — documented visual divergence, not
  a defect.
- `setCombatClockSource` while paused clears reasons but leaves the DOM
  latch — symmetric pre-existing limitation shared with 'tab-hidden';
  dev/test seam only, out of scope.

## Pre-existing Failures

- `tests/e2e/combat-overlay-layout.spec.ts` fails identically on the BASE
  branch (`codex/hoa-cau-fireball-vfx`, verified by stashing the task diff
  and re-running the compact viewport): the wheel slot click never opens
  `function-overlay-panel`, so every viewport times out before reaching
  combat. The failure is in the home wheel→teleport flow — upstream of
  every file this task touched. Not task-caused; left for the branch owner.
- In-worktree runtime verification substituted: `capture-combat.mjs`
  drives the real app (guest → character → wheel → teleport → battle) in
  the same browser and reaches combat; the after-* captures show the live
  reskinned overlay at 1600x900.
