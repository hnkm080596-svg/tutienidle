# Fixpoint r19 INT — blind audit of commit 8f60f30c (the r18 adjudication batch)

Blind integration-coherence audit of the r18 batch across the
save/restore/production/timed-effect boundary. Scope: (1) the split
`boundTimedEffectClocks`/`payoutExpiresAtMs` bound, (2) `LaneCursor.seeded`/
`seededPending` vs online 'observe' mode, (3) `offlineSinceIsServerEpoch`
removal completeness, (4) comment/doc coherence with shipped code.

**Verdict: PASS WITH EVIDENCE** — no Medium-or-higher defect found; two
Nit-level stale comment fragments (both pre-existing since r15, re-flagged
because r18's purpose-split makes them more wrong, not less).

## Axis 1 — `boundTimedEffectClocks` / `payoutExpiresAtMs` bound consistency

**Coherent. Evidence:**

- The stored bound is `min(expires, provenance + dur)` with
  `provenance = min(lastSavedAt, authorityNow)` (player.ts:135-143,387-389);
  the payout bound is `min(expires, lastSavedAt + dur)` (player.ts:163-174).
  `boundTimedEffectClocks` has exactly ONE production caller (restore map,
  player.ts:616); `payoutExpiresAtMs` exactly one (payout map, :405).
  Grep-verified.
- The two bounds are EQUAL whenever an offline payout can run: under every
  authority path, `elapsed > 0` implies `lastSavedAt <= authorityNow`
  (cold-boot: `elapsed = until - since`, and `lastSavedAt <= until` unless
  the client clock was ahead at save time; local: `lastSavedAt <=
  Date.now()`). Under a fast client clock (`lastSavedAt > until`) the stored
  bound is strictly tighter (`until + dur < lastSavedAt + dur`) — the
  deny-direction divergence the adjudication documents; the payout still
  pays the payload-epoch class max, and a crafted claim cannot mint beyond
  `lastSavedAt + dur` (probe A pins crafted `+6d` expiry == honest `+24h`
  payout).
- `percentAtSave` reads the RAW payload array at `lastSavedAt`
  (player.ts:444-447) — identical inputs to the validator's F-TC10-CPS
  probe (`saveShapeValidation.ts` cps gate): same array, same instant, same
  `getActiveCultivationSpeedPercent` (source=`tu_linh_tran` AND
  group=`tu_linh_tran` AND percent in (0,0.25]). The validator's TLT branch
  (:1548-1594) triggers on `sourceItemId === 'tu_linh_tran'` and REQUIRES
  the TLT group — so every record the probe counts has passed the TLT gate
  or was rejected. Probe parity is exact by construction.
- No unbounded-`expiresAtMs` reader survives: the restore map is the only
  path into `player.persistentTimedEffects`; raw reads are the two
  documented probes (validator + `percentAtSave`), both sampling the payload
  epoch at the marker — consistent.
- Boundary `expires == lastSavedAt`: dead in the stored copy (dead arm
  `min(nowMs, Date.now())`), dead in the payout copy (own stamp <=
  windowStart), dead in both probes (strict `>`). Consistent.
- Non-finite `lastSavedAt` divergences (provenance falls back to
  `authorityNow`, payout passthrough) are unreachable — validator pins
  `lastSavedAt` finite (:2297) before restore can run.

## Axis 2 — `LaneCursor.seeded` / `seededPending` vs 'observe' tickWorkers

**Coherent. Evidence:**

- `seeded` is set only on `emptyLaneStartMs`-spawned cursors
  (WorkerLaneAdvance.ts:158) and inherited by successors (:251). Saved lanes
  (`lane.saved` set) never carry it — `seeded && saved` is unreachable —
  so dropping the old `saved === undefined` predicate is exactly equivalent.
- Observe mode: `tickWorkers` (ProductionSystem.ts:414-426) passes
  `advanceMode:'observe'`, no `budgetMs` (jump block unreachable — needs
  `hasBudget`), `emptyLaneStartMs: nowMs` (seeds DO get `seeded:true` —
  probe E pins `seededPending.length == 2` on the result) — but the ONLY
  `seededPending` consumer is `settleWorkersOffline`'s re-stamp
  (ProductionOffline.ts:184-193). tickWorkers writes `result.pending` raw.
  The flag rides `LaneCursor` only and is never persisted onto
  `ProductionCycle` — no leak channel exists. On the next settle those
  cycles arrive as saved lanes (unmarked) — double-shift is structurally
  impossible.
- `pending <-> lanes` index alignment: `pending = lanes.map(...)` then
  `pending.filter((_, i) => lanes[i].seeded === true)` — 1:1 by
  construction over the same array; splices/reinserts happen before the
  map.
- `inFlight`/slots accounting: the respawn gate `advanceMode ===
  'deadline' && canSpawn && inFlight < slots` is identical on the normal
  path and inside the jump (both decrement-then-check). Oversubscribed
  saved lanes (`lanes.length > slots`) die in due order until
  `inFlight < slots`; the survivor respawns — the site converges to exactly
  `slots` live lanes. Probe D pins forfeit parity: 3 saved lanes at
  slots=1 under the jump arm => `forfeited = 1 + 1 + skippedDues`
  (dying lanes count the head only; the survivor counts its whole tail —
  the r18-COR-3 fix verified).
- `slots = 0` / `workerCapacity = 0`: no seeds spawn (`count < 0` fails);
  saved lanes settle once and die (D1 retained-work contract — pinned by
  existing tests).
- `fieldEpochShiftMs = max(0, Date.now() - nowMs)` is a correct
  epoch translation: seed chains always root in `nowMs`'s own epoch —
  verified for every ordering: `lastSavedAt <= since` roots at
  `lastSavedAt` (payload) with `nowMs = lastSavedAt + elapsed` (payload);
  `since < lastSavedAt <= until` roots at `since` (server) with
  `nowMs = until` (server — since `lastSavedAt + elapsed >= until`
  whenever `lastSavedAt > since`); local path `nowMs = Date.now()` gives
  shift 0. The head lands at `fieldNow + remaining-in-cycle` — honest
  remaining work preserved. Slow field clock (`Date.now() < nowMs`) yields
  shift 0 — bounded underpay direction only. Probe C pins a mixed site:
  saved-chain successor head keeps its client-epoch stamp (the documented
  one-time residual), seed-rooted heads shift +200k.
- Slot allocation is identical online/offline: both call
  `allocateWorkerSlots(activeStates /* autoRestart only */, ...)`, so a
  non-autoRestart site gets `slots = 0` in both paths — no offline-only
  seeding asymmetry.

## Axis 3 — `offlineSinceIsServerEpoch` removal completeness

**Complete. Evidence:**

- `git grep` for `offlineSinceIsServerEpoch`, `spawnedSeedsAreServerEpoch`,
  `serverSeeded`, `serverSeededPending`, `serverEpoch` across
  `game/src` and `game/tests`: ZERO hits outside `docs/qa/*r18*.md`
  (which describe the pre-fix state — correct as historical record).
- `emptyLaneStartMs` has exactly one producer expression:
  `offlineSinceMs = min(lastSavedAt, authorityNow - elapsed)`
  (GameManagerSaveRestore.ts:426-429) — consumed as the seed anchor by
  `settleWorkersOffline` (:165). Online producer: `tickWorkers` passes
  `nowMs` (:423). Paths agree by construction: cold-boot uses the
  authorized window start; warm-load/local resolves to `lastSavedAt`
  (`min(lastSavedAt, Date.now() - elapsed)` with `elapsed = Date.now() -
  lastSavedAt`); legacy save (`lastSavedAt` absent) resolves to
  `settleNowMs`; checkpoint restores (`EarlyGameSession.restoreCheckpoint`)
  run without authority => `Date.now()` epoch, where `shift = 0` makes the
  re-stamp a no-op. `start <= end` holds in every case (proved: the four
  orderings all yield `offlineSinceMs <= settleNowMs`).
- Gate unchanged: settle only when `elapsedOfflineSeconds > 60`
  (GMSR:431); 'live-replacement' accrues 0 and skips the settle.

## Axis 4 — comments/docs coherence vs shipped code

**Mostly coherent; two stale fragments.**

- The rewritten `boundTimedEffectClocks` docstring (:99-134) accurately
  describes the r18 semantics (provenance bound, rebuy-chain merge shape,
  irreducible fast-clock loss). The `payoutExpiresAtMs` doc (:146-162)
  matches its code. The jump-guard comment (WorkerLaneAdvance.ts:180-192)
  matches `headCostMs > budgetLeftMs && cycleMs > budgetLeftMs`. The
  `seededPending`/`seeded` docs (:81-90, :103-109) match.
- The three r18 findings docs + adjudication doc match shipped code:
  every disposition claim spot-checked — bounds text, jump guard, forfeit
  parity, flag removal, "seededPending only consumed by ProductionOffline",
  "988 tests, all green" (re-verified: scoped run `npx vitest run
  src/core/production src/services/save src/stores` = 64 files / 988
  tests green at 8f60f30c). The adjudication's "dead arm keeps the r17
  `min(nowMs, Date.now())` clamp" is accurate — `git log -S` shows the
  exact string entered in `cef2af9e` (r17).
- All r18 repro pins green at the audit commit (36/36 across the six
  r18/r16/r17 pin files).

## Confirmed findings

### R19-INT-01 — Nit — stale "shared helper" claim in `boundTimedEffectClocks` docstring

`game/src/stores/player.ts:107-109`:

> `Shared by the offline-payout read and the persistentTimedEffects restore map so crafted spans cannot feed the settlement seam through a raw copy.`

False at HEAD: the offline-payout read maps through the SIBLING function
`payoutExpiresAtMs` (player.ts:405), which takes a different anchor
(`lastSavedAt + dur`) — `boundTimedEffectClocks`'s only caller is the
restore map (:616). Stale since r15 (`ed0f57e9` split `payoutExpiresAtMs`
out; `git log -S` confirms the sentence entered in r13 `2ffe6e9d` when the
claim was true). r18 rewrote this docstring's surrounding paragraphs and
kept the stale line; post-split it actively misleads a reader about which
function bounds the payout copy. Evidence: SOURCE_PROOF + caller grep.

### R19-INT-02 — Nit — r13-INT-03 comment still says "(same bound as the restore map below)"

`game/src/stores/player.ts:397-399` (comment over `payoutTimedEffects`):

> `... a crafted oversized span otherwise pays its boost over window stretches no authored duration could cover (same bound as the restore map below).`

The parenthetical is false under `lastSavedAt > authorityNow`: payout
bound = `lastSavedAt + dur`, restore-map bound = `min(lastSavedAt,
authorityNow) + dur` — strictly different under a fast clock (that split
is precisely what r18 introduced). Under honest clocks they coincide
numerically, so the claim is imprecise rather than wrong for honest saves.
Stale since r15 for the same reason as INT-01. Evidence: SOURCE_PROOF +
probe B (stored `until+24h` vs payout `lastSavedAt+24h` under 2h skew).

Adjacent minor instance, same class: `ProductionOffline.ts:152` — "empty
lanes produce only from the save instant (offlineSinceMs)" — under
cold-boot `since < lastSavedAt` the anchor is the SERVER cutoff, not "the
save instant" (the r14-COR-1 authority-window start). Cosmetic.

## Residual / verified-clean notes

- Saved-chain heads keep their own stamps under a forward shift — the
  documented one-time `~1 in-flight grant settles late` residual
  (ProductionOffline.test.ts:427-432 pins it). Not an exploit: the
  persisted deadline is honest wall-clock work; the grant pays once.
- Stackable `expiresAtMs` passthrough remains the r14-AUT-1 accepted
  residual, identical in both bound functions.
- `forfeited` still has no production consumer (tests only) —
  r18-AUT-N1's DOCUMENTED disposition holds.

## Evidence

- Probe file: `game/src/services/save/auditR19Int.probe.test.ts` — 5
  probes, all green at 8f60f30c: crafted-parity (A), bound ordering under
  fast clock (B), mixed-lane seed/saved classification (C),
  oversubscribed forfeit parity (D), observe-mode seeded marking (E).
- Scoped suite: `npx vitest run src/core/production src/services/save
  src/stores` — 64 files / 988 tests green.
- r18 pin files: `npx vitest run src/stores/auditR18Int.repro.test.ts
  src/stores/player.r18Aut.test.ts src/services/save/fixpointR18Cor.qa.test.ts
  src/services/save/fixpointR16Cor.qa.test.ts
  src/services/save/SaveSystem.timeAuthority.test.ts
  src/core/production/ProductionOffline.test.ts` — 6 files / 36 tests green.
