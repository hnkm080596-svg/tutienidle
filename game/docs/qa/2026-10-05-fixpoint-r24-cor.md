# Fixpoint r24 — COR audit (commit f50fdaf9)

Scope: independent re-audit of the r23 batch — `sanitizeRestoreAuthority`
in `saveTypes.ts` applied at the entry of BOTH `player.restoreFromSave`
and `GameManagerSaveRestore.restoreFromSave` (whole authority dropped to
`undefined` when any stamp is non-finite or `|x| >= 2^52`), the
`CultivationInsight` non-finite-accumulator reset (`acc = 0`, was:
return leaving acc poisoned) and the O(1) drain's `max(0, remainder)`
clamp, plus comment-only fixes (payout dual-bound note, appliedAtMs
epoch note, GameManagerPersistentEffectOps note, D-01 closure).

Verdict: **PASS WITH GAPS** — one Medium correctness finding
(R24-COR-1, flagged for adjudication: the all-or-nothing drop widens a
guaranteed-deny into a paying fallback on a reachable corruption class),
plus Low/Nit findings below. No Critical/High. Whether R24-COR-1 blocks
depends on the intended contract for corrupt-but-parseable authority
stamps — the batch's own tests pin the NaN arm of this fallback as
intended (`player.restoreFromSave.test.ts:704-766`), but the
finite-reachable arm widens a deny the honored kind would have kept.

## Invariant ledger

| # | Attack | Result |
|---|--------|--------|
| 1 | Partially-out-of-domain authority — does dropping the record lose honest accrual / pay the un-approved span? | **Finding R24-COR-1 (Medium).** Two widening arms confirmed through the real seams: (i) `live-replacement` elapsed is `0` by kind — the stamp is never consumed for elapsed — so an honored corrupt stamp still pays nothing, while the dropped record pays the client window (player seam `elapsedSeconds` 86400 on a 10d-old save, alchemy settle mints a queued pill at the manager seam); (ii) cold-boot stamps that evaluate to a zero-width window (`sinceMs` far-future, `untilMs` deep-past) pay 0 when honored but the client window when dropped. Both directions reachable: any finite stamp in `[2^52, 8.64e15]` parses through `Date.parse` (ISO `+200000-…` -> 6.25e15 verified); `NaN` never reaches the authority (`parseTimestampMs` filters to `undefined` -> `?? Date.now()`). Two salvage-loss arms pinned: honest `sinceMs > lastSavedAt` narrowing is discarded (repays the server-excluded 2h segment — 5h vs 3h), honest `sinceMs < lastSavedAt` widening is clamped back to the marker (3h vs 5h, deny-direction loss). |
| 2 | Boundary `|x| < 2^52` vs honest server clocks | Clean — every honest stamp is ~1.7e12, four thousand x under the bound; the rejected band starts at year ~143800 AD. The domain matches exactly what `isBoundedTimestamp` already enforces on every persisted stamp, so an out-of-domain authority stamp is corrupt by definition — never honest. The `Date.parse`-admitted-but-out-of-domain band `[2^52, 8.64e15]` is the real reachability hole (postgres timestamptz can hold e.g. year 200000; the far tail past +275760 doesn't parse and is filtered upstream). |
| 3 | Raw `timeAuthority` reads after the sanitize point | Clean — grep-verified no `timeAuthority` reference remains inside either `restoreFromSave` after `const authority = sanitizeRestoreAuthority(...)`; the Proxy-read pin (D1/D1b) logs exactly the sanitize reads (`kind`+stamps) plus the honored-path re-reads through the same record — no stray consumer feeds stale/NaN derivations. |
| 4 | Crafted-authority-only round-trip + payload-identity guard | Clean with posture note — a same-payload re-restore under a different authority is a no-op (identity = payload hash, authority not part; pre-existing). Pinned: first restore under a dropped authority caches the fallback payment; a later honest-authority replay returns the cached result — the denied/honest window can never re-settle (D2). Acceptable under "save applied once" semantics, but it means a corrupt-authority grant is sticky. |
| 5 | acc reset to 0 — ever wrong? | Clean with residual — the pending remainder destroyed is `< threshold` (validator F-A11-2 pins `acc < threshold` at admission), so the loss is bounded `< 1 insight` of unbanked progress, and the reset self-heals the pre-poisoned-acc wedge (old code left acc non-finite so every later save-write failed `requireNonNegativeNumber`/finite checks — verified: after reset the player accrues and validates normally, B1/B2). Residual pinned (B3): only NON-finite is guarded — a finite `acc = 1e300` mints `5e297` insight with no magnitude bound; unreachable (admission + real-delta feeds) — R24-COR-3 Nit. |
| 6 | `max(0, remainder)` clamp — does it hide an over-mint; is the `~4.6e18` onset claim precise? | Clean in the reachable domain, artifacts pinned — bit-identical to the retired while-loop across the admitted domain (boundary-adjacent and fractional cases, C1). At mechanism magnitudes the quotient `fl(acc/t)` rounds UP across an integer boundary: `acc = 417972220788154000, t=2000` mints `steps+1` the loop never would (exact floor `208986110394076` vs `208986110394077`), and the `max(0, -48)` clamp hides the tell-tale negative remainder — the mint already happened in `steps` (C2). Sibling: the remainder can exit `[0, t)` UPWARD — `acc = 174165594658891500, t=1500` lands `1504 >= 1500`, which the next save-write rejects under F-A11-2 (self-wedge; the clamp only guards the negative side) (C3). Both need `acc >= ~2.8e17` — unreachable (admission requires `acc < t`; feeds are real deltas). The comment's "~4.6e18" onset is ~16x conservative vs the observed ~2.8e17 (C4) — R24-COR-4 Nit. |

## Verification evidence

- `npx vitest run src/services/save/auditR24Cor.probe.test.ts` in
  worktree `.agent-worktrees/audit-r24-cor` at f50fdaf9: **18/18 pass**.
  Pins: 7 authority-semantics probes through the real
  `player.restoreFromSave` seam (live-replacement deny->grant, cold-boot
  zero-width widening both directions, narrowing loss, widening loss,
  deep-past honored control, boundary pins), 1 end-to-end manager-seam
  probe (queued alchemy pill settles under the corrupt fallback, held
  under honest), 2 Proxy read-accounting probes (sanitize-only + honored
  path), 1 identity-guard replay probe, 3 acc-reset probes, 4 drain
  probes (reachable-domain identity, over-mint witness, rem>=t wedge,
  onset precision).
- The corrupt-authority inputs use stamps inside the real `Date.parse`
  band (`+200000-01-01` -> `6249223180800000`, finite, `>= 2^52`) — the
  same band `parseTimestampMs` admits before the sanitizer rejects it.

## Findings

### R24-COR-1 — Medium: whole-record drop widens a guaranteed-deny into a client-window grant on a reachable stamp class

`sanitizeRestoreAuthority` drops the whole authority to `undefined` when
ANY stamp leaves the `|x| < 2^52` domain — but the two kinds carry
different deny semantics:

- **`live-replacement`: the stamp is never used for elapsed.** The
  honored path is `authority?.kind === 'live-replacement' ? 0` — zero
  accrual BY KIND (the replace-ack means the server already accounted
  the span); `nowMs` only feeds the forward clamps. So honoring a
  corrupt `nowMs` (finite, `>= 2^52`) still pays **0**, while the
  dropped authority pays `min(now - lastSavedAt, 24h)` at the player
  seam (probe A1: `elapsedSeconds = 86400`, cultivation applied through
  the realm cap) and settles queued alchemy/production at the manager
  seam (probe A1b: a `tu_linh_dan` job due `lastSavedAt + 30min` is
  settled and minted under the corrupt stamp, held under the honest
  one). This is a deny->grant flip the sanitizer introduces — the
  pre-r23 code was also deny here (elapsed 0 regardless of the stamp).

- **`cold-boot`: zero-width windows become paying windows.** A
  corrupt-but-finite `sinceMs >= 2^52` (with honest `untilMs = now`)
  evaluates to `elapsed = max(since, until) - since = 0` when honored;
  dropped, it pays the full client window (probe A2: 86400s on a
  10d-old save). Mirror arm: `untilMs <= -2^52` (probe A2b).

- **Honest stamps are collateral.** With one stamp corrupt, the
  surviving stamp's information is discarded: an honest narrowing
  (`sinceMs = lastSavedAt + 2h`, server cutoff after the save marker)
  loses its bound — the fallback repays the segment the server excluded
  (probe A3: 5h paid vs 3h approved). An honest widening
  (`sinceMs = lastSavedAt - 2h`) is silently clamped back — deny-side
  underpay (probe A4: 3h vs 5h).

Reachability: the authority stamps come from `serverAuthority`
(`parseTimestampMs` = `Date.parse` + finite check) — the accepted range
is `[-8.64e15, +8.64e15]`, roughly 1.9x wider than the save domain on
the far side. Stamps in `[2^52, 8.64e15]` correspond to calendar years
~143800–275760: not producible by skew or honest clocks — only by a
corrupt or hostile authority source, which is exactly the input class
the sanitizer exists to contain. The payout is bounded (24h elapsed cap
at the player seam; per-seam settles bounded by job/stamp times at the
manager seam), so the impact is a bounded grant — but it is a grant the
honored record would have denied.

**Adjudication question for the coordinator:** should the fallback treat
the record as `kind`-only (live-replacement keeps its zero-elapsed
semantics regardless of stamps; cold-boot keeps its in-domain stamp(s)
with a client-now bound) rather than `undefined`? The current comment
("bounded deny") understates the grant direction on these arms.

### R24-COR-2 — Nit: payload-identity guard makes a corrupt-authority payment sticky

`computeRestoreIdentity(save)` excludes the authority — a second
`restoreFromSave` of the SAME payload under a now-honest authority is a
no-op returning the first (corrupt-fallback) result (probe D2:
fallback-paid 600s replays as 600s, not 0). Pre-existing (the guard
predates sanitize), correct under "a save applies once" — but worth
recording: if R24-COR-1's direction is adjudicated wrong, there is no
in-session recovery path short of a save with a different payload.

### R24-COR-3 — Nit: only non-finite acc is guarded; finite-huge acc mints unbounded

`accrueCultivationInsight` resets on `!Number.isFinite(acc + gained)`
but a finite `acc = 1e300` mints `floor(1e300/2000)` insight with no
magnitude bound (probe B3). Unreachable — admission requires
`acc < threshold` (F-A11-2) and every feed is a real cultivation delta
— recorded so the residual stays documented.

### R24-COR-4 — Nit: drain artifacts at mechanism magnitude + imprecise onset comment

- Over-mint witness `acc = 417972220788154000, t = 2000`:
  `fl(acc/t)` rounds up across the exact quotient, minting
  `208986110394077` vs the honest `208986110394076` (+1), and the
  `max(0, -48)` clamp leaves a clean `0` remainder — the field looks
  consistent while the extra insight was minted in `steps` before the
  remainder math (probe C2). So yes: the clamp hides the artifact's
  fingerprint, not the artifact.
- Upward wedge `acc = 174165594658891500, t = 1500`: product rounding
  lands the remainder at `1504 >= t` — `max(0, …)` only guards the
  negative side; a persisted `acc >= threshold` fails F-A11-2 on the
  next save-write (probe C3). Unreachable, same as above.
- The in-code comment's "~4.6e18" onset is ~16x conservative — measured
  artifacts begin at `~2.8e17` (probe C4, exact-floor oracle vs float
  division). Precision nit on a comment, not a behavior defect.

## Confirmed clean

- No raw `timeAuthority` reads downstream of the sanitize point in
  either `restoreFromSave` (grep + Proxy read-log pin).
- The `2^52` boundary is coherent with `isBoundedTimestamp` — no honest
  stamp is rejected, and deep-past-but-in-domain stamps keep their
  zero-width semantics (probe A5b: `untilMs = -2.1e14` honored, elapsed
  0).
- acc reset self-heals poisoned state: writable + validating afterwards
  (B1/B2).
- O(1) drain is bit-identical to the retired loop throughout the
  reachable domain, including boundary-adjacent fractional remainders
  (C1).
- Both restore seams sanitize identically and independently; the
  manager seam's fallback `settleNowMs` derives from the same dropped
  record (A1b shows symmetric payout).
