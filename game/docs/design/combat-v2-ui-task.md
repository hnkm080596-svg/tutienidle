# Combat v2 — UI-only preview

## G0: approved boundary

Worktree `E:/tutienidle/.agent-worktrees/hk-login-fidelity`, branch `codex/hk-login-fidelity`. User explicitly approved Combat HUD only. Background system, background files, parallax, Phaser scene, entities, animation, gameplay and persistence are OUT OF SCOPE. Preview entry is `/ui-combat.html`; live battle remains unchanged.

The existing background asset catalog may be displayed statically by the preview host solely to judge HUD contrast. This is not a replacement renderer or a runtime background/parallax implementation. The HUD has no background dependency.

## G1: component responsibilities

- Q1: Player plate, encounter plaque, turn portraits, AI options and skill dock match the reference composition. UI controls only emit intents / change local fixtures.
- Q2/Q3: `CombatPreview` owns transient UI selection/notice/paused/auto. Remount resets; no storage, combat clock, random outcome or resource writes.
- Q4: `ui-combat.html` -> `combat.ts` -> preview -> `CombatFidelityScene` -> player/turn/controls components. No production caller migrated.
- Q5: Existing `SceneDesignCanvas` owns uniform scaling. Existing Dong Fu gold/ink 9-slice art is reused for rectangular chrome; new transparent ring supplies portrait/skill bezels.
- Q6/Q7: Props and events only. No Pinia, GameManager, Phaser or battle imports in fidelity components.
- Q8/Q9: Display strings and percentages supplied by model, never calculate authoritative damage/eligibility. All combat quantities are visibly labeled fixture data.
- Q10: Repeated UI actions have no domain consequences; no async subscription or timer is added.
- Q11: Existing CombatTopBar, CombatAiPanel, TurnOrderStrip and canvas player/enemy HUD stay live and unchanged. Preview must not be mounted alongside them in production; implementer chooses one renderer per surface later.
- Q12: Stop at reviewable UI, not runtime integration or release readiness. Verify types, focused input/output tests, real browser scale and click behavior. Broader QA remains implementer work per user direction.
- U1/U2: One 1440×810 artboard; native controls/focus, pointer-transparent overlay with pointer-enabled interactive regions.
- U3/U4: Asset URLs resolved through existing asset URL helper. No generated scene/character/skill icon art.
- U5/U6: Text via preview i18n; real browser checks on this worktree, no gameplay claims.

## Art / ImageGen built-in

New: `public/assets/ui/huyen-kim/scene/combat-v2/ornament-ring-v1.png`, genuinely transparent center/exterior requested.
Source: `exec-ecdc2456-57dd-4157-88be-59bc9fdb1307.png` in generated_images session `01a0f7b5-053f-71d0-a72c-75577519a956`.

Prompt: One front-facing reusable circular xianxia HUD frame, thin aged-gold engraved bezel, symmetrical cloud filigree at cardinal points, jade diamond crests, restrained warm highlights, large transparent central aperture and transparent exterior. No portrait, icon, text, numbers, scenery or additional objects. Square image, clean production illustration.

Rectangular panels use existing `scene/dong-fu-v2/panel-nine-slice.png` with 360 source-pixel slices and display border width supplied by each frame. Portrait rings scale uniformly, not by 9-slice.

## Plugin hooks

- UI-44 `CombatFidelityScene`: formatted encounter/player/turns/enemy plate data; commands emitted, no battle authority.
- UI-45 `CombatFidelityPlayer`: player name, level label, portrait, bars, effect labels, pips; read-only display.
- UI-46 `CombatFidelityTurns`: supplied order and current actor ID; host controls ordering and advancement.
- UI-47 `CombatFidelityControls`: strategy items/current id, auto/paused, skills with icon/state labels; strategy(id), auto, pause, skill(id), back. Host validates real commands later.
- UI-48 `CombatFidelityMeter`: formatted value + percentage + label/tone; clamping is visual only.
- UI-49 Enemy plates: host-provided screen anchors and display bars. Runtime projection is implementer-owned; fixture anchors do not replace Phaser projection.

No x2 speed, invented hotkeys, extra gameplay skills, sprite generation or background changes.

## Verification / handoff boundary

- `npm run type-check`: exit 0 on final UI state.
- `npx vitest run src/components/scenes/combat/fidelity/CombatFidelityMeter.test.ts`: 4 passed; red run previously rejected overflow, negative and NaN display percentages.
- Worktree server port 5606; Edge screenshots inspected at 1280×720 and 1920×1080. Evidence under `docs/qa/huyen-kim-reference-fidelity/evidence/combat-v2-1280.png` and `combat-v2-1920.png` (the latter includes the final reused sword/orb symbols).
- Browser: strategy changes; AI hide/reopen preserves selected strategy; auto/manual and pause/resume UI toggle; cooldown skill remains clickable; notice does not move skill dock. Console 0 errors / 0 warnings.
- `git diff --name-only -- src/presentation/background src/game/support/ThanhVanBackdrop.ts public/assets/backgrounds`: empty. Runtime background unchanged. Static background context is preview-only and does not certify runtime parallax.
- Existing `CreationSkillSymbol` reused for temporary skill visuals; `motif` may be omitted to use the host-supplied icon URL. No skill icon or entity art generated.
- QA full suite/build/OCR/adversarial/sequential release gates are NOT certified by this UI review. No claim of QA fixed point, integration completion or merge readiness; gameplay/QA remains implementer scope per user instruction.
