# Fixpoint r15 adjudication

Wave: r15 blind trio on `b93c9de4` (r14 batch). Coordinator adjudicated
2026-10-05. Reports: `-r15-cor.md`, `-r15-aut.md`, `-r15-int.md`.

## Headline family — epoch mixing

r14 anchored the offline window in the SERVER epoch (`untilMs`) while
every persisted stamp (`lastSavedAt`, `expiresAtMs`, `appliedAtMs`,
`lastCheckedMs`) is CLIENT epoch. Every cross-epoch compare is a defect.
Fix direction taken: express the comparison in whichever epoch the
compared field owns.

Honest relations used everywhere below:

- `windowStart <= lastSavedAt` always.
- `expires <= lastSavedAt` = payload-dead: honestly dead at save time,
  can never revive (expires only extends via rebuy, which re-stamps
  past the save marker).
- `expires > lastSavedAt` = live claim: indistinguishable from a forge,
  bounded to `min(expires, provenance + 24h)` (<=24h residual, D-01
  family).

## COR (2 High / 2 Med / 2 Low / 1 Nit)

### r15-COR-A — dead-at-save revive — CONFIRMED (High) — FIXED

`provenanceMs = min(lastSavedAt, authorityNowMs)` picks the server
value exactly under a fast clock, so a TLT honestly dead before save
(stamps +skew) restored with `expires = untilMs + 24h` — a free ~24h
revive per boot, repeatable.

Fix: `boundTimedEffectClocks` gains the payload marker and splits the
clamp by claim class — `expires <= lastSavedAt` clamps to `nowMs`
(dead stays dead, revive killed), `expires > lastSavedAt` keeps the
`provenance + 24h` bound. The payout copy keeps the record's own death
position via `payoutExpiresAtMs` so a buff honestly dying mid-window
still pays its live part (see COR-B).

### r15-COR-E — autofarm anchor epoch — CONFIRMED (High) — FIXED

r13/r14 plumbed the server-epoch `settleNowMs` into
`settleAutoFarmOffline`, but `lastCheckedMs` is a client-epoch field
(every writer and the live `tickAutoFarm` read share `Date.now()`).
On a fast-clock device the settle's gap went negative AND the written
server-epoch stamp let the next tick mint `min(skew, 24h)` at FULL
live rate — a real mint class introduced by the r13 fix itself.

Fix: `settleAutoFarmOffline` reverts to `Date.now()` and the
`settleNowMs` parameter is removed (deps type, GameManager delegate,
both SaveRestore call sites, spy pins updated). The authorized bound
remains `elapsedOfflineSeconds` (server-derived) + the field's own
anchor gap — `min(elapsed, now - lastCheckedMs)` keeps the deny cap
binding. The cross-device slow-clock shrink r13 was chasing returns
as a bounded underpay (deny-acceptable), same as every client-epoch
field.

### r15-COR-B — splitter window in wrong epoch — CONFIRMED (Medium) — FIXED

`splitCultivationSpeedWindow` ran the authority-epoch window against
client-epoch expiry stamps — under +skew a mid-window death never
landed inside the window and paid x1.25 across all of it (+23.7%
repro).

Fix: the window is re-expressed in the payload epoch via
`clockSkewMs = max(0, lastSavedAt - authorityNowMs)` —
`payloadWindow = [windowStart + skew, windowEnd + skew]`. Honest synced
saves have skew ~0 and read identically to before. The split now runs
on `payoutTimedEffects` (payload-epoch death positions; live claims
still bound-clamped).

### r15-COR-D — honest clock-rollback save condemned — CONFIRMED (Medium) — FIXED (allowance, not normalize-clamp)

The r14 gate `expires > lastSavedAt + 24h` is only impossible inside
ONE clock epoch. Honest path: TLT rebuy stamped while the device clock
ran fast; clock corrected before the save → `expires` stays the skewed
stamp, `appliedAt` sits at first apply (F-TC9-1 silent), so
`expires > lastSavedAt + 24h` honestly holds → whole save quarantined.

COR suggested normalize-clamp like F-TC9-4. Rejected: the
normalization channel's own contract is "derived snapshots the owning
writer recomputes anyway" — `expiresAtMs` is persisted authority, not
derived, so a silent rewrite loses the claim's state (and honest
rollback saves would still be silently rewritten). The gate instead
gets a 7d provenance allowance (`+ 7 * 86_400_000`): plausible clock
migrations are rescued, absurd forges still rejected loud, and
anything admitted inside the allowance is still clamped to <=24h live
at the restore seam — the allowance buys a forge nothing.

### r15-COR-C — dead buff still divides cps — CONFIRMED (Low) — FIXED

Deny twin of COR-B: a dead-at-save buff sampled live at the server
window start divided the un-buff rate (underpay). Fixed by the same
change: `percentAtSave` samples the payout copy at the SAVE INSTANT
`min(lastSavedAt, payloadWindowEnd)` in payload epoch — dead at save
samples dead.

### r15-COR-F — pending production/decompose deadlines vs server settle — CONFIRMED (Low) — DOCUMENTED

Client-epoch deadlines (`completesAtMs` etc.) compared against
server-epoch `settleNowMs`: under a fast clock an in-flight cycle
reads not-yet-complete and is forfeited for that boot. Deny-direction
only, self-heals next settle. A general fix means re-epoching every
consumer deadline — same class as COR-E but underpay-only. Accepted
residual; revisit if a mint direction appears.

### COR Nit — TLT 24h hardcoded for all non-stackable — DOCUMENTED

`boundTimedEffectClocks` uses `TU_LINH_TRAN_DURATION_MS` as the
provenance bound for every non-stackable effect. Today TLT is the only
non-stackable timed group; a future >24h non-stackable must revisit
the bound (or the bound must read a per-group authored duration).

## AUT (1 Med / 2 Low / 2 Nit)

### r15-AUT-1 — epsilon-percent forge loosens full 1.25x bound — CONFIRMED (Medium) — FIXED

`hasLiveTlt` was binary (`expires > lastSavedAt`), so
`expires = lastSavedAt + 1ms, percent = 1e-9` claimed the whole 1.25x
cps bound; the record is live at the save-instant sample, the un-buff
divide shrinks nothing, and the dead tail pays the loosened rate for
the whole window (also reachable at maximum magnitude).

Fix: the bound scales by the record's OWN live percent —
`maxPersistedCps = BASE x talents x ramp x (1 + liveTltPercent)` where
`liveTltPercent = getActiveCultivationSpeedPercent(probeEffects,
lastSavedAt)` (same domain read + same sample instant the restore
uses). Airtight: claim <= BASE(1+p) -> unbuffed = claim/(1+p) <= BASE
at payout; honest 0.25 keeps its 1.25x snapshot.

AUT-1's companion note — crafted-future `lastSavedAt` makes every
`x <= lastSavedAt` gate vacuous — adjudicated mint-neutral: every
vacuous gate is re-clamped by `min(lastSavedAt, authorityNow)` at the
restore seam (window width stays `elapsed`, live-claim cap <=24h).
No field-level bound added: `lastSavedAt` legitimately reads ahead of
server time on honest fast clocks, and any bound would reject real
cross-device restores. The residual is the already-documented live
claim (<=24h, +25%).

### r15-AUT-2 — regen flat bound follows the CLAIMED pill's tier — CONFIRMED (Low) — FIXED

Forged `hoi_linh_dan_tribulation` regen on a mortal save stayed bounded
to the claimed pill's tier ceiling (~70x mortal's authored bound), not
the claimant's realm. `hoi_linh_dan_<realm>` pills carry an exact-realm
consume gate (`wrong_realm`) and realms are monotonic, so
`realmIndex(pill.realmId) > realmIndex(player.realmId)` is impossible
provenance — now rejected (F-A10 pattern applied to the regen pin).

### r15-AUT-3 — `durationStackable` had no type pin — CONFIRMED (Nit) — FIXED

`'yes'` passed the gate but stayed bounded at restore (the seam reads
`!== true`). No mint; contract looseness only. Boolean type pin added
inside the pill-regen branch.

### AUT Nit — `hasLiveTlt` non-finite arm dead code — DOCUMENTED

`lastSavedAt` non-finite is rejected upstream, so the tolerant arm
never fires on accepted saves. Kept deliberately as defense-in-depth —
`validatePlayer` is also reachable through paths that bypass the
top-level finite pin, and the arm costs one comparison.

## INT (0 Med+ / 1 Low)

### r15-INT-01 — r14 doc overstated the fast-clock claim — CONFIRMED (Low) — FIXED (doc + pin)

The r14 adjudication claimed the honest fast-clock case holds
`appliedAt/expires` unchanged. Under `min(lastSavedAt, authority)` a
TLT bought inside the skew gap stamps `appliedAt`/`expires` in the
skewed epoch and the restore rewrites them to `untilMs + 24h` — the
buff SHRINKS by the skew (deny-direction, max skew magnitude). Doc
corrected in `2026-10-05-fixpoint-r14-adjudication.md`; regression pin
`r15-INT-01` added in `player.restoreFromSave.test.ts`.

## Deferred / not actionable

- None escalated this wave: COR-D resolved by the 7d allowance
  (mechanical), so no new entry in `decisions-needed.md`. D-01
  (stackable expires cap ruling) remains the only open decision.

## Verification

- `npm run type-check` — clean.
- Scoped vitest (touched domains): 558 tests green —
  `player.restoreFromSave`, `saveShapeValidation`, `SaveSystem.timeAuthority`,
  `SaveSystem.conformance`, `w4int.repro`, `GameManager.autoFarmOffline`,
  `GameManager.autoFarmAdversarial`, `GameManagerSaveRestore.onceOnlySettle`,
  `betaWriterBoundsTc8`, `betaConsumerSeams`, `fixpointR11IntEvidence`.

## Pins added this wave

- `player.restoreFromSave.test.ts`: r15-INT-01 (honest fast-clock
  shrink pin), r15-COR-A (dead-at-save clamps to now, no revive),
  r15-COR-B (mid-window death pays only live part under +10d skew).
- `SaveSystem.timeAuthority.test.ts`: r15-COR-E (farm anchor rewrites
  in Date.now epoch, not the settle window end).
- `betaWriterBoundsTc8.qa.test.ts`: r15-AUT-1 (epsilon forge normalized
  to ~BASE; authored 0.25 still admits 1.25x), r15-AUT-2 (above-realm
  pill regen rejected; same-realm accepted), F-TC8-8 updated for the
  7d provenance allowance (reject past allowance, accept rollback).
