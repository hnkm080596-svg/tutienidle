# GameManager External Contract — Survey (no design, cutover-scope inventory)

Date: 2026-09-04
Status: Survey only — no design decisions locked, no plan follows. This
inventory exists so the real `BattleSystem` cutover (Slice 2+) has a
complete checklist of what it must replace or adapt, decided by the
user (2026-09-04, phiên 6): this item cannot be split into a standalone
`Turn*` system the way Buff/HazardZone/Wave were — it IS the cutover
itself, and there is no `TurnBattleSystem` feature-complete enough yet
to design a real replacement contract against.

## 1. The real-time driver (top of the call chain)

`GameManager.ts:2870`, `private updateBattleFixedStep(deltaSeconds: number)`:

```typescript
private updateBattleFixedStep(deltaSeconds: number) {
  let remaining = Math.min(deltaSeconds, BATTLE_MAX_CATCHUP_SECONDS)
  while (remaining > 0) {
    const step = Math.min(BATTLE_FIXED_STEP_SECONDS, remaining)
    remaining -= step
    this.battleSystem.update(step)
    this.grantBattleRewardIfNeeded()
    this.stageWaves.update(step)
    this.stageWaves.resolveBossSummons()
  }
  this.tribulationDirector.update(deltaSeconds)  // outside the fixed-step loop, own closed-form catch-up
}
```

- `BATTLE_FIXED_STEP_SECONDS = 0.1` — combat runs in 100ms fixed steps
  regardless of actual frame delta, to avoid float drift in the many
  countdown timers this pipeline drives.
- `BATTLE_MAX_CATCHUP_SECONDS = 30` — deltaSeconds beyond 30s (tab
  backgrounded, machine slept) is dropped for combat/stage only; other
  systems elsewhere in `GameManager.update()` still receive the full
  real delta (they're already safe with large deltas).
- 4 things happen per fixed step, in this order: `battleSystem.update()`
  → grant rewards for anything that died this step → `stageWaves.update()`
  → resolve any pending boss summons. Whatever replaces this loop needs
  to preserve this ordering relationship (rewards must see the
  post-update battle state; wave spawning must see rewards already
  granted, matching `StageWaveSystem.update()`'s own comment: "gọi mỗi
  tick (sau grantBattleRewardIfNeeded() — cần battle.enemies đã được
  dọn quái chết trước khi đếm 'còn sống bao nhiêu')").
- `tribulationDirector.update(deltaSeconds)` is a SEPARATE system
  (Kiếp/tribulation boss fights) with its own closed-form catch-up —
  explicitly out of the fixed-step loop already, not part of
  `BattleSystem`. Not this survey's concern beyond noting it exists at
  the same call site.

## 2. `BattleSystem.update(deltaSeconds)`'s 18-step pipeline (steps, by comment marker in source)

Verbatim step markers found in `BattleSystem.ts`'s `update()` (lines
882-1097): countdown-state early-return branch (spawn telegraph +
position emit only) → `[1]` telegraph spawn mid-battle → `[3]` boss
phases/enrage → `[4][5]` recompute stat modifiers → Buff/DoT/Lava/Regen
→ Lava Zones → Sword Zones → Regen → Pháp Tu resource update → Kiếm Tu
channeling tick → `[6]` skill cadence + enemy attack timers → `[6b]`
Artifact activation timer → `[7]` teleport ICD → `[8]` enemy movement →
`[9]` position emit → `[10]` resolve casting → `[11]-[13]` AI
target/teleport/start-skill → Ultimate auto-check (1×/sec gate) →
`[14]` enemy attacks → `[15]` impact windup tick → `[16]` status VFX
diff → `[17]` check defeat → `[18]` final position emit. This matches
the "~2400 lines, 18-step pipeline" figure already used elsewhere in
this rework's docs — confirmed against the live source, not assumed.

## 3. UI → `BattleSystem` direct WRITE call sites (must be redesigned, not just adapted)

Only ONE component writes directly into live `BattleSystem` state,
found via `grep "gameManager\.battleSystem\."` across `game/src/components/`:

`KiemTuCombatHud.vue` (also documented from a different angle — the Ult
button UX — in `game/docs/combat-ui-controls-survey.md`, §2/§4,
2026-09-03, uncommitted until this session):
- `gameManager.battleSystem.setChannelTickSeconds('bat_kiem_thuat', seconds)` — the "Nhịp Tụ Lực" 3-9s slider (Kiếm Tu Bạt Kiếm route only).
- `gameManager.battleSystem.ultAutoEnabled` — read/write boolean, the "Tự động" ult toggle checkbox.
- `gameManager.battleSystem.tryPlayerUltimate()` — the Ult button's click handler.

Per the already-locked "Ultimate is just a slot-6 skill" decision
(2026-09-04, phiên 4 — see the roadmap's Manual tap-to-cast UI row),
`tryPlayerUltimate()`/`ultAutoEnabled` disappear entirely at cutover —
firing the ultimate becomes indistinguishable from firing any other
loadout skill through the Manual UI's normal cast flow.
`setChannelTickSeconds` (Bạt Kiếm's channel-tick slider) has no
turn-based equivalent decided yet — channel skills convert to
`chargeSteps` per the original design spec §3, but whether a
player-facing "how many turns to charge" slider still makes sense is
undecided, not surveyed here.

## 4. UI → `BattleSystem`/`GameManager` READ-only call sites (presentation, need an adapted data source, not new logic)

Found via `grep "gameManager\.getBattle\(\)"` across `game/src/components/`:
- `CombatCountdownOverlay.vue` — reads `battle.state === 'countdown'` and `battle.countdownSecondsRemaining`.
- `CombatResultModal.vue` — reads `battle.state` (routes to Victory/Defeat panel).
- `PillBagSection.vue` (×2) — reads battle state to gate pill usage during combat.
- `ArtifactPanel.vue` — reads `!isBattleInProgress(battle?.state)` to gate artifact panel access.
- `CombatTopBar.vue` — via `gameManager.getStageProgress()` (wraps `stageWaves.getProgress()`), shows spawned/total/alive counts.
- `MortalCombatHud.vue` / `KiemTuCombatHud.vue` — read `gameManager.getBattle()` for `isBattleInProgress()` gating of cadence-smoothing display.

None of these mutate battle state — they render or gate other UI based
on `battle.state`/`countdownSecondsRemaining`/stage progress counts.
Whatever `TurnBattleSystem`'s eventual public shape is, it needs an
equivalent queryable `state`/progress surface for these to keep working
— this is an adaptation task (read from a new shape), not a redesign of
behavior.

## 5. `CombatAiPanel.vue` — indirect, not a `BattleSystem` call site

`CombatAiPanel.vue` calls `gameManager.setCombatAiStrategy(player.$state, strategy)` —
writes to `PlayerData.combatAiStrategy`, a plain data field. `BattleSystem`
reads this strategy internally (`aiStrategy()` closure,
`ActionTargetingSystem`'s `CombatAiStrategy` consumers) but the panel
itself never touches `BattleSystem` directly. Listed here for
completeness of the AI-strategy surface, not because it needs the same
treatment as §3's direct writes.

## 6. Combat entry points (not mid-battle control, but part of the same external contract)

- `GameManager.startBattle(player, enemy)` (`GameManager.ts:2334`) — direct 1-enemy battle start (used by, e.g., Tribulation flows outside normal stage progression).
- `GameManager.startStage(player, playerStats, stage, repeatContinuously)` (`GameManager.ts:2684`) — the real stage-progression entry point, delegates to `StageWaveSystem.start()`.
- `GameManager.getStageProgress()` — delegates to `StageWaveSystem.getProgress()`, consumed by `CombatTopBar.vue` (§4).

## 7. What this survey deliberately does not do

- No proposed replacement API/contract shape for `TurnBattleSystem` to expose.
- No decision on how `KiemTuCombatHud.vue`'s 3 direct-write call sites map onto the future Manual UI (Ultimate folding into loadout slot 6 is already decided; the Bạt Kiếm channel-tick slider is not).
- No decision on whether `updateBattleFixedStep`'s 0.1s fixed-step model survives at all once combat is turn-driven (a turn-based engine has no obvious "tick rate" — likely gets replaced by "resolve exactly one entity's turn per call," matching `TurnBattleSystem` Slice 1's `runToCompletion()` loop shape, but this is a design decision for whoever writes the real cutover slice, not decided here).
- No plan document. This inventory is the deliverable.
