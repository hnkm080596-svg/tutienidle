# Combat result ceremony variant

## Latest user direction

2026-10-16: Remove the failure-reason block from the new defeat variant. Do not run fixed-point QA. Stop the aggregate convergence workflow; retain direct component/controller and focused browser verification only. Earlier run files are historical evidence, not a completion certificate. No further independent review/convergence rounds or protocol terminal claim are requested.

> Execution: using-git-worktrees, Vue best practices, TDD; inline implementation followed by isolated internal reviewers. No commit/push authorized.

## G0 task card

- Request: rebuild combat victory/defeat presentation as separate component variants, reusing currently shipped gold/red title art. Layered reveal and animated resource totals.
- Worktree: `E:/tutienidle/.agent-worktrees/combat-result-ceremony`; branch `codex/combat-result-ceremony`; base `72dea7dfd`.
- Responsibility: presentation of already settled stage-battle results. Gameplay settlement, progression, retry eligibility and countdown deadlines remain with existing owners.
- Current chain: CombatSceneOverlay -> CombatResultModal -> CombatVictoryPanel/CombatDefeatPanel -> canonical GameManager reward summary and useBattleActions.
- Target: explicit `ceremony` presentation variant selected at CombatResultModal. Existing wrappers retain their battle controllers; fresh components own layout, staged art reveal, counting and action presentation. Classic remains available for comparison.
- Reuse: title PNGs, InkNineSlice, HuyenKimSymbol, GameButton, useDialogFocus, useVictorySceneModel read projection, existing battle actions/countdowns.
- New mechanism: one cancellable presentation-only RAF timeline per mounted result; derived count-up values, skip, reduced-motion subscription. No resource writes, no gameplay ACK dependency.
- State: summary belongs to GameManager; run mode/stage belong to UI; transient elapsed time belongs to variant and is discarded on unmount. No persistence.
- Non-goals: rebuilding combat gameplay, rewriting reward settlement, changing 3s auto-retry / 10s defeat return semantics, new art or audio/dependencies, fixing unrelated classic layout defects.
- Maintained boundary: roadmap R5 and 2026-09-08-r5-runtime-presentation-quick.md; rendering cannot determine rewards. Historical P14 deferral in that report is superseded by current P14.
- Acceptance: gold/red art unchanged; layers reveal independently; rewards visibly count to exact totals; all reward rows remain reachable; first skip gesture never also activates an action; reduced motion is immediate; auto presentation completes before 3s; retry/return work through existing controllers; new result mounts fresh after a retry.
- Gates: P3 quick while repairing, final aggregate verify and E2E; OCR; real browser and screenshot inspection in this worktree; adversarial evidence and temporal P5 passes; fresh A/B reviews.
- Stop condition: requested variant implemented and inspected; remaining unavailable required evidence explicitly QA_UNVERIFIED, never presented as fixed point.

## G1 / Q1-Q12

| Question | Decision / evidence |
|---|---|
| Q1 | Observable acceptance above; test count progression, skip atomicity, motion preference and action routing. |
| Q2 | GameManager/BattleLootSystem retain full reward outcome; new variant only consumes slots/growth. |
| Q3 | No new persisted state; timeline cancellation/listener removal on unmount. |
| Q4 | Production modal selects ceremony explicitly, wrappers pass existing read-model and callbacks. |
| Q5 | Existing art primitives and canonical actions reused; new timeline has present count/reveal consumers. |
| Q6 | Components import presentation/core contracts; no upward core dependencies. |
| Q7 | RAF is display-only, countdown owners unchanged; no grant on reveal/skip. |
| Q8 | All item kinds and three growth types come from existing projection, exact numeric totals preserved. |
| Q9 | Read-model queries remain observational; no mutation from rendering. |
| Q10 | Mount owns RAF/listeners; keyed outcome lifecycle and current controller cleanup prevent old visual work surviving. |
| Q11 | Classic is an explicit supported variant, not dead code; new variant has separate markup/styles. |
| Q12 | Each touched file maps to result presentation, its adapter, locale, tests or evidence. |

## Tasks

- [ ] 1. Characterize controller baseline and prove transient playback behavior with failing tests; prepare/preflight construction brief.
- [ ] 2. Build playback + fresh title/reward/result components; reuse current art, use exact display amounts and i18n.
- [ ] 3. Wire explicit ceremony variants into production modal without copying gameplay rules; test routing and failure recovery.
- [ ] 4. Verify, OCR, real runtime capture, adversarial tests and sequential resulting-state reviews. Retain review/evidence report and honest protocol outcome.

Component map: `CombatResultCeremony` composes header, reward ledger, hint and action slot; `CeremonyTitle` reveals existing raster art with animated masks; `CeremonyRewardLedger` renders scrollable icon/name/count rows; `useResultCeremonyPlayback` owns one display clock. Controller wrappers supply actions via slots using canonical GameButton.
