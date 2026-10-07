# QA Review: fixpoint r26 AUT — blind audit of the r25 adjudication batch

- Date: 2026-10-05
- Mode: deep (adversarial blind audit, assigned arm: AUT)
- Audited commit: `8f3cb237` on `codex/hoa-cau-fireball-vfx` (includes the
  wire-form follow-up: `driveSave` validates `JSON.parse(JSON.stringify(snapshot))`
  and refuses unserializable payloads with `OUTGOING_UNSERIALIZABLE` retryable:false)
- Verdict: **FAIL** — 1 High, 1 Medium, 1 Low, 2 Nit
- Task-owned paths: `game/src/services/save/auditR26Aut.probe.test.ts`,
  `game/docs/qa/2026-10-05-fixpoint-r26-AUT.md`
- Probe run: `npx vitest run src/services/save/auditR26Aut.probe.test.ts --pool=threads`
  → 14/14 pass (deterministic; `Date.now` mocked at `NOW = 1_725_160_000_000`)

## Scope and Risk Map

Audited surface: `CloudSaveCoordinator.driveSave` write gate (wire form),
`useAppLifecycle` remote-authoritative fail-closed authority mint,
`GameManagerSaveRestore` `offlineSinceMs` Date.now() clamp, `stores/player.ts`
`effectProvenanceMs` / `boundTimedEffectClocks` Date.now() clamps,
`saveShapeValidation.ts` `ID_COLLECTION_CAP` + record caps + quest cap ordering,
`saveTypes.ts` `sanitizeRestoreAuthority` kind whitelist, test-side fixture
replacement.

One-hop consumers checked: `SaveSystem.buildGameSave` / `restoreGameSession`,
`player.save` / `persistPlayer` write funnel, `importSaveRaw`, `restoreBackup`,
`resetCharacter`, `ProductionSystem.restoreStates`, `AlchemySystem.restoreJobs`,
`TribulationDirector.restoreRuntime/serializeRuntime`, `DecomposeSystem.restore/
getSaveState`, `QuestManager.restore`, `GameManagerAutoFarmOps.settleAutoFarmOffline
/tickAutoFarm`, `assertSaveAcceptable`/`isSaveAcceptable`, the
`useAppLifecycle.ts:567-590` boot-commit refuse arms, `DATA_REFUSE_CODES`.

## Findings

### QA-r26-AUT-1: Post-dated deadline stamps restore verbatim — every subsequent write self-bricks until the forged delta elapses; under remote authority the boot commit refuse wedges the character permanently with no designed escape

- Severity: **High** (Critical-shaped under remote-authoritative: literal
  inability to boot; graded High for the precondition — a poisoned-but-valid
  row must already exist: skewed-clock device, crafted import, or pre-gate row)
- Status: **Confirmed** (probes A1–A4, B1)
- Invariant: "the write-side gate is the remedy" / "bounded deny, never a
  grant" (r25 adjudication + driveSave comment at `CloudSaveCoordinator.ts:148-155`)
- Mechanism chain:
  1. Craft/skew a save with `player.lastSavedAt = now + Δ` and payload-
     consistent deadline stamps: `workerCycles[].startedAtMs ≤ lastSavedAt`,
     `alchemyJobs[].startedAtMs ≤ lastSavedAt` (spans stay authored),
     `tribulation.cooldownUntil = lastSavedAt + 300s` (the legal max under
     the pin). `validateGameSaveShape` **passes** — every admission pin
     compares stamps to the payload's *own* editable marker
     (`saveShapeValidation.ts:3503`, `:3733`, `:4540-4559`), never to real
     time. `isSaveAcceptable` **passes** — it contains no timestamp checks
     at all (registry refs / technique holder / progression / body only).
     → `probe A1`
  2. Restore loads the stamps **verbatim**: `ProductionSystem.restoreStates`
     (~:129), `AlchemySystem.restoreJobs` (:358-365, copy), `TribulationDirector
     .restoreRuntime` (:843-855, `slice?.cooldownUntil ?? 0`),
     `DecomposeSystem.restore` (max-clamp only). Nothing re-anchors them —
     unlike `autoFarmStage.lastCheckedMs` (re-anchored `>now→now`) and
     `quests.lastDailyResetAtMs` (clamped `min(state, nowMs)`), the deadline
     channels got no equivalent clamp. → `probe A2`
  3. The next `buildGameSave` stamps `lastSavedAt = Date.now()` (real now)
     but re-emits the future stamps verbatim (`SaveSystem.ts:392,402,413`).
     Every pin now fails vs real time → `driveSave` returns
     `OUTGOING_ADMISSION_REJECTED` before the service → `probe A3`.
  4. Wedge bound = Δ exactly: refused at `FUTURE − 1s`, admitted at `FUTURE`
     (`probe A4`, Δ = 400 days; max crafted Δ ≈ 2^52 ms ≈ 285k years).
     "Progress defers until the stamps are in-domain" is technically true
     and practically permanent; deadline records can't settle early because
     their `completesAtMs` are equally post-dated.
  5. Under **remote-authoritative** boot (`useAppLifecycle.ts:529-590`): the
     post-accrual commit `player.save` → the same refuse. The designed
     un-wedge arm requires `!retryable && code ∈ {SAVE_INVALID,
     SAVE_TOO_LARGE}` (:567-571). `OUTGOING_ADMISSION_REJECTED` is
     **retryable:true and carries no `code`** → the arm can never fire →
     falls to the generic `:583-588` → `onError` + `boot.fail()` —
     **every boot, forever**. Probe B1 drives the real composable:
     `boot.fail` called, `enterGame` never called, `saveIssue.report`
     (remote-reset + payload export) never called.
- Reachability: (a) a device whose clock is/was skewed — the gate's own
  motivating case ("written under a skewed clock or synced from another
  machine"): while skewed the write is self-consistent and commits; once
  the clock corrects (or another device pulls), the character wedges —
  including on the same device; (b) a crafted import file — the import gate
  enforces shape + `isSaveAcceptable`, both clock-free; (c) any pre-r25
  remote/local row already carrying post-dated records.
- Honest-vs-crafted boundary: Δ is the only knob. Small honest skew (seconds)
  wedges briefly; a player-visible wedge needs Δ ≫ session length — but the
  remote arm is *boot.fail()*, i.e. the character cannot even play while
  wedged (worse than the local tier, which plays but never saves).
- Owner subsystem: `services/save` + `services/cloudSave` + `useAppLifecycle`.
- Blast radius: one character row per poisoned save; remote tier hard-wedged
  at boot, local tier silently never persists.
- Suggested repair direction (not applied — QA boundary): restore-side
  re-anchor of post-dated deadline records (same deny-direction as the
  autofarm/quest clamps), or route the gate's refuse through a data-class
  `code` so the remote-reset surface can arm, or admission-side pin stamps
  vs the server `serverNowMs` where an authority exists.
- Test file: `game/src/services/save/auditR26Aut.probe.test.ts` arm A + B.

### QA-r26-AUT-2: Record-map channels bypass ID_COLLECTION_CAP — `hiddenBeastKills`, `productionSites[].hiddenChannelCycles`

- Severity: **Medium** (incomplete migration of the cap class; individual
  impact is inflation-only)
- Status: **Confirmed** (probes C1–C3)
- Mechanism: `ID_COLLECTION_CAP = 1024` lives inside `requireArray`/
  `optionalArray` (:441-486) plus `Object.keys().length` caps on three named
  records (`nodeLevels`, `nodeOneShotGrants`, `perfectClearSeconds`).
  `validateNonNegativeIntMap` (:524-540) iterates entries with **no count
  bound** — its two callers, `player.hiddenBeastKills` (:2359) and
  `productionSites[].hiddenChannelCycles` (:3568), accept arbitrary key
  counts. Probe C2: 2048-key maps pass `validateGameSaveShape`; probe C3:
  they restore verbatim via `Object.assign(this, restoredPlayer)` and
  re-emit on every write.
- Impact: a crafted import/remote row inflates the payload unboundedly →
  remote eventually hits `SAVE_TOO_LARGE` (which *is* in DATA_REFUSE_CODES —
  the designed escape arms there) and local hits the storage quota →
  generic 'unavailable' writes. No mint; deny-direction only, but the class
  the batch claims closed ("EVERY array channel + record maps") has two
  reachable holes.
- Contrast checked: `player.hiddenPerfection.hiddenBreakthroughRealmIds` is
  **not** a cap gap — the shape layer only reads it inline for the great_dao
  witness (:1821), and restore-side HiddenPerfection integrity rejects
  non-authored/prefixed realm ids (probe C3 negative check: `'rejected'`).
- Owner subsystem: `services/save/saveShapeValidation`.
- Blast radius: payload size only; per-write, every tier.
- Test file: same probe file, arm C.

### QA-r26-AUT-3: `decompose.nextCycleAt` has no marker pin — post-dated deadline persists through every write, idling the channel until Δ

- Severity: **Low**
- Status: **Confirmed** (probes A2, E4)
- Mechanism: `nextCycleAt` is validated only as a bounded timestamp
  (`saveShapeValidation.ts:4510`) — no `≤ lastSavedAt` pin (unlike the three
  pinned channels above). A post-dated value therefore survives admission,
  restores verbatim (`Math.max(this.nextCycleAt, max(0, restored))` —
  Monotonic max, can't even be pulled earlier), and re-emits on every write
  without ever failing the gate. The decompose lane simply sits idle until
  wall clock passes the stamp; the tick self-rebases afterwards.
- Reachability: crafted import / skewed-clock row, same as AUT-1.
- Test file: same probe file, E4.

### QA-r26-AUT-4 (Nit): `OUTGOING_UNSERIALIZABLE` also misses the DATA_REFUSE arm — unreachable for honest payloads

- Status: Confirmed shape-level (probe D1); reachability: none for honest
  writers — `buildGameSave` emits plain JSON, so only a crafted in-memory
  snapshot can be circular/unserializable. Retryable:false + codeless →
  generic `boot.fail` under remote if it ever fired. Recorded for the arm's
  completeness; not actionable.

### QA-r26-AUT-5 (Nit): displaced-queue callers resolve 'ok' without their payload ever being gate-evaluated

- Status: Confirmed by code read (`save()` join-or-displace at
  `CloudSaveCoordinator.ts:98-139`): caller A's resolver settles with the
  promoted snapshot's result — if A's payload was invalid it is never
  judged (and never lands). Deny-direction, contract ambiguity only; the
  drive-time wire check is what protects the slot, and it holds.

## Rejected attacks (verified, not findings)

- **Kind-whitelist injection**: both consumers sanitize independently
  (`GameManagerSaveRestore.ts:158`, `stores/player.ts:378`); unknown kinds →
  `{kind:'live-replacement', nowMs: Date.now()}` (probe E1). A crafted
  in-domain `live-replacement.nowMs` (incl. negative/small values) stays
  deny-direction only — all forward clamps include `Date.now()` operands.
- **Write-gate bypass via queue/displace/mutation**: the gate judges the
  wire form at drive time (:162-188), so queue-time→drive-time mutation is
  still judged; a displaced snapshot simply never writes. `resetCharacter`
  deletes + bumps `generation` (stales queued writes); the firstSave path
  routes through `coordinator.save` → same gate. `restoreBackup` restores
  raw bytes by design — the restored payload still faces the load gate and
  the write gate.
- **Imported writes**: `importSaveRaw` enforces shape + `isSaveAcceptable`
  (stricter than the write gate) — it *delivers* the AUT-1 row rather than
  bypassing a gate (counted as reachability, not a bypass).
- **autoFarm `lastCheckedMs`**: no marker pin, but restore re-anchors
  `>now→now` on every armed-farm path (`settleAutoFarmOffline` :270-276
  via `GameManagerSaveRestore.ts:486-492`; live tick :345-349) — probe E2.
- **quests `lastDailyResetAtMs`**: restore clamps `min(state, nowMs)`
  (`QuestManager.restore`) — probe E3.
- **`persistentTimedEffects` stamps**: r25 `Date.now()` clamps in
  `boundTimedEffectClocks`/`effectProvenanceMs` bound persisted stamps to
  the client epoch — closed.
- **`offlineSinceMs`**: r25-AUT-1 `Date.now()` clamp operand closes the
  lane-head seed — closed (r25 arm-B probe already pins).
- **Wire-form divergences**: NaN/Infinity → null in wire → judged invalid
  (probe D2); dropped `undefined`/function fields and `toJSON` evaluate
  identically at gate and writer; stateful-getter divergence requires a
  crafted *in-memory* object — JSON payloads can't carry getters, outside
  the honest threat model.
- **Uncapped `elapsedOfflineSeconds`** (`Number.POSITIVE_INFINITY` in
  `GameManagerSaveRestore.ts:389-402`): by design — each consumer applies
  its own cap (autofarm 24h, production per-channel, cultivation's own
  `calculateOfflineTime` default 24h). No unconstrained accrual observed.
- **Cold-boot reversed/crafted windows**: `sinceMs > untilMs` → elapsed 0;
  `untilMs` in-domain is honored exactly (r25 probes still green).

## Coverage notes / gaps

- The boot-wedge evidence (B1) is the real composable driven through the
  real `CloudSaveCoordinator`; the upstream remote service is a fake
  returning a fixed revision — the Supabase adapter adds no stamp remapping
  in between (payload travels as raw JSON), so the mechanism is faithful.
- Not probed end-to-end: `w5aut`/`useBootFlow` corrupted-surface visuals —
  the wedge specifically evades that surface (no `code`, not in
  DATA_REFUSE_CODES) so there is nothing to render.

## Verdict rationale

The r25 batch's write gate does what it claims — the healthy slot is
protected, the wire form is judged, displaced/queued payloads can't
smuggle, the authority whitelist and the new clamps hold. The residual
defect is what happens *after* a post-dated-but-valid row exists: restore
loads the stamps verbatim, every write refuses for up-to-permanent wall
time, and under remote authority the character can no longer boot at all
via the designed escape (the refuse's `retryable:true`/codeless shape can
never satisfy the data-class arm). The fixpoint isn't reached: the
self-brick *write* class is closed, but the self-brick *character* class
remains open on the three verbatim deadline channels.
