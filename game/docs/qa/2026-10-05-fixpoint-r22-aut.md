# Fixpoint r22 — AUT audit (adversarial exploit) of commit bf3b44a1 (the r21 magnitude-pin batch)

Auditor role: AUT (adversarial exploit). Blind to sibling waves'
results. Task: enumerate EVERY persisted timestamp/deadline/cursor in
the save schema and find any the `|stamp| >= 2^53` pin missed
(other validators, passthrough, nested/array/map/legacy shapes); then
attack the boundary, second-order corruption, non-timestamp
magnitudes, and re-derived cursors; escalate the documented "sub-pin
far-future parking = deny-direction, mints nothing" residual into
mint wherever a path exists.

Verdict: **FAIL WITH REASON** — 1 Medium (`persistentTimedEffects[].
expiresAtMs` on a `durationStackable: true` record has no forward
bound at admission AND is exempted from every restore clamp: a
crafted 9e15 expiry is a *permanent live buff* — grant polarity, so
the r21 residual's "deny-direction, mints nothing" classification is
wrong for this field; and the stackable refresh `expires = max(now,
expires) + duration` writes an out-of-domain `>= 2^53` stamp on the
next honest re-drink — a self-brick the game's own writer produces).
2 Low-latent (`hiddenChannelCycles` unbounded counters → deterministic
hidden-channel emission — scope-hidden today; `autoWorkerCapacity`
unbounded → >65,536 slots re-trips the r21 per-site freeze class once
`manualWorkforce` unhides). 1 Nit (the `accrueCultivationInsight`
drain loop is O(accumulator) — demonstrated hang on out-of-domain
input; admission is closed today by F-A11-2 — hardening note only).
The pins themselves all verify: boundary exact, every other cursor
either provenance-bound or self-heals/caps at restore, alchemy
unparkable, deep-past `lastSavedAt` subsumed by per-consumer caps.

Repro evidence: `game/src/services/save/auditR22Aut.probe.test.ts` —
8 probes, all green on bf3b44a1 (defect probes assert the current
admission/wedge state and flip red when a fix lands). Hang helper
`auditR22InsightHang.probe.test.ts` is env-gated
(`R22_INSIGHT_HANG_PROBE`) so a normal run never stalls. Scoped run
`npx vitest run src/services/save/auditR22Aut.probe.test.ts`:
**8/8 pass** in ~27s. `npm run type-check` clean.

---

## F-R22-01 — stackable `expiresAtMs`: no forward bound → permanent live buff + writer-emitted out-of-domain stamp (Medium)

**Root.** Two seams disagree about `durationStackable` expiries:

- `saveShapeValidation.ts` (~1657, regen branch): the expiry span is
  explicitly *not* bound — the inline comment says
  "expiresAtMs-appliedAtMs is NOT bound - the stackable refresh
  legitimately widens it (unbounded over drinks)". The only checks
  are `isBoundedTimestamp` (`|x| < 2^53`) and, per TLT records only,
  the `expiresAtMs <= lastSavedAt + TU_LINH_TRAN_DURATION_MS + 7d`
  provenance arm (~1578-1590). Regen/stackable entries skip that arm
  entirely (the `else` branch at ~1619).
- `stores/player.ts:131-139` (`boundTimedEffectClocks`): the live arm
  clamps `expiresAtMs` to `provenance + duration` **only when
  `effect.durationStackable !== true`** — stackable records keep the
  raw stamp verbatim, and the raw stamp is then `Object.assign`-ed
  into live `player.persistentTimedEffects`.

So a crafted stackable expiry is admitted, restored verbatim, and
read live — the one persisted timestamp the wave left dual-unbounded.

**Arm A — mint, not park (r21 residual escalation).** Crafted save
(`probe A1/A2`):

```ts
{
  id: 'fx-craft', sourceItemId: 'hoi_linh_dan_qi_refining',
  appliedAtMs: 1000, expiresAtMs: 9e15,
  effectGroup: 'hoi_linh_dan', durationStackable: true,
  modifiers: [{ stat: 'manaRegenPerTurn', flat: authored, domain: 'spell' }],
}
```

- `validateGameSaveShape` admits it (probe A1 asserts `ok === true`;
  the TLT twin with the same expiry is rejected — the gap is specific
  to the stackable arm).
- `boundTimedEffectClocks` keeps `9e15` verbatim (stackable
  exemption), so `getActiveTimedModifiers(player, Date.now())`
  returns the `manaRegenPerTurn` modifier NOW (probe A2): the buff is
  live for ~285 million years instead of the authored 75 seconds.

The r21 adjudication's accepted residual was framed as "sub-pin
far-future parking (9e15 family) — deny-direction self-harm, mints
nothing". That holds for *deadline* fields (a far-future `due`/
`cooldownUntil` just never fires — self-park). It does NOT hold for
an *expiry* field: far-future expiry on a live-effect record is the
buff itself — this field is grant-direction. The parked->mint
escalation the wave asked for exists and is demonstrated.

Scope of the mint: bounded stat (authored flat ≤
`mpPerSecond * potency <= 4.5` at qi_refining) but unbounded duration
and refresh — one crafted entry is a permanent regen modifier in
every battle and every restore forever.

**Arm B — second-order corruption: the writer mints an out-of-domain
stamp.** `GameManagerPersistentEffectOps.ts:315-317`:

```ts
const duration = Math.max(0, effect.expiresAtMs - effect.appliedAtMs)
existing.expiresAtMs = Math.max(Date.now(), existing.expiresAtMs) + duration
```

`existing.expiresAtMs` is additive. Craft `expiresAtMs =
2^53 - 1000` (admitted — probe B asserts `ok === true`). One honest
re-drink of the same family (`hoi_linh_dan` is live at qi_refining+,
not retired — `PillFamilies.ts:35,57-58`) runs the refresh:
`max(1.76e12, 9007199254740992 - 1000) + 75000 >= 2^53` → the record
is re-persisted verbatim → the NEXT boot's `isBoundedTimestamp`
rejects the save the game itself wrote (probe B asserts revalidation
`ok === false`). The r21 invariant "admission owns the bound, so no
writer emits out-of-domain" is violated on this additive path.

**Reachability.** Crafted save only; no honest path (honest expiry ~
`now + 75s`, honest chain growth ~75s per drink). Both arms fire on
ordinary load / consume — no special timing.

**Fix direction (for adjudication — do NOT take as spec).** The
writer-consistency break is unconditional regardless of the policy
choice: the stackable refresh should never emit `>= 2^53` (self-
clamp). For the admission gap: either (a) restore-seam bound — apply
the same `min(expires, provenance + dur + skew)` arm to stackable,
accepting that honest long chains exceed it (the same "irreducible
bounded loss" the TLT arm already accepts), or (b) admission bound
`expiresAtMs <= lastSavedAt + K * authoredDuration` for a pragmatic K
(≈ a year of drinks), or (c) bound the refresh itself so a re-drink
resets to a bounded window (`min(now + dur, ...)`) rather than
extending unboundedly. Note the honest stackable chain is genuinely
unbounded over drinks, so (a) at `+ dur` alone can clamp a live
honest chain — `+ 7d` skew slack may not suffice the way it does for
TLT.

---

## Swept — fields the pin did NOT miss (enumeration result)

Every persisted timestamp/deadline/cursor field in the save schema,
its pin, and its far-future/deep-past behavior:

| Field | Pin (bf3b44a1) | Crafted far-future / deep-past outcome |
|---|---|---|
| `player.lastSavedAt` | `isBoundedTimestamp` (sign allowed) | `9e15` → `elapsed=0` → pure park. `-9e15` → elapsed ~9e12 s, every consumer self-caps: cultivation/autofarm `DEFAULT_MAX_OFFLINE_SECONDS` (24 h), production `PRODUCTION_OFFLINE_CAP_SECONDS` (10 h) budget, decompose ≤5000 iterations — bounded mint = the authorized offline cap an honestly-aged save gets (probe D2) |
| `persistentTimedEffects[].appliedAtMs` | bounded + `<= lastSavedAt` (F-TC9-1) | past → dead/expired already; restore clamps `min(applied, now)` |
| `persistentTimedEffects[].expiresAtMs` (TLT `tu_linh_tran`) | bounded + `<= lastSavedAt + dur + 7d` | provenance-bound at admission AND clamped at restore |
| `persistentTimedEffects[].expiresAtMs` (non-stackable regen) | bounded | restore seam clamps to `provenance + dur` → cannot mint |
| **`expiresAtMs` (stackable regen)** | **bounded only — see F-R22-01** | **LIVE buff mint + writer overflow** |
| `autoFarmStage.lastCheckedMs` | non-neg bounded | future → settle re-anchors to now (AutoFarmOps ~341); past → 24 h cap |
| `buildings[].lastCollectedAt` | non-neg bounded (**SECONDS domain** — `BuildingManager.restore` compares against `Date.now()/1000`) | future → restore clamps to `now`; past → accrual is `min(elapsed, 36000 s)` then `min(stored, capacity)` — double-capped |
| `quests.lastDailyResetAtMs` | non-neg bounded | future → at most a one-shot daily-reset deferral (park) |
| `productionSites[].workerCycles[].startedAtMs/completesAtMs` | bounded + ordered + exact authored span + `startedAtMs <= lastSavedAt` | settle bounded by 10 h budget / jump-forfeit; pair cannot exceed `lastSavedAt + span` |
| `alchemyJobs[].startedAtMs/completesAtMs` | bounded + ordered + exact recipe span + `startedAtMs <= lastSavedAt` + reservation digest | far-future completion needs `startedAtMs > lastSavedAt` → admission rejects (probe D3); unparkable |
| `decompose.nextCycleAt` | non-neg bounded | far-future admitted but `tick` rebases `nextCycleAt - nowMs > cycleMs → now + cycleMs`; settle walks ≤5000 |
| `tribulation.cooldownUntil` | non-neg bounded + `<= lastSavedAt + authored cooldown` (F-LC-1) | provenance-bound; only honest-window park possible |
| `idleSkillInsightDaily.dayBucket/minted` | non-neg numbers | deny-direction (a far `dayBucket` suppresses a daily mint; never mints) |

Passthrough/nested sweeps: `committedOutcome` (tribulation witness:
attemptId/digest/seed — counters, no clocks), `equipment[]`,
`materials[]`, `pills[]`, `techniques[]`, `formations[]`, `questFlags`,
`hiddenPerfection`, `phapTuLab` — no unvalidated timestamp fields
flow into mechanism reads. `Object.assign(this, restoredPlayer)` does
copy unknown fields verbatim, but no live read consumes a
validator-unknown timestamp.

## Boundary check (PASS)

- `isBoundedTimestamp`/`isNonNegativeBoundedTimestamp` reject `|x| >=
  2^53`, admit `2^53 - 1` (probe D1 on `lastSavedAt`; the same helper
  gates every cursor above).
- Absorption inside the admitted domain: ulp on `[2^52, 2^53)` is 1,
  so the smallest possible integer delta (+1 ms) still advances; the
  smallest *authored* delta is `cycleMs = 22,000` ms (mortal L9,
  `ceil(100/4.6) = 22 s` — probe D1 asserts). No mechanism adds a
  sub-integer delta to a persisted stamp. No absorb, no wedge inside
  the domain.
- Second-order additive writes swept: the only `X += delta` on a
  persisted timestamp that can push past `2^53` is the stackable
  `expiresAtMs` refresh (F-R22-01 arm B). `nextCycleAt += skipped *
  cycleMs` lands ≤ `nowMs + cycleMs`; worker respawn dues land ≤
  `now + cycleMs`; `lastDailyResetAtMs`/`lastCheckedMs`/
  `lastCollectedAt`/`cooldownUntil` are set-from-now, not additive;
  `completesAtMs` is minted `start + authored span`.

## Non-timestamp magnitude sweep

| Field | Bound at admission | Consumer behavior on crafted magnitude |
|---|---|---|
| `cultivationInsightAccumulator` | **pinned `acc < insightThreshold` (F-A11-2)**, `>0` without the talent rejected (probe C1) | admission closed; mechanism loop O(acc) — see Nit below |
| `skillCastCounts`, `nodeLevels`, `talentLevels`, `nodeFreePurchaseRecord` | shape-gated / per-entry bounded where a gate reads them | generic counter forgery only — honest growth is unbounded, so no authored ceiling exists to pin; unchanged from earlier waves |
| `productionSites[].assignedWorkers` | non-neg int | bounded downstream by `betaEffectiveWorkerCapacity` |
| **`hiddenChannelCycles`** | **non-neg int, unbounded** | crafted `count >= guaranteedAfterCycles` forces one deterministic material emission per channel (counter resets to 0 on emit) — `hiddenGrottoChannels`/`hiddenContent` are scope-hidden today, so the surface is unreachable in beta; **Low-latent** — unhide without a bound mints guaranteed rare mats |
| **`autoWorkerCapacity`** | **non-neg finite, unbounded** | feeds `allocateWorkerSlots` → `slots` arg of `advanceWorkerLanes`; the r21 mechanism guard rejects `slots > 65_536` → a crafted capacity re-opens the per-site zero-advance freeze the moment `manualWorkforce` unhides. Today the beta pool is flat 3 — **Low-latent** |
| `companionPullsSinceRare` | non-neg | pull pool permanently closed — unreachable |
| `idleSkillInsightDaily.minted/dayBucket`, `duyenPhan`, `bossKillCount`, `skillInsight`, `cultivation`, `totalCultivationGained` | non-neg | currency/pity forgery — no authored ceiling; unchanged posture |

## Nit — `accrueCultivationInsight` drain loop is O(accumulator), not O(1)

`CultivationInsight.ts:20-24` — `while (acc >= threshold) { acc -=
threshold; skillInsight += 1 }`. Demonstrated: the env-gated child
probe on `acc = 1e15`, talent `ngo_dao` (threshold 2000) was still
inside the loop when killed at 25 s (probe C2 — marker armed, child
died by timeout). Admission is closed today (F-A11-2 pins `acc <
threshold`), so this is a hardening note only — `Math.floor(acc /
threshold)` + `acc %= threshold` makes the consumer O(1) and removes
the dependency on admission never regressing. Same argument the r20
wave used to justify the decompose O(1) fast-forward.

## Verified safe (PASS arms, probes green)

- D1 — exact `2^53` rejected / `2^53 - 1` admitted on pinned cursors;
  `2^53 - 1 + 22000` strictly advances (no absorb in-domain).
- D2 — `lastSavedAt = -9e15` admitted but every settle path self-caps
  (24 h / 10 h budget / ≤5000 / double-capped accrual).
- D3 — alchemy far-future pair rejected at admission
  (`startedAtMs <= lastSavedAt`), self-consistent digest included so
  the pin is the sole reject reason.
- C1 — accumulator pins hold (`>= threshold` rejected, `>0` without
  talent rejected, `1999` with `ngo_dao` admitted).
