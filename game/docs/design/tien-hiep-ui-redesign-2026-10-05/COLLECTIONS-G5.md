# Collections and workshops worker evidence

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`; branch `codex/tien-hiep-ui-redesign`. No commit, push, merge or gameplay change. Existing dirty task work was preserved. Worker scope is the six collection/workshop scene roots and the new collection composition stylesheet.

## Construction and consumer coverage

G0/G1 task card: `REBUILD-EXECUTION.md`, collection/workshop slice. Component map remains scene root -> existing display children/production slots -> existing emitted intent -> production surface adapter. Q1/Q4/Q8: signatures and intents unchanged. Q2/Q3/Q7/Q9: no domain, state, persistence or timing writer added. Q5/Q6: existing navigation, portrait, equipment stage, bag sections, skill nodes and recipe/map components reused. Q10: root `useDialogFocus` and Escape contracts preserved. Q11: production admission and preview entry separation unchanged. Q12: focused tests and real Edge screenshots below; aggregate verification/review is coordinator-owned.

Changed presentation paths:

- `src/assets/tien-hiep-collections.css`: warm ivory scene composition; charcoal inspectors; antique gold separators; scene-specific region geometry, contrast and dense viewport spacing. Imported by the six owned scene roots, without modifying the global skin or composition root.
- `src/components/scenes/character/fidelity/CharacterFidelityScene.vue`: personal study groups identity and the existing dynamic portrait, alongside aggregate stats and detailed source inspector. Dynamic art remains `PlayerPortrait` owned.
- `src/components/scenes/inventory/fidelity/InventoryFidelityScene.vue`: bag toolbar, grid, inspector and canonical count regions. Production `InventorySurface` still supplies three canonical tabs and the existing section search/sort/pagination; preview inspector remains preview-only.
- `src/components/scenes/equipment/fidelity/EquipmentFidelityScene.vue`: equipment stage and independent workshop region retain real `EquipmentSurface` doll/workspace/summary slots. Removed hardcoded sample fallback stat values; summary appears when the production summary slot exists.
- `src/components/scenes/skill/fidelity/SkillFidelityScene.vue`: authored graph geometry retained; element selector and charcoal inspector grouped clearly. No graph coordinate, node contract, cost or action semantics changed.
- `src/components/scenes/alchemy/fidelity/AlchemyFidelityScene.vue`: recipe archive, cauldron workbench, live job queue and recipe folio. Variants, costs, enough/insufficient semantics and existing brew/cancel commands retained.
- `src/components/scenes/exploration/fidelity/ExplorationFidelityScene.vue`: chapter atlas, progression line and expedition inspector. Existing chapter routes, locked states, mode/build/start/stop commands retained.

## G2/G3 verification

Focused Vitest run: 7 files / 17 tests passed: EquipmentFidelityScene, ForgeFidelityScene, ForgeBatchBag, EquipmentHallPanel, AlchemyPaperRecipes, ExplorationPaperMap and skillGraphViewport. Additional run: remainingPreview and InventorySurface, 2 files / 7 tests passed. After summary-slot cleanup, EquipmentFidelityScene and EquipmentHallPanel rerun: 2 files / 10 tests passed.

No broad type/build suite launched by this worker while concurrent workers edited aggregate source; coordinator must run the full required mode on final aggregate state.

## G4 runtime and repaired findings

Real Microsoft Edge, Playwright CLI session `collections`, implementation-worktree server `http://127.0.0.1:5449/`. All six existing preview entries captured at 1672x941 and 1280x720, then visually inspected. Intentional evidence is `runtime-evidence/rebuild-{character,inventory,equipment,skill,alchemy,exploration}-{1672,1280}.png`.

Confirmed and repaired: old global inspector pseudo-elements painted light ivory behind newly light inspector text (alchemy/exploration), and character element labels/counts exceeded the stats viewport. Explicit scene rules suppress the conflicting pseudo-elements. Compact attribute/talent spacing plus measured 517px stats region keeps the entire element row visible. Browser measurement after repair: stats clientHeight 517 / scrollHeight 518; element row bottom is within viewport bottom, `elementsFit: true` at 1280x720.

Browser interactions exercised: character allocation button; inventory item selection and search yielding no items; skill node selection and upgrade; alchemy recipe selection, herb radio, brew and cancel; exploration cleared-stage selection, repeat mode and start; equipment bag selection opening forge, then wash tab. These prove preview wiring and reachable controls, not gameplay outcomes. Equipment/production adapter semantics also remain covered by the focused tests.

Console: zero errors. Equipment preview produced two browser AudioContext-before-gesture warnings from existing Tone startup. No audio code changed. Browser closed after inspection.

## Current aggregate source compatibility review

Reviewed the resulting six scene roots, collection stylesheet and their real `CharacterSurface`, `InventorySurface`, `EquipmentSurface`/`EquipmentPaperdollStage`, `SkillSurface`, `AlchemySurface` and `ExplorationSurface` consumers after the runtime repairs. Confirmed the shared projection is 1440x810; scene geometry stays within it. Production inventory continues to use canonical sections, not the preview inspector; production equipment summary remains present through its supplied slot. Equipment stage sizing still delegates to the existing dynamic paperdoll. Skill graph viewport remains 740x420 and uses the existing computed bounds. Exploration's shorter map uses its existing scroll owner so later chapter routes remain reachable. Timers, dialogs, notices, command predicates and domain operations stay in their unchanged owners. No new `any`, asset path bypass or domain dependency was introduced. `git diff --check` on six roots passed. No new confirmed source-compatibility defect remained on this owned surface. This is a worker source review, not the coordinator's full sequential review or aggregate approval.

## G5 handoff and limitations

The worker's visual implementation and focused evidence are ready for aggregate review. This report does not claim QA_FIXED_POINT_REACHED, merge readiness, production acceptance, or a completed OCR/adversarial/sequential review gate. Required remaining coordinator evidence: aggregate type/build/full tests, P18 OCR, production runtime acceptance at all target PC widths including 1920x1080, independent adversarial QA and sequential resulting-state reviews. Preview-only fixture commands and screenshots cannot substitute for production owner outcomes.
