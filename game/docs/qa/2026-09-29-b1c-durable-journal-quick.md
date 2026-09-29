# QA Review: B1-C durable journal, serialized save queue, lost-ACK recovery (PR4)

- Date: 2026-09-29
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: `src/services/cloudSave/{PendingSaveJournal.ts,AckedSaveCache.ts,reconcilePendingSave.ts,CloudSaveCoordinator.ts,CloudSaveService.ts,SupabaseCloudSaveService.ts,LocalCloudSaveService.ts,*.test.ts}`, `src/services/save/{saveKeys.ts,SaveSystem.ts}`, `src/{App.vue,composables/{resumeSession.ts,useAppLifecycle.ts},components/panels/SettingsPanel.vue}`, `tests/integration/supabase/{authority.spec.ts,fixture.ts}`, `tsconfig.{node,tests}.json`

## Scope and Risk Map

`changed-risk-map.mjs` returned every task-owned path as `unmappedPaths` (the mapper's
route table does not cover `services/cloudSave/` or `services/save/`); all were
manually routed and inspected:

- **save-and-cloud** (primary): journal/cache/coordinator/adapter/saveKeys/SaveSystem +
  one-hop consumers `useAppLifecycle` (boot surfaces), `App.vue` (reset ordering),
  `SettingsPanel` (export seam), `resumeSession` (continue affordance).
- **time-and-offline**: the journaled write freezes `{checkpointId, elapsedMonotonicMs}`
  so a late commit preserves the server progression cutoff; the bigint-elapsed real bug
  found by the contract run lives here.
- **ui-input-lifecycle**: only boot/recovery routing, no interaction primitives.

Mandatory-escalation note: this diff materially changes save/cloud recovery, which the
quick workflow lists as an escalation trigger. The coordinator explicitly scoped the P4
run as `quick`; the run stays quick and documents the risk bounding instead of silently
widening: (a) the attack surface is fully enumerated by the plan's five checkboxes, each
already carrying unit + real-RPC contract assertions, (b) no economy/progression rule,
clock accrual, or Vue/Pinia/Phaser ownership boundary changed, (c) the remaining broad
risk — online session admission and identity surfaces — is PR5/PR6 scope and out of this
diff. If the coordinator prefers a formal deep audit, that is an additional run, not a
gap in this one.

Exclusions: none — every task-owned path reviewed.

## Invariant Ledger

| Invariant (class) | Hypothesis under attack | Disposition |
| --- | --- | --- |
| Exactly-once commit | Replayed mutation must never re-commit server-side | Resolved: receipt gate resolves identical mutation before CAS; `mutationReceiptCount == 1` asserted on the real staging RPC (authority.spec.ts) and on the fake (durableJournal.test.ts) |
| Pending retained where unresolved | A write whose transport never answered keeps its journal record; remote never overwritten | Resolved: journal-first ordering; transport fail / commit-then-drop / post-ACK storage failure injection tests |
| Single serialized writer | Overlapping manual/autosave/quit callers join one queued entry; newest detached snapshot wins; expected revision re-read after ACK | Resolved: queue tests + real-RPC "exactly two commits" test |
| Generation fence | reset/logout/user-switch while a write resolves must not advance revision, journal, cache | Resolved: advanceGeneration mid-flight + reset-drains-queue tests |
| Frozen checkpoint | Replays send the record's checkpoint verbatim; cutoff survives a late commit | Resolved: frozen-checkpoint test + `progression_cutoff_at` equality on the real RPC |
| Identity isolation | Foreign env/user/character bindings never read or clear a record | Resolved: isolation unit + contract tests |
| Conflict terminal | Genuine CAS divergence retains the record and surfaces pending-conflict; remote untouched | Resolved: unit + real-RPC tests |
| Receipt-behind-head | already-committed with `current > committed` must re-read the live row, never cache obsolete pending bytes | Resolved: unit + real-RPC test (rev 8 commit vs head 9) |
| REJECTED settles fate | A rejected write's record cannot recover; drop it | Resolved: write-path test |
| Cleanup after failure | A throwing adapter must not strand queue resolvers or leak `inflight` | **Defect found and repaired** (QA-2026-09-29-B1C-1) |
| Repeat-restore safety (learned QA-2026-09-08-001) | Replayed restore/commit must be idempotent | Resolved: identical mutation resolves alreadyCommitted; second load sees `none` |
| Side-channel identity binding (learned QA-2026-09-01-002) | Cross-reload side channel bound to owning payload, initialized before destructive persistence | Resolved: single envelope carries payload+revision+identity+byte hash |
| Boot transaction visibility (learned QA-2026-09-17-B2) | Every awaited service outcome resolves visibly, including thrown rejections | Resolved at the coordinator by the QA-2026-09-29-B1C-1 repair (same defect class, new site) |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/services/cloudSave src/services/save/saveKeys.test.ts src/stores/player.save.test.ts` | 89/89 pass | includes all 5 checkbox suites + acceptance seeds |
| `npx vitest run` (full, inside `npm run verify`) | 7342 pass / 5 expected-fail / 1 skipped | post-fix state |
| `npm run type-check` (`vue-tsc --build`) | clean | required a tsconfig split (integration specs moved to the dom+node-types project so the `@/` graph resolves) |
| `npm run test:supabase` (real staging RPC, fresh schema) | 24/24 pass incl. 5 new B1-C cases | every commit/receipt/assertion below is the real server |
| `retrySameMutationAfterLostAck()` | `{status:'already-committed'}` | acceptance seed |
| `readServerRevision()` | `8` | acceptance seed |
| `mutationReceiptCount()` (countCommitsForMutation) | `1` | acceptance seed over real RPC |
| `journal.read(otherBinding)` | `'none'` / `'mismatch'` | acceptance seed |
| `journal.clearMatching(binding, olderMutationId)` | `{status:'ok', cleared:false}` | acceptance seed |

## Findings

### QA-2026-09-29-B1C-1: throwing adapter strands queued save resolvers

- Severity: Medium
- Status: Confirmed (repaired this run — regression test added)
- Invariant: every `coordinator.save()` call settles; joined callers resolve.
- Preconditions: any `CloudSaveService.save` implementation rejects instead of
  returning `unavailable` (e.g. a thrown `JSON.stringify`, a rejecting
  `resolveBinding` seam).
- Reproduction: `save` returns `Promise.reject`; a second caller joins the queue.
  Pre-fix, `driveSave`'s rejection propagated out of `save()` before the drain
  loop ran, so `entry.resolvers` were never invoked — the joined callers hung
  forever and `this.queued` stayed populated.
- Expected: the inflight caller and every joined resolver settle `unavailable`.
- Actual (pre-fix): rejection propagated; queued resolvers hung.
- Evidence: static proof (the drain loop sat inside the `try` after the awaited
  `driveSave`); regression test `a throwing adapter settles save() and every
  joined resolver as unavailable` in `durableJournal.test.ts` — on the pre-fix
  code the `Promise.all` never settles.
- Test file: `game/src/services/cloudSave/durableJournal.test.ts`
- Owner subsystem: `CloudSaveCoordinator` queue.
- Blast radius: flush-on-quit / autosave callers awaiting a save whose adapter
  threw would hang; orphaned queue could wedge a later promotion.
- Same defect class as learned row QA-2026-09-17-B2 (rejection channel of an
  awaited service call) at a new site — the coordinator's join/drain path.

## New or Changed QA Tests

- `src/services/cloudSave/durableJournal.test.ts` — added
  `a throwing adapter settles save() and every joined resolver as unavailable`
  (repair pin for QA-2026-09-29-B1C-1).
- `src/services/save/SaveSystem.test.ts` — added `deleteSave() drops this
  account's B1-C envelopes but keeps another account's` (closes the coverage
  gap on the new reset path; cross-account isolation asserted).
- `src/composables/useAppLifecycle.test.ts` — added two cases asserting
  `pending-conflict`/`pending-quarantined` route `pendingRaw` to
  `saveIssue.report('corrupted', ...)` + `boot.fail()` (closes the gap on the
  new load statuses' consumer wiring).
- `src/composables/resumeSession.test.ts` — new file: acked-envelope fallback
  yields a resumable candidate, corrupt envelopes skip, foreign-account
  envelopes stay invisible (closes the gap on `rawSaveForResume`).

## Gaps and Residual Risk

- **Single-slot journal overwrite.** A second `save()` while a pending record
  exists replaces it. Sound only because snapshots are canonical full-state:
  the newer record is a superset of the displaced one. If a non-canonical or
  partial snapshot path is ever introduced, this invariant silently degrades —
  bounded here by the canonical-snapshot contract, worth pinning in PR5 review.
- **FakeRemote leniency.** The unit-suite fake resolves any replayed mutationId
  as `alreadyCommitted` regardless of payload bytes; the real server rejects a
  same-id/different-payload replay (`MUTATION_ID_REUSED`). Bounded: the real
  staging suite replays verbatim records and asserts receipt counts; a client
  that mutated the record between journal and replay would be caught there.
- **Multi-tab.** Two tabs share one journal slot; last writer's pending wins
  and the loser's CAS conflict surfaces normally. Session admission (PR5) is
  the designed owner of cross-session contention — recorded, not a defect.
- **Abrupt OS failure** between `setItem` return and real disk flush is
  outside localStorage's durability contract by design; the server ACK remains
  the authority — documented in the journal header.
- The integration spec's `MemoryStorage` models `localStorage` as always-ok;
  quota-failure paths are covered by the unit suite's throwing-storage stubs.
- **Not verified**: real-browser IndexedDB/localStorage persistence across an
  OS kill — inherent platform limit, acknowledged per plan §8 checkbox 3.

## Sequential Review Passes (P5)

Sequential Review Pass 1
  Reviewed state: post-OCR implementation state incl. the P18 Medium fix
    (adapterThrow drain) and the P4 coverage pins.
  Findings:
    - MEDIUM - `advanceGeneration()` bumped the counter but left
      `this.characterId` / `this.checkpoint` stale: after a
      reset/logout/user-switch a save-first path reused the OLD
      session's checkpoint (REJECTED at best) and stamped envelopes with
      the old character identity (forced quarantine on recovery).
    - MEDIUM - `journal.put`/remote write was not generation-fenced: a
      stale generation resumed after reset could journal (and remotely
      commit) under a checkpoint re-read that belongs to the NEW
      generation.
    - Nit (deferred) - `isRecordShape` accepts non-integer
      `elapsedMonotonicMs`; a foreign float record still hash-validates
      then terminally quarantines on server REJECTED. Safe.
  Fixes:
    - `advanceGeneration` now also clears `characterId` + `checkpoint`
      (generation-scoped identities).
    - Added an explicit stale-generation guard before the WAL write:
      `generation !== this.generation` -> `STALE_GENERATION`, no journal,
      no remote write.
    - New pins: `advanceGeneration clears identity + checkpoint: the
      next save re-resolves both` and `a save started before
      advanceGeneration never journals nor writes remotely`
      (durableJournal.test.ts).
  Verification: `npx vitest run src/services/cloudSave` 85/85; scoped
    suite 213/213 after the store-level pin.

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings:
    - Ownership layering verified: saveKeys owns key naming,
      PendingSaveJournal/AckedSaveCache own envelope semantics,
      coordinator owns the one write queue, adapter owns replay,
      reconcilePendingSave is the pure decider. Optional
      `readCachedSave?`/`advanceGeneration?` interface additions keep
      the local adapter free of remote concepts.
    - `pendingRaw` consistently carries the save payload bytes to the
      export surface while quarantine slots keep the forensic record -
      coherent, not a duplication of truth.
    - Low (deferred) - `resumeSession` prefers a stale local slot over a
      newer acked envelope in mixed local->remote history; resume is a
      UX affordance only, both parse to a candidate.
  Fixes: none required.
  Verification: code inspection + consumer grep (readCachedSave,
    readAnyAckedSaveEnvelope, listSaveEnvelopeKeys call sites).

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES (no Pass 2 changes)
  Findings:
    - `onAuthenticated` ordering verified: `coordinator.reset()` fences
      the old generation and drains queued writers BEFORE
      `setSaveAccountId` rebinding - a stale save can never journal into
      the new account's slot.
    - `ensureIdentityForSave` covers NO_CHARACTER / CHARACTER_DELETED /
      CHARACTER_UNINITIALIZED for the save-first path; the stale-gen
      guard re-anchored nothing under a dead generation.
    - All save callers route through `cloudSaveCoordinator.save`
      (player.ts:248, useAppLifecycle) - no raw adapter bypass.
    - Coverage pin added at the consumer layer named by the plan:
      `player.save.test.ts` overlapping-callers join-queue case.
  Fixes: `player.save.test.ts` +1 consumer pin (test-only).
  Verification: scoped `npx vitest run` 213/213; full `npm run verify`
    (type-check + build + 7352 tests) green on the final state;
    `npm run test:supabase` 24/24 on the real staging project.

Runtime evidence note (P13/P14): the only UI surface touched is the
boot save-issue router - the pending statuses reuse the existing
'corrupted' recovery surface already e2e-covered by
tests/e2e/error-recovery.spec.ts; the mapping itself is pinned by unit
tests. The authority/replay surface is covered by the real-RPC contract
run (Playwright spec, 24 cases incl. the five B1-C seeds).

## Pre-existing Failures

None observed. `vue-tsc --build` required moving `tests/integration/**/*` into
`tsconfig.tests.json` because this diff is the first to import `src/` modules
from an integration spec; the mass `@/` resolution errors were a consequence of
this change's import surface, not a pre-existing breakage (verified: the node
project has no `@` path mapping and no DOM lib).
