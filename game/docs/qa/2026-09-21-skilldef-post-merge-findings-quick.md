# QA Review: skilldef post-merge findings closure -- required CombatRng, fail-closed producer census, verification baseline

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE (2 coverage-masking defects found and fixed inside the QA loop; all other hypotheses rejected on inspection)
- Task-owned paths: `src/core/battle/runtime/scheduler/adapters/{CombatSystemDamageAdapter,CombatSystemDamageAdapter.test}.ts`, `src/core/battle/turn/{TurnBattleSystem,TurnSkillPlanRuntime,TurnBattleSystem.skillPlan.test}.ts`, `src/core/skilldef/{LegacySkillAdapter,LegacySkillCoverage.test}.ts`, `tests/architecture/{damageAuthorityRng,skillDefProducerSources}.test.ts`, `tests/architecture/baselines/asciiComments.json`, `docs/qa/2026-09-19-skilldef-m4-plan-routing-quick.md`, `docs/specs/2026-09-17-skill-definition-system-spec.md`

## Scope and Risk Map

`changed-risk-map.mjs` returned every path as `unmappedPaths` (the map has no `src/core/**` rules) -- manual routing: **combat-and-tribulation** domain pack for the adapter change (the only production-behavior edit: `rng` made a required dep with a constructor guard); test-infrastructure risk for the census/architecture guards; documentation-only for the rest. One-hop consumers inspected directly: `GameManagerTurnBattleOps` (the only production construction site -- binds `this.combatRng`, the same instance fed to `combatSystem.setRandomSource`), `TurnRuntimeFixtures` (test construction site). `deepAuditCandidate: false`. No save/cloud, time/offline, economy-transaction, or Vue/Pinia/Phaser boundary is crossed -- the change is headless and compile-time-visible.

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-F1-1 | DamageAuthority rng / CombatSystemDamageAdapter | Construct without an explicit `CombatRng` | Determinism: no implicit random source | Value mutation (missing dep) | Constructor throws | unit (`CombatSystemDamageAdapter.test`) | High -- the finding itself |
| INV-F1-2 | Adapter policy rolls | `hitPolicy`/`critPolicy`/`armorPolicy` on a `skill_hit` op | Exactly-once + ordering: declared policies consume the injected rng in legacy perInstanceOptions order (crit before armor) | Reorder | ScriptedCombatRng throw-on-second-roll; swapped roll order flips outcomes | unit | High |
| INV-F1-3 | Composition roots | Any `new CombatSystemDamageAdapter` in production src | Conservation of the rng stream: bind an existing rng, never inline-mint a fork | Cross-system chain | source scan: `rng:` bound, zero `new *CombatRng`/`Math.random` in the deps window | architecture (`damageAuthorityRng`) | High |
| INV-F2-1 | Producer file set / src/** | New file containing `cooldownTurns:` | Boundedness of authority: every producer file is walked data or declared | Degraded environment | fail-closed manifest failure | architecture (`skillDefProducerSources`) | High |
| INV-F2-2 | Census legs / collectCastableDefs | Producer returns nothing for a state that must produce | Recoverability: mandatory legs cannot silently skip | Stale state | `missingMandatory` asserted empty | integration (`LegacySkillCoverage`) | High -- found, fixed |
| INV-F2-3 | Provider `onCastResolved` emissions | Non-KiemPho provider returns extra defs | Boundedness: emissions join the census | Value mutation | emitted defs pushed to census | integration | Medium -- found, fixed |
| INV-F2-4 | KIEM_PHO_COMBOS reachability | Greedy matcher feed per authored pattern | Determinism: reachable combos self-emit | Reorder | emitted id set vs pinned `KNOWN_UNREACHABLE_COMBOS` | integration | Medium |
| INV-F3-1 | asciiComments baseline | Regenerated via `p15-baseline.mjs` | Monotonicity of the ratchet: zero NEW offenders in the task diff | Stale state | no baseline key under any diff file | architecture | High |

## Findings

### QA-2026-09-21-001: mandatory census legs could silently contribute nothing
- Severity: Medium
- Status: Confirmed -- FIXED (test-side repair inside the QA write boundary)
- Invariant: INV-F2-2
- Preconditions: a producer call in `collectCastableDefs` returns `undefined`/`null` for a state whose production contract requires a def (e.g. `selectAction` regressing to `NULL_ACTION` for a no-slot participant, `runtime.resolveBasic` returning nothing for a valid path).
- Reproduction: the uniform `push()` helper skipped nil values; the `defs.length >= 60` floor still passes with hundreds of defs; no assertion pinned any individual leg's presence.
- Expected: every mandatory producer output is asserted present.
- Actual (pre-fix): silent skip -- the "every producer is represented" invariant the finding requires could not be proven.
- Fix: `requireDef` records `missingMandatory`; new test `every mandatory producer leg emitted a def` asserts the list empty. Applied to `resolveBasic`, `provider.resolveBasic`, listed `manualOptions`/`resolveManualPick`, TheTu kit fields, An-kit mutations, companion `basic` + authored `special`/`ultimate` (max-unlock fixture), the engine fallback basic, and per-state kit slots via `requiredSlots` (ngu_hanh element kits + rooted the_tu states require special+ultimate; ngo_dao requires `special` only -- its ult slot is a passive `ngo_dao_hon_don` by design; the_tu no-root states require none). Legitimately optional outputs (mortal/kiem_tu `resolveSpecialUltimate`, `emblemSlots`, combo extras) keep `push`.
- Evidence: `src/core/skilldef/LegacySkillCoverage.test.ts` -- 11/11 green; `missingMandatory` is empty on the current surface (no latent defect, only the masking path closed).
- Blast radius: any future producer defect on a mandatory leg -- now fails the census instead of passing.

### QA-2026-09-21-002: non-KiemPho provider `onCastResolved` emissions discarded
- Severity: Medium (latent -- current Ngu provider emits none)
- Status: Confirmed -- FIXED
- Invariant: INV-F2-3
- Preconditions: a future/extended `DynamicBasicProvider` whose `onCastResolved` returns extra defs.
- Reproduction: the census called `provider.onCastResolved?.(castContext('orb_dam'))` and discarded the return value -- emitted defs never entered the census surface.
- Expected: emissions join the census like KiemPho combo extras do.
- Fix: emitted defs are pushed per emission (`provider.onCastResolved` source label). The provider's own domain effect (e.g. `gainKiemY`) remains out of scope.
- Evidence: same file, 11/11 green.
- Blast radius: a def-emitting non-KiemPho provider added without a `cooldownTurns:` literal in its file would previously escape BOTH the census and the producer-source scan; now the census collects its emissions.

## Rejected hypotheses

- **H-adapter binds wrong-but-existing rng**: the arch test requires `rng:` bound + no inline mint; the production site binds `this.combatRng` -- the same instance wired to `combatSystem.setRandomSource` at `GameManagerTurnBattleOps.ts:1243`. A root deliberately binding a *different* existing rng is not textually detectable without brittleness; recorded as documented residual (Low).
- **H-duck-type false negatives**: `id`/`cooldownTurns`/`targeting` are required contract fields -- any real `TurnSkillDefinition` satisfies the shape; `Skill`/buff objects cannot false-positive (different field names).
- **H-exported-Map/Set escape**: `Object.entries` cannot see Map/Set contents -- an exported `Map<string, TurnSkillDefinition>` in a data module would escape the deep walk. Fixed: the walk now descends `Map`/`Set` values (no such export exists today; the gate closes the class before it can).
- **H-adapter inside rng-impl dir**: the construction scan no longer exempts `core/battle/runtime/rng/` -- the deps-window check only triggers on `new CombatSystemDamageAdapter`, so legitimate rng impls cannot false-positive and a misplaced construction cannot hide.
- **H-merged-registry partition gaps**: spec variants (`#`) and route-locked empowered ults are mutually exclusive inside one battle (one equipped spec, one locked route, single player per battle) -- the partition models reachable coexistence, not skipped coverage.
- **H-Ngu `onCastResolved('orb_dam')` misses context-dependent emissions**: `NguKiemDaoProvider.onCastResolved` ignores ctx and returns `[]`; its `each`-shape variants across unlock states are covered by the `kiem_tu:ngu` fixture matrix (5 states).
- **H-baseline regen masked new offenders**: regenerated via the project's own `scripts/p15-baseline.mjs`; audited zero added entries under any task-diff file; suite red at baseline SHA `ebf9fca0` with the same violations class (pre-existing drift on untouched lines).
- **H-unreachable-combo pin staleness**: the pin compares the exact SET of non-self-emitting combos -- a newly-unreachable combo fails, a fixed combo fails -- both directions force a deliberate manifest update.
- **H-`.d.ts`/deep-nesting escape**: `?raw` + module globs share one pattern; `cooldownTurns:` in a `.d.ts` triggers the same fail-closed reachability check; walk depth 8 exceeds any authored literal nesting.

## Documented residuals (accepted boundaries, not defects)

- A producer minting defs with no `cooldownTurns:` literal inside an already-classified file escapes the source scan -- same limitation class as every textual guard in `tests/architecture`; recorded in the census header.
- The 800-char construction-window scan in `damageAuthorityRng` intentionally fails closed on a named-variable deps binding (forces the literal) -- conservative, self-documenting failure.
- `KNOWN_UNREACHABLE_COMBOS = ['thich_tram_tram_phach_thich']` pins a pre-existing authored-data defect (interior subsequence `[C,C,B]` collides with `nhi_tram_nhat_phach`) -- outside this task's scope; the pin converts silent unreachability into a deliberate manifest entry.
