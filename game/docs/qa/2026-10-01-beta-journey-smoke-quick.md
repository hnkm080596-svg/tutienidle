# QA quick review — beta journey smoke (scope-leak gate)

- Date: 2026-10-01
- Scope: `game/tests/architecture/betaJourney.test.ts`,
  `game/tests/architecture/betaScopeRenderedTokens.test.ts`,
  `game/tests/e2e/beta-journey.spec.ts` (task-owned; new files only — zero
  production diff)
- Mode: quick. Mapper: `changed-risk-map.mjs` returned `unmappedPaths` for
  all three (test files unrouted); `deepAuditCandidate: false`. Manual
  routing: economy-and-progression (journey steps), ui-input-lifecycle
  (DOM surfaces), save-and-cloud (save-cleanliness assert). No production
  transition changed; no deep-escalation trigger applies.

## Invariant ledger (attacked)

1. Journey spec must drive the authored sequence, not a shortcut
   (initiation requires linh_bao cast Lv3 + level 12 + element commit;
   realm gates = authored requirements; Act floors = real runStage calls).
2. Scope sanity must hold at EVERY journey point, not just the end —
   `assertScopeSanity` runs inside steps 2/4/5/7/8/10/11/12/13.
3. Corpus guard must fail on an unaccounted token and on stale registry
   entries (ratchet both directions).
4. E2E leak assertions must be hard gates (not test.fail), each failure
   line naming the forbidden-surface class.
5. No test may unlock beta ways/features — locks are applied via
   `lockBetaWaysForTests()` / `lockBetaFeaturesForTests()` inside the
   suite modules only (module scope; vitest file isolation prevents
   cross-file bleed — verified by the green full-suite run).

## Evidence

- `npx vitest run tests/architecture/betaJourney.test.ts` — 13/13 pass
  (~44s). Mortal grind: 401 dong_1 runs in 27s, 6412 casts logged before
  the cap was raised to 900; linh_bao clears dong_1 (~16 casts/run,
  defeat still accrues casts). Full journey to `betaComplete` observed.
- `npx vitest run tests/architecture/betaScopeRenderedTokens.test.ts` —
  passes; probe file with an unaccounted `daily_quest` token fails as
  intended (guard verified to fire).
- `npx playwright test tests/e2e/beta-journey.spec.ts` — 7 pass, 3 fail:
  the three failures are the three confirmed production leaks (below),
  each with DOM evidence.
- `npm run verify` — full suite green except `asciiComments` on first
  pass (non-ASCII comments in the new spec — fixed; comments now ASCII,
  Vietnamese only inside string literals which are data, not comments).

## Confirmed production defects found BY the gate (reported, not fixed —
task scope is the gate itself)

| # | Defect | Evidence kind | Where |
|---|--------|---------------|-------|
| L1 | Ultimate slot renders disabled ("Tuyet Ky" button) in every beta battle | EXECUTED_DOM (playwright count 2 buttons) + SOURCE_PROOF (ROLE_ORDER `[basic, special, ultimate]`; `visibleSlots` never consults `betaCombatRolesFor`) | `src/components/game/combat/hud/TurnCombatSkillBar.vue` |
| L2 | Ultimate role card renders inside SkillPathPanel ("Tuyet Ky" + empty marker) | EXECUTED_DOM (`.skill-role__label` count 1) + SOURCE_PROOF (`ROLE_KEYS` all three via `getResolvedSkillRoles`) | `src/components/panels/skill-path/SkillRoleStrip.vue` |
| L3 | Five element branch tabs render after a single-element commit (4 scope-hidden branches shown locked/browseable) | EXECUTED_DOM (`.skill-path-panel__element-tab` count 5, labels `Moc/Hoa/Tho/Kim/Thuy` after fire commit) | `src/components/panels/SkillPathPanel.vue` |

L1/L2 violate contract sec.C/D ("the ultimate role is absent, never
rendered locked"). L3 is recorded as a candidate: the design comment on
the tab loop says "others render locked" while spec sec.9 forbids
scope-hidden placeholders for non-committed branches — contract-ambiguous
wording, so severity is flagged for coordinator adjudication rather than
asserted.

## Suspected / coverage gaps

- `stripComments` treats `//` inside template text as a comment — a token
  split by a literal `//` would be missed. Edge case; corpus guard is a
  tripwire, not a prover. Low.
- Phaser canvas text is not DOM-assertable; scene-source token scan
  showed zero rendered hits (all comments/types). Coverage gap for
  future canvas labels — noted.
- "Daily quests" token coverage is label-level only; cadence is covered
  by the headless `betaQuestSurfaceFor` assert (`cadence === 'once'`)
  inside `assertScopeSanity`. Low.

## Verdict

PASS WITH EVIDENCE — the three suites are executable gates with honest
fail-on-leak semantics; the only reds in the corpus are the three
documented production leaks. Pre-existing environment note:
`electron-updater` was declared in package-lock but absent from the
shared node_modules (stale install) — refreshed via `npm install` in the
main checkout; type-check is clean on the tip with it installed.
