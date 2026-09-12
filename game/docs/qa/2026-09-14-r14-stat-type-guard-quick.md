# QA Quick — R14 leftover: type-level stat guard (2026-09-14)

Verdict: **PASS WITH EVIDENCE**

## Scope

Roadmap R14.3a shipped the writer-side half (zero production
`.baseStats =` sites). The remaining half — "raw stat input cannot
accept resolved-stat type" — needed a nominal type refactor, now
shipped here.

Contract introduced:

- `BaseStats = Stats & { [baseStatsBrand]: 'base' }` — phantom brand,
  zero runtime cost (`src/core/stats/StatBlock.ts`).
- `createBaseStats(overrides?: Partial<Stats>): BaseStats` — the
  canonical raw producer; overrides folded at construction so fixtures
  build `createBaseStats({ attack: 100 })` instead of spreading.
- `asBaseStats(stats: Stats): BaseStats` — the single named boundary
  cast for values KNOWN to be raw that arrive via a plain `Stats`
  channel (save payloads, authored data). Exactly one call site
  (`__fixtures__/startAStage.ts`).
- `calculateStats(baseStats: BaseStats, ...)` — the attribute-
  derivation pipeline now rejects resolved `Stats` at compile time.
- `PlayerData.baseStats: BaseStats` — the canonical store-side raw
  source carries the brand.
- `CombatEntity.baseStats` intentionally stays `Stats`: per the R2
  contract it holds the RESOLVED at-entry snapshot, not authored raw
  input. Branding it was evaluated and reverted as semantically wrong.

## Files reviewed

- `src/core/stats/StatBlock.ts`, `StatCalculator.ts` — brand +
  signature change; `runPipeline` internals untouched.
- `src/core/player/Player.ts` — `PlayerData.baseStats` brand;
  `playerToCombatEntity` still assigns resolved `Stats` to
  `CombatEntity.baseStats` (correct).
- `src/stores/player.ts` — `calculateStats(state.baseStats, ...)`
  compiles because the Pinia state field is `BaseStats`; save-restore
  (`Object.assign` / direct field writes) is type-level only, runtime
  unchanged.
- `src/core/companion/CompanionCombat.ts`, `__fixtures__/
  startAStage.ts` — codemod rewrites verified merge-order identical.
- ~66 test files — mechanical `{ ...createBaseStats(), X }` →
  `createBaseStats({ X })` rewrite; four stale fixture keys
  (`fireDamage` ×3, `hpRegenPerSecond` ×1) that the old spread
  silently carried were dropped — dead keys nothing read.

## Hypotheses tested

- **H1 — codemod semantics.** `createBaseStats({...})` evaluates
  `{...defaults, ...overrides}` — identical to the old
  `{...createBaseStats(), ...}` merge order. Verified by diff
  inspection + full suite green.
- **H2 — resolved-into-raw rejection.** Scratch probe
  `calculateStats(resolved: Stats, [])` →
  `error TS2345: Argument of type 'Stats' is not assignable to
  parameter of type 'BaseStats'`. Probe deleted after. The double-
  derivation regression class (raw 10 → resolved 70 → re-derived 130)
  no longer compiles.
- **H3 — escape hatch misuse.** `asBaseStats` can launder resolved
  stats into `calculateStats` — accepted residual: it is a named,
  greppable seam pinned by R14.3c; deliberate boundary casts cannot be
  type-prevented.
- **H4 — save/restore.** Brand is phantom — JSON deserialize yields
  plain objects assigned through `PlayerData`-typed fields; no runtime
  change, no migration needed.
- **H5 — `Partial<Stats>` overrides.** Explicit `undefined` overrides
  would produce `undefined` values — same exposure as the old spread;
  not a new risk.

## Falsifiability

- Compile-level: H2 probe (TS2345) proves the brand is enforced.
- Static pin: `tests/architecture/statProvenanceAndQueryPurity.test.ts`
  gained R14.3c — anchors `baseStatsBrand: unique symbol`, the
  `BaseStats` shape, `createBaseStats`/`asBaseStats` signatures,
  `calculateStats(baseStats: BaseStats` and `PlayerData.baseStats:
  BaseStats`. Reverting the signature or unbranding the type trips it.

## Verification

- `npm run type-check` — clean.
- `npm run build` — pass (pre-existing chunk-size warning only).
- `npx vitest run` — 523 files / 3496 tests pass.
- `npx vitest run tests/architecture/` — 23 files / 90 tests pass
  (+3 from R14.3c).

## Gaps

- The brand is nominal, not a runtime invariant: a `Stats` object
  constructed by hand (not via `createBaseStats`) and force-cast could
  still enter `calculateStats`. Same class as any `as` cast — out of
  scope for a type-level guard.
- `recomputeEffectiveStats` correctly still accepts `Stats` (resolved
  input by design); the raw/resolved/effective triad is now expressible
  but only the raw boundary is branded. Branding resolved separately
  was evaluated as churn without a live defect class — not done.
