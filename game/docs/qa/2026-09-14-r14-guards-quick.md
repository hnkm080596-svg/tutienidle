# Adversarial QA — R14 remaining guards (quick)

**Scope:** `tests/architecture/{assetContainment,catalogPreloadParity,ackTokenContract}.test.ts` (new) + `scripts/route-assets.mjs` containment fix. No runtime/gameplay code touched; guards are test-time static scans, route-assets is a dev tool (`npm run assets:route`).

**Mode rationale:** quick. Surface is asset pipeline + ack contract guards — no save/economy/lifecycle/combat-tick mutation. Mapper domains (asset infra, combat-contract) bounded by inspection.

## Hypotheses checked

| # | Hypothesis | Verdict | Evidence |
|---|-----------|---------|----------|
| H1 | `route-assets.mjs` traversal still escapes after fix | Rejected | Runtime probe: `..__..__probe_escape.png` dropped in `asset-drop/` → skipped with warn, nothing written outside `public/assets` (would have landed at `game/probe_escape.png` pre-fix) |
| H2 | Fix breaks legitimate routing | Rejected | Runtime probe: `__r14probe__subdir__ok.png` → routed to `public/assets/r14probe/subdir/ok.png`, verified on disk, cleaned up |
| H3 | Absolute-path filename segment bypasses `startsWith` prefix check | Rejected | `resolve(DEST_ROOT, 'C:\\evil')` resets to the absolute path → fails `startsWith(resolve(DEST_ROOT)+sep)` → skipped. Trailing `sep` prevents `assets-evil/` sibling-prefix bypass |
| H4 | `join` vs `resolve` divergence between checked path and moved path | Rejected | `destPath` (join) and `resolvedDest` (resolve) normalize identically for relative segments; absolute/`..` segments are rejected before `existsSync`/`mkdirSync`/`renameSync` run |
| H5 | Literal-load scan misses multi-line/nested-paren calls | Accepted limitation | `[^)]*` arg capture is heuristic; the canonical-feeder allowlist test catches dynamic call sites, and probes confirmed both literal tests fire on planted violations. Residual: a literal URL hidden behind an early `)` inside args could evade — mitigated by catalog-parity + descriptor tests |
| H6 | ACK guard anchors doc comments instead of signatures | Rejected | `methodBody()` anchors on `name(token?:` — definition-only shape; comments/call sites lack `token?:`. Probe history: first iteration matched comment text, regex fixed and re-verified |
| H7 | Script write-root guard false-positives on `path.resolve(import.meta.dirname, '..')` anchors | Rejected | `projectRoot`/`ROOT`/`SCRIPT_DIR`/`GAME_ROOT` are BASE_CONSTANTS — skipped at const-name level. `new URL('../public/assets/...')` roots are not collected by the `resolve|join|dirname` pattern. Tightened: quoted `'..'` segment can no longer ground via a base constant |
| H8 | `queueCombatAssets`↔catalog parity guard vacuous | Rejected | Both directions asserted against live runtime enumeration (`queuedCombatKeys()` drives the real function with a probe scene; `getCombatDescriptors()` from the catalog module) |
| H9 | Permanent buffs / `duration: Infinity` affected | N/A | No gameplay/presentation runtime code changed in this task |

## Probe evidence (falsifiability)

- Planted `src/__guard_probe__.ts` with `load.image('probe', '../outside-assets.png')` + `load.image('probe2', 'assets/not-in-catalog/probe.png')` → **both** containment and parity guards failed with targeted messages; file removed after run.
- route-assets: traversal rejection + normal routing both demonstrated at runtime (H1/H2).

## Residual risks

- Static scans are heuristic (H5); a sufficiently obfuscated load call could evade literal extraction — accepted, since the feeder allowlist still constrains dynamic sites.
- Script write-root guard checks *root constant provenance*, not every write arg — functions taking destination params remain caller-trusted (documented in test header).

## Verdict

**PASS WITH EVIDENCE** — traversal defect fixed and runtime-proven; all three guards probe-verified to fire on planted violations; full suite 521 files / 3480 tests green.
