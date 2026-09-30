# QA Review: BETA-FINAL PR12 — verified beta updates with flush-gated install admission

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH EVIDENCE (one Confirmed Medium found at OCR and fixed; scoped reruns green)
- Task-owned paths: `src/shared/update/UpdateState.ts`, `src/main-process/{UpdateService,updateFeed,electronUpdater}.ts`, `src/composables/{useUpdates,useElectronBridge}.ts`, `electron/{main,preload}.ts`, `src/App.vue`, `src/components/common/{UpdateBanner,ErrorScreen}.vue`, `src/components/panels/SettingsPanel.vue`, `src/shared/diagnostics/DiagnosticEvent.ts`, `src/locales/{en,vi}.json`, `electron-builder.yml`, `package.json`/lock, `playwright.electron.config.ts`, `tests/electron/beta-update.spec.ts`, `scripts/release/update-feed.test.mjs`, plus the new `*.test.ts` files in the same scopes.

## Scope and Risk Map

Mapper output (`changed-risk-map.mjs` over the 14 task-owned non-test paths): domain `ui-input-lifecycle`; `deepAuditCandidate: false`; 10 `unmappedPaths` manually routed by code inspection: the whole `shared/update/` + `main-process/` update surface maps to `save-and-cloud` (the install gate consumes PR5's FlushResult/authority drain verbatim; it changes NO save semantics) and `ui-input-lifecycle` (IPC boundary, overlay lifecycle, subscription disposal). `electron-builder.yml`/`package.json` map to the release surface — inspected directly (publish parity asserted by `scripts/release/update-feed.test.mjs`).

Escalation review (mandatory-escalation checklist): save/cloud consistency semantics unchanged (FlushResult contract consumed, not redefined — quitFlush.ts untouched); no clock/offline accrual touch; no economy/progression cross; Vue/Pinia lifecycle risk bounded — the `bindUpdateSurface` singleton mirrors `bindOnlineAuthority` and subscription disposal is unit-tested. No mandatory escalation trigger fires.

Exclusions: none — every dirty path is task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-U1 | pending install attempt | install-request -> prepare -> result | quitAndInstall ONLY on saved + requestId + generation + trusted sender | forged sender / stale requestId / stale generation / malformed payload | provider.quitCalls === 0 on every refusal path; exactly 1 on legit | unit (UpdateService.test.ts) | High — acceptance block | PASS |
| INV-U2 | candidate verification | provider manifest -> verified candidate | only a newer, same-channel, sha512-listed candidate is offered | older version / stable on beta build / wrong tag / missing sha512 / unparseable version | UpdateState.error code matrix; candidate undefined on reject | unit | High | PASS |
| INV-U3 | packaged feed | app-update.yml -> feed verdict | any drift (repo/owner/provider/channel/publisher) parks service at 'unsupported' | hijacked feed / wrong channel / publisher set while pin unset | verifyPackagedFeed code matrix; provider.checkCalls === 0 | unit (updateFeed.test.ts) | High | PASS |
| INV-U4 | download lifecycle | downloading -> downloaded/error/available(cancel) | interrupted download keeps candidate, no error on explicit cancel; corrupt -> CANDIDATE_CORRUPT retryable | cancel mid-flight / sha512 mismatch / transport reset / thrown rejection | phase + error.code + candidate retained; cancelCalls === 1 | unit | High | PASS |
| INV-U5 | install admission drain | prepare-install -> flush -> install-result | renderer pauses SIMULATION (not authority), drains once, replies bound; failure resumes + waits for explicit choice | flush failed / blocked / timeout / throw | pause before flush order asserted; install-failed notice; retry mints NEW requestId | unit (useUpdates.test.ts) | High | PASS |
| INV-U6 | quit/install interplay | quitAndInstall -> window close -> quitFlush interceptor | install's own quit bypasses quitFlush (its drain already succeeded); user close still drains | double-drain deadlock | installApproved WeakSet gate in main.ts | source | High | PASS (bounded — packaged proof pending) |
| INV-U7 | boot check | provider bind + did-finish-load -> check() | boot check fires exactly when renderer is live AND provider bound | listener attached inside .then (could miss did-finish-load) | Promise.all gate | source | Medium | FIXED (QA-2026-09-30-PR12-1) |
| INV-U8 | renderer surface | onUpdateState push | half-valid projections dropped whole, never rendered | missing channel / out-of-range percent / unknown error code / unknown phase | parseUpdateState returns null; UPDATE_STATE_DROPPED diagnostic | unit (UpdateState.test.ts + useUpdates.test.ts) | Medium | PASS |
| INV-U9 | singleton flush owner | bindUpdateSurface | exactly one prepare-install consumer - two owners would double-drain | second composable instance | panels consume bound handle; dispose+unbind on unmount | source + dispose test | Medium | PASS (bounded) |
| INV-U10 | update:check etc while untrusted | any renderer-frame sender | action channels reject untrusted senders | forged sender on all four channels | provider untouched; state stays idle | unit | Medium | PASS |
| INV-U11 | check/download independence | check/download failures | never touch gameplay admission (no pause, no flush, no authority call) | failure mid-run | pause/flush mocks never called | unit (useUpdates.test.ts) | High — spec requirement | PASS |
| INV-U12 | builder manifest parity | electron-builder.yml publish vs EXPECTED_UPDATE_FEED | the two declarations cannot drift | drift attack | update-feed.test.mjs asserts literals; no credential keys | release script test | Medium | PASS |
| INV-U13 | i18n | new updates.* + settings/error keys | en/vi parity | missing key | i18nKeyParity architecture test green | unit | Low | PASS |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run` on the 6 task files | 73 tests green | provider seam scripted; state machine real |
| `npx vitest run tests/architecture` | 56 files / 247 tests green | includes i18n parity |
| `node --test scripts/release/update-feed.test.mjs` | 2 tests green | builder/manifest parity |
| `npm run verify` (type-check + build + full vitest) | PASS — 834 files / 7556 tests green | full mode required (deps + build config changed) |
| `ocr delegate preview` workspace diff | 26/26 reviewable files reviewed, 0 skipped (package-lock excluded by tool) | P18 delegation pass; 1 Medium found+fixed |
| Real signed-candidate install journey | **Not verified** — needs two signed candidate builds + restricted feed | UNSEALED by plan; env-gated spec written (tests/electron/beta-update.spec.ts) |

## Findings

### QA-2026-09-30-PR12-1: boot check could miss did-finish-load before the lazy provider bound
- Severity: Medium -> resolved (fixed during gate)
- Status: Confirmed (SOURCE_PROOF — listener attach ordering provably racy)
- Invariant: INV-U7
- Preconditions: `app.isPackaged` true; electron-updater import resolves slower than the window's first load
- Reproduction: source inspection — `webContents.once('did-finish-load')` was registered inside `bindUpdateProvider().then(...)`; if the event fired first the listener registered late and never ran, silently losing the boot check
- Expected: boot check fires once per launch when both preconditions hold
- Actual: possible silent no-check on packaged builds under load ordering
- Evidence: fix in `electron/main.ts` — the `did-finish-load` promise now attaches synchronously in the same tick as `createWindow()`, and the check awaits `Promise.all([bindUpdateProvider(), didFinishLoad])`
- Test file: none (electron/main.ts has no unit harness by repo convention — the fix is a one-line ordering invariant)
- Owner subsystem: update authority (main process)
- Blast radius: packaged builds only; manual check unaffected

### QA-2026-09-30-PR12-2: recordMain TDZ crash on invalid-feed boot
- Severity: Medium -> resolved (fixed during P5 Pass 2)
- Status: Confirmed (SOURCE_PROOF - const TDZ is a guaranteed ReferenceError when the constructor records eagerly)
- Invariant: INV-U3
- Preconditions: any feed verdict != ok (unpackaged dev build, or a tampered packaged app-update.yml)
- Reproduction: UpdateService was constructed BEFORE `const recordMain` inside main(); the constructor calls `deps.record` synchronously on a rejected feed -> arrow callback reads `recordMain` inside its TDZ -> ReferenceError aborts main() - the exact failure path the feed gate exists to report crashed the whole process instead
- Expected: service parks at 'unsupported' and logs the rejection
- Actual: crash before any window
- Evidence: moved the entire update-authority block below the diagnostics section (recordMain line 107, UpdateService line 162); an ordering comment now records why
- Test file: none (electron/main.ts has no unit harness by repo convention)
- Owner subsystem: update authority (main process)

### QA-2026-09-30-PR12-3: quitAndInstall without isForceRunAfter; throw wedges 'installing'
- Severity: Medium -> resolved (fixed during P5 Pass 2)
- Status: Confirmed (SOURCE_PROOF - electron-updater's isForceRunAfter defaults false; a throwing quitAndInstall had no recovery)
- Invariant: INV-U1 / INV-U6
- Detail (a): `autoUpdater.quitAndInstall()` default runs the NSIS wizard but does not relaunch the new build - the update journey could end back at the desktop. Fixed to `quitAndInstall(false, true)` so the verified build starts.
- Detail (b): a synchronous throw from quitAndInstall (or onInstallApproved) left phase 'installing' forever with the flush already saved. Now caught: state returns to 'downloaded', an INSTALL_LAUNCH_FAILED diagnostic + install-failed notice let the user retry explicitly - the failure can never masquerade as a stuck install.

### QA-2026-09-30-PR12-4: get-state invoke lacked the sender guard
- Severity: Low -> resolved (fixed during P5 Pass 2)
- Detail: every `on` channel goes through the senderIsTrusted wrapper; the `update:get-state` invoke did not. Now returns null to an untrusted sender (parseUpdateState treats null as 'no push yet' - harmless to the honest path). Test extended to cover both branches.

### QA-2026-09-30-PR12-5 (Low, deferred): re-check while 'downloaded' discards the downloaded marker
- Severity: Low; Status: Suspected
- Detail: `check()` is allowed from 'downloaded' (a newer candidate may legitimately exist); if the same candidate returns, the user sees 'available' and re-downloads (electron-updater caches by updateInfo, so the second fetch is short). No integrity risk: install admission still requires the full verifyCandidate + sha512 path for whatever candidate is current. Deferred — a "retain downloaded when identical" optimization is complexity for a corner case.

### QA-2026-09-30-PR12-6 (Nit): `.settings-panel__update-status` has no style rule
- Renders as default body text — acceptable; a dedicated style is cosmetic.

### Rejected hypotheses (recorded per rule)
- Forged 'update:install-result' reaching install: rejected — `listen` wrapper AND `onInstallResult` both check `senderIsTrusted`; requestId/generation binding holds; a renderer-forged 'saved' shares the quitFlush trust model (the renderer owns the save write — not a new surface).
- `onUpdatePrepareInstall` non-object request: rejected — preload normalizes every payload to `{requestId: string}` ('' on malformed); the composable's `=== ''` guard suffices.
- `parseVersion('0.2.0-beta..1')` channel smuggle: rejected — empty prerelease identifier returns null -> MANIFEST_INVALID; 'betaevil' tag != 'beta'.
- getUpdateState invoke reverting a newer push: rejected — replies travel the same IPC channel in order after any queued push.

## New or Changed QA Tests

- `src/main-process/UpdateService.test.ts` — the get-state test now asserts the trusted/untrusted sender split after the Pass-2 sender-guard fix. No other new tests: all refusal/admission paths already carried deterministic tests.

## Gaps and Residual Risk

- **Signed-candidate journey UNSEALED (by plan):** real version-to-version install, installer signature verification, publisher CN pin (EXT-02 pending — `publisherName` intentionally unset), and relaunch save continuity are env-gated in `tests/electron/beta-update.spec.ts` (`TID_UPDATE_OLD_APP`/`TID_UPDATE_EXPECTED_BUILD_ID`/`TID_UPDATE_USERDATA`/`TID_UPDATE_ACCOUNT_ID`). Missing env fails loudly, never skips.
- electron-updater real-download behavior (throttle, partial writes, delta) is adapter-covered at the normalized boundary, not against a live release feed.
- `update:cancel-download` while a download is finishing races the provider's resolution — either 'available' (cancel) or 'downloaded' (bytes actually verified) is honest; both are non-error outcomes.

## Pre-existing Failures

None encountered.
