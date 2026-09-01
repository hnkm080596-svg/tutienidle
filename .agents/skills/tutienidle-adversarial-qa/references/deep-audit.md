# Deep Audit Workflow

Use deep audit for an explicit deep request, milestone/release readiness, or a mandatory escalation from quick review. It is an independent QA activity: it can add failing reproduction tests only within `game/src/**/*.test.ts`, `game/tests/e2e/**/*.spec.ts`, `game/tests/e2e/helpers.ts`, and `game/docs/qa/**`; it never authorizes a production edit, configuration/dependency/asset/snapshot change, secret access, live-service action, or Git mutation.

## Sequence

1. Prefer a fresh QA session. Read the requirement and current code before implementation commentary so the audit is not anchored to the implementation narrative.
2. Rebuild the system map for the audit scope from current code. Compare documentation secondarily and report any documentation drift separately.
3. Load every [domain pack](domains/), [the reasoning method](qa-reasoning-method.md), [test/evidence rules](test-authoring-and-evidence.md), [reporting rules](reporting-and-learning.md), and all entries in `game/docs/qa/learned-defects.md`.
4. Build a full invariant ledger for state owners, transitions, side effects, persisted results, attack operators, decisive oracles, and test layers.
5. Generate state-machine paths and cross-system sequences. Include repeat, reorder, interruption, concurrency, time manipulation, two tabs, corruption, low FPS, and soak behavior wherever the scope makes them reachable.
6. Select focused tests first, then run the complete verification matrix below. Use the lowest conclusive oracle for a hypothesis before expanding breadth.
7. Add a failing reproduction test for a confirmed defect when it can fail for the intended reason and stay inside the QA write allowlist. It is optional only when direct runtime evidence already confirms the defect or when no such test can be written inside the allowlist. Leave production repair to the development workflow.
8. Record pre-existing failures and blocked tools separately from audit-caused evidence.
9. Issue only an allowed verdict through the reporting rules. Green tests alone cannot produce `PASS WITH EVIDENCE`; the report must tie conclusive checks to the ledger's high-risk hypotheses.

## Evidence Gate

Do not call an issue `Confirmed` before evidence exists. `Confirmed` requires either a failing reproduction test that fails for the intended reason or direct runtime evidence. A static concern without either is `Suspected`; missing observability or control is a `Coverage gap`. Existing green tests alone neither confirm that a defect is absent nor justify an unqualified safe result.

For UI/UX reasoning, load `ui-ux-pro-max` before deciding the expected interaction or presentation behavior. A browser playtest is required only when audited behavior is interactive or visual and an in-app browser is available.

## Required Commands

Run from the repository root in this order after focused checks:

```powershell
cd game
npm.cmd run test
npm.cmd run type-check
npm.cmd run build
npm.cmd run test:e2e
```

Record unavailable commands as `Not verified`, then apply the reporting verdict rules rather than treating unavailable verification as a pass.

## Save and Time Escalation Example

For task-owned changes spanning `game/src/services/save/SaveSystem.ts` and `game/src/core/idle/OfflineProgressSystem.ts`, begin from quick review but escalate: save recovery and offline-time ownership are both critical and persist a cross-system result. Rebuild the map, load all packs, and ledger current-save corruption/recovery, threshold-adjacent elapsed time, duplicate offline application, reload interruption, and two-tab/overlapping-save sequences. Test current save shape only; backward migration of old save formats is outside this development-phase audit. A failing reproduction test may document a confirmed defect, but neither the quick escalation nor this deep audit repairs production code.

