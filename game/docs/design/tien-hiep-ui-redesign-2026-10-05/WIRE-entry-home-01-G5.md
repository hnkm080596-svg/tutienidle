# WIRE-entry-home-01 evidence

Worktree: E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx. Branch: codex/tien-hiep-ui-redesign. No commit/push performed. All initial dirty UI was task-owned by coordinator declaration.

## Responsibility and consumer proof

Presentation-only migration: opening shared control, creation continuous paper workspace, home warm landscape landmarks/HUD/rail. Existing AuthEntryScreen authentication, resume candidate, cross-account acknowledgement, busy/error and login focus are unchanged. CharacterCreationScreen retains name validation, service-owned talent offers/roll, exactly-one selection, draft validation/create, payload identity and busy/error/audio flow. Existing starter preview is retained pending user decision on approved design's unsupported selectable Dao Lo region; no pathway domain command added.

Home DongFuStage model remains the authority for resources, buildings, opportunities, tracked quest and admitted wheel actions. HomeContent preserves all action/toggleWheel/toggleBoard/upgrade event IDs and admissions. Upgrade chip still stops propagation. HUD replaces static character portrait with PlayerPortrait, which consumes existing user-owned runtime appearance. Authored resources map only known IDs; unknown resources retain their existing display glyph. Presentation icons use explicit semantic aliases with existing SVG fallback for unsupported identities.

Current production rail has 10 admitted entries: character, realm, skill, quest, teleport_array, pill_room, gathering_outpost, equipment_hall, scripture_pavilion, settings. The assignment's 11 count was not encoded: all actual model.actions remain available, including click-through locked intents to the existing admission owner.

Q1-Q12: observable auth/creation/home contracts preserved; domain/state/timing/async/persistence ownership unchanged; existing service and DongFuStage consumer chains retained; shared PcPaperScene/PcPaperButton/icon/resource primitives reused; no domain/core/store/service edits; fallback icon path retained solely for unsupported current semantic icons; completion requires coordinator aggregate review. U1/U3/U5/U6 checked via shared primitives/catalog/i18n/browser; no Phaser coordinate or gameplay rules changed.

## Changed owned files

- CharacterCreationScreen.vue: composition imports/template only; all existing handlers retained.
- LoginOpening.vue: shared paper begin button and approved opening geometry.
- DongFuHomeContent.vue: authored landmark banners, resource/icon consumers, simplified location label; prop/emit and interaction contracts retained.
- DongFuHud.vue: dynamic PlayerPortrait, authored known currency imagery.
- dongFuUi.ts: presentation icon aliases with fallback.
- tien-hiep-entry.css: approved continuous-paper creation and warm landscape geometry.

## Verification

Type-check PASS (latest full script/template state before final location-class-only styling).
Vitest AuthEntryScreen + DongFuHomeContent + DongFuWheel: 3 files / 14 tests PASS.
Vitest CharacterCreationScreen: 1 file / 3 tests PASS (name/talent emit payload and fixed starter-preview contract).

Actual Edge runtime from worktree server localhost:5449 PASS: begin reveals existing form and focuses auth-tab-login; guest enters creation; real name + real service talent creates character; finish fits viewport; home wheel opens and Escape closes; quest action opens real quest screen and Escape closes; zero pageerrors. Screenshots: runtime-evidence/wire-entry-{opening,auth,creation}.png and wire-home-{1280,1672,1920}.png. Screenshots visually inspected; initial creation tile CSS collision was found and repaired (specificity + explicit height) and rerun successfully.

Existing broader E2E `PC composition fits` reaches auth/creation/home/wheel and captures home, then fails at character assertion line115: cf-element-summary bottom665.94 > cf-stats bottom640.11. This belongs to character composition currently being migrated by another worker; reported to coordinator. No test weakened.

## Remaining limitations

Creation unsupported Dao Lo region requires user decision; implementation retains existing starter preview meanwhile. Coordinator owns aggregate P3/OCR/adversarial/sequential reviews and ledger closure; this report is slice evidence, not QA_FIXED_POINT_REACHED. Last location-label class cleanup requires refreshed home screenshots by coordinator (previous screenshot had inherited obsolete location plaque styling).
