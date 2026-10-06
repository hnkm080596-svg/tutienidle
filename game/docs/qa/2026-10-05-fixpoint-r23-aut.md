# Fixpoint r23 — AUT audit (da0d553d)

Blind adversarial audit of the r22 batch at `da0d553d`. Objective per
assignment: find a surviving mint/wedge/brick across five seams —
(a) the writer clamp edge, (b) the restore clamp applied to stackable,
(c) 2^52-admitted values feeding float derivations beyond
`offlineSinceMs`, (d) non-save feeds reaching mechanism guards via
runtime APIs, (e) the O(1) insight floor-division.

**Verdict: NO SURVIVING MINT / WEDGE / BRICK.** Every arm resolves to a
pin that holds or to a residual class already adjudicated and bounded.
Two latent hardening nits documented (both unreachable through any
admission or runtime feed). Probe suite:
`src/services/save/auditR23Aut.probe.test.ts` (14 probes, all green).

## The r22 batch under audit

- Admission bound on every persisted timestamp: `|x| < 2^52` (was 2^53).
- Stackable expiry exemption REMOVED in `boundTimedEffectClocks`
  (live-state copy) AND `payoutExpiresAtMs` (payout copy).
- Stackable writer: `expiresAtMs = min(2**52 - 1, max(Date.now(), old) + duration)`.
- `autoWorkerCapacity` ≤ 65536.
- `accrueCultivationInsight`: O(1) floor-division + non-finite guard.

## Arm (a) — writer clamp edge: NO MINT

`applyTimedEffect` stackable arm
(`GameManagerPersistentEffectOps.ts:315-328`):

```ts
const duration = Math.max(0, effect.expiresAtMs - effect.appliedAtMs)
existing.expiresAtMs = Math.min(2 ** 52 - 1, Math.max(Date.now(), existing.expiresAtMs) + duration)
```

- `duration` derives from the **incoming** effect, which every caller
  constructs in code (`PillSystem.consume`: `now + durationSeconds*1000`;
  TLT: `now + TU_LINH_TRAN_DURATION_MS`; Kiep Thuong the same). No
  persisted or player-controlled field reaches it. Probe A1: a
  negative-huge persisted `old` is floored by `max(Date.now(), old)` to
  `Date.now()` — refresh produces an honest `now+dur` stamp. Probe A2:
  a crafted incoming pair with `expires < applied` yields `duration=0`
  and can only hold or extend the expiry past `now`, never below it.
  Probe A4: the non-stackable arm is `max(existing, incoming)` — it
  cannot push a sub-pin admitted stamp out of domain, and no runtime
  caller passes an out-of-domain `incoming`.
- **Latent nit (A3, unreachable):** `Math.min(2**52-1, x)` propagates
  `NaN` — `Math.max(0, NaN)=NaN` on a NaN duration would write
  `expiresAtMs=NaN`, wedging the next write-time validation. No caller
  can produce a NaN stamp (every feed stamps `Date.now()` + authored
  finite durations). Same latent-hardening class r22 recorded; no fix
  requested — worth a `Number.isFinite` pre-guard only if a new feed
  appears that doesn't stamp its own pair.

## Arm (b) — restore clamp on stackable: NO ESCAPE

Every reader of `persistentTimedEffects` enumerated:

| reader | copy seen | clock bound |
|---|---|---|
| live array (post-`:630` map) | `boundTimedEffectClocks` | dead arm `min(now, Date.now())`; live arm `provenance + 24h` |
| offline payout map (`:416`) | `payoutExpiresAtMs` | `min(expires, lastSavedAt + 24h)` |
| `percentAtSave` (`:458`) | RAW payload stamps | percent only (≤0.25), used for the un-buff divide — consistent with payout |
| `foldRetiredPillPermanents` (`:589`) | RAW | reads `modifier.flat/stat` only — no clock fields, inert |
| `getActiveTimedModifiers`/`tick`/`activateTuLinhTran`/`CultivationTick` | live array | clamped |

**Anchor mismatch closed:** `payoutExpiresAtMs` anchors `lastSavedAt`
(payload epoch) while `boundTimedEffectClocks` anchors
`min(lastSavedAt, authorityNow)`. Under `untilMs < lastSavedAt` the
payout bound is *looser* — but the payout window itself ends at
`untilMs`, so a record paying segments inside `[windowStart, untilMs]`
is indistinguishable under either bound. No divergence mint. Under
`untilMs ≥ lastSavedAt` the bounds are equal.

**Ordering gaps verified inert:** regen records carry no
`expires ≥ appliedAt` pin — but `appliedAtMs` is write-only after
persistence (no runtime reader exists: grep finds only the writer, the
validator, and the interface). A reversed pair restores dead-arm
(probe B2). Deep-past `lastSavedAt` anchors deny (B3); far-future
`lastSavedAt` + live-arm expiry clamps to `provenance+24h` ≤ the
authored class window (B4).

## Arm (c) — 2^52-admitted values in float derivations: BOUNDED

- All admitted stamps sit `~2x` inside the mechanism's own `|x| < 2^53`
  line; ULP at `[2^51, 2^52)` is 1, so even the smallest authored delta
  (22 s cycle, 75 s regen) advances cursors — no absorb (probe C2).
- Derived `offlineSinceMs = min(lastSavedAt, authorityNow − elapsed·1000)`
  can only reach `< −(2^52−1)` through a **server-stamped** `sinceMs`
  outside the save domain — the `advanceWorkerLanes` guard trips into
  zero-advance (deny), probed at C1 with `nowMs = 9.1e15`.
- `Date.parse`-range authority values (`±8.64e15`) land **inside** the
  2^53 guard and settle anyway — bounded by the 10 h budget
  (`completed ≤ budget/cycleMs + 1`), not by the clock (C1).
- `autoWorkerCapacity` ≤ 65536 with the F-W-16 `chi_hien_quan` witness
  (probe C3). `perfectClearSeconds` has a physical floor (spawn ticks)
  and needs no upper bound (slow claims are deny-direction).

## Arm (d) — non-save feeds: NO BYPASS

`importSaveRaw`, `recoveryApi`, remote pull (`SupabaseCloudSaveService`
×2) and disk load all run `validateGameSaveShape` +
`isSaveAcceptable` — identical gate (probe D1). The remaining feed is
`timeAuthority` (`cold-boot` `sinceMs`/`untilMs` from the server row):
`parseTimestampMs` forces finite-or-undefined, and every derivation off
it lands under either the 2^53 mechanism guard or a budget cap — a
corrupt server clock can at worst deny, never unboundedly mint (C1).

## Arm (e) — O(1) insight jump: IDENTICAL IN-DOMAIN

- F-A11-2 pins `cultivationInsightAccumulator < threshold` (≤2000) at
  admission; `gained` is always a real cultivation delta (`tick` and
  `offline` both compute the clamped delta, bounded by the admission-
  capped `cultivationPerSecond` claim). Reachable `acc` stays ≪ 2^53 —
  floor-division is bit-identical to the retired while-loop across the
  domain edge (probe E1, including fractional gain).
- **Latent nit (E2, unreachable):** `acc += gained` runs before the
  non-finite guard, so a non-finite `gained` would persist
  `acc=Infinity` — self-wedge via write-time validation. No feed can
  produce non-finite `gained` today (both callers pass a real delta of
  clamped adds). If a future caller adds an unclamped input, reset the
  accumulator in the guard rather than returning poisoned.

## Non-timestamp magnitude surface — enumeration result

Persisted fields a settle path treats as cursor/counter/span/seed,
checked against pins:

- **Pinned:** all timestamp cursors (`|x|<2^52`), worker-cycle spans
  (exact `expectedSpanMs`), `autoWorkerCapacity` (65536 + witness),
  `perfectClearSeconds` (physical floor), `cultivationInsightAccumulator`
  (F-A11-2), `cultivationOvercharge ≤ totalCultivationGained`,
  `skillInsight ≤ totalSkillInsightGained`, `attributePoints` ≤ tier
  position, `enhanceLevel` ≤ authored max, alchemy/job ordering + digest
  replay, `companionPullsSinceRare`-adjacent gift records (moment table
  + realm/stage witnesses), stage claims (realm + chain coherence).
- **Unbounded honest-shape counters (accepted class, re-verified):**
  `companionPullsSinceRare` (crafted huge value forces one authored
  pity-rare per forged save — direct companion forgery is already
  available and stronger), `hiddenBeastKills` (gate-unlock claim,
  bounded authored reward), `duyenPhan`, `kiemY`, `kiemDaoBase`
  (documented merge growth), `skillCastCounts` (`floor(t/10)` precursor
  flat damage — same class), `totalSkillInsightGained`,
  `totalCultivationGained`. Each grants at most its authored bounded
  outcome; admission cannot distinguish honest accumulation from a
  claim. (probe C3)
- **Inert/unread:** `rewardTableVersion` (write-only — no consumer),
  `appliedAtMs` on persisted records (write-only), unknown pass-through
  keys via `normalizedSave` spread (no consumer binds them).

## Residuals accepted vs prior waves

- Sub-bound far-future DEADLINE fields park (deny direction) — still in
  force, re-verified under the tighter 2^52 admission.
- `hiddenChannelCycles` pity counters unboundable — same reasoning now
  extended to `companionPullsSinceRare` and `hiddenBeastKills`.
- Stackable binge chains > ~24 h claimed expiry lose their tail on load
  — now applies to *all* classes uniformly (the removed exemption).

## Suggested next-wave targets (r24)

1. The latent nits above if any new feed is introduced that doesn't
   stamp its own pair (stackable writer NaN, insight acc reset).
2. `normalizedSave`'s `...parsed` spread admits unknown keys into live
   state — today inert, but worth a strip-list if a future consumer
   starts reading free-form fields.
3. The server-authority boundary (`sinceMs`/`untilMs`) is the one input
   class the save gate never sees — the mechanism guard covers it, but
   a `|x| < 2^52`-style domain assert at `useAppLifecycle` would make
   the trust explicit.
