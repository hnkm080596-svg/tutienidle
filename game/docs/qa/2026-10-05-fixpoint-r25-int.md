# Fixpoint r25 — INT audit (integration coherence), commit 2a3f95a9

Audited batch (r24 adjudication):

1. `sanitizeRestoreAuthority` (`saveTypes.ts:298`): present-but-corrupt
   authority (non-finite or `|x| >= 2^52` stamp) degrades to
   `{kind:'live-replacement', nowMs: Date.now()}`; `undefined` stays
   reserved for an absent authority.
2. `GameManagerSaveRestore.ts:424` — `settleNowMs =
   Math.min(lastSavedAt + elapsed*1000, authorityNowMs, Date.now())`
   (the adjudicated r24-INT-01 direction).
3. `saveShapeValidation.ts` `validateQuestSave` — `QUEST_LIST_CAP = 1024`
   on `active` / `completedOnceIds` / `questFlags` (`:3203-3273`).
4. `CultivationInsight.ts` comment correction (mechanical, no surface).
5. Auditor probe files (`auditR24*.probe.test.ts`) +
   `player.restoreFromSave.test.ts` flips.

Branch `codex/hoa-cau-fireball-vfx` @ `2a3f95a9` (worktree main
checkout). Probes: `src/services/save/auditR25Int.probe.test.ts` —
13/13 green (`npx vitest run src/services/save/auditR25Int.probe.test.ts`).

## Verdict: FAIL — one new Medium+ finding (R25-INT-01, High)

The adjudicated batch itself is coherent end-to-end: the same authority
object reaches both restore bodies, the degrade is deny-direction on
both, the `settleNowMs` clamp closes the authority-seeded self-brick arm
as designed (dues defer to real wall time, none lost), `QUEST_LIST_CAP`
bounds all three crafted-list lanes while honest flows sit ~48x under
it, and the payload-identity caches keep the deny-only property the
r24 adjudication excepted. The finding below is the *payload-seeded*
sibling of the defect the batch just closed — same self-brick, a
different inlet the settle clamp cannot reach.

## Invariant ledger

| ID | Invariant under audit | Evidence | Verdict |
|----|-----------------------|----------|---------|
| I-a | `restoreGameSession` hands ONE authority object to both bodies | probe (a): spy identity `toBe(authority)` on both `player.restoreFromSave` (`SaveSystem.ts:293`) and `saveOps.restoreFromSave` (`SaveSystem.ts:297`); corrupt stamp -> `elapsedSeconds=0`, `offline.cultivation=0`, settle skipped | **Coherent** |
| I-b | Degrade is per-consumer but identical in class | probe (b): two `sanitizeRestoreAuthority` calls stamp their own `Date.now()` (T1 vs T2 — distinct `nowMs`); end-to-end, player body under T1 -> `elapsedSeconds=0`, fresh manager body under T2 -> `settleAutoFarmOffline` never called | **Coherent** (the per-consumer `nowMs` is consumed only as a settle cursor/elapsed bound — never persisted — so the drift is cosmetic) |
| I-c | `settleNowMs` clamp splits paid span vs persisted stamps correctly | probe (d): honored cold-boot `untilMs = NOW+30s` -> player `elapsedSeconds=630` (full approved span); seeded lane heads all `startedAtMs <= NOW`; heads pending past now collect at real wall time (tick at `NOW+101s` turns `cycleId`s over) | **Coherent** — designed split, no dues lost |
| I-d | `EarlyGameSession` absent-authority path unchanged | probe (e): `restoreCheckpoint` (`EarlyGameSession.ts:645-655`) passes no authority; 7200s save -> player `elapsedSeconds=7200` AND `settleAutoFarmOffline(_, 7200)` — legacy client window on both sides | **Coherent** |
| I-e | `QUEST_LIST_CAP=1024` vs honest flows | probe (f): saturating `ensureActive`/`markCompletedOnce`/`markQuestFlag` over the whole authored roster (`QUESTS.length=21`) produces a validating save; crafted 1025-entry lists reject on all three slices | **Coherent** (~48x headroom; no honest flow approaches the cap — `ensureActive`/`markCompletedOnce`/flag dedup bound all three lists to the roster) |
| I-f | Payload-identity caches deny-only post-fix (R24-COR-2/INT-03 claim) | probe (g): corrupt-then-honest on the MANAGER side -> `settleAutoFarmOffline` never re-invoked (`lastAppliedPayloadHash`, `GameManagerSaveRestore.ts:114,160,552`); honest-then-corrupt on the player side -> cached result replayed, `player.cultivation` unchanged (no re-grant); split-brain retry -> cached deny + live honest settle, each legitimate for some authority | **Coherent** — the deny-only claim holds on both sides |
| I-g | Round-trip: degrade -> save -> honest re-restore leaves no poison | probe (round-trip): denied restore repackages into a shape-valid save; a fresh store restores a later honest save under a real authority and settles 300s normally | **Coherent** |
| I-h | Boundary `>60s` settle gate | observed: `elapsed=60` exactly accrues 60s player-side but the strict gate (`GameManagerSaveRestore.ts:450`) skips every manager settle — dues collect live instead. Deny-direction, deliberate ("same >60s gate as Production catch-up") | **Consistent by design** |
| I-i | >24h cold-boot split (r24 seam (b) carried) | `Number.POSITIVE_INFINITY` still feeds the manager settle while the player accrual keeps the 24h cap — a >24h honored window settles all manager dues but pays the player 24h. Deny-direction, pre-existing, documented | **Consistent** (carried observation) |

## Finding

### R25-INT-01 — payload-seeded future epoch: a consistent `+Δ` save self-bricks the next honest write — **High**

**Class** REAL_DEFECT · the payload-seeded sibling of r24-INT-01 (which
the batch's `settleNowMs` clamp closed for the authority-seeded arm).

**Chain** (all steps executed, probe (c)):

1. A save whose stamps are all shifted `+Δ` together (`lastSavedAt`,
   `workerCycles.startedAtMs/completesAtMs`, `tribulation.cooldownUntil`,
   `quests.lastDailyResetAtMs` — all = NOW+Δ-family) passes
   `validateGameSaveShape` cleanly. No admission pin can see a
   consistent future epoch: `lastSavedAt` is never bounded against the
   wall clock, and every in-payload pin (`startedAtMs <= lastSavedAt`,
   `cooldownUntil <= lastSavedAt + 300s`, span equality) compares
   payload fields to the payload's own marker.
2. `restoreGameSession` restores the deadline channels **verbatim** —
   `ProductionSystem.restoreStates` (`ProductionSystem.ts:129`),
   `AlchemySystem.restoreJobs` (`AlchemySystem.ts:358`),
   `tribulationDirector.restoreRuntime` — while the *healed* siblings
   clamp at restore: `QuestManager.restore` `min(stamp, now)`
   (`QuestManager.ts:186`), `BuildingManager.restore` future-clamp
   (`BuildingManager.ts:49`), `boundTimedEffectClocks` for
   `appliedAtMs`/`expiresAtMs` (r22-AUT-1), the armed-farm re-anchor
   `settleAutoFarmOffline(player, 0)` (`GameManagerSaveRestore.ts:482`).
   Probe evidence: post-restore, `workerCycles[0].startedAtMs =
   NOW+Δ-100s`, `tribulation.cooldownUntil = NOW+Δ+120s`, but
   `lastDailyResetAtMs <= NOW`.
3. The next `buildGameSave` stamps `lastSavedAt = Date.now()` over the
   verbatim `+Δ` heads, and `writeGameSave` (`SaveSystem.ts:421-435`)
   persists it with **no validation** — the write path never runs
   `validateGameSaveShape`.
4. Next load: `loadGame` (`SaveSystem.ts:524`) rejects the game's own
   save as `corrupted` on `workerCycles[].startedAtMs > lastSavedAt`
   (`saveShapeValidation.ts:3484`), `alchemyJobs[].startedAtMs >
   lastSavedAt` (`:3714`), `tribulation.cooldownUntil` (`:4528-4530`)
   → SaveIncompatibleScreen (export-or-delete).

**Reachability** (honest, not crafted):

- Device clock fast at save time, corrected before the next load —
  NTP catch-up, timezone travel, or (the genre-specific one) the
  player setting the clock forward to cheat idle time and it syncing
  back. The fast-clock save is self-consistent `+Δ`; it loads and
  restores fine *while the clock stays fast*, then bricks on the first
  corrected-clock session.
- Cross-device: fast-clock save on device A -> cloud sync -> restore on
  device B at true time -> B's autosave self-bricks -> the doomed
  payload pushes back to cloud, poisoning A's mirror too.
- A crafted `+Δ`-consistent payload also admits trivially — but that
  arm is self-DoS only, no attacker gain.

The poison decays in real time (each `+Δ` deadline completes and is
replaced by a fresh `<=now` stamp), but autosave lands inside that
window almost certainly — one doomed write is enough to lose the slot
at the next boot.

**Why the batch cannot see it**: the adjudicated fix clamps
`settleNowMs` — the *settle-seeded* stamp inlet. This arm needs no
settle at all: `restoreStates`/`restoreJobs`/`restoreRuntime` copy the
payload's own deadline stamps into live state regardless of authority.
The r24-INT-01 "suggested direction" fixed the cursor; the restore-seam
heal coverage (which fields clamp at restore vs which stay verbatim)
was never audited as a set — the asymmetry table above is the gap.

**Suggested direction** (for adjudication, not this audit's scope):

- Restore-side repair for the deadline families: shift a `+Δ` deadline
  group into the client epoch at restore (e.g.
  `shift = max(0, startedAtMs - now)` subtracted from the family's
  stamps — preserves in-family spans, matches how the healed siblings
  clamp to `min(stamp, now)`/`now`), or
- write-side self-check: run `validateGameSaveShape` on the outgoing
  payload in the autosave/write seam and refuse + surface instead of
  overwriting a healthy slot — same "a file the boot restore would
  reject must not overwrite a healthy save slot" parity the import gate
  already enforces (F-INT-03, `SaveSystem.ts:758`).

**Probe evidence**: `seam (c)` — crafted `+Δ`-epoch save admitted
(`ok=true`), restores `startedAtMs = NOW+Δ-100_000` +
`cooldownUntil = NOW+Δ+120_000` verbatim while
`lastDailyResetAtMs` clamps to `<= NOW`; repackaged `buildGameSave`
fails validation with `workerCycles.startedAtMs` and `tribulation`
issues. Plus the deferred-collection arm in `seam (d)` proving the
clamp loses no dues.

## Notes for adjudication

- The r24 batch's own changes are clean — this finding is a pre-existing
  inlet the new clamp cannot cover; charging it to the batch's scope or
  carrying it forward is the coordinator's call.
- `decompose.nextCycleAt` restores verbatim too, but has no
  `> lastSavedAt` admission pin — it defers, never bricks (different
  class; recorded so the repair sweep does not miss it when deciding
  which deadline channels to heal).
- Per-consumer degrade `nowMs` drift (I-b) is cosmetic — the stamp is
  only a settle cursor, never persisted.
