# Quick QA — large-file split (feat/large-file-split) — 2026-09-13

## Scope

Task-owned paths: `GameManager.ts` + 11 new `GameManager*Ops.ts`,
`GameManagerTurnBattleOps.ts` + 3 sub-ops, `CombatScene.ts` + 4 new
`combat-*` modules, data barrels (Skills/Enemies/PhapTuNodes/buffs +
per-domain files), `EquipmentSystem` + `EquipmentRefine`/`EquipmentRolling`,
`ProductionSystem` + `ProductionOffline`/`ProductionCycles`,
`SaveSystem` + `saveTypes`, `GameRoot.vue` lazy panels, call-site
migrations across panels/tests.

## Risk map

`changed-risk-map.mjs` → `deepAuditCandidate: true` (save-and-cloud,
time-and-offline, 7 domains; 5 unmapped new Ops paths). **Bounded, not
escalated**, for the following reasons, each verified against current code:

- The change is a mechanical extraction refactor: moved method/data bodies
  are verbatim; no rule, formula, timing, or persistence semantic was
  rewritten. Every moved body is covered by the pre-existing suite —
  3678/3679 tests green in full mode (1 environmental flake,
  `perfectClear.feasibility`, green in isolation 8/8).
- Save: only save-shape *interfaces* moved to `saveTypes.ts`
  (type-only); `SaveSystem` re-exports them — zero runtime change.
  Save round-trip/migration/boot-restore suites green (527 tests incl.
  production+equipment scope).
- Time/offline: `update()`/`updateBattleFixedStep`/offline settle moved
  verbatim into `GameManagerTickOps`/`ProductionOffline` — still called
  from the same GameManager seams; offline/auto-farm adversarial suites
  green.
- The only non-verbatim behavioral changes were reviewed individually:
  1. `GameRoot` lazy-once mount — panel chunks load on first open via
     `defineAsyncComponent` + `v-if` on a reactive once-set; component
     then stays mounted so `OverlayPanel` close transition + internal
     state behave identically to static imports. Router has no routes
     (hash history, empty) — no route-split surface exists.
  2. `BreakthroughOutcomeService` narrowed to a context interface —
     type-level only, runtime calls unchanged.
  3. Dead `spawnEnemy` facade removed (zero callers, verified by grep).
  4. `vitalsWriteAuthority` allowlist path updated to the write's new
     owner file — the guard itself still passes and still scans.
- Architecture guards green: vitals-write allowlist, ack-token contract,
  bundle-split AST guard, combat-helpers encapsulation, art-extent.

## Evidence

- `npm run type-check` — clean.
- `npm run build` — green; panels emit as separate lazy chunks
  (SkillPathPanel 22.6KB, CompanionPanel 10.3KB, ...).
- `npm run check:bundle-split` — OK: entry 587KB (<900), phaser 1343KB
  separate, 20 chunks.
- `npx vitest run` (full) — 535/536 files, 3678/3679 tests; sole failure
  environmental flake (green isolated).
- Per-slice focused suites were run at each wave boundary (all green).

## Coverage gaps / limitations

- P14 live-browser check deferred per the isolated-worktree exception —
  must be exercised at branch finishing from an authorized checkout:
  open each standalone panel once (lazy chunk load), verify close
  transition and reopen.
- `defineAsyncComponent` caches a failed chunk load — a failed first open
  leaves the panel absent for the session (accepted: local file:// build
  makes chunk-load failure effectively impossible; documented for
  completeness).
- `CombatScene.ts` (2154) and `TurnBattleSystem.ts` (1319) remain large
  by design — verified composition-root / interleaved state graph, not
  line-count candidates.

## Verdict

PASS WITH GAPS — gaps limited to the deferred P14 live-browser check.
