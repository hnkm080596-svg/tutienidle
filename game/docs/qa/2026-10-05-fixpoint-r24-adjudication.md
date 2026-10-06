# Fixpoint r24 — adjudication (audit commit `f50fdaf9`, batch r23)

Auditors: COR `devin/audit-r24-cor-f50fdaf9`, AUT `devin/audit-r24-aut-f50fdaf9`, INT `devin/audit-r24-int-f50fdaf9`.

## Verdicts

| Auditor | Verdict | Medium+ | Low | Nit |
| ------- | ------- | ------- | --- | --- |
| COR | PASS WITH GAPS | 1 (COR-1) | 0 | 3 (COR-2/3/4) |
| AUT | FAIL | 2 High (AUT-1/2) | 0 | 2 ((d) count cap, (e) note) |
| INT | PASS WITH EVIDENCE | 1 (INT-01, pre-existing) | 1 (INT-03) | 1 (INT-02) |

COR-1, AUT-1 and AUT-2 are one defect family (the `sanitizeRestoreAuthority`
fallback direction); fixed once, credited to all three IDs.

## Dispositions

### R24-AUT-1 / R24-AUT-2 / R24-COR-1 — corrupt authority degraded to `undefined` = client-clock GRANT (High/Medium, CONFIRMED -> FIXED)

Claim verified against the code: `sanitizeRestoreAuthority` (r23) returned
`undefined` for any present-but-corrupt stamp — and `undefined` is the
ABSENT-authority sentinel, which selects the legacy client-clock window
`min(Date.now() - lastSavedAt, 24h)` over the payload-editable
`lastSavedAt` marker. Two mint arms confirmed through real seams:

- **cold-boot selective poison** (AUT-1/COR-1): one corrupt stamp drops
  the whole authority, converting the server-approved window
  `[sinceMs, untilMs]` into the client window — a zero-width approval
  pays up to 24h; honest narrowing (`sinceMs > lastSavedAt`) is
  discarded.
- **live-replacement** (AUT-2): the kind that exists to pay ZERO has
  `nowMs` as its only mint path — `NaN`/out-of-domain `nowMs` dropped
  the authority and the client window paid up to 24h on both the player
  and manager seams simultaneously (symmetry arm (e): one seam hands
  the same object to both stores).

Reachability confirmed: `parseTimestampMs` admits finite stamps out to
`Date.parse`'s `±8.64e15` domain (Postgres `+200000-01-01` -> 6.25e15),
outside the `|x| < 2^52` domain the sanitizer enforces. (NaN stays
unreachable through the response parser — it filters to `undefined` —
but the direct-call surface is pinned anyway.)

**Fix**: a present-but-corrupt authority now degrades to
`{ kind: 'live-replacement', nowMs: Date.now() }` — the tightest deny:
the restore still loads queues/jobs but accrues nothing, needs no new
rejection path, and never pays the payload-editable client window.
`undefined` stays reserved for an ABSENT authority only
(`EarlyGameSession`, callers with no server response). Docblock
rewritten; describe block in `player.restoreFromSave.test.ts` renamed
"sanitizeRestoreAuthority deny" with pins flipped to `elapsedSeconds: 0`
plus the boundary pin (`untilMs = 2^52-1` honored -> 86400) unchanged.

All auditor probes flipped from mint demos to deny pins:
`auditR24Aut` (A2-A4 -> `elapsedSeconds: 0`; A5 settle -> `(_, 0)`;
B2-B4 deny + `not.toHaveBeenCalled()`; E1/E2 both sides -> 0; unit pins
-> `toEqual({kind:'live-replacement', nowMs: NOW})`),
`auditR24Cor` (A1-A4 corrupt arms -> 0 with honest-side pins kept;
A5 boundary; D1 -> 0; D2 deny pin), `auditR24Int` (seam (a)/(b) ->
elapsed 0, `settleSpy.not.toHaveBeenCalled()`; round-trip + unit pins).

### R24-INT-01 — honored forward-skewed authority seeds persisted `workerCycles[].startedAtMs` past the next `lastSavedAt` (Medium, PRE-EXISTING since r13, CONFIRMED -> FIXED)

`settleNowMs` (r13-COR-4) anchored the manager settle at
`min(lastSavedAt + elapsed*1000, untilMs)`. An honest forward-skewed
authority (`untilMs > Date.now()` — a 30s server skew suffices) settled
dues inside `(now, untilMs]` and persisted lane heads stamped past the
next save's own `lastSavedAt` marker — admission pin
`workerCycles[].startedAtMs <= lastSavedAt` then rejected the game's
own save: self-brick, confirmed by two INT repros.

**Fix**: `settleNowMs` gains a third clamp — `Math.min(..., Date.now())`.
Persisted stamps live in the client epoch, so dues in the skew window
`(now, untilMs]` defer to the next live tick at their real times (no
loss); elapsed-driven channels (autoFarm 24h, production budget,
alchemy deadlines) still pay the full approved span. INT's two RESIDUAL
tests flipped to "fixed" pins (`heads.every(startedAtMs <= NOW)`,
`shape.ok === true`).

### R24-COR-2 / R24-INT-03 — payload-identity caches are authority-agnostic (Nit/Low, EXCEPTED - deny-direction only)

`lastRestoredPayloads` / `lastAppliedPayloadHash` key on
`computeRestoreIdentity(save)` only — never the authority — so a split
retry of the same payload under a different authority reuses the first
settlement. Pre-fix this made a corrupt-authority GRANT sticky; post-fix
the sticky outcome is deny-direction (an honest retry of a payload first
seen under a corrupt authority loses the approved window). Keying the
identity on the authority requires plumbing it through the hash plus a
mid-restore invalidation path — a structural change out of proportion to
a deny-only residual. Exception recorded.

### R24-COR-3 — finite-huge `cultivationInsightAccumulator` mints unbounded (Nit, EXCEPTED - unreachable)

Only non-finite acc is guarded; a finite `acc = 1e300` would mint
`5e297` insight. Unreachable: admission pins `acc < threshold`
(F-A11-2), and every mechanism feed is a real delta capped far below.
Exception recorded — no reachable feed exists.

### R24-COR-4 — drain artifacts at mechanism magnitude + imprecise comment (Nit, comment FIXED)

COR measured the rounding onset at ~2.8e17 (not ~4.6e18 — the comment
was ~16x conservative) and pinned two artifacts at those magnitudes:
quotient rounding can mint `steps+1`, and the remainder can exit
`[0, t)` upward (self-wedge on next write). Both need `acc >= ~2.8e17`,
unreachable behind admission. Comment corrected to the measured onset
with the reachability note; drain logic unchanged (the `max(0,...)`
clamp stays — deny direction).

### R24-INT-02 — kind-blind fallback pays a corrupt live-replacement MORE than an honest one (Nit, CLOSED by the fix)

Superseded: the corrupt live-replacement now pays exactly what an honest
one pays — zero. INT's "kind-blind drop" observation is resolved by the
deny semantics, not the drop.

### R24-AUT (d) — dedup-only quest string lists have no count cap (Nit, CONFIRMED -> FIXED)

`quests.completedOnceIds` / `quests.questFlags` (and `quests.active`)
validated with dedup-only — a crafted 5k-unique-entry payload passed and
inflated every write/restore walk. New `QUEST_LIST_CAP = 1024` (honest
bound is the authored quest roster, ~two dozen) pins all three lists.
Probe D3 flipped to the rejection pin + an honest-sized admit pin.

### R24-AUT (c) — `acc = 0` reset destroys a sub-threshold pending remainder (Nit, DOCUMENTED - deny direction)

Confirmed clean: admission pins `acc < threshold`, so the reset wipes at
most a sub-threshold remainder (bounded `< 1 insight`) and self-heals
the non-finite wedge it exists to fix. Deny direction, no action.

### R24-AUT (e) — intra-fallback divergence note (informational, MOOT post-fix)

The player store caps its client-clock fallback at 24h while the manager
resolves it uncapped — was pre-existing divergence, now unreachable for
a present authority (only the absent-authority path uses it, where both
sides consistently get legacy semantics). No action.

### AUT r25 suggestion 1 — clamp-into-domain edge values (resolved by design)

The chosen fix is deny (zero-accrual), not edge-clamping — no clamped
endpoint exists to re-open a window. Closed.

## Verification

- `npm run type-check`: clean.
- `npx vitest run src/services/save/ src/stores/player.restoreFromSave.test.ts src/core/cultivation/ src/core/game/`: 196 files, 2040 pass.
- `npx vitest run src/core/production/ src/core/decompose/ src/core/quest/ src/services/`: 85 files, 1343 pass.
- OCR gate (P18): 8/8 reviewable files self-reviewed, coverage 100% (3 `.md` excluded `unsupported_ext`).

## Wave boundary

Batch r24 pushed to `codex/hoa-cau-fireball-vfx`. Wave r25 trio
dispatched against the new tip to attack this batch + siblings.
