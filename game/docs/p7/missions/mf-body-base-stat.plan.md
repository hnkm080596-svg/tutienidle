# M-F — Body Refinement Base-Stat Re-emit (D1) — Plan

Spec: `mf-body-base-stat.spec.md` (v2 after spec-review resolutions).
Base: `6854fe27` (post M-E).

## Steps

1. **Data** (`data/realm/BodyRefinement.ts`)
   - `BodyRefinementTierDefinition`: drop `stats` + `percentAtFullTier`; add `baseGains: Partial<Record<StatType, number>>` (drop `stats` — it duplicates `Object.keys(baseGains)` and creates a sync hazard).
   - Fill placeholder `baseGains` per spec §3.4 with `// P7-M-F PLACEHOLDER` comment: `luyen_bi {defense:4}`, `luyen_nhuc {might:5}`, `luyen_cot {maxHp:40}`, `luyen_huyet {hpRegenPerTurn:1.5}`, `luyen_tang {vitality:2}`, `luyen_mach {maxHp:60, hpRegenPerTurn:2}`.
   - Export `baseGainKeys(gains): StatType[]` — the typed-key seam (single narrow, no `as` in consumers).

2. **Chapter contract** (`core/realm/body/BodyChapter.ts`)
   - Split `BodyChapterDefinition` into `ModifierBodyChapter` (`kind:'modifier'`, `modifierPrefix`, `applyModifiers`) | `BaseStatBodyChapter` (`kind:'baseStat'`, `legacyModifierPrefix`, `collectBaseStatDeltas`, `scrubLegacyModifiers`).
   - Shared fields: id/currency/auxCurrency/invest/progress/isComplete/validatePersistedState/integrityIssues.

3. **BodyRefinementChapter.ts**
   - `kind:'baseStat'`, `legacyModifierPrefix:'luyen-the:'`.
   - `collectBaseStatDeltas`: completed tier → full `baseGains`; active tier → `baseGains[stat] × clamp(progress/cap,0,1)`; sum across tiers.
   - `scrubLegacyModifiers`: strip `luyen-the:*`, emit nothing. Delete `buildTierModifiers`/`applyTierModifiers`/`modifierId`.

4. **MeridianChapter.ts** — `kind:'modifier'`, keep `modifierPrefix`/`applyModifiers` verbatim.

5. **Dispatch** (`BodyProgressionSystem.ts`)
   - `investBodyChapterState`: consumed>0 → modifier chapter `applyModifiers`; base chapter `scrubLegacyModifiers`.
   - `applyAllBodyModifiers`: same per-kind dispatch.
   - New `collectBodyBaseStatDeltas(player): Partial<Record<StatType,number>>` — sums `collectBaseStatDeltas` over base chapters.

6. **Assembly seam** (`core/player/Player.ts`)
   - `resolvePlayerStatAssembly`: `assembledBase = asBaseStats({...baseStats} + deltas additively per key)` → feed `resolveAttributeTotals(assembledBase,…)` AND `calculateStats(assembledBase,…)`. Import `collectBodyBaseStatDeltas` (runtime dep Player→body — verified no cycle, all back-imports are `import type`).

7. **UI** (`BodyRefinementSection.vue`) — `tier.stats` → `baseGainKeys(tier.baseGains)` for statLabels.

8. **Comment/doc sync** — `GameManagerSaveRestore.ts:560` comment (`luyen-the:` → base-stat re-emit), `BodyRefinementChapter.ts` header, `BodyChapter.ts` header (chapter owns delta emission OR modifier emission per kind), `docs/superpowers/plans/2026-09-21-canonical-build-composition.md` (current-arch doc). M5 historical docs untouched.

9. **Tests** (TDD — write first):
   - `BodyRefinementChapter.test.ts`: rewrite modifier tests → `collectBaseStatDeltas` (completed full / active linear / zero state), `scrubLegacyModifiers` strips `luyen-the:*`, `kind==='baseStat'`, `legacyModifierPrefix`.
   - `BodyProgressionSystem.test.ts`: `collectBodyBaseStatDeltas` aggregation; invest → scrub (no `luyen-the:*` emitted); `applyAllBodyModifiers` still rebuilds `bat-mach:*` + scrubs `luyen-the:*`.
   - `GameManagerSaveRestore.boundary.test.ts`: stale `luyen-the:*` fixture → scrubbed after restore (assert absence, not rebuild).
   - Assembly test (Player stat assembly suite or new): body deltas join base additively on a NON-ZERO base stat; modifier ordering preserved (flat delta multiplied by percent equipment); vitality delta flows through `deriveAttributeModifiers`.
   - `BodyChapter.test.ts`: union shape assertions.
   - `BodyRefinementSection` test (`RealmBodySections.test.ts`): stat labels render from `baseGains` keys.

## Risks
- Double-count if any path persists deltas into `baseStats` — none exists; verify by test (baseStats unchanged after invest).
- `resolvePlayerStatAssembly` callers all get the new base automatically — no per-caller change.
