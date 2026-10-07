# WIRE-outcomes-01 — G5 worker evidence

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`  
Branch: `codex/tien-hiep-ui-redesign`  
Base HEAD: `f8af8007b0b6519e6aa6997fedad2cc77939538a`  
Application root: `game/`  
Status: implementation handed back; **QA_UNVERIFIED** for aggregate completion. No commit/push/merge.

## G0 task card

Authorized request: wire the approved PC paper gallery into actual production combat, victory, defeat and tribulation UI while leaving gameplay unchanged. Reservation: `WIRE-outcomes-01`, already admitted by coordinator. Existing dirty changes in these files were task-owned; no unrelated overlap was encountered. The worktree was inspected before edits. This report is Markdown inside the assigned worktree; no additional worktree was needed.

Single responsibility: presentation chrome for the actual outcome/overlay consumers. Current and target owners stay the same: CombatSceneOverlay owns DOM composition/top inset publication; CombatSkillDockPanel owns right inset; CombatDefeatPanel/CombatVictoryPanel own their existing retry/home commands and countdowns; TribulationDirector owns questions, HP, chapter progression and outcomes. Existing mechanisms reused: PcPaperChrome, pcPaperControlStyles, GameButton, existing rails/cards/model. No missing gameplay capability was added.

Production chain: GameRoot/MainScene + PhaserCanvas -> live overlays -> existing scene rails/cards -> existing commands/composables/director. Result: CombatResultModal -> CombatVictoryPanel -> VictoryScene, or CombatDefeatPanel -> defeat child regions. State remains under existing stores/GameManager/director; no additional mutable projection or gameplay cache was introduced.

Sources: project AGENTS rules, architecture-worker-workflow, AstraDoctrine, QA README/schema/taxonomy/learning, roadmap R5 runtime/presentation separation and R6 art contract, maintained R14 combat-contract QA report, approved CombatOutcomeDesignPreview, PcPaperScene/PcPaperChrome/PcPaperButton and production paper CSS. Vue skill applied. Gallery data is aesthetic reference only.

Non-goals: core/data/store/Phaser changes, invented gallery metrics/actions/resources, altered failure/retry policies, new scene infrastructure, settings/quest selector changes, commit/push. First proof: inspect real canvas/HUD ownership and measured insets before decorative edits. Stop: preserve contracts, demonstrate focused checks, report missing actual runtime outcome evidence.

## Files written

| Production file | Responsibility |
| --- | --- |
| components/game/combat/CombatSceneOverlay.vue | Bind approved control art to live overlay; retain refs, observers, publishTopBarHeight/resetCombatInsets and children |
| components/game/combat/CombatDefeatPanel.vue | Shared paper chrome; retain canonical summary, eligibility hint, rewards, retry/home/countdown ownership |
| components/game/tribulation/TribulationSceneOverlay.vue | Bind approved control art to live director-backed overlay; preserve all props and answer command |
| components/scenes/victory/VictoryScene.vue | Shared paper chrome; preserve summary/runMode/countdownLabel/retry/continue contract and real read-model |
| components/scenes/victory/VictoryTitleBand.vue | Approved title-cloud asset through existing asset URL resolver |
| components/scenes/defeat/DefeatTitleBand.vue | Approved title-cloud asset through existing asset URL resolver |
| components/scenes/tribulation/TribulationResultBanner.vue | Shared paper chrome, same title/text contract |
| assets/tien-hiep-outcomes.css | Append live-only paper/ink treatment under pc-outcome-live; retain all earlier settings/quest rules |

Paths are relative to `game/src/`. Pre-existing fidelity files and layouts were not rewritten by this worker. No introduced `any`, dependency, locale, authoritative state, or gameplay formula change.

Intentional evidence artifacts: this report; wire-outcomes-capture.mjs and wire-outcomes-components-capture.mjs; captured PNGs in wire-outcomes-live/ and wire-outcomes-components/; original failed E2E evidence in wire-outcomes-runtime/ and wire-outcomes-runtime-retry/. The supplemental browser fixture imports actual production components into a separate fresh GameManager/Pinia, matches the page's observed Vite Vue/Pinia runtime modules, and unmounts the fixture/ closes the browser. It is not gameplay outcome evidence.

## G1 / Q1–Q12 and domain checks

| Check | Evidence/decision |
| --- | --- |
| Q1 | Existing stage/HUD data, manual/auto/AI choices, rewards, hints, countdowns and result commands remain observable; styling only |
| Q2 | Battle/actions/director authorities unchanged; no outcomes computed by new presentation |
| Q3 | No new mutable state; manager/stores/director remain writers, scene models remain readers |
| Q4 | Real overlays and CombatResultModal consumers inspected; live browser entered combat through home teleport navigation -> stage-start button |
| Q5 | PcPaperChrome/control styles reused; no new UI primitive |
| Q6 | New imports point to common presentation primitives and asset URL helpers; no domain-to-UI import |
| Q7 | Observer timing/teardown and countdown composables untouched; no ACK/gameplay authority change |
| Q8 | All incoming props/emits retained; summary, runMode, countdowns, mind answers and director fields unchanged |
| Q9 | Read-model queries unchanged; no side effects added to queries |
| Q10 | Insets disconnect/reset lifecycle unchanged; countdown cancellation/retry rollback unchanged and existing tests pass |
| Q11 | Real Phaser canvas retained. Static CombatFidelityScene/gallery are references, not replacements for production |
| Q12 | Eight reserved production files, focused verification, explicit runtime gaps; no unrelated fixes |
| U1 | Shared paper/art controls own decoration; existing GameButton interaction/a11y unchanged |
| U2 | Top/right publishers and canvas placement untouched. Real 1600x900 runtime measured top 46px; dock right edge 1600px |
| U3 | Control styles and URL resolver reused; title-cloud/paper are approved existing assets |
| U4 | Phaser rendering resources untouched |
| U5 | No new UI wording; existing i18n preserved. New CSS comments ASCII English |
| U6 | P14 applies. Live combat and fixture component visual evidence described below |
| C7/S5 | Declare/impact/ACK protocol and all observer/countdown cleanup unchanged; no changes to core combat or scene internals |

Economy/progression/save/domain formulas are N/A: none were modified. Actual director-driven tribulation behavior still requires aggregate runtime coverage.

## G2–G4 evidence

P3 quick, from `game/`, latest meaningful production state:

- `npm run type-check`: PASS.
- `npx vitest run src/components/game/combat/CombatSceneOverlay.style.test.ts src/components/game/combat/CombatDefeatPanel.test.ts src/components/game/combat/CombatVictoryPanel.test.ts src/components/scenes/victory src/components/scenes/tribulation src/components/scenes/combat`: **6 files / 20 tests PASS**, 12:48:01 local run. These include existing defeat fallback/cancellation and overlay geometry contracts. Last subsequent production edit was whitespace removal only.
- No mirrored CSS source tests were added for the reversible decoration. Existing behavior pins retained.
- OCR binary v1.12.11 available. Aggregate preview/rule selection, OCR reasoning, P4 and aggregate sequential/independent reviews remain the coordinator's gates; this worker does not claim they passed.

### Actual browser runtime, MS Edge, worktree URL 127.0.0.1:5449

`wire-outcomes-capture.mjs` booted guest, created character, dismissed tutorial, clicked actual `[data-df-navigation="teleport_array"]`, then stage-start, waited presentation idle and skill dock.

Observed: one Phaser canvas; actual player sprite/background/enemies retained; live overlay covers 1600x900; top rail y0 height46; dock x1449.765625/y76.5/width150.234375/height191 and right edge1600. Live dark button art on top/AI/dock/turn/log regions visually inspected in `wire-outcomes-live/combat-1600.png`. Mode checkbox uncheck and second AI radio check succeeded; page error collection was empty.

Bounded limitation: waiting for the actual defeat panel timed out after90s. Neither actual defeat-return-home nor actual victory/tribulation flow was demonstrated. No private/core state was modified to manufacture a result. The first supported-UI-store capture was rejected for outcome proof and its early screenshot was rejected because the curtain was still closing. The final combat screenshot uses actual navigation and a released curtain.

Existing `combat-overlay-layout.spec.ts --grep desktop:` attempts:

1. Failed before auth due a temporary missing auxiliary stylesheet import while another writer was working. Auxiliary asset then appeared; worker did not touch that scope.
2. Booted to home but failed at hidden `[data-wheel-slot="teleport_array"]` after Tab. Current home rail is reachable by `[data-df-navigation="teleport_array"]`; root informed that aggregate test navigation needs updating. This worker did not weaken the test.

### Supplemental actual-component appearance fixtures (NOT domain outcomes)

`wire-outcomes-components-capture.mjs` rendered actual VictoryScene, CombatDefeatPanel and tribulation child status/mind/HP components with a separate fresh manager/Pinia and fixture inputs. Screenshot sets at1600x900 and1280x720 visually inspected:

- victory paper/title/cloud, canonical slot display with currency120, growth10/5/2, retry/continue buttons readable and within viewport;
- defeat paper/title/hint and original return countdown, retry/home buttons readable and within viewport;
- tribulation status timer/strikes and actual answer buttons/HP remain present on ink panels. Chapter/result behavior was not exercised. The fixture only supplies child props and an equivalent inherited text color; it does not mount/direct the actual tribulation owner.

All final fixture page-error collections empty. These prove rendered appearance, not settlement/resource grants/timing/transition correctness. Screenshots are under `wire-outcomes-components/`.

## Found defect and renewed checks

Medium UI contrast defect found in worker's own supplemental capture: existing `.victory-scene.victory-scene .victory-title__subtitle` outranked the new paper subtitle rule, leaving ivory text on ivory paper. Root class: presentation cascade ownership/specificity escape (UI-06/UI-07). Repair: strengthen only appended pc-outcome-live selectors so live paper color wins; settings/quest/fidelity rules untouched. Sibling search: inspect prior outcome color selectors and appended title/flavor/section/action colors; only this visible conflict confirmed. Fresh fixture captures prove readable subtitle and buttons. P3 rerun above passed. Coordinator notified for learning incident/detector qualification; no automatic prevention claim.

The first component-fixture experiment used an unversioned Vue module and lost scoped attributes because it loaded a second runtime; its screenshots were invalidated and replaced using observed Vite module URLs. The final script captures real scoped component styles. This was a harness error, not a product defect.

## G5 decision and remaining work

Implementation handoff ready for aggregate review. Worker does **not** claim QA_FIXED_POINT_REACHED, PASS WITH EVIDENCE for full task, merge readiness, or completion of P18/P4/P5. Required remaining evidence:

1. Aggregate OCR/P4/sequential resulting-state reviews and independent fixed-point checks.
2. Actual victory/defeat command/result path, including repeat countdown and return-home; actual tribulation chapters/answers/outcome.
3. Aggregate runtime regression coverage after all concurrent UI writers freeze; investigate whether the90s outcome wait indicates reachability/timing gap or a pre-existing game issue.
4. Localization/zoom/reduced-motion/narrower viewport matrix beyond the described screenshots.

No authorized gameplay changes were made to force missing evidence. No commit/push.
