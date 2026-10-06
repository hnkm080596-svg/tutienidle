# Fixpoint r24 — INT audit (integration coherence), commit f50fdaf9

Audited batch (r23): `sanitizeRestoreAuthority` drops out-of-domain
(`|x| >= 2^52` or non-finite) authority stamps to the client-clock
fallback inside both `restoreFromSave` bodies; insight acc non-finite
reset + `max(0, remainder)`; comment/doc fixes.

Worktree: `.agent-worktrees/audit-r24-int` at f50fdaf9.
Probes: `src/services/save/auditR24Int.probe.test.ts` — 11/11 green.
Verification: `npx vitest run src/services/save/auditR24Int.probe.test.ts`
(11 passed), `npm run type-check` clean.

## Verdict: PASS WITH EVIDENCE (one pre-existing residual re-confirmed)

The sanitize is applied identically at the entry of both restore bodies
(`player.ts:372`, `GameManagerSaveRestore.ts:158`), before any stamp
read. The same raw union flows through `restoreGameSession`
(`SaveSystem.ts:293,297`); identical input + identical pure function =
identical sanitized authority on both sides. No third consumer reads
authority fields: `useAppLifecycle:458-470` and `App.vue:663-666` only
*produce* the union, and every upstream `serverAuthority` stamp
originates in `parseTimestampMs` (finite-or-undefined;
`SupabaseCloudSaveService.ts:137-141, 663-664, 772-776, 460-463`).
`restoreAuthorityNowMs` is only ever invoked on the already-sanitized
local in both bodies. `EarlyGameSession:648` passes no authority —
deliberate legacy semantics.

## Invariant ledger

| ID | Invariant under audit | Evidence | Verdict |
|----|-----------------------|----------|---------|
| I-a1 | Symmetric sanitize: player + manager settle the SAME window | probe A1-A3: out-of-domain `untilMs`, out-of-domain `sinceMs`, non-finite live-replacement `nowMs` all produce player `elapsedSeconds=600` AND `settleAutoFarmOffline(_, 600)` + alchemy bound `= NOW` (client epoch) | **Coherent** |
| I-a2 | Whole-authority drop: one corrupt stamp discards honest siblings | probe A2 (`sinceMs=-2^52` + honest `untilMs` → full fallback); unit pins | **Coherent** (deny-direction choice, documented) |
| I-a3 | No raw-stamp reader outside the two sanitized bodies | consumer census: `timeAuthority` fields only read post-sanitize in `player.ts:386-409` and `GameManagerSaveRestore.ts:389-434`; producers never consume | **Coherent** |
| I-b1 | Fallback never mints past an honored same-payload authority | probe B2: fallback raw window `172800s` == honored cold-boot raw window `172800s`; both resolve uncapped by design (`POSITIVE_INFINITY` at `GameManagerSaveRestore:396,401`) with per-channel caps downstream | **Coherent** |
| I-b2 | Capped-vs-uncapped split preserved through fallback | probe B1: player accrual caps at `86400` (default 24h), manager settle receives raw `172800`; autoFarm self-caps `min(capped, anchorGap)` (`GameManagerAutoFarmOps:247-278`), decompose floors windowStart + 5000-cycle bound (`DecomposeSystem:274-320`), production 10h budget (`ProductionOffline:67`), alchemy bounded by persisted job deadlines | **Coherent** |
| I-c  | No stale "authority trusted / unboundable / upstream-finite" claims | `saveTypes.ts:281-305` docblock accurate; `player.ts:95-153` correctly supersedes the r13/r14 "unboundable" exemption; `WorkerLaneAdvance:60-68` "huge finite honored by design" is mechanism-truth (admission is a different layer) — accurate | **Coherent** (one nit, F-02) |
| I-d1 | Sanitized restore cannot persist stamps the validator rejects | probe D1: 48h save + autoRestart site + worker pool → fallback settle → `buildGameSave` → `validateGameSaveShape` ok; all seeded heads `startedAtMs <= NOW` (`settleNowMs = min(lastSavedAt + elapsed, Date.now()) <= Date.now()` by construction) | **Coherent** |
| I-d2 | Insight acc: non-finite `gained` resets to writable 0 | `CultivationInsight.ts:20-43` guard precedes drain; not save-reachable (validator bounds the field at admission); both callers pass real deltas | **Coherent** (mechanism-level belt, no save reachability) |

## Findings

### R24-INT-01 — honored in-domain authority ahead of `Date.now()` mints persisted `workerCycles` that fail the `startedAtMs <= lastSavedAt` pin (self-brick) — **Medium, PRE-EXISTING residual (not charged to r23)**

- **Invariant**: any save `buildGameSave` emits after a restore must
  re-admit under `validateGameSaveShape` (round-trip closure).
- **Actual**: under an honored cold-boot with `untilMs > Date.now()`,
  `settleNowMs = min(lastSavedAt + elapsed, untilMs) = untilMs` sits in
  the future. `settleWorkersOffline` → `advanceWorkerLanes` seeds lane
  heads whose `startedAtMs` lands up to `settleNowMs` (pending head
  `startMs = largest due <= nowMs`; `due_k = emptyLaneStart + k*cycleMs`).
  The r16 `fieldEpochShiftMs` re-stamp is one-way
  (`max(0, Date.now() - nowMs)`, `ProductionOffline.ts:184`) — it does
  not fire when the authority is *ahead* of the client. `buildGameSave`
  then stamps `lastSavedAt = Date.now()`, and the next load's F-TC10-WC
  pin (`saveShapeValidation.ts:3471`) rejects
  `startedAtMs > lastSavedAt` → save 'corrupted'.
- **Reachability**: remote-authoritative boot path
  (`useAppLifecycle:458-470`) + an `autoRestart` production site with
  empty/seeded lanes + server clock ahead of the client. Honest positive
  skew suffices: dues landing inside `(Date.now(), untilMs]` make the
  surviving head start past `lastSavedAt` — probability ~`skew/cycleMs`
  per lane (≈10%/lane at 30s skew, 300s cycle). An absurd in-domain
  `untilMs` (e.g. `2^52-1`) bricks deterministically.
- **Probe evidence** (both green as written):
  `RESIDUAL (r19 carried observation)` — honest +30s skew, heads
  `startedAtMs = NOW+10000`, `shape.ok === false` on a
  `workerCycles` issue; `RESIDUAL (extreme)` — `untilMs = 2^52-1`,
  heads near the domain edge, `shape.ok === false`.
- **Relation to r23**: the sanitize bounds stamp *magnitude* (`< 2^52`)
  but cannot bound stamps against the save's own `lastSavedAt` marker —
  that pin is tighter and client-epoch. The batch neither introduces nor
  worsens this; r19-cor recorded the same class as a carried observation
  ("deny direction, exotic precondition"). This audit adds the concrete
  *forward*-skew reachable path (r19 recorded the backward-clock
  correction arm) and pins it deterministically.
- **Blast radius**: deny direction (no mint — the bounced save loses the
  offline window and routes to the recovery surface). Beta reachability
  depends on the remote-authoritative (Supabase) boot being live.
- **Suggested direction** (for adjudication, not this audit's scope):
  either clamp `settleNowMs` for persistence-bound stamps
  (`min(authorityNowMs, Date.now())` at the production-settle cursor),
  or extend the seeded-head re-stamp symmetrically
  (`|Date.now() - nowMs|` shift).

### R24-INT-02 — kind-blind fallback: a corrupt live-replacement pays MORE than an honest one — **Nit, deliberate/pinned**

- `sanitizeRestoreAuthority` drops the union to `undefined`, which the
  restore reads as legacy client-clock accrual — so a corrupt
  `live-replacement` (`nowMs` non-finite/`|x|>=2^52`) pays the client
  window instead of its honest zero-accrual semantics. Pinned
  deliberately by r23 (`player.restoreFromSave.test.ts`, non-finite
  `nowMs` → 600s client window) and re-pinned end-to-end here (probe
  A3: player 600s AND `settleAutoFarmOffline(_, 600)`).
- Bounded by the 24h player cap + per-channel caps; the threat model is
  a corrupt server response, and the fallback pays only what the save's
  own marker + local clock justify.
- **Doc nit**: the `saveTypes.ts:281-290` docblock ("bounded deny
  direction: no path widens past the honest elapsed a same-payload
  client-window would pay") is literally true against the *client-window*
  baseline but does not flag that it is a *widening* against the honest
  `live-replacement` semantics — a one-line note would close the gap.

### R24-INT-03 — payload-identity caches are authority-agnostic: a split retry can settle the two sides under different windows — **Low, pre-existing**

- `lastRestoredPayloads` (`player.ts:373-376,738`) and
  `lastAppliedPayloadHash` (`GameManagerSaveRestore.ts:160,542`) key on
  `computeRestoreIdentity(save)` only — never on the authority. Both
  commit at end-of-method; `restoreGameSession` runs player first
  (`SaveSystem.ts:293`) then manager (`:297`), so a mid-manager-restore
  throw leaves player committed / manager uncommitted. A retry of the
  SAME payload under a DIFFERENT authority (boot re-poll yields a new
  `serverNowMs`) returns the player's cached first-authority result
  while the manager settles the retry's window — asymmetric settle for
  one logical restore.
- **Probe evidence**: probe A5 — after a fallback-context player commit
  (600s), a fresh manager settles the honored 200s window while the
  player's repeat call replays the cached 600s.
- Pre-existing (identity caches predate the authority union); the
  sanitize does not create it — it merely makes the cached-vs-live
  divergence visible across authority changes. Bounded: each side's
  result is a legitimate semantics for *some* authority; requires a
  mid-restore throw to arm. Worth adjudication awareness only.

## Gaps and residual risk

- **In-domain absurd authority is honored by design**: `untilMs` up to
  `2^52-1` (≈ year 143942) resolves a ~4.5e12-second raw window into the
  settle channels (probe A-boundary: `settleAutoFarmOffline` receives
  `elapsed ≈ 4.5e12`). Every channel self-caps (autoFarm 24h + anchor
  gap; decompose cap floor + 5000-cycle bound; production 10h budget +
  lane ceiling; alchemy persisted deadlines), so no mint — but the
  persisted-cursor seam (F-01) is where the bounded surface ends.
- **Fallback `settleNowMs <= Date.now()`** holds by construction
  (`min(lastSavedAt + elapsed*1000, Date.now())`), so the sanitized path
  provably cannot self-brick via persisted settle stamps — verified by
  probe D1 end-to-end.
- **Kind-blind drop granularity** (F-02's sibling): one corrupt stamp
  discards honest siblings (corrupt `sinceMs` + honest `untilMs` → full
  fallback; probe A2). Deny-direction-consistent with the r23 contract;
  a partial-salvage policy is a design choice, not a defect.
- **Insight acc**: the non-finite reset is unreachable from a valid
  payload (admission bounds the field; both callers pass real deltas) —
  belt-level defense, correctly placed, no integration gap found.

## Learned-defect loop

| Lesson | Class | Detector escape | Pin proposed |
|--------|-------|-----------------|--------------|
| Domain bound (2^52) does not imply pin bound (`<= lastSavedAt`): authority-cleaned input can still mint persisted stamps the stricter marker pin rejects — check every *persisted* writer against the tightest downstream pin, not just the admission domain | cross-layer bound mismatch | the r19 carried observation was noted but had no deterministic repro; the lane-seed epoch arm needed phase-aligned dues to expose | probe D-residual pins (`auditR24Int.probe.test.ts` seam d); candidate fix: clamp persistence-bound stamps to `min(authorityNowMs, Date.now())` or symmetric field-epoch re-stamp |
| Identity guards keyed on payload only can split-settle two consumers under different authorities on retry | cache-key incompleteness | requires a mid-restore throw to arm — masked in normal boots | probe A5 documents; adjudication may accept (bounded, narrow) or key the caches on (identity, authority) |
| Fallback kindness is kind-blind: a corrupt zero-accrual union pays accrual | semantic flip | deliberate r23 pin; docblock silently true against the wrong baseline | one-line docblock note (F-02) |

---
INT auditor sign-off: r24 — PASS WITH EVIDENCE. Two findings deferred to
adjudication (R24-INT-01 residual hardening decision, R24-INT-03
cache-key scope), two informational (R24-INT-02, kind-blind drop noted
above).
