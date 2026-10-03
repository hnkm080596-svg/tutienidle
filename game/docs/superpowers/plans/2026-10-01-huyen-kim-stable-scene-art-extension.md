# Huyen Kim Stable Scene Art Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce nine reusable Huyen Kim scene-art packages, complete their production metadata and visual QA, then deliver a self-contained frontend/Devin handoff without wiring them into runtime.

**Architecture:** Organic scene anchors are generated as isolated raster layers, normalized deterministically to canonical `@1x` and `@2x` contracts, and combined only at runtime or in review-only composition boards. Auth/creation, realm, and skill backgrounds use aligned parallax stacks compatible with the existing Dong Fu/Thanh Van depth model; flattened masters remain provenance inputs, never production backgrounds. Stable symbols, meridian lines, and map chrome are authored deterministically as SVG/vector geometry. Runtime remains the sole owner of text, topology, state, interaction, animation, and frequently changing content.

**Tech Stack:** Built-in ImageGen, SVG, Node.js 22+, Sharp 0.34.5, JSON manifests, Markdown QA/handoff documentation.

**Spec:** `game/docs/superpowers/specs/2026-10-01-huyen-kim-stable-scene-art-extension-design.md`

## Global Constraints

- Work only in the attached worktree `C:/Users/hnkm0/.codex/worktrees/huyen-kim-ui-art/tutienidle` on branch `devin/huyen-kim-ui-art`.
- Do not modify production Vue, TypeScript, Phaser, gameplay data, or state ownership.
- Do not create entity spritesheets, portraits, technique illustrations, skill icons, pills, materials, item/equipment/reward icons, realm emblems, painted Son Ha geography, or animated VFX.
- Do not bake Vietnamese/English text, labels, numbers, logos, wordmarks, node counts, or mutable topology into production art.
- Use the user-provided reference scenes for style and composition only; repository contracts remain functional authority.
- Every raster deliverable is lossless sRGB PNG and has exact paired `@1x` / `@2x` dimensions.
- Runtime owns tint, selected/locked/disabled states, labels, nodes, paths, connectors, progress, animation, lightning, and content art.
- Background packages must preserve aligned canvases, depth ordering, bounded bleed for maximum drift, and zero offsets under reduced motion.
- Keep the existing 42-asset chrome pack and `scrollbar = HOLD` contract intact.
- Do not commit, push, merge, deploy, or wire frontend consumers without separate user authorization.

---

## File Map

### Planning, QA, and production metadata

- Create `game/docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art.json` — G0/G1 task intake for deterministic QA lesson routing.
- Create `game/docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art-brief.json` — generated construction brief and preflight evidence.
- Create `game/docs/design/huyen-kim-stable-scene-art-prompts.md` — exact normalized ImageGen prompt ledger and source-reference mapping.
- Modify `game/docs/design/huyen-kim-ui-art-manifest.json` — add nine package contracts and every production path.
- Modify `game/docs/design/huyen-kim-ui-art-production-report.md` — extend counts, provenance, QA evidence, exclusions, and status.
- Create `game/docs/design/huyen-kim-frontend-art-handoff.md` — consumer map and runtime/art ownership contract.
- Create `game/docs/design/huyen-kim-devin-art-handoff-prompt.md` — reusable Devin implementation prompt.

### Deterministic source and validation

- Create `game/public/assets/ui/huyen-kim/_source/stable-scene-extension.json` — canonical dimensions, alpha, crop, safe-area, and package metadata.
- Create `game/public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs` — normalize ImageGen sources, author vector-derived layers, export paired scales, validate geometry/alpha, and build previews.
- Create `game/public/assets/ui/huyen-kim/_source/generated/*.png` — selected original ImageGen results retained as provenance inputs.
- Create `game/public/assets/ui/huyen-kim/_source/stable-scene-extension-qa.json` — generated validation report.

### Production art

- Create `game/public/assets/ui/huyen-kim/symbols/*.svg` — 18 monochrome `24 x 24` symbols.
- Create `game/public/assets/ui/huyen-kim/scene/auth/{00-sky,01-far-mountains,02-mid-landscape,03-focal-architecture,04-low-mist,05-foreground}@1x.png` and paired `@2x` files — aligned `1672 x 941` / `3344 x 1882` parallax stack.
- Create `game/public/assets/ui/huyen-kim/scene/realm/{00-sky,01-far-mountains,02-mid-ascent,03-summit-architecture,04-low-mist}@1x.png` and paired `@2x` files — aligned `812 x 610` / `1624 x 1220` parallax stack.
- Create `game/public/assets/ui/huyen-kim/scene/body/body-cultivation-figure@1x.png` and `@2x.png` — `640 x 520` / `1280 x 1040`, transparent.
- Create `game/public/assets/ui/huyen-kim/scene/body/body-meridian-overlay@1x.png` and `@2x.png` — aligned dimensions, transparent deterministic geometry.
- Create `game/public/assets/ui/huyen-kim/scene/tribulation/tribulation-storm-far@1x.png`, `tribulation-storm-near@1x.png`, `tribulation-dais@1x.png`, `tribulation-sky-vignette@1x.png`, and paired `@2x` files — aligned `1672 x 941` / `3344 x 1882`, transparent.
- Create `game/public/assets/ui/huyen-kim/scene/equipment/equipment-paperdoll-base@1x.png` and `@2x.png` — `380 x 610` / `760 x 1220`, transparent.
- Create `game/public/assets/ui/huyen-kim/scene/map/exploration-map-frame@1x.png`, `exploration-map-mask@1x.png`, `exploration-chapter-divider@1x.png`, and paired `@2x` files — deterministic map chrome for `700 x 524`.
- Create `game/public/assets/ui/huyen-kim/scene/technique/technique-display-plinth@1x.png` and `@2x.png` — `448 x 480` / `896 x 960`, transparent.
- Create `game/public/assets/ui/huyen-kim/scene/skill/{00-sky,01-far-mountains,02-celestial-field,03-atmosphere}@1x.png` and paired `@2x` files — aligned `640 x 470` / `1280 x 940` parallax stack.

### Review-only previews

- Create `game/public/assets/ui/huyen-kim/preview/09-stable-symbols.png`.
- Create `game/public/assets/ui/huyen-kim/preview/10-scene-substrates.png`.
- Create `game/public/assets/ui/huyen-kim/preview/11-transparent-layer-kits.png`.
- Create `game/public/assets/ui/huyen-kim/preview/12-stable-scene-compositions.png`.
- Create `game/public/assets/ui/huyen-kim/preview/13-stable-scene-safe-areas.png`.
- Create `game/public/assets/ui/huyen-kim/preview/14-parallax-motion-qa.png`.

---

### Task 1: G0/G1 Intake and Construction Readiness

**Files:**
- Create: `game/docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art.json`
- Create: `game/docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art-brief.json`

**Interfaces:**
- Consumes: approved spec and current worktree HEAD `211a62e4b61c6686534cc2c3f07bc52e0a94a01f`.
- Produces: a preflight result with `readiness = READY_TO_DECLARE` before the first production-art write.

- [ ] **Step 1: Record the task card**

Create JSON with `taskId = "HK-STABLE-SCENE-ART-2026-10-01"`, applicability keys `ui-art`, `asset-pipeline`, `huyen-kim`, `image-generation`, requirement references to the approved spec and asset brief, invariants for text-free output, mutable-content exclusion, exact geometry, alpha, and no frontend wiring, plus nine named slices matching the nine deliverable packages.

- [ ] **Step 2: Pin source dependencies**

Calculate SHA-256 hashes for the approved spec, `huyen-kim-scene-layout-spec.md`, `huyen-kim-reference-audit.md`, `huyen-kim-ui-art-agent-brief.md`, and `huyen-kim-ui-art-manifest.json`; write them as `sha256:<hex>` source dependency revisions in the task card.

- [ ] **Step 3: Name the first proof obligation**

Set one `BEFORE_WRITE` obligation admitted by the `shared-contract` slice: the oracle is a manifest-driven validator proving exact dimensions, alpha mode, aligned paired scales, text-free production intent, and zero paths under gameplay-art directories.

- [ ] **Step 4: Run deterministic preparation**

Run from `game/`:

```powershell
npm run qa:internal -- prepare --task docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art.json --out docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art-brief.json
```

Expected: command exits 0 and writes the routed construction brief.

- [ ] **Step 5: Run preflight**

```powershell
npm run qa:internal -- preflight --brief docs/qa/tasks/2026-10-01-huyen-kim-stable-scene-art-brief.json
```

Expected: `readiness` reports `READY_TO_DECLARE`. Stop before production writes if blocked.

- [ ] **Step 6: Preserve the uncommitted checkpoint**

Run `git status --short` and confirm only the existing Huyen Kim task surface plus the approved spec, plan, and QA task files are present. Do not commit.

### Task 2: Canonical Extension Contract and Failing Validator

**Files:**
- Create: `game/public/assets/ui/huyen-kim/_source/stable-scene-extension.json`
- Create: `game/public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs`

**Interfaces:**
- Consumes: nine package definitions from the approved spec.
- Produces: `npm`-runnable Node script whose `--check` mode exits nonzero until every declared source/output exists and passes geometry/alpha rules.

- [ ] **Step 1: Write the canonical JSON contract**

Define every asset ID, package ID, source filename, output paths, `@1x` dimensions, alpha requirement, contain/cover crop mode, focal anchor, transparent margin, safe rectangle, scene consumers, reference image, runtime-owned fields, and exclusion list.

- [ ] **Step 2: Write the validator first**

Implement `--check` to load the contract, require all declared outputs, inspect each PNG with Sharp, verify exact dimensions/channels/alpha, verify `@2x` is exactly two times `@1x`, verify paired alpha bounding boxes within a two-pixel scaled tolerance, verify every parallax package has aligned canvases and unique depth indices, and scan production filenames/manifest strings for banned content categories.

- [ ] **Step 3: Prove the validator fails before assets exist**

Run from `game/`:

```powershell
node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check
```

Expected: nonzero exit listing the declared missing outputs, with no script exception.

- [ ] **Step 4: Add generation modes**

Implement `--build` for deterministic normalize/crop/pad/downscale, vector-derived meridian/map assets, contact sheets, safe-area boards, and JSON QA output. Preserve alpha and never upscale a source beyond the declared `@2x` target without recording it in QA metadata.

- [ ] **Step 5: Preserve the uncommitted checkpoint**

Run `git diff --check` and inspect the two new source files. Do not commit.

### Task 3: Stable SVG Symbol Set

**Files:**
- Create: `game/public/assets/ui/huyen-kim/symbols/{back,close,home,character,realm,skill,body,technique,inventory,exploration,alchemy,equipment,quest,settings,feedback,auto-farm,confirm,lock}.svg`

**Interfaces:**
- Consumes: `24 x 24`, monochrome, `currentColor`, no-text contract.
- Produces: 18 symbols readable at 20, 24, and 32 CSS pixels.

- [ ] **Step 1: Author one shared vector grammar**

Use `viewBox="0 0 24 24"`, round linecaps/joins, 1.7-1.9 stroke width, no embedded raster, no font glyphs, no fill except deliberate seal dots, and no hard-coded palette colors.

- [ ] **Step 2: Author all 18 semantic symbols**

Keep silhouettes distinct without encoding mutable gameplay content: navigation arrows, mountain/step realm abstraction, orbit/branch skill abstraction, seated-body abstraction, closed-scroll technique abstraction, bag, map fold, cauldron, armor stand, scroll quest, gear settings, message seal, circular auto arrow, check, and padlock.

- [ ] **Step 3: Add symbol validation to `--check`**

Require exactly 18 files; parse each as text; assert `viewBox="0 0 24 24"`, no `<text>`, no `<image>`, no `#` color literal, and at least one path/polyline/circle element.

- [ ] **Step 4: Generate and inspect `09-stable-symbols.png`**

Render every symbol at 20, 24, and 32 pixels against dark lacquer and ivory parchment swatches. Reject collapsed strokes, ambiguous silhouettes, and inconsistent optical weight.

- [ ] **Step 5: Preserve the uncommitted checkpoint**

Run the focused validator and `git diff --check`. Do not commit.

### Task 4: Prompt Ledger and Organic Raster Sources

**Files:**
- Create: `game/docs/design/huyen-kim-stable-scene-art-prompts.md`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/auth-creation-master.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/auth-creation-{00-sky,01-far-mountains,02-mid-landscape,03-focal-architecture,04-low-mist,05-foreground}.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/realm-ascent-master.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/realm-ascent-{00-sky,01-far-mountains,02-mid-ascent,03-summit-architecture,04-low-mist}.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/body-cultivation-figure.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/tribulation-storm-far.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/tribulation-storm-near.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/tribulation-dais.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/tribulation-sky-vignette.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/equipment-paperdoll-base.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/technique-display-plinth.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/skill-tree-master.png`
- Create: `game/public/assets/ui/huyen-kim/_source/generated/skill-tree-{00-sky,01-far-mountains,02-celestial-field,03-atmosphere}.png`

**Interfaces:**
- Consumes: local concept references `01`, `02`, `05`, `06`, `07`, `08`, `12`, and `13` as style/composition references.
- Produces: three clean masters, 15 aligned background-layer sources, seven independent cutout/atmosphere sources, and an exact prompt/provenance ledger.

- [ ] **Step 1: Write normalized prompts before generation**

For each source, record taxonomy `stylized-concept`, asset purpose, reference-image role, composition, Huyen Kim palette/materials, transparent/opaque requirement, negative-space contract, and explicit avoid list: no text, logo, UI controls, content icons, node topology, item art, watermark, clipped silhouette, or checkerboard.

- [ ] **Step 2: Generate three clean environmental masters**

Use built-in ImageGen with scene references: `01-login.jpg` + `02-character-creation.jpg` for the auth/creation master, `05-realm.jpg` for the realm master, and `07-skill.jpg` for the skill master. Masters contain no UI/content and are retained only as layer-extraction provenance.

- [ ] **Step 3: Extract aligned parallax layers**

Use each clean master as the edit target and issue one transparent extraction call per non-sky layer. Generate the sky as the only opaque layer. Preserve the source canvas, focal alignment, and edge bleed. Record depth/motion metadata matching the existing background contract: far layers move least, foreground layers move most, atmosphere may drift slowly, and reduced-motion uses zero offset.

- [ ] **Step 4: Generate the body and paperdoll cutouts**

Use `08-body.jpg` and `12-equipment.jpg` only as style/composition references. Request true transparent backgrounds, neutral identities, whole-body unclipped silhouettes, no equipment-specific art, and no semantic meridian nodes.

- [ ] **Step 5: Generate the tribulation layers separately**

Use `13-tribulation.jpg` as reference and issue one call per far storm, near storm, dais, and vignette layer. Require true transparency and layer isolation; no lightning bolts, characters, chains, text, meters, or UI.

- [ ] **Step 6: Generate the technique anchor**

Use `06-technique.jpg` for a transparent empty ritual plinth. Exclude scroll/book art, icons, nodes, endpoints, connectors, and fixed topology. Skill background art is already produced as the four-layer stack in Step 3.

- [ ] **Step 7: Inspect every selected source**

Use image inspection at original detail. Reject text-like glyphs, watermarks, nontransparent mattes, clipped silhouettes, fixed nodes/topology, content items, and style drift. Regenerate only the failed source with one targeted correction.

- [ ] **Step 8: Preserve the uncommitted checkpoint**

Confirm all 25 selected source paths exist and match the prompt ledger. Do not commit.

### Task 5: Normalize Raster Packages and Author Deterministic Layers

**Files:**
- Create all production files listed under `Production art` except the SVG symbol files.
- Modify: `game/public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs`

**Interfaces:**
- Consumes: ten selected ImageGen sources plus the canonical extension JSON.
- Produces: 26 paired-scale raster assets (52 PNG files) with exact geometry, including 15 parallax layers plus deterministic meridian and map chrome layers.

- [ ] **Step 1: Normalize aligned parallax stacks**

Normalize every auth, realm, and skill layer to its package canvas without independent reframing. Preserve focal alignment, negative-space zones, and declared bleed. The only opaque layer is `00-sky`; all upper layers retain true alpha.

- [ ] **Step 2: Normalize transparent cutouts**

Trim alpha, contain within declared transparent margins, align anchors, and composite onto exact transparent canvases for body, equipment, technique, and each tribulation layer.

- [ ] **Step 3: Author the meridian overlay**

Generate a transparent vector-derived overlay aligned to the body canvas: restrained aged-gold central channel, soft dantian rings, symmetric secondary branches, and no endpoints, named points, countable semantic nodes, labels, or chapter-specific state.

- [ ] **Step 4: Author exploration map chrome**

Generate frame, inner alpha mask, and two neutral chapter dividers for the `700 x 524` canvas. Keep the center transparent/neutral and include no geography, routes, landmarks, stage nodes, boss seals, or labels.

- [ ] **Step 5: Export paired scales**

Derive `@1x` from the normalized `@2x` result with Lanczos3 so paired composition and alpha alignment remain deterministic.

- [ ] **Step 6: Run the focused contract check**

```powershell
node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check
```

Expected: exact path, dimension, alpha, SVG, paired-scale, and banned-category checks pass.

- [ ] **Step 7: Visually inspect every production output**

Inspect `@2x` originals for clipping, transparency, text-like artifacts, content leakage, noisy centers, and palette mismatch. Apply targeted regeneration only when a defect cannot be safely corrected by normalization.

- [ ] **Step 8: Preserve the uncommitted checkpoint**

Run `git status --short` and confirm no production frontend/gameplay path appears. Do not commit.

### Task 6: Contact Sheets, Scene Boards, and Safe-Area Evidence

**Files:**
- Create: `game/public/assets/ui/huyen-kim/preview/09-stable-symbols.png`
- Create: `game/public/assets/ui/huyen-kim/preview/10-scene-substrates.png`
- Create: `game/public/assets/ui/huyen-kim/preview/11-transparent-layer-kits.png`
- Create: `game/public/assets/ui/huyen-kim/preview/12-stable-scene-compositions.png`
- Create: `game/public/assets/ui/huyen-kim/preview/13-stable-scene-safe-areas.png`
- Create: `game/public/assets/ui/huyen-kim/preview/14-parallax-motion-qa.png`
- Create: `game/public/assets/ui/huyen-kim/_source/stable-scene-extension-qa.json`

**Interfaces:**
- Consumes: all production outputs and canonical safe rectangles.
- Produces: visual evidence for package coherence, alpha isolation, layout compatibility, runtime-owned negative space, and bounded parallax motion.

- [ ] **Step 1: Build the substrate sheet**

Show every auth, realm, and skill layer separately and as a neutral-offset composite, with protected runtime regions outlined only in the preview.

- [ ] **Step 2: Build the transparent-layer sheet**

Show body figure/meridian alignment, equipment paperdoll, technique plinth, map chrome, and each tribulation layer separately on checker-neutral review backgrounds.

- [ ] **Step 3: Build composition boards**

Compose review-only scenes 01/02, 05, 06, 07, 08, 10, 12, and 14 using the new art plus wireframe placeholders for runtime-owned regions. Do not present these boards as production screenshots.

- [ ] **Step 4: Build the safe-area sheet**

Overlay declared content-safe rectangles, anchors, transparent margins, and runtime-owned node/text zones. Confirm decorations do not cross the protected regions.

- [ ] **Step 5: Write generated QA JSON**

Record per-file path, dimensions, alpha, alpha bounds, paired-scale result, safe-area result, parallax depth/motion/maximum drift, source provenance, and human visual-inspection status.

- [ ] **Step 6: Build and inspect parallax motion QA**

Render each background stack at neutral offset and both maximum drift extremes. Reject visible seams, broken occlusion, detached focal architecture, or layer motion that competes with runtime information.

- [ ] **Step 7: Inspect all six preview files**

Reject inconsistent gold/jade values, excess ornament, weak silhouette separation, content leaks, bad crops, or any scene where art competes with the runtime information hierarchy.

### Task 7: Manifest, Production Report, and Devin Handoff

**Files:**
- Modify: `game/docs/design/huyen-kim-ui-art-manifest.json`
- Modify: `game/docs/design/huyen-kim-ui-art-production-report.md`
- Create: `game/docs/design/huyen-kim-frontend-art-handoff.md`
- Create: `game/docs/design/huyen-kim-devin-art-handoff-prompt.md`

**Interfaces:**
- Consumes: canonical extension JSON and final QA JSON.
- Produces: exact downstream paths, consumers, runtime ownership, exclusion boundaries, and integration order.

- [ ] **Step 1: Extend the art manifest**

Add nine package records and every child output with exact dimensions, alpha, safe rectangles, anchors, `@1x/@2x` paths, consumers, state strategy, and source-reference IDs. Preserve all existing 43 inventory entries and `scrollbar = HOLD`.

- [ ] **Step 2: Extend the production report**

Update production counts, SVG/raster counts, ImageGen provenance, prompt-ledger path, package QA table, contact sheets, and explicit confirmation that volatile gameplay art remains zero.

- [ ] **Step 3: Write the frontend art handoff**

Map each package to scenes and suggested consumers, state whether to use `<img>`, CSS background, mask, or layered absolute positioning, and name every runtime-owned label/state/effect. State that this document is an integration contract, not proof of runtime wiring.

- [ ] **Step 4: Write the Devin prompt**

Instruct Devin to read the spec, extension manifest, scene layout, state matrix, frontend contract, production report, and handoff; integrate only the stable assets; keep all excluded content dynamic; obey Beta scope-hidden rules; run required Vue/Phaser/browser QA; and stop on contract mismatch rather than inventing topology.

- [ ] **Step 5: Verify metadata parity**

Run a script-assisted census proving every declared production file appears exactly once in the extension contract and manifest, every manifest path exists, and no output is omitted from the report/handoff.

### Task 8: Repository Gates and Sequential Final Review

**Files:**
- Modify only task-owned QA/report files if evidence needs recording.

**Interfaces:**
- Consumes: final aggregate uncommitted task state.
- Produces: evidence-backed readiness status for handoff, without commit/push/merge/deploy.

- [ ] **Step 1: Simplify and inspect the aggregate diff**

Remove duplicated generator logic, unused intermediate files, and inconsistent metadata while preserving the production contract. Run `git diff --check` and census every changed/untracked path.

- [ ] **Step 2: Run P3 full verification**

From `game/` run:

```powershell
npm run verify
```

Stop on first task-caused failure. Record any proven pre-existing failure separately; do not call the aggregate complete while a required gate is unavailable.

- [ ] **Step 3: Run the P18 OCR delegation gate**

Run `ocr delegate preview`, account for every reviewable file, resolve rules with `ocr delegate rule <paths>`, review the latest task diff, fix confirmed Medium-or-higher findings, rerun affected P3 evidence, and repeat OCR until the current state has zero unresolved confirmed Medium-or-higher findings.

- [ ] **Step 4: Evaluate P13/P14 applicability**

Record P13/P14 as not triggered only if no production consumer is wired. Use the five visual review sheets as art evidence, not as runtime proof.

- [ ] **Step 5: Run P4 art-boundary adversarial QA**

Use the `tutienidle-adversarial-qa` quick gate against the final asset/docs surface. Attack volatile-content leakage, text baking, wrong ownership, geometry mismatch, stale manifest paths, alpha failure, and hidden frontend modifications.

- [ ] **Step 6: Run Sequential Review Pass 1**

Review local correctness/regression on the post-OCR state. Validate every finding, fix confirmed Medium-or-higher defects, and rerun affected verification before Pass 2.

- [ ] **Step 7: Run Sequential Review Pass 2**

Review the state produced after Pass 1 for architecture/authority/ownership: art versus runtime boundaries, source-of-truth duplication, asset contract stability, and unintended dependency changes. Fix and reverify before Pass 3.

- [ ] **Step 8: Run Sequential Review Pass 3**

Adversarially review the state produced after Pass 2 across consumers, manifest/report/path parity, repeatable generation, clean-clone behavior, responsive crop assumptions, and handoff completeness. Any Medium-or-higher fix forces another resulting-state pass.

- [ ] **Step 9: Render the final readiness report**

Report exact DONE/HOLD/BLOCKED counts, raster/SVG totals, contact sheets, verification commands/results, OCR coverage, P4 verdict, sequential pass chronology, unresolved Low/Nit items, and whether the package is ready for frontend integration.

- [ ] **Step 10: Stop before Git/external mutations**

Do not commit, push, merge, deploy, or message another task. Ask the user for explicit commit/handoff authorization after presenting the verified results and Devin prompt.
