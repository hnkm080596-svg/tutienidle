# QA Quick — 9.5 #12 appliesBuff/appliesAilments registry guard (2026-09-14)

Verdict: **PASS WITH EVIDENCE**

## Scope

`TurnBattleSystem` called `TurnBuffRegistry.get()` unguarded at two
content-derived-id sites: `action.skill.appliesBuff.definitionId` (the
Reaction Path ultimate path, live via `reaction_path_unlock_*` keystones)
and `appliesAilments[].buffDefinitionId`. `MapTurnBuffRegistry.get`
throws on unknown ids → a renamed/drifted buff id crashed every
fixed-step tick with no isolation upstream. Same defect class as the
Phase A2 bossTrigger gap, which already carries the established
try/catch skip pattern.

## Fix

Both lookups wrapped in the same try/catch pattern as the bossTrigger
block: `definition` resolves to `undefined` on failure; the apply block
runs only when a definition was found. Registry throwing behavior is
unchanged; no substitute buff is invented.

## Invariants checked

- **No crash**: `resolveNextStep` does not throw for an unknown
  `appliesBuff.definitionId` or `appliesAilments[].buffDefinitionId`
  (new QA test, was RED before fix — throw propagated).
- **No partial mutation**: failed `appliesBuff` lookup leaves
  `pendingGaugeDeltaTargets`/`pendingGaugeDeltaDefinition` untouched;
  those fields are only assigned inside `if (definition)` and are reset
  immediately after consume (lines ~1165-1166), so no stale value can
  leak into a later action's gauge delta.
- **No phantom application**: `TurnBuffSystem.apply` is not invoked for
  unresolvable ids; target `buffs` stays empty.
- **Reaction gating preserved**: `reactionManager.checkAndTrigger` runs
  only when the ailment definition resolved — a buff that was never
  applied cannot feed reaction checks.
- **Valid path unchanged**: a known id still applies the buff
  (positive-control test in the same file); existing
  `reactionPathE2E` tests confirm `reaction_empowerment` applies with
  `reactionEffectPercent: 0.25` and feeds `TurnReactionManager`.
- **RNG semantics preserved**: the `Math.random() < ailment.chance`
  roll still happens before lookup, same order as before — an unknown
  id consumes its roll exactly like a known one.

## Falsifiability

- Before fix: both unknown-id tests failed with
  `Error: TurnBuffRegistry: unknown buff id "buff_id_not_in_registry"`
  (throw propagated through `resolveNextStep`).
- After fix: all 3 tests pass; valid-id control proves the guard does
  not blanket-swallow.

## Verification

- `npm run type-check` — clean.
- `npm run build` — clean (pre-existing chunk-size warning only).
- `npx vitest run` — 522 files / 3486 tests, all pass.

## Notes / follow-ups

- Other `registry.get` call sites were reviewed; the remaining ones
  either already sit behind the bossTrigger try/catch or read
  engine-internal ids. No further guards added in scope.
- `catch {}` swallows any registry throw, not just unknown-id — matches
  the established bossTrigger contract (registry only throws for
  unknown ids today).
