# M-F — Body Refinement Base-Stat Re-emit (D1)

Status: v2
Decision: D1 — Luyện Thể contributes **BASE STATS**, not percent modifiers.
Worktree: `.agent-worktrees/mf-body-base-stat` · Branch: `feat/mf-body-base-stat` · Base: `6854fe27` (post M-E)

## 1. Problem

`bodyRefinementChapter.applyModifiers` emits `StatModifier.percent` entries (`luyen-the:<tier>:<stat>`, `sourceType: 'realm'`) into `player.modifiers` — the generic percentage layer. D1 pins a different architecture: Body Refinement is a **base-stat progression** — its gains join the base before any derived stat or multiplier is computed:

```
baseStats + Body permanent gains → assembledBase → derived stats →
realm passives / equipment / technique / buffs → % layers
```

Body must not own a generic multiplier channel. The persisted `bodyProgression.body_refinement` record (completedTiers + currentTierProgress) remains the single authority — deltas are **derived**, never persisted (no save-shape change, no version bump).

## 2. Scope

IN:
- `BodyRefinementTierDefinition`: `percentAtFullTier` → `baseGains: Partial<Record<StatType, number>>` (per-stat flat at full tier — needed because Luyện Mạch targets 2 stats in different units).
- Chapter contract split: `ModifierBodyChapter` (`applyModifiers`) vs `BaseStatBodyChapter` (`collectBaseStatDeltas`). `body_refinement` becomes base-stat; `meridian` stays modifier (D1 scope is Body Refinement only — `bat-mach:*` unchanged).
- `resolvePlayerStatAssembly`: `assembledBase = baseStats + collectBodyBaseStatDeltas(player)` computed once, fed to `resolveAttributeTotals` AND `calculateStats`.
- `applyAllBodyModifiers`: modifier chapters rebuild; the base chapter **scrubs its legacy `luyen-the:*` prefix** and emits nothing (slice-rebuild invariant, not migration).
- `BodyRefinementSection.vue`: stat labels derive from `baseGains` keys (display parity — magnitude not shown today, stays hidden).
- Tests: chapter/base-delta/assembly/scrub/UI suites.

OUT: balance magnitudes finalization (dedicated phase — see §4), meridian modifier conversion (separate decision), invest/cap/realm-level rules, mortal perfection semantics, save version.

## 3. Design

### 3.1 Chapter contract

```ts
interface BodyChapterShared { id, currency, auxCurrency?, invest, progress, isComplete, validatePersistedState, integrityIssues }
interface ModifierBodyChapter extends BodyChapterShared { kind: 'modifier'; modifierPrefix: string; applyModifiers(player): void }
interface BaseStatBodyChapter extends BodyChapterShared { kind: 'baseStat'; legacyModifierPrefix: string; collectBaseStatDeltas(player): Partial<Record<StatType, number>>; scrubLegacyModifiers(player): void }
type BodyChapterDefinition = ModifierBodyChapter | BaseStatBodyChapter
```

`investBodyChapterState` post-invest: `kind==='modifier'` → `applyModifiers`; `kind==='baseStat'` → `scrubLegacyModifiers` (guarantees no stale `luyen-the:*` survives an invest). `applyAllBodyModifiers` same dispatch.

### 3.2 Delta collection

`collectBodyBaseStatDeltas(player)` (BodyProgressionSystem — the dispatch authority): iterates `BODY_CHAPTERS`, sums `collectBaseStatDeltas` per stat for `kind==='baseStat'` chapters.

Chapter rule: completed tier → full `baseGains`; active tier → `baseGains × clamp(currentTierProgress/cap, 0, 1)` per stat (linear, same curve as the old percent ratio — semantics preserved, unit changed).

### 3.3 Assembly seam

`resolvePlayerStatAssembly` is the single effective-stat entry point. The merge is **additive per key**, not a spread override — deltas add onto the base they augment:

```ts
const assembledBase = { ...player.baseStats }
for (const [stat, delta] of statDeltaEntries(collectBodyBaseStatDeltas(player))) {
  assembledBase[stat] = (assembledBase[stat] ?? 0) + delta
}
// assembledBase → asBaseStats(...) → resolveAttributeTotals + calculateStats
```

`{ ...baseStats, ...deltas }` would be a defect (delta replaces base: 100 + 40 → 40). One object, passed to both `resolveAttributeTotals` and `calculateStats`. `player.baseStats` is never mutated: restores stay exact, mortal perfection's persisted-base read (`MAIN_STAT_KEYS.every(baseStats[s] >= cap)`) is untouched, and no double-count can occur across save/load. Assembly tests must pin at least one stat whose base is non-zero so an overwrite regression cannot pass.

Strict-layering fallout (real, intended): body attribute gains (vitality) raise the resolved attribute totals → `deriveAttributeModifiers` + way facets emit larger attribute-reactive deltas. Under percent-emission the same channels saw the boost; the unit changes, the topology does not. Tests must pin this, not assume it.

### 3.4 Placeholder magnitudes (balance-pending)

`baseGains` values ship as **explicit placeholders** marked `// P7-M-F PLACEHOLDER — pending dedicated balance phase` because the balance phase owns the real numbers. Proposal: modest flat values on the mortal scale so the loop stays playable — e.g. `defense +4`, `might +5`, `maxHp +40`, `hpRegenPerTurn +1.5`, `vitality +2`, `maxHp +60 / hpRegenPerTurn +2` for the six tiers respectively. Tests assert the **mechanism** (derivation, ratio scaling, assembly ordering, scrub), never specific magnitudes.

### 3.5 Display

`BodyRefinementSection` stat labels derive from the typed keys of `baseGains` — `Object.keys` returns `string[]`, which is not `keyof Stats`; pin a typed seam (`baseGainKeys(tier.baseGains): StatType[]` helper, or a `as StatType[]` narrow at the data boundary) rather than ad-hoc casts in the template. Same labels as today, no magnitude shown (parity).

## 4. Invariants

1. `player.baseStats` never mutated by body progression.
2. `luyen-the:*` modifiers are never emitted again; existing slices are scrubbed at invest/restore.
3. `bat-mach:*` (meridian) untouched.
4. `assembledBase` recomputed at every stat resolution — no cached/stale body gains.
5. Mortal perfection reads persisted `baseStats` — body gains never count.
6. Attribute-reactive channels (deriveAttributeModifiers, way facets) see body-boosted totals — pinned by test.

## 5. Risks / watch

- **Double-count on restore:** deltas derived from `bodyProgression` state + base persisted — never write them into `baseStats`.
- **`investBodyChapterState` rebuild call:** base chapter has no modifiers to rebuild — dispatch must not assume `applyModifiers` exists on every chapter.
- **Dependency direction:** `Player.ts` importing `BodyProgressionSystem` — verify no runtime import cycle (all body→player imports are `import type`).
- **Caller sweep for `percentAtFullTier`/`luyen-the:`:** tests, save fixtures, live comments. Current-architecture docs that describe the old percent model must be updated (e.g. `docs/superpowers/plans/2026-09-21-canonical-build-composition.md`). Historical mission artifacts (M5 spec/plan) are intentionally **not** rewritten — they document the architecture as it was decided then; add a supersession note only where a reader could mistake them for current truth.
