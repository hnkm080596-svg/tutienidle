# Huyền Kim Sơn Thủy — UI Art Production Report

## Scope and authority

- Forensic source commit: `211a62e4b61c6686534cc2c3f07bc52e0a94a01f`.
- Source inventory: `game/docs/design/huyen-kim-ui-asset-inventory.json`.
- Stable scene extension contract: `game/public/assets/ui/huyen-kim/_source/stable-scene-extension.json`.
- Output is UI chrome and stable scene substrate only. It contains no frontend/gameplay code, no gameplay-identity art, and no Sơn Hà painted geography substrate.
- `scrollbar` remains `HOLD` exactly as ruled by the forensic package.

## Delivery summary

- Core chrome inventory rows: 43.
- Core chrome DONE: 42; HOLD: 1; NOT_REQUIRED: 0; BLOCKED: 0.
- Stable scene extension: 9 packages, 26 raster assets, 18 SVG symbols; DONE: 44; HOLD: 0; BLOCKED: 0.
- Production files: 154 total — 84 core chrome PNGs, 52 stable scene PNGs, and 18 SVG symbols.
- Preview/contact-sheet files: 15.
- Runtime/CSS-only effects: 12, all `NOT_REQUIRED` as raster art.
- No production asset contains baked text. Labels appear only in QA contact sheets.
- Every tintable sheet is exported in grayscale; runtime owns tint, opacity, glow, masks, and motion states.
- Volatile content remains intentionally excluded: entity spritesheets/portraits, technique illustrations, skill icons/topology, pill/material/item/equipment/reward icons, realm/quest/stage/boss/chapter art, Sơn Hà geography, and animated VFX.

## Production method and provenance

- Deterministic vector geometry is rasterized by `public/assets/ui/huyen-kim/_source/generate-pack.mjs` for exact dimensions, repeatable 2x output, alpha, margins, and 9-slice seams.
- `alchemy-cauldron-prop` uses an AI-generated organic source illustration, then is trimmed, contained, and padded deterministically to the inventory contract. It remains a decorative UI scene prop with no gameplay identity.
- Stable organic scene layers are authored with built-in ImageGen from the approved concept references, then normalized and paired deterministically by `public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs`.
- Auth/creation, realm, and skill backgrounds are aligned parallax stacks. Their flattened masters are provenance inputs only and are not production/runtime assets.
- Stable meridian and map chrome layers are deterministic vector-derived outputs. Runtime owns all named points, nodes, routes, geography, labels, state, interaction, and motion.
- Existing `public/assets/ui/ink-wash/**` assets were audited as interim references. Dedicated Huyền Kim replacements are exported for every drawable inventory row so the pack has one coherent material language.

### Existing-asset audit

| Canonical asset | Existing candidate | Decision | Mismatch / reason |
|---|---|---|---|
| frame-s-slot | `public/assets/ui/ink-wash/slices/frame-s-slot@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| surface-m-panel | `public/assets/ui/ink-wash/slices/surface-m-paper@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| frame-m-modal | `public/assets/ui/ink-wash/slices/frame-m-seal-corner@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| surface-l-drawer | `public/assets/ui/ink-wash/slices/surface-l-ink-data@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| surface-xl-scroll | `public/assets/ui/ink-wash/slices/surface-xl-paper-scroll@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| frame-xl-ceremony | `public/assets/ui/ink-wash/slices/frame-xl-ceremony@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| button-standard | `public/assets/ui/ink-wash/slices/button-s-paper@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| button-ceremonial | `public/assets/ui/ink-wash/slices/button-s-seal@1x.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| divider-ornament | `public/assets/ui/divider-glow.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |
| cloud-ornament | `public/assets/ui/ink-wash/overlays/wash-bottom-mist.png` | REPLACED | Interim ink-wash source does not meet the dedicated Huyền Kim material richness, exact geometry, or paired @1x/@2x export contract. |

## QA evidence

- Automated export checks: exact dimensions, RGBA alpha channel, declared transparent margins, and grayscale parity for tintable sheets.
- 9-slice QA renders every scalable 9-slice entry at inventory minimum, nominal, and maximum expected size; undersized minima proportionally compress corner slices instead of cropping them. Entries declared `scalable_axes: none` use whole-image scaling at the same three checkpoints.
- Contact sheets:
  - `public/assets/ui/huyen-kim/preview/01-p0-foundation.png`
  - `public/assets/ui/huyen-kim/preview/02-shared-functional.png`
  - `public/assets/ui/huyen-kim/preview/03-slots-nodes-hud.png`
  - `public/assets/ui/huyen-kim/preview/03-specialized.png`
  - `public/assets/ui/huyen-kim/preview/04-combat-ceremony.png`
  - `public/assets/ui/huyen-kim/preview/05-scene-specials.png`
  - `public/assets/ui/huyen-kim/preview/06-complete-ui-art-pack.png`
  - `public/assets/ui/huyen-kim/preview/07-nine-slice-qa.png`
  - `public/assets/ui/huyen-kim/preview/08-safe-area-qa.png`
  - `public/assets/ui/huyen-kim/preview/09-stable-symbols.png`
  - `public/assets/ui/huyen-kim/preview/10-scene-substrates.png`
  - `public/assets/ui/huyen-kim/preview/11-transparent-layer-kits.png`
  - `public/assets/ui/huyen-kim/preview/12-stable-scene-compositions.png`
  - `public/assets/ui/huyen-kim/preview/13-stable-scene-safe-areas.png`
  - `public/assets/ui/huyen-kim/preview/14-parallax-motion-qa.png`

### Stable scene extension QA

- Automated extension validator: PASS — 26 raster assets, 52 exact-size PNGs, 18 structurally valid SVG symbols.
- Alpha contract: PASS — opaque `L0` sky in every parallax stack; true-alpha upper layers and independent cutouts.
- Paired-scale contract: PASS — every `@2x` canvas and alpha bound matches its `@1x` source at exact 2x scale within declared tolerance.
- Parallax contract: PASS — aligned canvas per stack, unique contiguous depth/order, nondecreasing drift, and zero reduced-motion offset.
- Banned-content path scan: PASS — no production output category or filename introduces excluded volatile content.
- Human visual inspection: PASS — layer sheets, neutral composites, safe-area overlays, and maximum positive/negative drift inspected. The first skill celestial-field candidate was rejected because discrete points could be mistaken for runtime nodes; the replacement contains no countable topology.
- Frontend handoff: `docs/design/huyen-kim-frontend-art-handoff.md`.
- Devin implementation prompt: `docs/design/huyen-kim-devin-art-handoff-prompt.md`.

### Current stable scene extension completion evidence

- Deterministic extension check: PASS — 26 raster assets, 52 PNG files, 18 currentColor SVG symbols, zero missing outputs, and zero banned volatile-content paths.
- Parallax acceptance: PASS — 15 layers across three aligned stacks; unique contiguous depth/order; bounded nondecreasing drift; exact zero reduced-motion offset; original-detail inspection of neutral and both maximum-drift extremes found no exposed seams.
- Evidence freshness: PASS — all six visual-review boards are SHA-256 pinned. An isolated one-byte mutation of the parallax board was rejected with exit code 1, so an old human-inspection PASS cannot survive changed art.
- Generator replay safety: PASS — an isolated clean-root run created its own output directories, retained the stable-scene extension in the shared manifest, retained aggregate count 154, and byte-preserved the integrated production report.
- Full P3 command: type-check PASS and production build PASS; Vitest 862/863 files and 7873 tests passed, with five expected failures. The sole failing file is the baseline stale `BENIGN` registry row for `MaterialBagSection.vue :: post-beta-realm`; neither the test nor component is task-owned.
- OCR latest-state pass: 7/7 reviewable files reviewed, 0 skipped, 100% reviewable coverage, and zero unresolved confirmed Medium-or-higher findings. The 200 excluded Markdown/SVG/binary paths were routed to document inspection, structural SVG validation, exact manifest census, hash pins, and original-detail visual boards.
- Adversarial QA quick: PASS WITH EVIDENCE — see `docs/qa/2026-10-02-huyen-kim-stable-scene-art-quick.md`. The 207 task paths are static art/docs/pipeline files with no runtime ownership or lifecycle transition; browser integration remains a required gate for the later Devin implementation, not evidence claimed by this art-only task.
- P13/P14 are not triggered in this task because no frontend or Phaser consumer is added. Static visual boards are art evidence only and are not described as runtime proof.

### Prior core chrome verification status

The evidence below predates the stable scene extension and is retained for the unchanged core chrome pack. It is not presented as current verification of the extension.

- Independent geometry audit: PASS — 43 inventory rows, 42 DONE assets, 1 HOLD, 84 production PNG files, 52 grayscale file checks, and 124 declared transparent-margin region checks.
- Production build: PASS after the final asset changes.
- Focused Huyền Kim / ink-wash / 9-slice tests: PASS — 5 files, 16 tests.
- Full `npm run verify`: type-check PASS, build PASS, 862/863 Vitest files passed (7873 tests passed, 5 expected failures). The sole failure is a stale `BENIGN` registry row for `MaterialBagSection.vue :: post-beta-realm`; both the source absence and stale test entry exist at canonical HEAD and neither file is task-owned.
- OCR delegation clean pass: 2/2 reviewable files reviewed, 0 skipped, 100% coverage; 92 binary files and this Markdown report were tool-excluded with explicit type reasons and reviewed through pixel audits, contact sheets, and direct document inspection.
- P14 runtime wiring is not triggered: this mission intentionally adds no frontend consumer. Visual evidence is the nine contact sheets, including min/nominal/max 9-slice and safe-area overlays.
- Adversarial QA quick scope: PASS WITH EVIDENCE for the art-only boundary. The risk mapper classified all paths as unmapped static art/docs; manual routing found no mutable state, lifecycle, persistence, or gameplay authority transition.
- Independent isolated-review evidence is unavailable in this run; sequential reviews below are same-context reviews and do not claim independent-review provenance.

### Prior core chrome sequential review evidence

Sequential Review Pass 1
  Reviewed state: post-OCR implementation state
  Findings: Medium — checkpoint sheets did not demonstrate every brief-mandated family; Medium — shared chrome was too close to generic dark rectangles.
  Fixes: rebuilt Checkpoints A/B/C around the required family lists; added bounded cloud engraving, cultivation end-caps, a jade-slip tab silhouette, and an ancient boss crest.
  Verification: contact sheets visually re-inspected; exporter geometry checks passed.

Sequential Review Pass 2
  Reviewed state after Pass 1 fixes: YES
  Findings: Medium — some corner motifs could cross 9-slice inset boundaries; Medium — the divider center motif distorted at maximum width.
  Fixes: clamped corner motifs to canonical insets; removed stretch-zone seals; made divider center stretch-safe and kept ornaments in fixed end caps.
  Verification: min/nominal/max sheet re-rendered and visually inspected; production build and focused tests passed.

Sequential Review Pass 3
  Reviewed state after Pass 2 fixes: YES
  Findings: Medium — 12 runtime-only effects and explicit existing-asset decisions were missing from frontend handoff metadata.
  Fixes: added manifest/runtime-only records and a report audit table without creating extra raster assets.
  Verification: inventory/manifest parity and path audit passed.

Sequential Review Pass 4
  Reviewed state after Pass 3 fixes: YES
  Findings: Medium — no visual safe-area oracle; the first overlay exposed ornament overlap in node, boss, ceremony, portrait, and skill-icon regions.
  Fixes: added `08-safe-area-qa.png`; cleared runtime icon/text recesses, shifted labelled nodes, and moved boss/ceremony ornament outside text-safe rectangles.
  Verification: safe-area sheet visually inspected; geometry, alpha, margin, grayscale, build, and focused tests re-run.

Sequential Review Pass 5
  Reviewed state after Pass 4 fixes: YES
  Findings: no confirmed Critical/High/Medium/Low/Nit finding in the task-owned art and handoff surface.
  Fixes: none.
  Verification: final independent audit, OCR coverage, production build, focused tests, boundary scan, and contact-sheet inspection.

## Asset ledger

| Asset ID | Priority | Status | Production paths | Runtime state strategy |
|---|---:|---|---|---|
| frame-xs-tooltip | P1 | DONE | public/assets/ui/huyen-kim/frames/frame-xs-tooltip@1x.png<br>public/assets/ui/huyen-kim/frames/frame-xs-tooltip@2x.png | grayscale + runtime tint (--hk-gold / --hk-cinnabar) |
| frame-s-slot | P0 | DONE | public/assets/ui/huyen-kim/slots/frame-s-slot@1x.png<br>public/assets/ui/huyen-kim/slots/frame-s-slot@2x.png | grayscale + rarity tint |
| surface-m-panel | P0 | DONE | public/assets/ui/huyen-kim/surfaces/surface-m-panel@1x.png<br>public/assets/ui/huyen-kim/surfaces/surface-m-panel@2x.png | fixed colors; state overlays are runtime |
| frame-m-modal | P0 | DONE | public/assets/ui/huyen-kim/frames/frame-m-modal@1x.png<br>public/assets/ui/huyen-kim/frames/frame-m-modal@2x.png | fixed colors |
| surface-l-drawer | P0 | DONE | public/assets/ui/huyen-kim/surfaces/surface-l-drawer@1x.png<br>public/assets/ui/huyen-kim/surfaces/surface-l-drawer@2x.png | fixed colors |
| surface-xl-scroll | P0 | DONE | public/assets/ui/huyen-kim/scroll/surface-xl-scroll@1x.png<br>public/assets/ui/huyen-kim/scroll/surface-xl-scroll@2x.png | fixed colors; victory/defeat differ by ceremony ribbon + tint overlay |
| frame-xl-ceremony | P0 | DONE | public/assets/ui/huyen-kim/frames/frame-xl-ceremony@1x.png<br>public/assets/ui/huyen-kim/frames/frame-xl-ceremony@2x.png | fixed colors; defeat/alert = runtime cinnabar tint layer |
| button-compact | P0 | DONE | public/assets/ui/huyen-kim/buttons/button-compact@1x.png<br>public/assets/ui/huyen-kim/buttons/button-compact@2x.png | grayscale + runtime tint/opacity/scale |
| button-standard | P0 | DONE | public/assets/ui/huyen-kim/buttons/button-standard@1x.png<br>public/assets/ui/huyen-kim/buttons/button-standard@2x.png | grayscale + runtime tint/opacity |
| button-ceremonial | P0 | DONE | public/assets/ui/huyen-kim/buttons/button-ceremonial@1x.png<br>public/assets/ui/huyen-kim/buttons/button-ceremonial@2x.png | grayscale + gold/jade/cinnabar tint + breath glow |
| icon-button-utility | P0 | DONE | public/assets/ui/huyen-kim/buttons/icon-button-utility@1x.png<br>public/assets/ui/huyen-kim/buttons/icon-button-utility@2x.png | grayscale + tint; dot = runtime |
| seal-chip | P1 | DONE | public/assets/ui/huyen-kim/badges/seal-chip@1x.png<br>public/assets/ui/huyen-kim/badges/seal-chip@2x.png | grayscale + rank/tone tint |
| resource-pill | P0 | DONE | public/assets/ui/huyen-kim/hud/resource-pill@1x.png<br>public/assets/ui/huyen-kim/hud/resource-pill@2x.png | fixed capsule; runtime scale pop + cinnabar flash |
| entity-bar | P0 | DONE | public/assets/ui/huyen-kim/bars/entity-bar@1x.png<br>public/assets/ui/huyen-kim/bars/entity-bar@2x.png | grayscale track + runtime fill gradient + tint (jade/cinnabar) |
| divider-ornament | P1 | DONE | public/assets/ui/huyen-kim/ornaments/divider-ornament@1x.png<br>public/assets/ui/huyen-kim/ornaments/divider-ornament@2x.png | grayscale + tint |
| scrollbar | P3 | HOLD | — | grayscale + tint |
| dao-luan-center | P0 | DONE | public/assets/ui/huyen-kim/nodes/dao-luan-center@1x.png<br>public/assets/ui/huyen-kim/nodes/dao-luan-center@2x.png | fixed colors + runtime glow overlay |
| dao-luan-node | P0 | DONE | public/assets/ui/huyen-kim/nodes/dao-luan-node@1x.png<br>public/assets/ui/huyen-kim/nodes/dao-luan-node@2x.png | grayscale + runtime tint + dot |
| rune-node | P0 | DONE | public/assets/ui/huyen-kim/nodes/rune-node@1x.png<br>public/assets/ui/huyen-kim/nodes/rune-node@2x.png | grayscale + tint per state; lock glyph runtime |
| tab-seal | P1 | DONE | public/assets/ui/huyen-kim/tabs/tab-seal@1x.png<br>public/assets/ui/huyen-kim/tabs/tab-seal@2x.png | grayscale + tint; selected = jade fill + gold edge |
| imperial-scroll-body | P0 | DONE | public/assets/ui/huyen-kim/scroll/imperial-scroll-body@1x.png<br>public/assets/ui/huyen-kim/scroll/imperial-scroll-body@2x.png | fixed colors |
| imperial-scroll-roller | P0 | DONE | public/assets/ui/huyen-kim/scroll/imperial-scroll-roller@1x.png<br>public/assets/ui/huyen-kim/scroll/imperial-scroll-roller@2x.png | fixed colors; reveal anim is runtime transform+mask |
| scroll-title-plaque | P0 | DONE | public/assets/ui/huyen-kim/plaques/scroll-title-plaque@1x.png<br>public/assets/ui/huyen-kim/plaques/scroll-title-plaque@2x.png | fixed colors |
| section-plaque | P1 | DONE | public/assets/ui/huyen-kim/plaques/section-plaque@1x.png<br>public/assets/ui/huyen-kim/plaques/section-plaque@2x.png | fixed colors |
| nav-seal-vertical | P0 | DONE | public/assets/ui/huyen-kim/tabs/nav-seal-vertical@1x.png<br>public/assets/ui/huyen-kim/tabs/nav-seal-vertical@2x.png | grayscale + tint; selected = gold edge + jade core glow |
| list-row | P0 | DONE | public/assets/ui/huyen-kim/list/list-row@1x.png<br>public/assets/ui/huyen-kim/list/list-row@2x.png | grayscale + tint; selected adds left-edge seal marker (runtime) |
| avatar-frame | P0 | DONE | public/assets/ui/huyen-kim/hud/avatar-frame@1x.png<br>public/assets/ui/huyen-kim/hud/avatar-frame@2x.png | fixed colors + runtime ring tint |
| identity-plate | P0 | DONE | public/assets/ui/huyen-kim/hud/identity-plate@1x.png<br>public/assets/ui/huyen-kim/hud/identity-plate@2x.png | grayscale + tint |
| text-field | P0 | DONE | public/assets/ui/huyen-kim/forms/text-field@1x.png<br>public/assets/ui/huyen-kim/forms/text-field@2x.png | grayscale + tint (focus gold, invalid cinnabar) |
| toggle-track | P1 | DONE | public/assets/ui/huyen-kim/settings/toggle-track@1x.png<br>public/assets/ui/huyen-kim/settings/toggle-track@2x.png | grayscale + jade/gold tint for on |
| slider-track | P1 | DONE | public/assets/ui/huyen-kim/settings/slider-track@1x.png<br>public/assets/ui/huyen-kim/settings/slider-track@2x.png | grayscale + fill gradient runtime |
| slider-thumb | P1 | DONE | public/assets/ui/huyen-kim/settings/slider-thumb@1x.png<br>public/assets/ui/huyen-kim/settings/slider-thumb@2x.png | grayscale + tint |
| skill-orb-frame | P0 | DONE | public/assets/ui/huyen-kim/combat/skill-orb-frame@1x.png<br>public/assets/ui/huyen-kim/combat/skill-orb-frame@2x.png | grayscale + tint + cooldown sweep mask + cost badge runtime |
| turn-token | P1 | DONE | public/assets/ui/huyen-kim/combat/turn-token@1x.png<br>public/assets/ui/huyen-kim/combat/turn-token@2x.png | grayscale + faction tint + gauge fill runtime |
| boss-seal | P1 | DONE | public/assets/ui/huyen-kim/badges/boss-seal@1x.png<br>public/assets/ui/huyen-kim/badges/boss-seal@2x.png | fixed colors; defeated = jade check overlay runtime |
| stage-node | P0 | DONE | public/assets/ui/huyen-kim/map-ui/stage-node@1x.png<br>public/assets/ui/huyen-kim/map-ui/stage-node@2x.png | grayscale + state tint + mist overlay for locked |
| building-plaque | P1 | DONE | public/assets/ui/huyen-kim/plaques/building-plaque@1x.png<br>public/assets/ui/huyen-kim/plaques/building-plaque@2x.png | fixed colors + runtime state ring |
| corner-ornament | P2 | DONE | public/assets/ui/huyen-kim/ornaments/corner-ornament@1x.png<br>public/assets/ui/huyen-kim/ornaments/corner-ornament@2x.png | grayscale + tint |
| cloud-ornament | P3 | DONE | public/assets/ui/huyen-kim/ornaments/cloud-ornament@1x.png<br>public/assets/ui/huyen-kim/ornaments/cloud-ornament@2x.png | grayscale + opacity/drift anim |
| timer-ring | P1 | DONE | public/assets/ui/huyen-kim/combat/timer-ring@1x.png<br>public/assets/ui/huyen-kim/combat/timer-ring@2x.png | grayscale + tint + runtime arc |
| ceremony-ribbon | P1 | DONE | public/assets/ui/huyen-kim/ceremony/ceremony-ribbon@1x.png<br>public/assets/ui/huyen-kim/ceremony/ceremony-ribbon@2x.png | fixed colors + runtime cinnabar/gold tint overlay |
| paper-grain-tile | P3 | DONE | public/assets/ui/huyen-kim/textures/paper-grain-tile@1x.png<br>public/assets/ui/huyen-kim/textures/paper-grain-tile@2x.png | grayscale low-contrast + opacity |
| alchemy-cauldron-prop | P2 | DONE | public/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@1x.png<br>public/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png | fixed colors; brewing state = runtime ember/mist overlay (CSS glow), never a second raster |

## Stable scene extension asset ledger

| Package | Asset ID | @1x path | @2x path | Alpha | Parallax |
|---|---|---|---|---|---|
| auth-creation-vista | auth-creation-00-sky | `public/assets/ui/huyen-kim/scene/auth/00-sky@1x.png` | `public/assets/ui/huyen-kim/scene/auth/00-sky@2x.png` | no | L0 / static / ±0,±0px |
| auth-creation-vista | auth-creation-01-far-mountains | `public/assets/ui/huyen-kim/scene/auth/01-far-mountains@1x.png` | `public/assets/ui/huyen-kim/scene/auth/01-far-mountains@2x.png` | yes | L1 / far-slow / ±4,±2px |
| auth-creation-vista | auth-creation-02-mid-landscape | `public/assets/ui/huyen-kim/scene/auth/02-mid-landscape@1x.png` | `public/assets/ui/huyen-kim/scene/auth/02-mid-landscape@2x.png` | yes | L2 / mid / ±8,±4px |
| auth-creation-vista | auth-creation-03-focal-architecture | `public/assets/ui/huyen-kim/scene/auth/03-focal-architecture@1x.png` | `public/assets/ui/huyen-kim/scene/auth/03-focal-architecture@2x.png` | yes | L3 / ground / ±10,±5px |
| auth-creation-vista | auth-creation-04-low-mist | `public/assets/ui/huyen-kim/scene/auth/04-low-mist@1x.png` | `public/assets/ui/huyen-kim/scene/auth/04-low-mist@2x.png` | yes | L4 / mist-slow / ±12,±6px |
| auth-creation-vista | auth-creation-05-foreground | `public/assets/ui/huyen-kim/scene/auth/05-foreground@1x.png` | `public/assets/ui/huyen-kim/scene/auth/05-foreground@2x.png` | yes | L5 / foreground / ±18,±9px |
| realm-ascent-vista | realm-ascent-00-sky | `public/assets/ui/huyen-kim/scene/realm/00-sky@1x.png` | `public/assets/ui/huyen-kim/scene/realm/00-sky@2x.png` | no | L0 / static / ±0,±0px |
| realm-ascent-vista | realm-ascent-01-far-mountains | `public/assets/ui/huyen-kim/scene/realm/01-far-mountains@1x.png` | `public/assets/ui/huyen-kim/scene/realm/01-far-mountains@2x.png` | yes | L1 / far-slow / ±3,±2px |
| realm-ascent-vista | realm-ascent-02-mid-ascent | `public/assets/ui/huyen-kim/scene/realm/02-mid-ascent@1x.png` | `public/assets/ui/huyen-kim/scene/realm/02-mid-ascent@2x.png` | yes | L2 / mid / ±6,±3px |
| realm-ascent-vista | realm-ascent-03-summit-architecture | `public/assets/ui/huyen-kim/scene/realm/03-summit-architecture@1x.png` | `public/assets/ui/huyen-kim/scene/realm/03-summit-architecture@2x.png` | yes | L3 / ground / ±8,±4px |
| realm-ascent-vista | realm-ascent-04-low-mist | `public/assets/ui/huyen-kim/scene/realm/04-low-mist@1x.png` | `public/assets/ui/huyen-kim/scene/realm/04-low-mist@2x.png` | yes | L4 / mist-slow / ±10,±5px |
| body-diagram-kit | body-cultivation-figure | `public/assets/ui/huyen-kim/scene/body/body-cultivation-figure@1x.png` | `public/assets/ui/huyen-kim/scene/body/body-cultivation-figure@2x.png` | yes | — |
| body-diagram-kit | body-meridian-overlay | `public/assets/ui/huyen-kim/scene/body/body-meridian-overlay@1x.png` | `public/assets/ui/huyen-kim/scene/body/body-meridian-overlay@2x.png` | yes | — |
| tribulation-environment-kit | tribulation-storm-far | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-storm-far@1x.png` | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-storm-far@2x.png` | yes | — |
| tribulation-environment-kit | tribulation-storm-near | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-storm-near@1x.png` | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-storm-near@2x.png` | yes | — |
| tribulation-environment-kit | tribulation-dais | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-dais@1x.png` | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-dais@2x.png` | yes | — |
| tribulation-environment-kit | tribulation-sky-vignette | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-sky-vignette@1x.png` | `public/assets/ui/huyen-kim/scene/tribulation/tribulation-sky-vignette@2x.png` | yes | — |
| equipment-paperdoll-base | equipment-paperdoll-base | `public/assets/ui/huyen-kim/scene/equipment/equipment-paperdoll-base@1x.png` | `public/assets/ui/huyen-kim/scene/equipment/equipment-paperdoll-base@2x.png` | yes | — |
| exploration-map-chrome-kit | exploration-map-frame | `public/assets/ui/huyen-kim/scene/map/exploration-map-frame@1x.png` | `public/assets/ui/huyen-kim/scene/map/exploration-map-frame@2x.png` | yes | — |
| exploration-map-chrome-kit | exploration-map-mask | `public/assets/ui/huyen-kim/scene/map/exploration-map-mask@1x.png` | `public/assets/ui/huyen-kim/scene/map/exploration-map-mask@2x.png` | yes | — |
| exploration-map-chrome-kit | exploration-chapter-divider | `public/assets/ui/huyen-kim/scene/map/exploration-chapter-divider@1x.png` | `public/assets/ui/huyen-kim/scene/map/exploration-chapter-divider@2x.png` | yes | — |
| technique-display-plinth | technique-display-plinth | `public/assets/ui/huyen-kim/scene/technique/technique-display-plinth@1x.png` | `public/assets/ui/huyen-kim/scene/technique/technique-display-plinth@2x.png` | yes | — |
| neutral-skill-tree-substrate | skill-tree-00-sky | `public/assets/ui/huyen-kim/scene/skill/00-sky@1x.png` | `public/assets/ui/huyen-kim/scene/skill/00-sky@2x.png` | no | L0 / static / ±0,±0px |
| neutral-skill-tree-substrate | skill-tree-01-far-mountains | `public/assets/ui/huyen-kim/scene/skill/01-far-mountains@1x.png` | `public/assets/ui/huyen-kim/scene/skill/01-far-mountains@2x.png` | yes | L1 / far-slow / ±3,±2px |
| neutral-skill-tree-substrate | skill-tree-02-celestial-field | `public/assets/ui/huyen-kim/scene/skill/02-celestial-field@1x.png` | `public/assets/ui/huyen-kim/scene/skill/02-celestial-field@2x.png` | yes | L2 / celestial-slow / ±5,±2px |
| neutral-skill-tree-substrate | skill-tree-03-atmosphere | `public/assets/ui/huyen-kim/scene/skill/03-atmosphere@1x.png` | `public/assets/ui/huyen-kim/scene/skill/03-atmosphere@2x.png` | yes | L3 / atmosphere / ±8,±4px |

All 18 SVG symbols are under `public/assets/ui/huyen-kim/symbols/` and are enumerated individually in `huyen-kim-ui-art-manifest.json`. Their `currentColor` contract keeps every interaction/state treatment runtime-owned.

## Runtime/CSS-only effects

These are directives in the forensic inventory, not part of its 43 canonical asset definitions. They intentionally have no raster file.

| Effect ID | Status | Implementation |
|---|---|---|
| notification-dot | NOT_REQUIRED | CSS/runtime |
| focus-ring | NOT_REQUIRED | CSS/runtime |
| orbit-guide-circle | NOT_REQUIRED | CSS/runtime |
| node-edge-stroke | NOT_REQUIRED | CSS/runtime |
| cooldown-sweep-mask | NOT_REQUIRED | CSS/runtime |
| atb-gauge-fill | NOT_REQUIRED | CSS/runtime |
| the-pip-dots | NOT_REQUIRED | CSS/runtime |
| selection-halo-breath | NOT_REQUIRED | CSS/runtime |
| scrollfade-gradient | NOT_REQUIRED | CSS/runtime |
| mist-vignette | NOT_REQUIRED | CSS/runtime |
| lock-desaturation | NOT_REQUIRED | CSS/runtime |
| pressed-scale | NOT_REQUIRED | CSS/runtime |

## Consumer and implementation boundaries

- Frontend consumers should read `game/docs/design/huyen-kim-ui-art-manifest.json`; no runtime imports were added in this task.
- Runtime text, icons, state overlays, focus rings, cooldown sweeps, notification dots, gauge fills, route lines, and animation remain code-owned.
- The Sơn Hà map substrate, characters, enemies, skills, items, materials, VFX, and all other gameplay art remain outside this pack.
