# Skill Presentation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. No commits: AGENTS P7 overrides generic skill commit steps.

**Goal:** Ship the shared E2E skill presentation runtime with Phi Kiem, melee/AoE/buff recipes, production wiring, a dev preview and regression evidence.

**Architecture:** Existing domain owners resolve outcomes, CombatAnimationRuntime publishes detached intent and sealed outcomes, a presentation-only runner owns all visual completion. The Phaser driver samples bounded resources; neither recipes nor driver receive gameplay mutation access.

**Tech Stack:** Existing locked TypeScript/Vue/Phaser 4.2/Vitest/Playwright. No new dependency.

**Spec:** game/docs/superpowers/specs/2026-09-25-skill-presentation-system-design.md

## Global Constraints

- Worktree: E:/tutienidle/.agent-worktrees/skill-presentation-design; branch codex/skill-presentation-runtime.
- Implementation baseline: 48962aaa36caffa4a37f6fdf6a01ee3af98e5f50, fetched 2026-09-25. The design baseline af5f6094 is retained as historical audit; intervening diff changes only KiemTu save validation and QA evidence, not presentation seams.
- Do not merge sibling feature branches, commit, push, deploy, delete user files, change save schema or gameplay balance.
- Combat outcome/RNG/order remain domain-owned. Keep existing ACK command port closed. No second combat timer/watchdog.
- Timeline: release 120 + cruise 180 + acceleration 70; commit at 370; impact 80 including local visual hold 25; recall 170. Reduced motion preserves phase milestones.
- VFX caps, reset/rebind/stale identity and missing asset fallback are acceptance, not optional polish.
- Existing entity, audio, damage-number and status owners remain. No duplicate hit audio or mutation per animated blade.
- Complete only with fresh verification; required unavailable gates remain explicit gaps.

## G0/G1 construction card

Outcome: skills use one replayable recipe/runner contract, Phi Kiem visibly flies/impacts/recalls in the real game, combat continues after visual cancellation/failure.
Owner chain: GameManagerTurnBattleOps -> CombatAnimationRuntime -> TurnBattleSystem/TurnSkillPlanRuntime -> event bus -> CombatScene -> runner -> Phaser driver.
State: runtime owns ephemeral request and immutable receipt; runner owns local phase/barrier; scene owns pools; Game owns textures. Nothing persists.
Q1/Q2: receipt is copied from committed operation results; visual arrival cannot select targets or damage.
Q3/Q4: reset and resume retain existing session/coordinator ownership and regenerate playback token; both headless and real production factory covered.
Q5/Q6: reuse ACKs, preset registry, geometry/body anchors and asset bundle catalogue; core contracts do not import presentation.
Q7/Q8: one atomic impact, primary/composite/combo collected before seal; no dodges inferred from target-set subtraction.
Q9/Q10: preview uses fake ACK port and immutable fixtures, no save import; duplicate/stale/reentrant/cancel tests required.
Q11/Q12: legacy events retained only as observer feeds, scene completion moves atomically to runner; unrelated refactors excluded.
Triggered modules: C1/C3/C4/C6/C7, S1/S4/S5/S6, L3, U1-U6. Economic and progression rule changes N/A.

## Task 1: Domain facts and coherent runtime envelope

Files: add core/battle/turn/SkillPresentationFacts.ts and focused tests; modify TurnSkillPlanRuntime.ts, TurnBattleSystem.ts, CombatAnimationRuntime.ts, TurnActionPresentationEvents.ts; only repair GameManagerTurnBattleOps.ts if first-proof establishes watchdog defect.
Produces: immutable SkillCastPresentation and SkillPresentationResolved (sealed true) at new skill_presentation_cast and skill_presentation_resolved events; requestId stable across resume and token renewed; source/target anchor facts; resolved preset; disposition; candidate instance count; primary/composite/combo groups with settled outcomes/provenance.
Consumes: existing declaration, execution hooks/results and runtime ACK methods. Follow spec section 4; any source-driven type refinement is recorded before Task 2 integration.
- [ ] First proof before production: production pipeline hold beyond 4 seconds and synchronous event ACK ordering. Use actual GameManager factory/manual clock helpers. Assert no lost pending step, no duplicate resolution, continued progression after resume.
- [ ] RED: tests require immutable descriptor, multi-instance hit/miss, charge/no-effect, interception and composite/combo identities; zero extra RNG draws.
- [ ] GREEN: copy owner results while resolving once; publish one sealed batch after inline groups; extend existing resume discriminants with the same facts.
- [ ] Run focused runtime/skill-plan/production parity tests and type-check.
Example behavioral oracle:
```ts
expect(impactAcks).toBe(1)
expect(resolved.groups.map(group => group.groupId).length).toBe(new Set(resolved.groups.map(group => group.groupId)).size)
expect(afterHeadless).toEqual(afterPresented)
```

## Task 2: Pure recipe compiler and runner

Files: add presentation/skills/SkillPresentationRecipe.ts, SkillPresentationRunner.ts and tests; data/vfx/SkillPresentationRecipes.ts.
Produces: runner.start(cast, port), resolve(batch), update(deltaMs), resume(snapshot, port), cancel(), destroy(); readonly diagnostic snapshot. Driver contract begins/samples/releases cue handles and has reset/destroy; no domain access.
Consumes: Task 1 facts and existing DomainCommandPort narrowed to ACK methods.
- [ ] RED: at 369ms no impact ACK; at 370 exactly one; a synchronously returned batch queues until ACK unwinds; shortest primary cannot finish a longer combo.
- [ ] RED: duplicates/stale tokens, replacement port, invalid deltas, cancellation at each phase, zero duration and throwing visual driver never duplicate ACK; no complete without sealed matching batch.
- [ ] GREEN: bounded finite recipe validation, shared phases and barrier, one semantic completion owner. Use elapsed sampling rather than callback-owned timers.
- [ ] Add seeded sequence tests (100 seeds x 100 lifecycle actions) and run focused tests.
Example:
```ts
runner.update(369)
expect(recorded).toEqual([])
runner.update(1)
expect(recorded).toEqual(['impact'])
runner.cancel()
runner.update(1000)
expect(recorded).toEqual(['impact'])
```

## Task 3: Phaser driver and production migration

Files: add game/support/skill-vfx/{PhaserSkillPresentationDriver,VfxPool,trajectory,strokes}.ts and tests, game/scenes/combat/combat-skill-presentation.ts; modify CombatScene.ts and combat-action-feedback.ts. Add data preset mapping for ngu_kiem_thuat at its authored definition.
Produces: data-driven release/travel/impact/recovery, tangent rotation, trails/afterimages, sparks/slash, local hold, capped camera cue, bounded pools.
Consumes: runner and anchor port (body/cell projection, last-known fallback, depth/scale); scene update/reset/shutdown lifecycle.
- [ ] RED geometry/resource tests: endpoints, zero-distance finite tangent, reverse direction, caps and idempotent cancel/destroy.
- [ ] GREEN procedural primitives with scene-local leases, no shared RNG, no timers/RAF owned by driver; reduced motion lowers decoration without timeline shift.
- [ ] Migrate CombatScene bindings to new typed events; legacy generic handlers do not retain ACK authority or duplicate primary VFX. Ready flourish still uses existing path with captured port.
- [ ] Reset on battle-start, rebind and shutdown; resume cast/full or post-impact short tail without duplicate damage feedback.
- [ ] Test real scene seam and compare headless outcomes. Update maintained R5 reference in roadmap.

## Task 4: Reusable recipes, selective existing clips and preview

Files: add data/vfx/VfxClipCatalogue.ts, selective catalogue/bundle integration, dev/skill-vfx.html and dev entry under game/src/dev; tests for authoring/clip metadata; localized controls via existing i18n.
Produces: one preview using same runner/driver/catalogue, no save state. At least Phi Kiem, melee, AoE and buff/heal recipes demonstrate common mechanism.
- [ ] RED validator tests for unknown primitive/nonfinite duration/unsafe clip reference and optional missing atlas fallback.
- [ ] GREEN admit only visually inspected neutral clip metadata; do not preload all 568 sheets. Retain procedural guaranteed path and document license admission limit.
- [ ] Preview controls: preset, replay, pause/step, speed, tier/reduced-motion, deterministic seed/cases, phase/lease readout. Import dev module only under DEV.
- [ ] Verify no production preview entry, no save imports and keyboard/resize readability.

## Task 5: Runtime proof and review

Files: game/tests/e2e/skill-presentation.spec.ts and ngu-kiem-vfx.spec.ts; task QA run artifacts.
- [ ] RED E2E before preview wiring; then observe actual release/cruise/impact/recall plus clean cancel.
- [ ] Production path: isolated guest/test save -> legal Ngự Kiếm ritual prerequisites -> Vạn Kiếm Quyết -> battle -> real ngu_kiem_thuat -> next turn/refight/exit. Reuse cultivation-path-ritual/combat-vertical-slice helpers.
- [ ] Capture desktop/narrow, left/right/intercept/zero-distance/missing asset/reduced-motion, phase trace + screenshots/video, console and HP assertions.
- [ ] Warm up 20 casts; 100 casts/20 rebinds with bounded objects and no live leases after completion. Record actual machine/backend and frame-time evidence, no universal FPS promise.
- [ ] E3 simplify; P3 npm run verify; P18 OCR delegation with complete file coverage; P13/P14 runtime; P4 adversarial; P5 sequential resulting-state reviews; clean A/B and final mutation/full verification as protocol requires.
- [ ] Report exact commands/counts/evidence and remaining gaps; no commit/push.

## Progress and preflight

- [x] Fetched latest Git and isolated source at 48962aaa.
- [x] Installed lockfile dependencies (npm ci, 639 packages).
- [x] Baseline: four targeted files, 54 tests passed, exit 0.
- [ ] First-proof gates.
- [ ] Tasks 1-5.

Interface overlap review: T1/T2 share facts only; T2/T3 share driver/runner port; T3/T4 share primitive/catalogue; T4/T5 share preview fixtures. One writer per owned surface. No gameplay formulas, save writes, or timer owner transferred.
