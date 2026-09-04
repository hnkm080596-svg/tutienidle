# QA Review: Stat System Turn-Based Conversion (speed/hpRegenPerTurn rename + 3 stat retirements)

- Date: 2026-09-04
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 88 files under `game/src/` (see `git diff --name-only master...HEAD` on branch `feat/stat-turn-based-conversion`, worktree `.agent-worktrees/stat-conversion`), per plan `docs/superpowers/plans/2026-09-04-stat-system-turn-based-conversion.md` and spec `docs/superpowers/specs/2026-09-04-stat-system-turn-based-conversion-design.md`

## Scope and Risk Map

Changed systems (all mechanical renames per plan Global Constraints except 2 spec'd formula files):

- `core/stats/StatTypes.ts` — StatType union: `attackSpeed`→`speed`, `hpRegenPerSecond`→`hpRegenPerTurn`, retire `movementSpeed`/`castSpeedPercent`/`cooldownReduction`
- `core/stats/StatBlock.ts` — `speed: 100` base (HSR-SPD anchor), `hpRegenPerTurn: 0`, retired fields removed
- `core/stats/StatCalculator.ts` — Dexterity→`speed` flat 0.15/pt (was attackSpeed percent 0.0015), Intelligence CDR modifier deleted, Vitality→`hpRegenPerTurn` 0.1/pt
- `core/stats/StatMetadata.ts` — retired metadata entries removed
- `core/battle/BattleSystem.ts`, `EnemyAttackSystem.ts`, `SkillEffectResolver.ts`, `CombatSkillPresentation.ts`, `GameManager.ts`, `PillSystem.ts`, `ArtifactSystem.ts`, `EnemyStatInput.ts`, `EquipmentStatPolicy.ts`, `StatLabels.ts` — call-site renames
- `data/` content (Skills, Enemies, buffs, affixes, equipment, KiemTuNodes, PhapTuNodes, TalentPassives, talismans, technique types, realm data) — stat-key renames, values untouched
- ~50 test files — fixture/assertion renames; timing-sensitive fixtures pin `speed: 1` to preserve the cadence semantics they were written against

One-hop consumers reviewed: Phaser combat scene (reads presentation via events — no stat names), Vue panels (`CharacterPanel.vue` combatPower formula renamed, `PillBagSection.vue` modifier lookup renamed, `SkillDetailView.vue` locale key kept — describes `execution.kind 'attack_speed'` policy, not StatType), i18n locale JSON (`attackSpeed` key at `panels.skillPath.detail` is the execution-policy label, correctly retained), save system (save shape does not type stat keys through the renamed union for equipped affix `stat` fields — dev phase, save compat explicitly out of scope per AGENTS.md).

Mapper returned `deepAuditCandidate: true` (6 domains, "critical state boundary: time-and-offline" via GameManager.ts). **Not escalated to deep — justification:** the GameManager change is 2 lines (stat key rename in technique-tier modifier target; `skillSystem.update(deltaSeconds, 0)` replacing a retired CDR read). No clock/offline accrual logic, no save schema, no economy transaction, no Vue/Pinia ownership or Phaser lifecycle transition is touched. Idle/cultivation production is untouched by the plan. The blast surface is the stat pipeline itself, whose consumers are exhaustively enumerated by the TypeScript compiler (Record<StatType, number> is a closed union) — the strongest available oracle for a rename task. The remaining untyped seams were manually grepped (locale JSON, string-typed data helpers) and are covered below.

Exclusions: unrelated dirty files on master (docs commits `8f364fe`, `b5d81b8` by user) — not reviewed.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-STAT-1 | `createBaseStats()` | Boot/base stat creation | Boundedness: speed=100 finite, no NaN/0 | Value mutation | `base.speed === 100` | Unit | High — every combat cadence reads it |
| INV-STAT-2 | `deriveAttributeModifiers()` | Dexterity 1→21 investment | Conservation: +0.15 flat/pt linear, no percent compounding | Value mutation | `result.speed === 100 + dex×0.15` | Unit | High — new formula is the spec'd core change |
| INV-STAT-3 | `deriveAttributeModifiers()` | Intelligence investment | Exactly-once/absence: no CDR derivation survives; 2 remaining stats correct | Deletion | `'cooldownReduction' in result === false`; critDmg/ailmentResist rates unchanged | Unit | High — silent survival = ghost stat |
| INV-STAT-4 | `deriveAttributeModifiers()` | Vitality investment | Conservation: hpRegenPerTurn rate 0.1/pt identical to old hpRegenPerSecond | Rename | `result.hpRegenPerTurn ≈ vit×0.1` | Unit | High — same-number rename contract |
| INV-STAT-5 | `STAT_METADATA` | Post-retire metadata lookup | Recoverability: no dead metadata entries; speed not misclassified percent | Stale state | key absence + `isPercentStat('speed')===false` | Unit | Medium — wrong unit breaks every UI format |
| INV-STAT-6 | `createBaseStats()` keys | Full Stats shape | Synchronization: union and record agree — no dead/missing keys | Cross-system | exact key set assertion | Unit | High — TypeScript Record enforces; test pins regression |
| INV-STAT-7 | stat pipeline | Extreme speed modifiers (±1e9) | Boundedness: finite, positive from standard pipeline, no hidden clamp | Value mutation | finite + sign assertions | Unit | Medium |
| INV-STAT-8 | stat pipeline | Multi-source speed stack (flat+percent+attribute) | Determinism: Added pool then Increased ×(1+p) ordering preserved | Reorder/Repeat | exact composite value 121.165 | Unit | High — proves speed flows the same pipeline as attackSpeed did |
| INV-STAT-9 | content data | Buffs/nodes/affixes granting renamed stats | Synchronization: no content still targets retired keys (would be dead modifiers at runtime) | Stale state | exhaustive grep + compile | Static + full suite | High — string-typed helpers bypass compiler |
| INV-STAT-10 | BattleSystem tests | Real-time engine under new speed scale | Determinism: timing tests pin `speed: 1` restoring original cadence semantics | Timing boundary | full battle suite green | Unit | Medium — doomed engine, compile+green is the bar |
| INV-STAT-11 | movement constant | Enemy movement w/o movementSpeed stat | Boundedness: off-screen gate still blocks attacks while enemy is outside visible range | Timing boundary | attackRangeVisibility test (re-pinned per-tick) | Unit | Medium — engine doomed; test updated to isolate the gate |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npm.cmd run type-check` (worktree) | 0 errors | Closed StatType union makes the compiler the exhaustive call-site oracle |
| `npx vitest run` full suite | 371 files / 2490 tests passed | Includes 9 new adversarial probes; one transient `deadReferences` I/O timeout and one `earthPath` flake failed in a mid-run pass but both passed in 3 consecutive re-runs and in the final full run |
| `npx vitest run src/core/stats/StatCalculator.turnConversion.test.ts` | 9/9 passed | The 9 QA probes above; 3 initial probe failures were probe arithmetic errors (pipeline order: flat Added pool sums BEFORE Increased multiplies), fixed in the probe, not production |
| `npm.cmd run build` | ✓ built in 5.06s | Pre-existing chunk-size warning only |
| `git grep -E "'(attackSpeed|movementSpeed|cooldownReduction|castSpeedPercent|hpRegenPerSecond)'" game/src` | only legitimate hits remain | `EnemyStatInput.hpRegenPerSecond` + `input.attackSpeed` are authored-input fields (plan Task 4 keeps input names); `attackSpeedMultiplier` is a SkillExecutionPolicy field; `panels.skillPath.detail.attackSpeed` locale key labels execution kind `'attack_speed'` |
| `git grep` retired names in locale JSON | 1 hit (skillPath detail label) | Verified consumer — execution-policy label, not a StatType reference |

## Findings

### QA-2026-09-04-001: Retired stat keys survived as dead object-spread keys in test fixtures
- Severity: Low
- Status: Confirmed (fixed during QA by allowlisted test edits only — no production code touched)
- Invariant: Synchronization (Stats shape agreement)
- Preconditions: object spreads `{...createBaseStats(), hpRegenPerSecond: 0}` in `BattleSystem.regen.test.ts` / `useTribulation.dotPha.test.ts` — excess keys in spreads are not compile errors, so the compiler oracle missed them
- Reproduction: `git grep hpRegenPerSecond game/src` post-Task-6 showed 2 fixture hits + 3 stale comments
- Expected: no references to retired stat names outside documented authored-input fields
- Actual: 2 dead fixture keys (inert — silently ignored at runtime, no behavioral effect) + 3 comments describing retired semantics
- Evidence: grep output in session; full suite green before and after cleanup
- Test file: n/a (grep evidence; cleanup committed `d892dc2`)
- Owner subsystem: test fixtures
- Blast radius: none at runtime (dead keys inert); misleading-only

No other findings. No production-code defects found: the compiler-enumerated surface was fully migrated, and the manually-attacked untyped seams (string-typed `stat()` helper in PhapTuNodes — found and converted 6 dead-modifier targets to `speed` during Task 6; locale JSON; execution-policy labels) are all accounted for.

## New or Changed QA Tests

- `game/src/core/stats/StatCalculator.turnConversion.test.ts` (new, 9 tests) — pins the spec'd formula change (speed base 100 + dexterity×0.15 flat, hpRegenPerTurn rate preservation, Intelligence's 2-stat gap, retired-key absence from base stats/metadata/pipeline, multi-source pool ordering, extreme-value boundedness). Proves the conversion's numeric contract independently of the content files.

## Gaps and Residual Risk

- **Doomed real-time engine numeric drift is intentional** (user-locked decision): enemy affix/passive/buff values granting old-scale `attackSpeed` numbers (e.g. affix `speed: 0.02` at the new ~100 scale) are meaningless-but-accepted until Slice 6 replaces `BattleSystem.ts`. Equipment affix *ranges* for `speed` were not re-authored (out of scope, tracked in roadmap "Equipment/Affix content" row).
- **Enemy `speed` values are not turn-meaningful yet** — `normalizeEnemyAttackSpeed()` clamps to 0.8–2.5 while the player base is 100; ATB ratios between actors will be ~40:1 until the tracked "Enemy data speed values" content task runs. Explicitly out of scope per plan §Not Covered.
- **`hpRegenPerTurn` is not wired into `TurnBattleSystem`** (no regen call site) — tracked as separate follow-up in the roadmap; this conversion only renames the field per spec §6.
- deadReferences full-suite I/O timeout is load-dependent (junctioned node_modules + 370 parallel files); passed 3/3 standalone and in the final full run. Not caused by this task.

## Pre-existing Failures

None — the suite was green at the worktree baseline before the change (370 files / 2482 tests), and green after (371 / 2490).
