# QA Review: B7 beta feedback intake (PR13)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH GAPS (staging contract suite + migration apply blocked
  on missing credentials — see Gaps)
- Task-owned paths:
  - `game/supabase/migrations/202609300004_beta_feedback.sql` (new: table +
    guarded `submit_feedback` RPC + `feedbackLimits`/`environment` config)
  - `game/src/shared/feedback/FeedbackDraft.ts` (new: categories, limits,
    validation, wire serialization)
  - `game/src/services/feedback/{FeedbackService,SupabaseFeedbackService}.ts` (new)
  - `game/src/components/common/FeedbackDialog.vue` (new: form + opt-in
    diagnostics preview + idempotent submit + local export)
  - `game/src/components/common/ErrorScreen.vue` (feedback entry prefilled
    with the error)
  - `game/src/components/panels/SettingsPanel.vue` (feedback section entry)
  - `game/src/App.vue` (bind/unbind feedback service + context providers)
  - `game/src/services/backend/backendBundle.ts` (`feedbackService` field)
  - `game/src/locales/{en,vi}.json` (`betaFeedback.*`, `errors.app.feedback`)
  - `game/tests/integration/supabase/{fixture.ts,feedback.spec.ts}` (contract suite)
  - `game/tests/e2e/feedback-intake.spec.ts` (new: browser journey)
  - `game/src/{shared/feedback,services/feedback,components/common}/\*.test.ts` (new unit coverage)
  - `game/src/components/common/ErrorScreen.test.ts` (updated contract)

## Scope and Risk Map

changed-risk-map.mjs returned every task path under `unmappedPaths` —
manual routing:

- `supabase/migrations/202609300004_beta_feedback.sql` → save-and-cloud
  (new security-definer RPC + owner-scoped table + idempotent write).
- `tests/integration/supabase/{fixture,feedback.spec}.ts` → save-and-cloud
  (contract surface).
- `src/services/feedback/*`, `src/services/backend/backendBundle.ts`,
  `src/App.vue` → save-and-cloud (service binding/bundle composition).
- `src/shared/feedback/*` → save-and-cloud (wire contract + limits).
- `FeedbackDialog.vue`, `ErrorScreen.vue`, `SettingsPanel.vue`, locales,
  `tests/e2e/feedback-intake.spec.ts` → ui-input-lifecycle (overlay, form
  lifecycle, i18n parity).
- One-hop consumers: `SettingsPanel` (dialog host), `ErrorScreen` (dialog
  host + prefill), `DiagnosticRecorder.events` (read-only attach source),
  `account_sessions`/`characters`/`character_saves` (server-side
  attribution reads). All consume, none own feedback state.

Escalation decision (not escalated): spans two domain packs, but the only
state authority added is the server table/RPC — client state is dialog-local
(sessionStorage draft) and the diagnostic ring is consumed read-only.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-FB-1 | feedback_reports / Postgres | submit_feedback called | Owner/session/build/env attribution is server-derived; client fields cannot spoof it | Spoof (foreign session, wrong buildId, injected context) | `FEEDBACK_BUILD_MISMATCH`; stored `owner_user_id`/`build_id` from session row | Contract spec (blocked: creds) | High |
| INV-FB-2 | (owner, idempotency_key) unique | Identical retry | Dedupes to same reportId, 1 row; same key + different body rejects | Reorder/replay | `alreadyAccepted`, `FEEDBACK_IDEMPOTENCY_REUSED`, count==1 | Service test + contract spec | High — B7 acceptance |
| INV-FB-3 | Dialog draft / sessionStorage | Submit fails or dialog closes | Draft + minted key preserved; accepted report clears both | Crash/reopen | description retained, `[data-testid=feedback-status]`, restore on reopen | Dialog test + e2e | High — B7 acceptance |
| INV-FB-4 | Service result union | Any failure path | Result union, never a thrown exception, never fabricated acceptance | Throw (binding/request), revoked, 5xx, transport | mapped statuses incl. `session-revoked`, `unavailable` | Service test | High |
| INV-FB-5 | Table grants/RLS | Direct read/write as anon/authenticated | Definer-only: denied at every surface | Direct DML, REST | 401/403 REST; sqlAsUser select+insert denied | Contract spec | High |
| INV-FB-6 | Report bounds | Any field or attachment | Bounded by config: per-field chars, context scalars, diagnostics events/bytes/details, report bytes, rate windows | Overflow | `FEEDBACK_INVALID`/`FEEDBACK_TOO_LARGE`/`RATE_LIMITED` | Unit + contract spec | High |
| INV-FB-7 | Attached diagnostics | Ring exceeds caps (200 ring vs 50 cap) | Newest-fits-cap attachment; user never lands in unfixable 'invalid' | Overflow | attachEvents slice; truncated hint shown | Unit + code inspection | Medium |
| INV-FB-8 | Idempotency key ↔ content | Draft edited between attempts | Key re-mints on content change (fingerprint) — edited report never collides | Reorder | `keyFor(reportJson)` | Code inspection | Medium |
| INV-FB-9 | Layering | Dialog opened from ErrorScreen | Dialog above `OVERLAY_LAYERS.appError` | Stale z-order | `:layer` prop, appError+1 | overlayLayers test + type-check | Medium |
| INV-FB-10 | i18n parity | New `betaFeedback.*` + `errors.app.feedback` keys | Identical key trees en/vi | Drift | i18nKeyParity suite | Architecture test | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm run type-check` (vue-tsc --build) | PASS, exit 0 | Covers tests/integration via tsconfig.tests.json |
| `npx vitest run` scoped (feedback/draft/service/dialog/ErrorScreen/SettingsPanel/backend/i18nParity/overlayLayers) | PASS — 8 files / 55 tests | Includes all new unit tests |
| `npx playwright test tests/e2e/feedback-intake.spec.ts` | PASS (15.0s) | Real browser: settings entry -> dialog -> submit gated -> unavailable status -> draft preserved -> export enabled -> reopen restore |
| `ocr delegate preview+rule` (P18, delegation mode) | Clean pass, 17/17 files reviewed, 100% coverage | Second pass after findings below |
| `npm run test:supabase` | NOT RUN — credentials absent on this box | No org secrets, no `~/.secrets/supabase.env`, no `.env.supabase.contract`; requested from coordinator |

## Findings (all fixed in this change)

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| F1 | Medium | `resolveBinding()` throw escaped the result union | try/catch -> `unavailable/NETWORK_UNAVAILABLE` |
| F2 | Medium | Idempotency key reused across edited drafts -> `FEEDBACK_IDEMPOTENCY_REUSED` on legit new reports | `keyFor(reportJson)` re-mints on content change; fingerprint persisted |
| F3 | Medium | Memoized draftInput froze route/context at open | `buildDraftInput()` rebuilt per submit/export |
| F4 | Medium | Diagnostic `details` values unbounded server-side (nested-blob smuggle in approved field) | Scalar/key-charset/count bounds mirroring DIAGNOSTIC_DETAIL_KEYS |
| F5 | Medium | Day-limit `retryAfterSeconds` computed from hour window | Separate day-window oldest-timestamp computation |
| F6 | Medium | Attach-all-events made validation unfixable when ring > cap | Newest-fits-cap attachment (drop-oldest policy) |
| F7 | Medium | Accepted report's text resurfaced on reopen | `resetFields()` when no stored draft |
| F8 | Low | Error-screen feedback button hidden when no recorder/bridge | Always rendered; test updated |
| F9 | Low | Throwing context provider would kill submit/export | `safeProvide` wrapper |
| F10 | Nit | Unused `v_save` declaration | Removed |

## New or Changed QA Tests

- `FeedbackDraft.test.ts` — bounds, context/diagnostics caps, scrub,
  wire shape, measured ~11.5KB fixture vs 48KB ceiling.
- `SupabaseFeedbackService.test.ts` — contract path/args, ACCEPTED +
  idempotent retry, REJECTED/RATE_LIMITED mapping, revoked/401/outdated/
  500/transport/null-binding, invalid short-circuit.
- `FeedbackDialog.test.ts` — submit gating, consent-gated preview,
  draft preserved on failure, reportId + cleared draft on success,
  persisted restore, always-available export.
- `ErrorScreen.test.ts` — updated: feedback entry always offered.
- `tests/e2e/feedback-intake.spec.ts` — real-browser journey.
- `tests/integration/supabase/feedback.spec.ts` — accept/attribution/
  idempotency, key-reuse reject, hourly rate limit, invalid/build-
  mismatch/revoked, definer-only table (WRITTEN, awaiting creds to run).

## Gaps and Residual Risk

- **Staging contract suite UNSEALED:** `npm run test:supabase` and the
  `202609300004` apply need staging creds absent from this box; requested
  from coordinator (migration authored + reviewed, not yet applied).
- **Packaged submit/export proof UNSEALED:** env-gated per task brief;
  e2e covered the mock-backend path only.
- **EXT-06 policy unresolved:** feedback limits are interim measured
  bounds (fixture ~11.5KB << 48KB report cap), marked
  `EXT-06-interim-measured` in code/config — operator can tighten via
  `backend_config.feedbackLimits` without a new migration.
- **Suspected-low:** two dialog instances (Settings + ErrorScreen) share
  the sessionStorage draft key — a crash draft can resurface in settings;
  intentional single-draft-per-session semantics.

## Pre-existing Failures

None observed in scoped runs; full suite not required by quick scope.
