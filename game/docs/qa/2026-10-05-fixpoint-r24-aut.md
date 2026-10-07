# Fixpoint r24 — AUT audit (f50fdaf9)

Blind adversarial audit of the r23 batch at `f50fdaf9`. Objective per
assignment: find a surviving mint/wedge/brick across five seams —
(a) the `sanitizeRestoreAuthority` fallback (grant regression /
selective-stamp poison), (b) live-replacement `nowMs` out-of-domain,
(c) the `acc=0` reset, (d) remaining unbounded non-timestamp inputs,
(e) asymmetric sanitize between the two restores.

**Verdict: TWO CONFIRMED FINDINGS on the sanitize fallback itself —
r24-AUT-1 (cold-boot selective poison converts the server-approved
window into the client window) and r24-AUT-2 (a corrupt `nowMs`
converts live-replacement's zero-accrual contract into the client
window). Both are introduced by the r23 batch: pre-r23 the same stamps
flowed raw — bigger magnitude on cold-boot, but the live-replacement
kind's `elapsed = 0` arm was unbreakable; the guard now makes
corruption the *only* mint on that channel.** Arms (c) and (e) clean;
(d) re-verified accepted classes + one perf nit. Probe suite:
`src/services/save/auditR24Aut.probe.test.ts` (20 probes, all green).

## The r23 batch under audit

- `sanitizeRestoreAuthority` (saveTypes.ts:292): a present authority
  whose stamps are non-finite or `|x| >= 2^52` is dropped to
  `undefined` — which both restores interpret as the legacy
  client-clock semantics (`elapsed = Date.now() - lastSavedAt`,
  payload-editable marker).
- `CultivationInsight`: non-finite `acc` resets to 0; remainder
  `max(0, ...)`.
- Doc/comment-only otherwise.

## Attack surface recap

Authority stamps never pass `validateGameSaveShape` — they arrive
out-of-band from `serverAuthority = { cutoffMs, serverNowMs }`, both
produced by `parseTimestampMs` (`Date.parse`, finite or undefined).
The producible band the guard rejects is therefore exactly
`(2^52, 8.64e15]` — a corrupt/malformed server timestamp, or a client
patching its own cloud response. That is the guard's own declared
threat model, so findings on it are in-scope.

Two restores consume `authority`, both called from the single seam
`restoreGameSession` (SaveSystem.ts:293,297) with the **same** object:

- `player.restoreFromSave`: cold-boot → `calculateOfflineTime(sinceMs,
  untilMs)` (24h cap); live-replacement → 0; **undefined →
  `calculateOfflineTime(lastSavedAt)` (24h cap over the editable
  marker)**.
- `GameManagerSaveRestore.restoreFromSave`: same shape, but cold-boot
  and the undefined fallback resolve elapsed **uncapped**
  (`POSITIVE_INFINITY`) — bounded only downstream by per-channel caps
  (auto-farm 24h, production/decompose channel caps).

## Finding r24-AUT-1 — cold-boot selective poison swaps the approved window for the client window (High)

A cold-boot authority is `{sinceMs, untilMs}`. The sanitize is
all-or-nothing: corrupting **one** stamp discards the honest sibling
and demotes the whole restore to client-clock semantics.

```ts
// server approved a 100s window; payload claims 900s staleness
restoreFromSave(save, { kind: 'cold-boot', sinceMs: NOW-100_000, untilMs: 8.6e15 })
// -> authority dropped -> elapsed = now - lastSavedAt = 900s minted
```

Probe evidence:

- **A2**: approved 100s, poisoned `untilMs` → pays **900s** (9× the
  approval).
- **A3**: approved **0**s (`sinceMs == untilMs`, the normal
  post-checkpoint window), one corrupt stamp → pays the full
  `min(now - lastSavedAt, 86400s)` = **86400s** — the sharpest mint:
  a zero-width server approval becomes a 24h payout.
- **A4**: selective poison confirmed — corrupting `sinceMs` alone drops
  the honest `untilMs` too (no partial-authority survive path).
- **A5** (wedge direction): approved 48h (`172800s` reaches the manager
  uncapped) + poisoned `untilMs` → settles **900s** — a corrupt stamp
  *confiscates* ~99.5% of an honestly approved span. Same flaw, deny
  direction.
- **A6** (posture pin): an in-domain crafted `{sinceMs: -(2^52-1),
  untilMs: NOW}` stays cold-boot and mints the full 24h player cap —
  the guard never bounded the full-control attacker; it only moved the
  corrupt-*only* attacker from deny to mint.

**Why this is a regression, not just a residual.** Pre-r23 the same
corrupt `untilMs` minted far more in magnitude (the
`untilMs - sinceMs` span directly). But semantically the authority's
contract is "the server-approved window bounds accrual"; r23 replaced
"a present-but-corrupt bound" with "no bound at all" — the *least*
trusted clock. The fallback:

1. pays strictly **more than the approval** whenever
   `min(now - lastSavedAt, 24h) > untilMs - sinceMs` (any tight/zero
   approved window — A2/A3);
2. re-opens the **fast-client-clock mint** the authority exists to
   kill — under a valid cold-boot, skew cannot mint past `untilMs`;
   after the drop, `Date.now()` anchors every forward clamp, so a
   `+N` skewed device clock adds `N` to elapsed (24h-capped player
   side, uncapped-elapsed manager side);
3. *confiscates* honestly-approved pay when the approval exceeds the
   client window (A5 — a wedge for honest players on a buggy server
   stamp).

Correct deny direction: for a **present** authority, never drop to
`undefined`. Either clamp each stamp into the `|x| < 2^52` domain
keeping the kind (cold-boot keeps its — possibly degenerate —
approved window), or reject the restore (`status: 'rejected'` →
recovery surface, already wired in `App.vue`). `undefined` semantics
should remain reserved for an **absent** authority only.

## Finding r24-AUT-2 — corrupt `nowMs` kills live-replacement's zero-accrual contract (High)

`live-replacement` exists to accrue **zero**: the server delivered an
authoritative head and the client must restore queues/jobs *without*
catch-up (`replacement-in-place`). Its only stamp is `nowMs`. There is
no in-domain `nowMs` that pays anything through this kind — so
corruption is the **only** mint path on the channel, and the r23
guard creates it:

```ts
// payload claims 900s staleness; server intended replacement-in-place
restoreGameSession(player, manager, save, { kind: 'live-replacement', nowMs: 8.6e15 })
// -> authority dropped -> player pays 900s, auto-farm settles 900s,
//    production + decompose catch-up fire (>60s gate)
```

Probe evidence:

- **B2/B3**: `nowMs = ±8.6e15` (inside `Date.parse`'s range, outside the
  guard's) → `elapsedSeconds = 900`, cultivation minted — vs `0` for
  the same payload under an honest stamp (B1).
- **B4**: through `restoreGameSession` with an armed farm — honest
  `nowMs` yields `settleAutoFarmOffline(_, 0)` and **no**
  decompose/production settle; the poisoned stamp yields
  `settleAutoFarmOffline(_, 900)` **and** production/decompose
  catch-up. The zero-accrual settle the 'replaced' verdict exists to
  enforce dies with the stamp.
- Concretely this mints catch-up over the divergent window the
  replacement exists to erase.

Fix direction: a present `live-replacement` with an out-of-domain
`nowMs` must keep `elapsed = 0` — clamp the stamp (or fall back to
`Date.now()` *as the live anchor only*, never as the accrual window),
or reject outright. Never let the kind disappear.

## Arm (c) — `acc=0` reset: NO MINT (deny-direction)

- `cultivationInsightAccumulator` is admission-pinned `< threshold`
  (F-A11-2), so the reset drops at most a sub-threshold remainder plus
  the current `gained` — the guard can only underpay (probe C2: an
  honest 1999 remainder + poisoned gained → 0).
- `acc` carries no anti-abuse state — `skillInsight` /
  `totalSkillInsightGained` are separate fields; resetting the
  remainder cannot free a pit counter or replay a conversion (probe
  C1: acc=Infinity + gained → acc=0, insight 0).
- Reachability: no feed produces a non-finite `acc` or `gained` —
  callers pass clamped cultivation deltas; a non-finite persisted
  value dies at `JSON.stringify` → `null` → `requireNonNegativeNumber`
  (probe C4: the max client-window restore keeps `acc` finite).
- **Residual nit (documented, no live feed):** the reset repaired the
  ONE field's brick path; every *sibling* required-finite counter
  (`skillInsight`, `cultivation`, `attributePoints`,
  `phaGiapCarryStacks`, ...) still bricks the write→load cycle on a
  runtime `NaN`/`Infinity` — `JSON.stringify` → `null` → shape
  rejection → `boot.fail` recovery loop (probe C3). Same
  latent-hardening class r22/r23 recorded — worth a shared
  "persist-time finite guard" helper, not a per-field fix.

## Arm (d) — remaining unbounded inputs: accepted classes hold + one perf nit

- **Pinned (re-verified, probe D4):** `phaGiapCarryStacks ≤
  PHA_GIAP_CARRY_BANK_MAX`, `attributePoints ≤` level-derived bound —
  both still deny.
- **Accepted unbounded honest-shape class (re-verified):** stack
  `amount` ≥ 0 only (probe D1: `1e15` material amount validates —
  local-save self-cheat class, cloud writes carry server-side
  authority), `quests.active[].progress` ≥ 0 only (probe D2 — bounded
  authored reward).
- **Nit (new, perf wedge, not a mint):** dedup-only string lists —
  `quests.completedOnceIds`, `quests.questFlags` — have no count cap;
  a 5k-unique-entry payload validates (probe D3). Bounded-by-
  construction siblings exist elsewhere: equipment has
  `EQUIPMENT_BAG_SOFT_CAP`, `persistentTimedEffects` is bounded by
  `effectGroup` merge-dedup + claimed-source coherence (a duplicate
  group is unproducible — my first D3 attempt failed validation for
  exactly that reason). A count cap on the string lists closes the
  last unbounded-collection surface.
- Timestamps, spans, levels, lanes, reservations, tribulation
  receipts, `nodeLevels` (authored max + prereq/mutex coherence),
  `nodeOneShotGrants` (typed records), alchemy/job order+digest — all
  carry r21–r23 pins, re-verified.

## Arm (e) — authority symmetry: NO ASYMMETRY DEFECT

`restoreGameSession` (SaveSystem.ts:293–297) is the **only**
production path to either restore; it passes the same `timeAuthority`
object to `player.restoreFromSave` then
`gameManager.saveOps.restoreFromSave`, and each sanitizes internally —
the two stores always see an identically-treated authority (probe E2:
a direct `saveOps.restoreFromSave` call with no player involvement
still drops the poisoned authority). No path exists that sanitizes one
side and not the other.

However, symmetry also means the fail-open mints on **both** sides
(probe E1: one poisoned live-replacement stamp → player
`elapsedSeconds = 900` *and* manager `settleAutoFarmOffline(_, 900)`)
— the (a)/(b) findings are doubled, not halved, by the shared seam.
The `EarlyGameSession` path calls `restoreGameSession` without
authority — `undefined` → legacy semantics — consistent with the
local-sim design.

Intra-fallback note: the player store caps the fallback at 24h while
the manager resolves it uncapped — pre-existing divergence (identical
under cold-boot), bounded by downstream channel caps; listed for
completeness, not a new defect.

## Suggested fix sketch (implementation left to a fix wave)

```ts
export function sanitizeRestoreAuthority(
  timeAuthority?: RestoreTimeAuthority,
): RestoreTimeAuthority | undefined {
  if (timeAuthority === undefined) return undefined
  const inDomain = (x: number) => Number.isFinite(x) && Math.abs(x) < 2 ** 52
  if (timeAuthority.kind === 'live-replacement') {
    // Keep the zero-accrual contract; only the live anchor re-roots.
    return { kind: 'live-replacement', nowMs: inDomain(timeAuthority.nowMs) ? timeAuthority.nowMs : Date.now() }
  }
  const sinceMs = inDomain(timeAuthority.sinceMs) ? timeAuthority.sinceMs : /* clamp or reject */ ...
  // Option B (simpler): if either stamp fails, return
  // { kind: 'live-replacement', nowMs: Date.now() } - treat corrupt
  // authority as "server replaced, zero accrual" - the safe deny.
}
```

The cheapest correct deny: a present-but-corrupt authority degrades to
zero-accrual live-replacement (or `status: 'rejected'`), never to the
client clock.

## Suggested next-wave targets (r25)

1. If the fix lands as clamp-into-domain: adversarial check that the
   clamped endpoints can't mint a window wider than any honest
   approval (e.g. `sinceMs` clamped to `-2^52+ε` re-opens a wide window
   — clamping may need *rejection* semantics rather than edge values).
2. The dedup-only string lists' missing count caps (D3 nit).
3. The shared "persist-time finite guard" for sibling counters (C3
   residual class).
