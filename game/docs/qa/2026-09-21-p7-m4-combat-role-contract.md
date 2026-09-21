# QA Review: P7-M4 combat-role contract + generic loadout retirement

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 87 reviewable files under `game/src/**` (diff on `feat/p7-progression-consolidation`); `game/docs/**` excluded (docs-only); 6 diff-excluded (4 deletions, 2 mission docs)

## Scope and Risk Map

`changed-risk-map.mjs` returned `deepAuditCandidate: true` (save-and-cloud + time-and-offline boundaries, 6 domains, ~80 unmapped paths) — manually routed:

| Path(s) | Domain routing |
|---|---|
| `Skill.ts`, `SkillProgressionState.ts`, `SkillManager.ts`, `SkillSystem.ts`, `MortalPrecursors.ts`, data `*Skills.ts` | combat-and-tribulation, economy-and-progression (learned membership = sole authority; retired fields) |
| `CultivationPathRuntime.ts`, `CultivationPathRegistry.ts`, `CultivationPathRoles.ts`, `CultivationPathKit.ts`, path modules | economy-and-progression, combat (runtime role resolution, starter/dynamic basics, emblem precedence) |
| `CombatBuild.ts`, `GameManagerTurnBattleOps.ts`, `GameManager.ts` | combat (single role-composition seam, shared resolver binding) |
| `GameManagerProgressionOps.ts`, `GameManagerRealmAdvanceOps.ts` | economy-and-progression (pick write op, ritual atomicity) |
| `saveShapeValidation.ts`, `saveVersion.ts`, `Player.ts` | save-and-cloud (v71 boundary, pick field validation) |
| `SkillLoadoutStrip.vue`, `SkillPathPanel.vue`, `useLoadoutActions.ts`, `App.vue`, `EarlyGameBootstrap.ts`, `OverlayLayers.ts` | ui-input-lifecycle, pinia-phaser-sync |
| `TurnSkillPlanRuntime.ts`, `BattleSimulation.ts` consumer, ~55 test files | combat/test migration |

**Escalation decision — bounded to quick:** the save impact is a dev-phase version bump (v70 rejected at version check before shape validation — identical policy to M1/M2/M3); `mortalBasicSkillId` is one optional field with a two-rule validator, not a new persistence channel. The combat/UI resolver merge is a code-path consolidation pinned by 6239 green tests plus a live two-leg runtime verification this session (fresh char → pick persist → strip parity → ritual → pick cleared → dynamic label → live battle firing the provider basic). No clock/offline, cloud, or Phaser lifecycle surface touched beyond unchanged consumers.

## Invariant Ledger

| ID | State/owner | Transition | Invariant | Operator | Oracle | Result |
|---|---|---|---|---|---|---|
| INV-M4-1 | `player.mortalBasicSkillId` / ritual | `chooseCultivationPath` failure at any pre-commit check | Atomicity: pick preserved byte-identically on failure; cleared only post-commit | Reorder/interruption | Code trace: 3 template preflights + `applyPathChoice` all precede `delete` at line ~211; no failure path after deletion | SAFE — verified against `GameManagerRealmAdvanceOps.ts:185-285` |
| INV-M4-2 | Passive application / `getPassiveSkills` | Learned membership replaces `equipped` filter | Conservation: no passive loses or gains application vs old equipped set | Value mutation | Old equipped set = realm (equipWithoutSlot), way (same), talent (authored `equipped:true` at `TalentPassives.ts:21-22`), initiation (same); node-granted passives auto-applying is the spec'd M4 semantic | SAFE — equip surface was dead for every production grant channel |
| INV-M4-3 | Talent combat passives / restore | `restoreGameSession` ordering + template filter | Recoverability: selected talent's passives must survive reload | Interruption/stale state | Live: post-reload save lacks `talent_passive_*` despite `selectedTalentIds:['can_than']`; repro test fails for intended reason | **CONFIRMED — PRE-EXISTING** (see Findings) |
| INV-M4-4 | `setPathRuntimeResolver` override | Combat vs UI resolution parity | Synchronization: one override-aware binding serves both ops | Reorder/stale state | `GameManager.ts:559-562`: call-time closure over `pathRuntimeResolverOverride` injected at lines 572 + 814 | SAFE — single binding, call-time consult |
| INV-M4-5 | Basic fallback chains | Starter/kit absent at fresh initiation | Recoverability: defined degradation order per way | Value mutation | sword=nominal+provider; hidden_sword=provider+emblem; spell=element kit→linh_bao starter→build→generic; body=root kit→huy_quyen starter→generic; hidden_body=fixed An kit always resolves | SAFE — all chains verified in `CultivationPathRegistry.ts` |
| INV-M4-6 | Retired skill keys / save v71 | v71 save carrying `loadoutSlot/loadoutSlots/equipped/unlocked` | Recoverability: rejected at boundary, no partial restore | Value mutation | `validateSkillEntries` `RETIRED_SKILL_ENTRY_KEYS` rejection at `saveShapeValidation.ts:722`; v70 version-gated first | SAFE — boundary verified + test-pinned |
| INV-M4-7 | `setMortalBasicSkill` | Non-precursor/post-path/unlearned writes | Boundedness: only mortal players, only precursors, only learned | Value mutation | Guard order: `!isMortal→false`, `!isMortalPrecursorSkillId→false`, `!skillManager.has→false`; live: linh_bao pick persisted, sword pick cleared at ritual | SAFE — op + boundary + live evidence |
| INV-M4-8 | Resolved roles / UI+combat | Same role composition both consumers | Synchronization: `resolveCombatSkillRoles` single seam | Stale state | `CombatBuild` consumes seam (no second emblem overwrite); `getResolvedSkillRoles` same binding; live strip showed `Kiếm Phổ` dynamic label + battle fired `Đâm` | SAFE — live two-leg evidence, 0 console errors |
| INV-M4-9 | Precursor cast counting | Picked precursor fires as basic | Conservation: casts keep feeding hidden-way gates | Cross-system | `toTurnSkillDefinition` preserves `skill.id`; `skillCastCounts` unchanged channel | SAFE — hidden-gate grind mechanism preserved |
| INV-M4-10 | `syncRealmPassive` idempotency | Re-grant on repeat entry | Idempotency | Repeat | `skillManager.has` guard unchanged | SAFE |

## Findings

### F1 — CONFIRMED (PRE-EXISTING): Talent combat passives wiped on every save-reload

- **Severity**: Medium (pre-existing, out of M4 scope — recorded, not fixed here)
- **Evidence**: direct runtime (guest save `selectedTalentIds:['can_than']` → post-reload `skills[]` lacks both `talent_passive_*`) + deterministic repro `game/src/services/save/SaveSystem.talentPassiveRestore.qa.test.ts` (`it.fails`, fails for the intended reason).
- **Mechanism** (two compounding layers, both predating M4):
  1. `restoreGameSession` ordering (`SaveSystem.ts:284-288`): `setActivePlayer` → `syncTalentCombatPassive` re-grants into `skillManager`, then `saveOps.restoreFromSave` → `skillManager.restore` replaces the whole set — wiping the grant.
  2. `restoreSkills` template filter (`GameManagerSaveRestore.ts:281-283`) drops `talent_passive_*` file entries — they live in `TALENT_PASSIVE_SKILLS`, not `skillTemplates`.
- **M4 causality check**: ordering (`ccc2a855` Sep 3, `63fef9e6` Sep 13), `skillManager.restore` replace semantics (M1 ARCH-001), and the template filter are all untouched by the M4 diff. Membership-authority change does not alter the wipe.
- **Suggested fix (future)**: re-run `syncTalentCombatPassive` after `skillManager.restore` (talent passives are derived state — re-derivation beats file persistence), or exempt `talent_passive_*` from the restore template filter. The `it.fails` test flips green when fixed — convert to `it()` then.

### F2 — NIT: `ResolvedDefRole.name` duplicate of def id when unlearned

- `getResolvedSkillRoles` def-name chain falls through learned → template → `def.id`; an unlearned def shows the raw id. Cosmetic only — the authored/kit defs are always learnable via ritual, and sword's real basic rides `dynamicLabel`. Deferred.

## Evidence

- Repro test: `SaveSystem.talentPassiveRestore.qa.test.ts` — expected-fail, deterministic.
- Live runtime (worktree dev server, Edge): fresh char v71 save (learn-only grants, no pick) → Kỹ Năng strip `Cơ Bản: Huy Kiếm` + 3-chip chooser → linh_bao pick persisted (`player.mortalBasicSkillId`) + strip parity → Quán Khí ritual (Tâm Ma + Lôi survived) → Kiếm Tu commit (`qi_refining:1`, `sword:sword_pathway`, pick ABSENT, both way/realm passives learned, precursors retained) → strip `Cơ Bản — Kiếm Phổ` dynamic label → Động 1 victory with `dùng Đâm` provider basic, 0 console errors.
- Suite: 710 files / 6239 tests green (+4 expected-fail incl. this repro).
