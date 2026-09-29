# QA Review: BETA-FINAL PR1 build identity foundation

- Date: 2026-09-29
- Mode: quick
- Verdict: PASS WITH GAPS
- Task-owned paths: game/.gitignore, game/electron/main.ts, game/package.json (+lock), game/vite.config.ts, game/scripts/release/build-identity.mjs, game/scripts/release/build-identity.test.mjs, game/src/shared/build/BuildIdentity.ts, game/src/shared/build/BuildIdentity.test.ts, game/src/components/panels/SettingsPanel.vue, game/src/components/panels/SettingsPanel.test.ts, game/src/components/common/ErrorScreen.vue, game/src/components/common/ErrorScreen.test.ts, game/src/locales/en.json, game/src/locales/vi.json

## Scope and Risk Map

Changed systems: build/release tooling (vite config, electron-builder packaging config surface, node release script), one shared contract module, two presentational surfaces (settings Build section, error-screen footer), two locale dicts. changed-risk-map routed only `ui-input-lifecycle` (deepAuditCandidate: false); the 12 unmapped paths are build tooling, electron main, shared contract, locales and tests — manually routed: build/release tooling risk is bounded by executed builds and artifact checks, locale risk by the i18n-parity guard, contract risk by direct parse tests. No save/time/economy/combat/Phaser-lifecycle transitions touched → no mandatory deep escalation. Exclusions: game/.qa-intake/* (scratch intake artifacts, deleted before commit), package-lock.json (OCR default_path exclusion).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-BI-1 | injected literal / vite define | renderer+main bundles consume | Synchronization | stale or divergent bundle | `build-identity.mjs check` flags any field mismatch | script + real dist output | High — release integrity core |
| INV-BI-2 | process.env / collectIdentityInput | arbitrary env present at build | Boundedness | planted secret in non-allowlisted keys | serialized identity lacks sentinel | unit (node:test) | High — secret-sentinel contract |
| INV-BI-3 | git metadata / collect | untagged or absent repo | Recoverability | `git describe`/`rev-parse` fails | dev identity uses 'unknown'/no releaseTag, no crash | unit (node:test) | Medium |
| INV-BI-4 | release input / createBuildIdentity | release with bad tag, dirty tree, dev backend, missing build id or sha, 0.0.0 | Recoverability | value mutation at every release precondition | BuildIdentityError before any build output | unit (node:test) | High — fail-closed contract |
| INV-BI-5 | injected blob / parseBuildIdentity | extra key or malformed field at injection boundary | Boundedness | smuggle {leaked:'…'} plus malformed field set | throws; JSON.stringify never carries extra key | unit (vitest) | High — injection boundary |
| INV-BI-6 | missing define / BUILD_IDENTITY | bundle built without the define | Recoverability | omit `__BUILD_IDENTITY__` | module throws at import (fail closed) | source proof | Medium — alternate bundlers only |
| INV-BI-7 | settings/error surfaces | render identity rows + footer | — | full 40-char sha or raw timestamp must not render | rendered text carries display forms only | component (jsdom) | Medium |
| INV-BI-8 | emitted manifest / generateBundle | web-only and electron builds | Determinism | one generator run → one identity in all artifacts | manifests in dist/ and dist-electron/ byte-identical | script check | High |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `node --test scripts/release/*.test.mjs` | 25 pass / 0 fail | generator readers, dev/release validation, secret sentinel, injected exec, checkArtifacts incl. minified-spelling bundles and missing-git fallback |
| `npx vitest run` scoped (BuildIdentity + ErrorScreen + SettingsPanel + asciiComments + i18nKeyParity) | all pass | parse/freeze/sentinel, component assertions, P15, locale parity |
| `npm run verify` (type-check + build + full vitest) | green — 7277 tests | full suite after wiring (see Gaps for post-fix re-runs) |
| `npm run build` (web) and `ELECTRON=1` build | green; emits dist/build-identity.json and dist-electron/build-identity.json | both manifests byte-identical, produced by one generator invocation |
| `node scripts/release/build-identity.mjs check` on real output | OK | proves renderer bundle, main bundle and both manifests agree on all 8 fields |
| `npx electron-builder --win --dir` | produced release/win-unpacked with app.asar containing dist/, dist-electron/, both manifests | unpacked-dir smoke only — no NSIS/installer execution on Linux host |
| `ocr delegate preview/rule` | 16 reviewable files, all reviewed (2 scratch skipped) | P18 delegation-mode pass; findings below were fixed and re-verified |

## Findings

### QA-2026-09-29-BI-1: unanchored `release` ignore hid scripts/release/
- Severity: Medium
- Status: Confirmed (resolved in-task)
- Invariant: source files required by the task must be committable
- Preconditions: `game/.gitignore` line `release`
- Reproduction: `git check-ignore game/scripts/release/build-identity.mjs` → ignored; `git status` never listed the generator
- Expected: packaging output dir ignored, generator tracked
- Actual: both ignored
- Evidence: git check-ignore output; fixed by anchoring to `/release`; verified game/release/ still ignored
- Test file: none (gitignore behavior, verified by command)
- Owner subsystem: build tooling
- Blast radius: any future file under */release/ paths; scope of this task

### QA-2026-09-29-BI-2: builtAtUtc accepted non-ISO strings
- Severity: Low
- Status: Confirmed (resolved in-task)
- Invariant: contract field format must match its declared shape
- Preconditions: Date.parse('September 29, 2026') is valid while error text claimed ISO-8601
- Reproduction: parseBuildIdentity({builtAtUtc:'September 29, 2026'}) passed
- Expected: reject non-ISO-8601-UTC
- Actual: accepted any Date.parse-tolerated string
- Evidence: ISO_UTC_RE now enforced identically in generator and TS contract
- Test file: existing malformed-field cases in both test suites still reject
- Owner subsystem: shared contract
- Blast radius: informational field only

### QA-2026-09-29-BI-3: `node --test <dir>` fails on Node 22
- Severity: Medium
- Status: Confirmed (resolved in-task)
- Invariant: committed npm script must actually run
- Preconditions: "test:release": "node --test scripts/release/"
- Reproduction: `npm run test:release` → 1 failing pseudo-test 'scripts/release'
- Expected: glob form runs the suite
- Actual: directory argument failed under Node 22
- Evidence: switched to `node --test "scripts/release/*.test.mjs"`; 25/25 pass
- Test file: n/a
- Owner subsystem: build tooling
- Blast radius: CI/dev ergonomics only

### QA-2026-09-29-BI-4: malformed dist-electron manifest crashed check
- Severity: Low
- Status: Confirmed (resolved in-task)
- Invariant: release checker reports problems, never crashes
- Reproduction: secondary manifest with invalid JSON → JSON.parse threw uncaught
- Expected: problem entry 'unreadable'
- Actual: uncaught throw
- Evidence: try/catch added; suite still 25/25
- Test file: none added (behavior verified by code path symmetry with primary manifest)
- Owner subsystem: build tooling
- Blast radius: release verification UX

## New or Changed QA Tests

- `build-identity.test.mjs` (+6 checkArtifacts tests, +1 no-repo fallback): proves manifest/bundle agreement under real minified spellings, manifest disagreement, missing manifest+bundles, web-only tolerance, git-failure fallback.
- `BuildIdentity.test.ts`: proves injected identity equals contract (saveSchemaVersion from CURRENT_SAVE_VERSION), freeze, extra-key/secret rejection, malformed-field matrix.
- `ErrorScreen.test.ts`, `SettingsPanel.test.ts` (+2 cases): proves surfaces render manifest values and never the full sha.

## Gaps and Residual Risk

- No real Windows installer smoke: `--win --dir` proves packaging+asar contents; the NSIS installer path and a signed .exe run remain unexercised on this Linux host (documented acceptance gap for PR1; CI matrix owns it).
- `check` run after a web-only build but with a stale dist-electron/ present flags a mismatch — intended (stale release state is a defect), but could surprise ad-hoc local runs; documented in code comment.
- Settings/error surfaces verified at component level (jsdom) and by bundle inspection, not by a packaged-app browser session; the rendered values are the injected literal by construction.
- Suspected (non-blocking): GIT_TAG env is trusted as the release tag source when set; a hostile/mistyped env could supply a tag string that still must equal `v${version}`, bounding the risk.

## Pre-existing Failures

None observed. The `vue/one-component-per-file` eslint warnings in touched test files predate this task (same mount-helper pattern used elsewhere).
