# QA Review: vue-i18n v9.14 → v11 migration (Task 9, roadmap 2.1)

- Date: 2026-09-03
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/package.json`, `game/package-lock.json`

## Scope and Risk Map

Change is a dependency version bump only: `vue-i18n ^9.14.5 → ^11.4.10` (installed 11.4.10; `@intlify/core-base`, `@intlify/shared`, `@intlify/message-compiler`, `@intlify/devtools-types` moved 9.14.5 → 11.4.10 with it). Lockfile diff contains no other package changes. Zero production source files required modification.

The risk mapper (`changed-risk-map.mjs`) returned `unmappedPaths` for both dependency files (mapper has no dependency domain). Manual routing:

- **Domain packs:** `ui-input-lifecycle` (i18n is a cross-cutting UI rendering concern; no `.vue` file changed, but all ~43 i18n-consuming components are one-hop consumers).
- **One-hop consumers:** `src/i18n/index.ts` (sole `createI18n` site), ~43 `.vue` components using `useI18n()`/`useI18n({ useScope: 'local' })`, 11 test files using `i18n.global.t` / `locale.value`, `vite.config.ts:54` vendor chunk regex, all locale-asserting tests (333 files).
- **Escalation decision:** no save/cloud, time/offline, economy/progression, or Vue/Pinia/Phaser ownership change — i18n affects text rendering only, and the full verify matrix directly resolves the high-risk hypotheses. No deep escalation.
- **Exclusions:** none (no unrelated dirty files; worktree was clean at start).

v10/v11 breaking-change audit (official migration docs, fetched 2026-09-03) vs. actual usage:

| v10/v11 breaking change | Used here? | Evidence |
| --- | --- | --- |
| Drop `tc`/`$tc` (v11) | No | grep `tc(`/`$tc`: 0 usages |
| Deprecate Legacy API mode (v11) | No | `legacy: false` at `i18n/index.ts:8`; no `legacy` i18n option elsewhere |
| Deprecate `v-t` directive (v11) | No | grep `v-t=` in `*.vue`: 0 usages |
| v10 `$t(key, locale, ...)` signature removal | No | all calls are `t(key)` / `t(key, named)` |
| v10 drop `%` modulo syntax | No | node scan of both JSONs: every `%` is literal text (never `%{`); `{percent}` is named interpolation |
| Special chars `@ \| $` in messages (compiler errors since v9) | No | node scan: 0 `@`, 0 `\|`, 0 `$` in vi.json/en.json values — no new v11 escaping rules |
| `createI18n<[Schema], Locale>` typed-schema generic | Unchanged in v11 | `type-check` passes with zero edits to `i18n/index.ts` |
| `useI18n({ useScope: 'local' })` | Unchanged in v11 | all 30 local-scope components type-check and pass component tests |
| `i18n.global` Composer on non-legacy mode | Unchanged in v11 | 11 test files pass unchanged |

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-I18N-1 | vue-i18n instance (`src/i18n/index.ts`) | Boot with typed schema `createI18n<[typeof vi], 'vi' \| 'en'>`, `legacy: false`, under v11 | Synchronization — instance initializes and app boots under v11 without runtime/type error | Dependency swap v9→v11 | type-check clean; e2e `boot-fresh` passes; 333 test files import the instance | Unit + browser | High (boot failure = total) |
| INV-I18N-2 | Locale messages (vi.json/en.json) | Message compilation under the v11 compiler | Determinism — every leaf value compiles; no new special-char/escaping rule breaks a value | Static scan for `@ \| $ %` special-char classes | Scan: 0 `@`/`\|`/`$`; `%` literal-only; `{named}` params intact; full suite (2162) asserts rendered strings in both locales | Static scan + unit | High |
| INV-I18N-3 | ~43 components using `useI18n()` / `useI18n({ useScope: 'local' })` | Render + locale switch vi↔en | Synchronization — composition API + local-scope resolution unchanged in v11 | API audit; `locale.value` mutation in tests | RefineTab/ActionFeedbackLog tests assert rendered output in BOTH locales after switching; full suite green | Unit | High |
| INV-I18N-4 | `i18n.global.t` / `locale.value` in tests (non-legacy global Composer) | Global-scope translation + locale switching | Synchronization — `i18n.global` remains the Composer under `legacy: false` in v11 | API audit | `src/i18n/index.test.ts` switches locale en↔vi and reads `locale.value`; 11 files resolve keys via `i18n.global.t`; all pass | Unit | Medium |
| INV-I18N-5 | Vendor chunking (`vite.config.ts:54`) | Production build under v11 | Lifecycle — vendor chunk regex still matches `vue-i18n`/`@intlify` (package names unchanged in v11) | Build after swap | Build succeeds; `vendor-*.js` emitted (186.70 kB) | Build | Low |
| INV-I18N-6 | Named interpolation `t(key, { time })` (SettingsPanel and others) | Runtime translation with params | Determinism — `{param}` interpolation output unchanged v9→v11 | Param rendering at runtime | SettingsPanel tests + e2e flows render params; suite green | Unit + browser | Medium |
| INV-I18N-7 | Vue peer (`vue 3.6.0-rc.3` via overrides) | Install / peer resolution under v11 | Recoverability — v11 peer range `^3.0.0` accepts the pinned Vue rc | `npm ls` peer inspection | `vue-i18n@11.4.10` resolves against `vue@3.6.0-rc.3`, deduped, no peer warnings; engines `>= 22` satisfied | Tooling | Medium |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` (vue-tsc --build) | Pass, no errors | Typed-schema generic unchanged in v11; `i18n/index.ts` needed 0 edits |
| `npm.cmd run test` (full Vitest) | 333 files, 2162/2162 passed, 0 failures | Both-locale assertions (RefineTab, ActionFeedbackLog, HomeResourceStrip, etc.) green |
| `npm.cmd run build` (type-check + vite build) | Pass in 6.84s | Pre-existing chunk-size warning on `index` chunk (unrelated, present before) |
| `npm.cmd run test:e2e` (Playwright) | 9/9 passed incl. boot-fresh, save-reload, create-to-combat, overlay layout ×3, ink-wash ×3 | Real-browser boot + flows on v11 |
| Static char scan of vi.json/en.json | 0 `@`, 0 `\|`, 0 `$`; `%` literal-only | Via node walk of both trees |
| grep audit of v9-only/deprecated APIs | 0 `useScope` outside documented local-scope option, 0 `tc`, 0 `v-t`, 0 Composer internals | Listed in scope table above |
| `npm.cmd ls vue-i18n @intlify/core-base vue` | v11.4.10 tree, vue 3.6.0-rc.3 deduped, no peer errors | peer `^3.0.0` satisfied |
| Lockfile diff scope | Only vue-i18n + @intlify packages changed 9.14.5 → 11.4.10 | No collateral dependency drift |

## Findings

None — no Confirmed, Suspected, or material Coverage-gap findings against this task.

## New or Changed QA Tests

None. The existing suite already provides the decisive oracles: `src/i18n/index.test.ts` (locale switching, fallback, key parity between vi/en), both-locale rendered-string component tests, and 9 e2e browser flows. The change is a version bump with no behavioral surface to add a new test for.

## Gaps and Residual Risk

- No dedicated test enumerates and compiles every locale-JSON leaf through the v11 message compiler (parity test checks key structure, rendered-string tests sample usage). Non-material: static scan shows no compiler-special characters, and 2162 unit assertions + e2e exercise rendered strings in both locales.
- v11 deprecation warnings (Legacy API mode, `v-t`) target v12 removal. App uses neither; zero remediation needed now. Future risk only.

## Pre-existing Failures

None observed — full matrix was green on this worktree before the bump was attempted? Not directly re-baselined on v9 in this session; however, the worktree was clean at `d384e1d` (pre-bump mainline state) and the post-bump matrix is fully green, so no failure can be attributed to either baseline.
