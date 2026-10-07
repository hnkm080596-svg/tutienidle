# Fixpoint r25 adjudication — commit 2a3f95a9 (r24 batch)

Auditors: COR `devin-705e23c1b283491f8b3a92d10b10fc13`, AUT `devin-f909aa1005a04f89be164e58cbdf79c4`, INT `devin-2c3355601a3f449090d945eb08bed319` — all blind, all probed at `2a3f95a9`.

Verdicts: COR PASS WITH EVIDENCE (1 Medium + 3 Nit), INT FAIL (1 High), AUT FAIL (0 mint; 2 Medium self-brick + 2 Low).

## Confirmed findings and fixes

### R25-INT-01 (High) + R25-AUT-2 (Medium) — persisted deadline stamps restore verbatim with no epoch clamp → the game's own next write self-rejects

- Claim (verified): `workerCycles[].startedAtMs`, `alchemyJobs[].startedAtMs`, `tribulation.cooldownUntil` restore verbatim. A payload whose stamps are shifted +Δ together (crafted-future `lastSavedAt`) passes every admission pin — `startedAtMs <= lastSavedAt` compares against the payload's OWN editable marker (AUT-2). The stamps persist +Δ; the next honest write stamps `lastSavedAt = Date.now()` beneath them and `writeGameSave` commits it raw — the healthy slot is overwritten by a self-failing payload. Next boot: corrupted recovery.
- Repro: INT seam (c) + AUT arm B probe both demonstrated: +Δ save → admission ok → verbatim restore → `buildGameSave` output fails `validateGameSaveShape` on `startedAtMs`/`tribulation` paths.
- Fix (backstop, the one that closes the class): **write-side gate inside `CloudSaveCoordinator.driveSave`** — the single seam covering local (`LocalCloudSaveService` → `writeGameSave`) AND remote (Supabase RPC `write_character_save`). An outgoing `GameSave` that fails `validateGameSaveShape` — the same predicate the local boot path (`loadGame`) applies — is refused BEFORE `service.save` runs: `{status:'unavailable', detail:'OUTGOING_ADMISSION_REJECTED', retryable:true}`. The healthy slot is never overwritten; a +Δ-skewed state self-heals once wall time overtakes the skew (hence retryable). The gate validates the **wire form** (`JSON.parse(JSON.stringify(snapshot))`) — the exact bytes the boot path will read; unserializable payloads refuse non-retryable (`OUTGOING_UNSERIALIZABLE`).
- Why shape-only, not `isSaveAcceptable`: `loadGame` (the local admission) runs `validateGameSaveShape` only; acceptance is the foreign-payload surface (import + remote envelope). A pre-creation-pick autosave is shape-valid and loadGame-legal — applying acceptance to the writer would block legitimate early saves (caught by `player.save.test.ts` regression).
- Coverage audit (coordinator self-check): every path that puts bytes into SAVE_KEY is gated — `driveSave` (all store/autosave/quit writes + queued promotions), `importSaveRaw` (stricter: shape + acceptance), remote `adoptCommittedPending` (shape + acceptance at :441), `restoreBackup` (deliberately ungated — recovery lane restoring bytes that were already admitted).
- Sibling seed-clamps (defense in depth — restore-side):
  - R25-AUT-1: `offlineSinceMs` gained a third `Date.now()` operand — marker+sinceMs both future no longer seeds lane heads past the next marker.
  - `effectProvenanceMs` (`player.ts`) gained `Date.now()` — the persisted expires clamp (`provenance + TU_LINH_TRAN_DURATION_MS`) can no longer write `expires > next-lastSavedAt + duration`.
  - `boundTimedEffectClocks` `appliedAtMs` gained `Date.now()` — appliedAt can't persist past the next marker when authorityNow is skewed.
- Verdict on verbatim restore: KEPT. Post-dated stamps are real deadlines — clamping them to now would silently skip honest dues. The gate makes the self-fail unreachable at the slot; the stale state ages out harmlessly.

### R25-COR-1 (Medium) — remote-authoritative + absent/corrupt `serverTimeUtc` → `timeAuthority === undefined` → legacy client window pays the payload's editable marker

- Claim (verified): both `serverAuthority` producers (`SupabaseCloudSaveService` ~:460 adopted-pending, ~:772 SAVE_READY) collapse to `undefined` on absent/unparseable `serverTimeUtc`; `useAppLifecycle:459` minted `timeAuthority` only when `remoteAuthoritative && loaded.serverAuthority`, so `undefined` selected the client-clock window paying `Date.now()-lastSavedAt` — the exact fail-open class r24 denied for present-corrupt stamps.
- Fix: remote-authoritative + absent authority now mints `{kind:'live-replacement', nowMs: Date.now()}` (zero-accrual deny primitive) — same seam App.vue:664 already used for the resume path. `undefined` is now exclusively "caller truly has no authority" (EarlyGameSession, non-remote adapters).

### R25-AUT-3 (Low) — quest dedup element walks ran before the length cap

- Reordered `validateQuestSave` so `length > ID_COLLECTION_CAP` precedes `.every`/`new Set` on `active`/`completedOnceIds`/`questFlags`.

### R25-AUT-4 (Low) — unknown authority `kind` honored verbatim → client-clock elapsed (fail-open, unreachable today)

- `sanitizeRestoreAuthority` now whitelists kinds: `cold-boot`/`live-replacement` read their stamps; any other kind forces `[NaN]` → degrades to live-replacement.

### R25-COR-3 (Nit) — sibling id collections uncapped (completedStageIds, perfectClearStageIds, purchasedNodeIds, grantedRealmPassiveIds, selectedTalentIds, offeredTalentIds, nodeLevels/nodeOneShotGrants/perfectClearSeconds maps)

- `ID_COLLECTION_CAP = 1024` now lives inside `requireArray`/`optionalArray` — every array channel shares the bound (quests, techniques, skills, materials, equipment, pills, talismans, formations, buildings, equipmentSlots, effect modifiers, companions, formation assignments, equipment affixes) — plus `Object.keys(...).length` caps on the three Record maps. `validateStringEntries`' own count check removed (subsumed).

## Formally excepted / documented (non-actionable)

- **COR-Nit `settleNowMs` redundant `Date.now()` on the absent arm**: harmless — `authorityNowMs` already resolves `Date.now()` there; kept for symmetry with the cold-boot arm where it is load-bearing. Recorded, no change.
- **COR-D `lastDailyResetAtMs` crafted-past → early daily reset**: DORMANT — the authored roster has zero `cadence:'daily'` quests; `checkAndResetDaily` clears nothing real. Re-opening is self-harm deny-side. Exception recorded; re-evaluate only if a daily quest is authored.
- **Verbatim post-dated deadline stamps**: covered above — the write-side gate is the remedy, not stamp rewriting.

## Pins added (flipped auditor probes + new coverage)

- `auditR25Cor.probe.test.ts` — A4 mirror updated to the new upstream semantics; Q3 flipped to deny (sibling caps now bound).
- `auditR25Int.probe.test.ts` — seam (c) extended with a coordinator pin: the self-failing payload is refused before `service.save` runs; a clean payload passes.
- `auditR25Aut.probe.test.ts` — arm B test 1 flipped (heads clamp `<= now`, repackage validates); arm B test 2 extended with the same gate pin; arm C materials-2048 flipped to deny; arm D rogue-kind flipped to degrade.
- `CloudSaveCoordinator.test.ts` + `w5aut.repro.test.ts` — stub `{}` fixtures replaced with real `buildGameSave` payloads (the gate requires a real save).

## Verification

- `npm run type-check`: clean.
- Scoped `npx vitest run` (services/save, services/cloudSave, composables/useAppLifecycle, core/game, stores): 219 files / 2254 tests green (3 probe files: 35 tests).
- P18 OCR: 11/11 reviewable files read against the diff (3 .md excluded `unsupported_ext`).

## Wave state

r25 closes the self-brick family completely: both seeding seams clamp at `Date.now()` and the write-side gate makes a self-failing payload unable to reach either slot. Next: wave r26 blind trio at the new tip.
