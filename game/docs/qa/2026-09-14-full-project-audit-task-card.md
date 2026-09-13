# Full-project audit task card

- Request: audit current HEAD across all meaningful systems; no production implementation or repair.
- Baseline: `f2846064a4b15d4d20a94540855b6194b77eb21c`, source checkout `E:/tutienidle`, branch `master`.
- Assigned audit worktree: `E:/tutienidle/.agent-worktrees/full-project-audit-2026-09-14`, branch `codex/full-project-audit-2026-09-14`.
- Original dirty state: `game/package.json` has scripts and devDependencies removed; preserved and excluded from HEAD verification.
- Responsibility: establish whether important state has one authority, trace actual production callers and downstream consumers, and identify reproducible or source-established defects.
- Current entry chain: `main.ts -> App.vue/useAppLifecycle -> GameManager/domain owners -> Vue/Phaser presentation`; exact domain chains are documented in the aggregate report sections B-C.
- Current candidate owners: `EntityVitalsSystem`, `CombatSystem`, `TurnBattleSystem`, canonical buff systems; player stat assembly; inventory/equipment operation systems; `GameManagerSaveRestore`/`SaveSystem`; `GamePresentationCoordinator`/`PhaserSceneAdapter`.
- Target owners: no changes; repair directions are recommendations only.
- Existing mechanisms: current factories, catalogs, typed session/ACK contracts, domain APIs, Vitest, architecture guards, Playwright specs.
- State map and Q1-Q12/C/S/E/UI evidence: consolidated in final report sections B-H and J-K. Unknown remains unknown.
- Allowed writes: audit reports/evidence under `game/docs/qa/`; temporary isolated diagnostics, removed before handoff. No production code/config/test edits, no commit/merge/push/deploy.
- Evidence gates: type-check, build, full Vitest, non-mutating lint/dependency checks; existing E2E and visual inspection if stable. Existing failures are reported, not repaired (audit request overrides fix-on-failure workflow).
- Roadmap: current R1-R14 and later combat/beta updates are intent; verify source rather than inherit completion claims.
- G2/G3 production implementation gates: N/A, read-only audit. G4 executable checks are evidence collection, not implementation certification.
- Stop condition: required A-N report, authority/flow maps, findings with locations/call paths/severity/evidence, dependency-ordered repair missions, explicit test and runtime gaps, unchanged production diff.

## Independent reviewer assignments

1. Combat authority and authored execution: vitals/damage/buff/reaction/turn scheduler/skills/combat rewards and cleanup; report `2026-09-14-audit-combat-review.md`.
2. Persistent progression and economy authority: player stats/equipment/inventory/resources/production/cultivation/realm/quests/companions; report `2026-09-14-audit-economy-review.md`.
3. Application lifecycle and persistence: boot/auth/routes/Phaser/assets/session/save-load/cloud/tribulation; report `2026-09-14-audit-lifecycle-review.md`.
4. Coordinator: repository-wide inventory, static/build/test execution, events/dependencies/type escapes/test blind spots, cross-system verification and final synthesis.

## G5 handoff

- Aggregate: [full A-N report](2026-09-14-full-project-engineering-audit.md).
- Q evidence index (audit findings are FAIL/GAP for product invariants, not a production PASS): Q1 observable behavior: each finding; Q2 complete owner: B/D-H; Q3 lifecycle/state: H; Q4 real production chain: C and finding call paths; Q5 existing primitive/reuse: B/M; Q6 dependencies: B/I/K and AST inventory; Q7 clock/domain/presentation: C/G; Q8 semantic parity: ARCH-002/003/008/012/014; Q9 pure queries/paid previews: economy reviewer authority map and ARCH-011; Q10 duplicate/stale/failure: ARCH-001/004/006/013; Q11 old paths: I; Q12 scope/verification/stop: A/J/L and this G5. Triggered combat, save, economy, UI and scene checks are recorded in those sections.
- Audit verdict: REPAIR BEFORE MAJOR FEATURES; seven P1 and eight P2 groups. No production fixes or completion claim for the game.
- Type-check/build pass; Vitest 3796/3800 pass; architecture 116/116; lint 24 errors/178 warnings; E2E 14/19 pass. Failure classification and runtime gaps: J.
- Independent lifecycle reviewer checked aggregate claims; corrections applied for remote guest scope, READY-before-route-commit ordering and session-start routing consumer.
- Temporary browser/inventory executable diagnostics removed after preserving method/output; reports and screenshots retained intentionally. Own Vite process and browser contexts stopped.
- Worktree production diff is empty. Original checkout package.json change preserved; unrelated home.png/panel-nhanvat.png observed late were left untouched. No commit/merge/push.
