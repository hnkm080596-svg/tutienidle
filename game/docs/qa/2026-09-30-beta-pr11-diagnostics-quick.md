# QA Review: BETA-FINAL PR11 — bounded redacted diagnostics + local crash bundle

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH EVIDENCE (one Confirmed Medium found and fixed during the gate)
- Task-owned paths: `src/shared/diagnostics/DiagnosticEvent.ts`, `src/services/diagnostics/{DiagnosticRecorder,CrashReporter,recordSaveOutcome}.ts`, `src/main-process/DiagnosticBundle.ts`, `src/components/common/{ErrorBoundary,ErrorScreen}.vue`, `src/composables/{useAppLifecycle,useElectronBridge}.ts`, `src/stores/{error,saveIssue}.ts`, `src/App.vue`, `src/main.ts`, `electron/{main,preload}.ts`, `src/locales/{en,vi}.json`, plus the new `*.test.ts` files in the same scopes.

## Scope and Risk Map

Mapper output (`changed-risk-map.mjs` over the 22 task-owned paths): domains `pinia-phaser-sync`, `save-and-cloud`, `ui-input-lifecycle`; `deepAuditCandidate: true` ("critical state boundary: save-and-cloud", "cross-system change: 3 domains"); 17 `unmappedPaths` manually routed by code inspection: the whole `diagnostics/` + `main-process/DiagnosticBundle` + `shared/diagnostics` surface maps to save-and-cloud (coarse revision metadata, never save bytes) and ui-input-lifecycle (error surfaces, quit flush); `electron/{main,preload}.ts` → ui-input-lifecycle IPC boundary.

Escalation decision (required documentation for `deepAuditCandidate`): the change is **strictly observational** — every save/cloud touchpoint ADDS a field-picked `recordDiagnostic` call after the existing authority flow (`observeAuthoritySaveResult` still runs first; `recordSaveOutcome` runs after it and cannot mutate the result object, the coordinator, or the save bytes). No save-shape, revision, conflict-policy, clock, or lifecycle semantics change. The only material new risk class is "diagnostics must never crash or leak into the path it observes" — resolved conclusively at unit level (INV-B1/QA-2026-09-30-PR11-1). Residual risk that quick mode cannot oracle on this box: real Electron packaged-app IPC/disk behavior (native shell, real `userData` dir) — recorded as evidence gap, per plan the packaged-crash/export proof is the runbook's manual step.

Exclusions: none — every dirty path is task-owned.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-B1 | recorder inside save/error/session paths | record() from persistPlayer, onError, onPause/Resume/StateChange, quit flush, error store | Diagnostics never throw into the observing path (Recoverability) | degraded env | throwing routeProvider / non-numeric revisionProvider / bad-charset correlationId → event survives with context fields dropped; whole-record catch → null + invalidCount | unit (DiagnosticRecorder.test.ts new case) | High — a throw inside persistPlayer/onError corrupts the guarded flow | FIXED (QA-2026-09-30-PR11-1) |
| INV-B2 | bundle file + export bytes | planted secrets in message/details/stack | credential/payload strings never reach disk or export (Boundedness/redaction) | value mutation | planted JWT/refresh-token/password/raw-save/URL-query/path scrubbed end-to-end; whole-blob payload short-circuit | unit (DiagnosticEvent.test.ts, DiagnosticBundle.test.ts) | High | PASS |
| INV-B3 | ring + rotated files + bundle | 200+ events, oversized files, giant export | maxEntries/maxFileBytes/maxFiles/maxBundleBytes all hold | value mutation | ring drops oldest; rotation caps at maxFiles; export shrinks under maxBundleBytes | unit | High | PASS |
| INV-B4 | `diagnostic:record` IPC | freeform/forged renderer payloads | nothing unvalidated reaches disk; source forced to 'renderer' | forged input | unknown keys / wrong types / non-object / array all reject; main rewrites source | unit (bundle append) + source | High | PASS |
| INV-B5 | exactly-once persistence | error/fatal event with reporter+transport both wired to one sink | one line per event, not two | repeat | production-shaped composition test: error → 1 write, info → 1 write | unit (new) | Medium | PASS |
| INV-B6 | concurrent appends | 25 parallel append() calls | lines serialize through the queue; every line parses | concurrency | all 25 lines valid JSON | unit | Medium | PASS |
| INV-B7 | export lifecycle | export while events exist / corrupted lines in file / denied disk | export never throws; malformed lines drop; denial → 'denied' result | interruption/degraded | manifest carries buildId; tmp+rename; EACCES → denied | unit | Medium | PASS |
| INV-B8 | quit flush observation | `app:flush-result` parallel listener vs quitFlush's own | parallel listener is field-picked observe-only; quitFlush protocol untouched | reorder | quitFlush tests still green; observer picks {status,requestId,generation,revision,code} only | source + unit | Medium | PASS (bounded) |
| INV-B9 | `render-process-gone` / `uncaughtException` / `unhandledRejection` | fatal main-side events | recorded fatal, never crash the loop | degraded env | handlers record + swallow (append returns false on denial) | source | Medium | PASS (bounded — shell-level pending) |
| INV-B10 | `saveIssue.report` | `raw` unreadable save bytes | raw NEVER enters diagnostics | value mutation | only {status, foundVersion} recorded; `raw` not referenced | unit + source | High | PASS |
| INV-B11 | ErrorScreen report block | bound/unbound recorder, cancelled dialog, clipboard denial | report id correlates screenshot↔bundle; cancel is not "failed" | interruption | report-id renders when bound; block hidden without recorder/bridge; cancelled → idle; clipboard rejection caught | unit (new cases) | Medium | PASS |
| INV-B12 | `useElectronBridge` flush events | requestId as correlationId; result field-picking | forged/missing ids degrade cleanly (bad charset → event dropped, not crash) | forged input | validation rejects → null, no throw; requestId '' → undefined | source + validator tests | Low | PASS |
| INV-B13 | i18n parity | new `errors.app.*` keys | en/vi key parity holds | — | i18nKeyParity + i18n index tests green | unit | Low | PASS |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/services/diagnostics src/shared/diagnostics src/main-process src/components/common src/composables/useElectronBridge.test.ts src/composables/useAppLifecycle tests/architecture` | 83 files / 420 tests green (post-fix) | deterministic in-memory fs doubles |
| `npx vitest run src/components/common/ErrorScreen.test.ts src/services/diagnostics` | 3 files / 17 tests green | jsdom mount |
| `npm run verify` (type-check + vite build + full vitest) | PASS — 829 files / 7486 tests green, build clean | run on the state before the QA fix; scoped rerun after (below) |
| post-QA-fix `npx vitest run` scoped + `vue-tsc --build` | 420 tests + TYPECHECK-OK | QA fix re-verified |
| `npx eslint` on all changed files | 0 errors / 0 warnings | repo-wide baseline pre-existing |
| `ocr delegate preview` workspace diff | 22/22 files reviewed, 0 skipped | P18 delegation pass recorded in session notes |
| Real packaged Electron export/crash proof | **Not verified** — needs a built Electron app + real userData dir | UNSEALED; manual proof steps in the runbook |
| `npm run test:supabase` / live-staging paths | **Not verified** — no staging env on this box | unchanged from PR5 baseline |

## Findings

### QA-2026-09-30-PR11-1: a throwing context provider would propagate out of record() into the save/error path
- Severity: Medium → resolved (fixed during gate)
- Status: Confirmed (SOURCE_PROOF + failing-behavior repro test added post-fix)
- Invariant: INV-B1 — diagnostics never throw into the observing path
- Preconditions: recorder bound with routeProvider/revisionProvider/correlationId (App.vue binds all three after boot); any provider throws or returns an out-of-schema value
- Reproduction: `routeProvider: () => { throw new Error('router exploded') }` then any `recordDiagnostic` call inside `persistPlayer`/`onError` — the throw propagated out of `record()` into the caller
- Expected: a throwing/invalid provider degrades to a dropped field (or a dropped event), never a caller-facing exception
- Actual: provider call inside `record()` was unguarded; an invalid-but-returned context value produced an event that would fail main-side re-validation and silently drop
- Evidence: `DiagnosticRecorder.test.ts` "drops a throwing provider value instead of crashing the caller" — event survives with route/revision/correlationId dropped, transport still fires once; `record()` now wraps the whole body in try/catch → null + invalidCount
- Test file: `src/services/diagnostics/DiagnosticRecorder.test.ts`
- Owner subsystem: save-and-cloud (observational layer)
- Blast radius: every site that records inside a guarded flow — persistPlayer, boot onError, authority callbacks, quit flush, error store

### QA-2026-09-30-PR11-2 (Low, fixed): cancelled export dialog surfaced "Export failed"
- Severity: Low; Status: Confirmed by source inspection of the status union (`exported|denied|failed|cancelled`)
- Fix: `cancelled` keeps `exportState` idle; only denied/failed surface failure. Recording the `EXPORT_CANCELLED` event unchanged.

### QA-2026-09-30-PR11-3 (Low, fixed): seq monotonicity across pre-stamped renderer events
- Severity: Low; Status: Confirmed by source inspection
- Fix: `DiagnosticBundle.append` now does `this.seq = Math.max(this.seq, event.seq)` so a renderer-stamped seq cannot make a later main-stamped event reuse a lower seq (file order was already authoritative; this keeps the seq column monotonic for debugging).

### QA-2026-09-30-PR11-4 (Nit, fixed): clipboard write rejection was unhandled
- `navigator.clipboard.writeText(...)` rejection now caught — it would otherwise raise an `unhandledrejection` event inside the very diagnostics path being exercised.

## New or Changed QA Tests

- `src/services/diagnostics/DiagnosticRecorder.test.ts` — throwing/invalid-provider resilience + exactly-one-sink composition.
- `src/components/common/ErrorScreen.test.ts` — report-id block renders when bound, hidden when unbound.
- (Implementation-side tests already covered: payload/secret redaction end-to-end, rotation bounds, concurrent append ordering, export manifest/bounds, denial fallbacks, freeform-payload rejection.)

## Gaps and Residual Risk

- **Packaged-Electron proof UNSEALED** (by plan): real `userData` write, rotation under real fs, save-dialog export, and `render-process-gone`/`uncaughtException` markers need a built app. Manual proof steps: build (`npm run build` + electron packaging per repo release docs), launch, trigger a renderer error (or `window.electronAPI.reportDiagnosticEvent` from devtools), confirm `<userData>/diagnostics/events.ndjson` accumulates lines and `report-id` is minted; use the error screen's "Export diagnostics" button and confirm the saved JSON contains `manifest.buildId`, `summary`, bounded `events`, and no planted secrets.
- IPC rate is not artificially throttled (flood is bounded by rotation caps, not rejected); acceptable for a local beta.
- Error-boundary component tests cover the report block, not the export click-through (dialog is main-side; covered at bundle level).

## Pre-existing Failures

None encountered. Repo-wide eslint shows a large baseline (64 errors / 189 warnings) entirely outside the changed paths; the changed files lint clean.
