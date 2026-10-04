# Hỏa Cầu Thuật Fireball VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver editable Arcadia Tụ Hỏa and a complete, synchronized portal → charge → Fire 9 projectile → landed Fire 20 sequence for `hoa_cau_thuat` in Phaser.

**Architecture:** Keep the new effect source separate from game exports. Add a narrow fireball asset catalog and a pure visual timeline. A Phaser adapter owns sprites, while CombatScene passes admitted cast/resolve facts and the actual clip impact deadline; the existing runner alone owns mechanical ACK.

**Tech Stack:** Arcadia Effects JSON/Canvas2D, Node.js asset scripts, Vue/TypeScript, Phaser 4, Vitest.

**Spec:** `game/docs/superpowers/specs/2026-10-04-hoa-cau-thuat-fireball-vfx-design.md`

**Implementation note (after impact-marker gate):** The shared Pháp Tu basic
attack now has an authored clip-local release marker at frame 10, so the actual
impact ACK is 1312.5 ms. The implementation keeps charge at 550 ms, opens the
portal for 612.5 ms, releases at 1162.5 ms, and travels for 150 ms. The older
2062.5 ms examples below remain boundary tests for a longer played clip, not
the shipping basic-attack timing. Fire 9/20 use unchanged PNGs with new
BOM-free, occupied-frame-only metadata. Multi-target landed primary outcomes
each receive Fire 20.

## Global Constraints

- Scope only `hoa_cau_thuat` / `hoa_cau_comet`; no damage, targeting, character-art, or other-skill changes.
- Do not overwrite the supplied PNGs or the shared Fire 9/Fire 20 atlases; never play padded empty frames 27–31.
- Arcadia JSON is an editable, stable-ID source outside runtime assets. Export RGBA and keep source/export distinct.
- Cast admission and the actual played clip determine timing. Resolution facts determine whether Fire 20 appears. Renderer never acknowledges impact.
- Preserve all unrelated dirty files in the current checkout. Do not delete material files.

---

### Task 1: Arcadia Tụ Hỏa source and deterministic export

**Files:**
- Create: `E:/tutienidle-tools/arcadia-effects/Arcada Effects/library/Hoa Tu Charge.json`
- Create: `game/art/vfx/hoa-cau-thuat/Hoa Tu Charge.json` (source mirror for version control/cloud discovery)
- Create: `game/scripts/export-arcadia-charge.mjs`
- Create: `game/public/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.png`
- Create: `game/public/assets/vfx/hoa-cau-thuat/charge/hoa-tu-charge.json`
- Test: `game/tests/architecture/hoaCauChargeArt.test.ts`

**Interfaces:** Produces a 0.55 s, 18-frame RGBA sheet at 30 fps; `frame_0..frame_17` in Phaser atlas JSON, 192×192 cells. No projectile or portal pixels in this sheet.

- [ ] **Step 1: Write failing asset-contract test.** Assert the source mirror has `doc.id === 'fx_hoa_tu_charge'`, `doc.comp.dur === 0.55`, `doc.exp.mode === 'rgba'`, 18 atlas frames, and transparent corner pixels in the actual PNG. Assert release metadata is exactly 550 ms.
- [ ] **Step 2: Run red test.** `cd game; npx vitest run tests/architecture/hoaCauChargeArt.test.ts` must fail because outputs do not exist.
- [ ] **Step 3: Author new Arcadia JSON.** Choose five guided curved ember streams with deterministic seeds, short trails, a small compressing red/orange/yellow core, a restrained white-hot center and a final compact flash. Stable ids `fx_hoa_tu_charge`, `lr_hoa_tu_*`; no imported projectile, circle, explosion, or smoke. Read `CLAUDE.md`, `skills/afx-effect-authoring/SKILL.md`, `docs/FORMAT.md`, and nearest examples first. Do not modify editor engine/UI code.
- [ ] **Step 4: Validate and render.** `node tools/validate.mjs 'library/Hoa Tu Charge.json'`; use Arcadia's own `AFX.Atlas.build` via a Node Canvas-backed authoring/export script, or the editor's export control if the permitted UI surface works. The script must accept an Arcadia root argument, hydrate the source, build atlas with `mode:'rgba'`, and emit PNG plus Phaser frame JSON; never hand-paint output. Copy the validated JSON into the source mirror.
- [ ] **Step 5: Run green test and visual review.** Inspect at least start/middle/merge/release frames and alpha data. Rerun the exporter and compare hashes for deterministic output. Record any browser/visual access limitation rather than claiming an unseen Arcadia preview.

### Task 2: Portal and Fire sheet asset contract

**Files:**
- Create: `game/public/assets/vfx/hoa-cau-thuat/portal/mystic-portal-blood-{open,active,close}.png`
- Create: `game/public/assets/vfx/hoa-cau-thuat/portal/*.atlas.json`
- Create: `game/src/game/support/HoaCauVfxAssets.ts`
- Modify: `game/src/presentation/assets/AssetBundleCatalog.ts`
- Test: `game/tests/architecture/hoaCauVfxAssets.test.ts`

**Interfaces:** `HOA_CAU_VFX_ASSETS` lists portal open/active/close, charge, Fire 9 and Fire 20 with unique texture keys, URLs, frame prefixes and exact nonblank ranges. `hoaCauCombatDescriptors()` returns distinct `atlas` descriptors for the combat bundle.

- [ ] **Step 1: Write red test.** Check the descriptor list includes all six textures and resolves Fire 9/20 to the existing files. Read the PNGs and assert portal occupied counts 24/52/15, Fire occupied count 27 each, and no playback range references padded cells.
- [ ] **Step 2: Run red test.** `cd game; npx vitest run tests/architecture/hoaCauVfxAssets.test.ts` must fail on missing catalog or assets.
- [ ] **Step 3: Copy three portal PNGs into new versioned paths without changing their pixels.** Generate ordinary Phaser atlas JSON mapping 256×256 cells, OPEN `frame_1..frame_24`, ACTIVE `frame_0..frame_51`, CLOSE `frame_0..frame_14`. Do not rename or rewrite the Download originals.
- [ ] **Step 4: Implement `HoaCauVfxAssets.ts` and append its atlas descriptors to the combat bundle.** Reuse shared Fire 9/20 atlas JSON; do not edit it. Preserve existing bundle dedupe behavior.
- [ ] **Step 5: Run green and bundle parity tests.** `npx vitest run tests/architecture/hoaCauVfxAssets.test.ts src/presentation/assets/AssetBundleCatalog.test.ts`.

### Task 3: Pure fireball timeline and hit policy

**Files:**
- Create: `game/src/game/support/skill-vfx/HoaCauFireballTimeline.ts`
- Test: `game/src/game/support/skill-vfx/HoaCauFireballTimeline.test.ts`

**Interfaces:** `sampleHoaCauTimeline(elapsedMs, impactMs): { portal: 'open'|'active'|'close'|'none'; chargeFrame: number|null; projectileProgress: number|null }`; `resolveHoaCauImpact(groups): readonly ActorAnchorFact[]` returns only landed primary-hit targets. RELEASE_MS=1350, CHARGE_START_MS=800, CHARGE_DURATION_MS=550.

- [ ] **Step 1: Write red boundary tests.** At 799 ms portal is open, 800 ms charge frame starts, 1349 ms charge still owns center, 1350 ms Fire 9 begins at progress 0, `impactMs` has progress 1. For a 1400 ms fallback, scale phases without division-by-zero; for missing/invalid target outcome, explosion target list is empty.
- [ ] **Step 2: Run red test.** `npx vitest run src/game/support/skill-vfx/HoaCauFireballTimeline.test.ts` must fail for the missing module.
- [ ] **Step 3: Implement pure sampling.** Normalize the 800/550/travel proportions to the actual `impactMs`, preserving event order and exact phase boundaries; clamp out-of-range elapsed and avoid empty frames.
- [ ] **Step 4: Implement landed-only extraction from `SkillPresentationResolved.groups` without reading mutable combat state.** Deduplicate by `entityId`; ignore combo-only, missed, skipped and no-effect outcomes.
- [ ] **Step 5: Run green tests, including 2062.5 ms animated and fallback cases.**

### Task 4: Phaser presentation and CombatScene handoff

**Files:**
- Create: `game/src/game/support/skill-vfx/HoaCauFireballPresentation.ts`
- Modify: `game/src/game/scenes/CombatScene.ts`
- Modify: `game/src/data/vfx/SkillPresentationRecipes.ts`
- Test: `game/src/game/support/skill-vfx/HoaCauFireballPresentation.test.ts`
- Test: `game/src/game/scenes/CombatScene.combatAnimations.test.ts`
- Test: `game/src/data/vfx/SkillPresentationRecipes.test.ts`

**Interfaces:** Presentation `start(cast, impactMs)`, `update(deltaMs)`, `resolve(resolved)`, `cancel()`, `destroy()`. A surface adapter provides `anchor(fact)`, `createSprite(textureKey, frame)`, and `uprightDepth(fact)`; tests inspect real phase/texture/frame/position decisions, not mock existence. `CombatScene.onSkillCast` starts it only after `canStart` and clip selection; `onSkillResolved` supplies sealed facts; scene update and reset/shutdown cancel it.

- [ ] **Step 1: Write red tests.** Verify portal opens at source, charge starts only after full OPEN, Fire 9 spawns at charge end and reaches target at impact deadline, Fire 20 plays only on landed primary hit, cancellation destroys all live sprites, and generic `hoa_cau_comet` burst/aura is absent.
- [ ] **Step 2: Run red tests.** `npx vitest run src/game/support/skill-vfx/HoaCauFireballPresentation.test.ts src/game/scenes/CombatScene.combatAnimations.test.ts src/data/vfx/SkillPresentationRecipes.test.ts`.
- [ ] **Step 3: Implement the renderer with bounded sprites and no independent ACK/timer.** Frames are selected from elapsed time and occupied ranges; portal CLOSE overlaps Fire 9 travel. Aim Fire 9 toward the target; carry the last known anchor if an entity disappears; remove visuals on stale token/battle reset/scene shutdown.
- [ ] **Step 4: Wire the admitted cast and resolved facts in CombatScene and suppress only the generic `hoa_cau_comet` visuals.** Preserve the runner's existing `clipImpactMs` override and impact ACK. If no actor/target anchor, skip the visual safely while runner proceeds.
- [ ] **Step 5: Run green tests and nearby presentation/asset tests.**

### Task 5: Final production verification and handoff

**Files:** No new runtime files; update `game/docs/tooling/arcadia-effects.md` only if the actual export command or source-mirror path needs discovery.

- [ ] **Step 1: Re-run Arcadia validator and export determinism check.** Report exact source/export/meta paths and release at 550 ms relative to Tụ Hỏa, 1350 ms relative to cast start.
- [ ] **Step 2: Run `npm run type-check`, `npm run build-only`, focused Vitest suites, and `git diff --check` from the correct roots.** Distinguish pre-existing failures from regressions.
- [ ] **Step 3: Inspect production-scene playback at gameplay scale when an authorized preview surface is available.** Capture opening, gathering, release, travel and impact, including miss/cancel. If unavailable, explicitly mark runtime visual acceptance unverified.
- [ ] **Step 4: Review the diff to confirm no gameplay, shared Fire atlas, character art, or unrelated dirty files changed.** Report all six asset paths, exact timing, verification evidence, and remaining limitations.
