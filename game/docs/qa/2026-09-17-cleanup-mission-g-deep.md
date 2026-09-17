# Deep QA — Mission G (Dead Code & Type Hygiene)

Date: 2026-09-17 · Mode: **deep** (mandatory escalation — mapper flagged `deepAuditCandidate: true`: save-and-cloud + time-and-offline boundaries touched by Task 8 restore filter, Task 22 store-member removal, Task 24 socket-field removal, Task 39 timed-effect read; 7 domains mapped) · Branch: `chore/cleanup` · Base: `master @ d0b8a516`

## Scope

Task-owned surface (37 commits, `master..HEAD`, 151 files): staged M13 dormant-cluster deletion (CombatSystem kill-trigger path → SkillTriggerRunner/SkillEffectSystem/SkillActionRegistry → slimmed ActionImpactSystem/ActionTargetingSystem/Battle), legacy bridges deleted outright (statKeyMigration, Buff.ts shim, pham_nhan attack key, dead realm-formula branches, getCultivationDurationSeconds), unreachable UI/state removal (MainMenu overlay chain, vue-router dep, dead store members, beginTribulation, socket fields, artifact combat advertising), type hygiene (as never/double casts/__tutienPhaserGame global/EventHandler<never>), dedup onto single owners (rank colors, getNodeMaxLevel, getRealmTier, profession material ids, bag snapshots, insight accrual, breakthrough target, building quote, tooltip quote, creation budget, tu_linh_tran read, huy_quyen backfill), floor-8 beetle content fix.

Changed-risk-map domains: combat-and-tribulation, economy-and-progression, inventory-equipment, pinia-phaser-sync, save-and-cloud, time-and-offline, ui-input-lifecycle. 47 unmapped paths manually routed — predominantly the deleted files themselves (nothing to map), test files, env.d.ts, and package.json (vue-router dep removal, verified via `npm run verify` build).

## Invariant ledger

| ID | Hypothesis | Invariant | Oracle | Result |
| --- | --- | --- | --- | --- |
| INV-G-1 | `getActiveCultivationSpeedPercent` adds a group filter the old inline sum lacked — a non-`tu_linh_tran` effect carrying `cultivationSpeedPercent` would silently lose its buff | State ownership | Fresh grep: `cultivationSpeedPercent` has exactly ONE writer — `activateTuLinhTran` (GameManagerPersistentEffectOps:381), which always sets `effectGroup: TU_LINH_TRAN_EFFECT_GROUP`. No other writer exists. Group filter excludes nothing live | **Resolved** — stricter read matches the write contract; `applyTimedEffect` group-refresh preserves the field on the surviving effect |
| INV-G-2 | Restore drops a *live* gated modifier — Task 8's `isCurrentShapeModifier` rejects gated stats lacking the owning `domain` | Recoverability | Swept every gated-stat `StatModifier` literal in `src/core` + `src/data` (-A6 window): all carry `domain` (phap_tu/the_tu/the_tu_an). Only domain-less legacy writes can drop — the intended zombie kill | **Resolved** |
| INV-G-3 | Removed PlayerData fields (socket fields, unlockedRealmEnhancements, isCultivating, pendingEquipTarget) break v67 saves written before Mission G | Recoverability | `saveShapeValidation.test.ts:845` pins unknown/extra fields as tolerated-and-ignored; old saves carry removed fields as tolerated extras; new saves satisfy the current validator. `CURRENT_SAVE_VERSION` correctly NOT bumped — bumping would force-wipe compatible v67 saves | **Resolved** — bidirectionally compatible |
| INV-G-4 | A caller mutates a `bag.get()`/`getAll()` result expecting the live bag to change → now silently no-ops on the snapshot | Synchronization | Swept all `materialBag.*`/`pillBag.*` call sites: only `add`/`remove`/`has`/`getAmount`/`clear` used; sole `get()` caller (GameManagerCompanionOps:89) reads `.material` — never mutates the stack | **Resolved** |
| INV-G-5 | `beginTribulation` still referenced by a caller the earlier grep missed | Correctness | Post-delete grep: zero hits; type-check + full suite green (a stale caller would fail compile/test) | **Resolved** |
| INV-G-6 | Parked artifact runtime damaged by the M13 cull | Preservation | Keep-list verified present: `ArtifactSystem`/`ArtifactRuntime`/`getArtifactCycleSeconds`, `ActionDamageInfo`/`scaleActionDamage`/`HitResolveOptions`/`ScheduledBasicImpact`, `areaFor`/`selectRankedTarget`, `SkillAction`/`TriggerBinding`/`SkillEffect` types, parked `Battle` | **Resolved** — all exports intact, artifact tests green |
| INV-G-7 | Fresh-grep anchors — any removed symbol still referenced in production | Correctness | Swept 24 anchors (SkillTriggerRunner, SkillEffectSystem, SkillActionRegistry, ActionImpactSystem class, ArtifactDropBalance, fireKillTriggers, statKeyMigration, migrateStatModifiers, Buff shim, getCultivationDurationSeconds, MainMenu, vue-router, player.load(, markRealmEnhancementUnlocked, unlockedRealmEnhancements, pendingEquipTarget, beginTribulation, resolveSpriteBodyAnchor, spiritStoneIdForRealm, filterNguHanhElements, ESSENCE_REALM_ORDER, socket fields, store isCultivating): zero production hits | **Resolved** |
| INV-G-8 | `pham_nhan` removal hit the `pham_nhan_chi_cot` talent (name prefix collision) | Correctness | Remaining `pham_nhan*` hits are the talent id (TribulationOutcomeService/Talents.ts — different system, kept) + one CultivationPathRegistry comment. The attack-key map entry is gone | **Resolved** |
| INV-G-9 | `combatOrigin` was removed as dead but has live readers | Regression | Kept — live readers confirmed: ui.ts:185/:345, CombatExitConfirmModal:36, CombatResultModal:20 | **Resolved** |
| INV-G-10 | `killIfDead` 3rd arg removed but a caller still passes it | Correctness | Signature is 2-arg `(target, sourceId)`; all call sites (:130, :501, TurnReactionManager:162) pass 2 args; type-check green | **Resolved** |
| INV-G-11 | App.vue edits (MainMenu chain, dup backfill, store-member removals) break boot/restore wiring | Runtime wiring | In-worktree Playwright: `boot-fresh`, `save-reload`, `error-recovery` (2 tests), `create-to-combat` — 5/5 green on the derived worktree port, exercising boot, restore, starter backfill, and the creation flow | **Resolved** |
| INV-G-12 | Double-backfill deletion changed grant behavior (not just dedup) | Idempotency | Second block was a no-op via `has()` guard pre-delete; AST pin in App.wiring.test.ts asserts the 'huy_quyen' literal appears exactly once in onRestoreOk | **Resolved** |
| INV-G-13 | Vendor `getRealmTier` swap changed reachable essence prices | Regression | VendorSystem.test.ts pins mortal→×1, qi_refining→×3, foundation→×9; post-beta divergence (body_integration shares tier 8) documented+tested as intended | **Resolved** |
| INV-G-14 | Building header quote vs buildingOps disagree on affordability/realm gate | Single authority | LeftPanel.building.test.ts: realm-gated state disables button + shows required realm; header consumes the ops quote (no second formula) | **Resolved** |
| INV-G-15 | Tooltip main-stat quote required but a production call site passes undefined → empty range | Correctness | All production call sites pass `gameManager.equipmentSystem.quoteMainStatRange(...)`; `compare` typed `| undefined` preserves positional compat | **Resolved** |
| INV-G-16 | `EventHandler<never>` / double-cast removals left a compile-visible gap | Type surface | type-check green; remaining `as unknown as` sites are runtime-guard narrowing (assertEnemyStatInputAllowed, collectUnsupportedSkillSemantics, frozen EMPTY_EVENTS, test-support fixtures) — justified pattern, not the listed sites | **Resolved** |
| INV-G-17 | `player.load()` / store-member removal left a dangling save-path call | Regression | Zero `player.load(` hits; removed members had zero writers/readers at delete time (fresh grep per task) | **Resolved** |
| INV-G-18 | Floor-8 beetle fix touched a shared stage row → wrong enemy elsewhere | Data integrity | Single data row in StageDropTables/floor definition; pin test asserts ferocious beetle on floor 8 only | **Resolved** |
| INV-G-19 | `getNodeMaxLevel` normalization diverges from inlined `Math.max(1, … ?? 1)` | Equivalence | NodeSystem.test.ts pins undefined→1, 0→1, positive→value — identical output | **Resolved** |
| INV-G-20 | Realm-formula dead-branch removal changed reachable realm outputs | Equivalence | XOR-invariant pin tests written before deletion; all reachable outputs unchanged | **Resolved** |

## Deferred / pre-existing

- `ThanhVanArt.test.ts` intermittent `loadModule()` timeout under parallel load — observed once during Task 25/26 scope; passes in isolation and in the full verify run. Pre-existing flake, not task-caused.
- Parked `Battle.ts` fixture fields are restorable from git history if the artifact reimagine needs them — documented plan risk, not a defect.
- `ESSENCE_REALM_ORDER` unification changes unreachable post-beta pricing only — documented + test-pinned intention.

## Verification evidence

- `npm run verify` (type-check + build + full vitest): **green** — 622 files / 5,200 passed + 4 expected-fail; build 6.80s.
- Fresh-grep sweep over all 24 deletion anchors: zero production references.
- In-worktree Playwright (P13/P14): `boot-fresh`, `save-reload`, `error-recovery` ×2, `create-to-combat` — 5/5 green.
- Per-task scoped verification throughout: 37 commits each landed behind a scoped green run.

## Verdict

**PASS WITH EVIDENCE** — every ledger hypothesis resolved against current code, tests, or in-worktree runtime; zero Confirmed defects; zero unresolved Suspected items in the task-owned surface. Deferred items are pre-existing or plan-recorded, listed above.

---

## Re-review addendum (2026-09-19) — user verdict REQUEST CHANGES, 2 Medium

External re-review of the merged Mission G disagreed with the INV-G-15
resolution and flagged a second task-authored rule violation. Both are
repaired in this round.

### G1 (Medium) — `mainStatRangeQuote` required-quote contract

The deep-QA resolution above treated `| undefined` as positional
compatibility. The locked Task 37 intent was stronger: the compiler must
force every tooltip/compare site to resolve the authoritative quote.

Repaired: `EquipmentCompareContext.mainStatRangeQuote` and
`buildEquipmentTooltip()`'s parameter are now required
`{ min: number; max: number }` (no `| undefined`). All 11 compile-enumerated
call/test sites migrated: production callers hoist
`quoteMainStatRange(...)` and gate the tooltip/compare on quote presence
(no quote → no tooltip, matching the existing registry-miss convention);
test sites pass the template's declared range. New source guard
`tests/architecture/equipmentQuoteContract.test.ts` forbids the
`| undefined` signature and `mainStatRangeQuote: undefined` literals from
returning. 13 tooltip tests + guard green; type-check clean.

### G2 (Medium) — P15 violations in G-authored comments

The sweep script (`git blame` scoped to the 41 G commits, TS-tokenizer
comment classification) found 129 G-authored non-ASCII comment lines:
48 mechanical glyph cases (`—`, `→`, `×`, `§`) and 81 Vietnamese prose
lines. All swept: mechanical chars substituted, Vietnamese prose
translated to English ASCII (contiguous comment runs anchored on
G-authored lines; adjacent legacy lines within the same sentence included
for coherence — the C10/whole-run rule). Verified: re-scan reports **0**
G-authored comment violations (50 remaining non-ASCII lines are all
non-comment UI/data strings). P15 baseline regenerated: 954 files /
10,906 violations (was 963 / 11,104). Tokenizer strip-compare of the
aggregate diff proves the sweep touched comments only — the sole
non-comment changes are the 6 intended G1 files.

### Verification this round

- `npm run type-check`: green.
- `npx vitest run` on asciiComments + equipmentQuoteContract guards and
  all swept test files (SkillSystem.huyKiem, player.talentM2,
  ActionTargetingSystem, useEquipmentTooltip): 20 tests green.
- Aggregate-diff strip-compare: zero unintended non-comment changes.
