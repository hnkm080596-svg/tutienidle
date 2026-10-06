# Fixpoint r29 — adjudication

Audited tip: `faa893c1` (r28 batch). Auditors: COR `ba2fa853`, AUT `1627f8ef`, INT `f02b57de`.
Verdicts: COR PASS (1 Low + 3 Nit), AUT PASS (1 Medium + 1 Low + 3 Nit), INT PASS (3 Low + 3 Nit).
Aggregate: 1 Medium + 4 Low + 9 Nit = 14 actionable at intake.

## Confirmed → fixed

### Finite-clock doctrine — completed across every ms-clock seam

The r28 pin covered `advanceWorkerLanes` + `AlchemySystem.tick`/`settleOffline`.
r29 auditors found five sibling seams still open. All now deny on
`!Number.isFinite(x) || |x| >= 2**53`:

| Seam | Old behavior on hostile clock | New |
|---|---|---|
| `AlchemySystem.restoreJobs` (COR-F1/AUT-F2) | `-Infinity` re-anchored began/due pairs to `-Infinity` → next honest tick minted the whole queue (digest self-consistent, verify passes) | `clockOk` gate → verbatim restore; post-dated job stays parked |
| `ProductionSystem.restoreStates` (AUT-F2) | same re-anchor on workerCycles | verbatim restore |
| `DecomposeSystem.tick` (INT-1) | `tick(NaN)` minted once AND poisoned `nextCycleAt=NaN` → every later finite tick minted again | zero-advance; deadline kept |
| `DecomposeSystem.settleOffline` (INT-1) | `1e300` ran the bounded loop to its 5000-cycle ceiling | `return 0` |
| `DecomposeSystem.restore` | `Math.min(restoredDeadline, restoreNowMs+cycleMs)` with `restoreNowMs=NaN` → `nextCycleAt=NaN` | verbatim merge via `Math.max(0, restoredDeadline)` |
| `QuestManager.restore` `lastDailyResetAtMs` | `Math.min(state, NaN)` → wedge | verbatim marker (frozen = deny) |
| `TribulationDirector.restoreRuntime` | `cooldownUntil` shifted under NaN → opened the cooldown gate = free retry | verbatim `(slice?.cooldownUntil ?? 0)` |
| `AlchemySystem.startJob` (INT-2, origination gap) | `startJob(nowMs=NaN)` minted a NaN-deadline job — the tick guard inspects `nowMs`, not the stored deadline → next finite tick settled → pill minted; `1e300` minted a parked-forever job | guard before all cost/burn → `{ok:false, reason:'invalid_clock'}` |

Persisted-stamp biên stays `< 2^52`; mechanism guards `< 2^53` (feeds outside save).

### AUT-1 (Medium) — refuse-code provenance

AUT's premise was partly falsified: a server `REJECTED` envelope DOES map to
`unavailable(code ∈ DATA_REFUSE_CODES, retryable:false)` in
`SupabaseCloudSaveService` (~968-989), so the App.vue coded-refuse arm fires on
both "adapter never invoked" (local gate) and "server refused" paths.

Adjudication: **'local' scope stays correct on both paths.** A refused write
never commits — the remote row still holds last-good — so withholding
`resetCharacter()` (remoteResettable=false) is the safe label; a 'remote' scope
would offer a destructive cloud reset against a healthy row. Residual
documented: if the server refuses even last-good content (e.g. size cap
shrunk), the save-issue card can't offer the remote reset — the user falls back
to local reset. `DATA_REFUSE_CODES` docblock rewritten (INT-6: old text still
claimed remote-scope arm); App.vue refuse comment rewritten + `return result`
after `bootFlow.fail()` so the terminal surface doesn't also arm the transient
autosaveFailed toast (AUT-4).

### INT-3 (Low) — tier asymmetry on coded refuse

Remote: coded refuse → `authorityStateForError` → 'recovery' (terminal) →
`canMutate()` false → tick loop idles. Local (no reconnect dep):
`observeSaveResult` early-returns → `canMutate()` stayed true → the sim kept
advancing behind `SaveIncompatibleScreen`. Fixed at the lifecycle seam: tick
callback now gates on `entryStage.value === 'game' && authority.canMutate()`
(matching the `persistProgress` gate at :318). Pin in `useAppLifecycle.test.ts`
(entryStage 'error' freezes ticks, 'game' resumes).

### INT-4 + AUT-3 (Low) — cap-refused collections still walked

`requireArray`/`optionalArray` now `return []` after pushing the cap issue — a
refused array pays no element walk (worst case was per-job digest folds on an
already-refused payload). The `validateSkillCoreCoverage` `nodeLevels` binding
is also cap-gated (`isObject && keys <= ID_COLLECTION_CAP`), so the three
sibling walks (:3158/:3225/:3253) stop emitting per-key issues on refused
records — parity with the r28 `talentLevels` arms (AUT-F3 asymmetry closed;
r27-E1 probe flipped to parity pin).

## Accepted (documented, no fix)

- **F4/COR-F4 foldable residual**: restore-time digest re-derive covers only
  `specialIngredients` foldable witnesses — a `reservation` whose specials are
  non-foldable keeps the writer digest over the OLD stamps, so shift arms
  self-deny at settle (deny direction, unreachable from save-validated feeds).
- **AUT-5 `saveIssue.clear()` dead arm under remote refuse**: 'recovery' is
  terminal → a later ok-write can never run inside the session → `clear()`
  unreachable. Harmless; kept as the ok-arm hygiene.
- **INT-7 `saveFailureNotified` latch**: cosmetic double-flag only.
- **INT-1/COR nits**: marker fields that stay verbatim under bad clock park
  their own channel — self-harm deny, consistent with the r21-r28 doctrine.
- **AUT F1 provenance exists-but-ignored**: `result.detail` distinguishes
  gate-refuse (`OUTGOING_*`) from server-refuse, but the 'local' label is
  correct on both (see AUT-1); no code change needed beyond comments.

## Probe disposition

- `auditR29Cor.probe.test.ts`: E1-E6 flipped to deny asserts (verbatim restore,
  parked job survives honest tick, zero-advance); B3 `gets` → 0.
- `auditR29Int.probe.test.ts`: P3/O1/O2/C1/C2 flipped to deny; T2 repinned
  (canMutate stays true by design; freeze owned by the entryStage gate —
  behavioral pin lives in `useAppLifecycle.test.ts`).
- `auditR29Aut.probe.test.ts`: F2 pair flipped to verbatim-restore pins; F3
  walks flipped to empty; F1 suite kept as-is (documents the adjudicated
  contract: server CAN emit the codes, provenance exists but 'local' stands).
- `auditR27Int.probe.test.ts` E1 flipped: array over-cap now stops at the cap
  issue (parity with maps) — the r29 fix closed the asymmetry it pinned.

## Verification

- `npm run type-check` — clean.
- Scoped `npx vitest run --pool=threads` over `core/alchemy`, `core/production`,
  `core/quest`, `core/tribulation`, `services/save`, `composables/useAppLifecycle` —
  1558 passed, 4 skipped. 90 r29 probe tests green post-flip.
- OCR delegate: 15/15 files reviewed, 100% coverage.
