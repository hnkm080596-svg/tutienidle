# Huyen Kim Stable Scene Art Extension Design

## Goal

Complete the stable, reusable scene-art layer that is missing from the existing Huyen Kim UI chrome pack, while keeping gameplay content, labels, progression topology, and frequently changing icons under runtime or later content-pipeline ownership.

This extension uses the user-provided 17-scene concept set as visual and compositional reference. Repository contracts remain the functional authority.

## Scope Classification

This is an architectural art-production extension. It adds reusable asset families, manifest contracts, preview evidence, and a downstream frontend handoff, but it does not modify production Vue, TypeScript, Phaser, gameplay data, or state ownership.

## Visual Direction

The extension follows the approved Huyen Kim Son Thuy direction:

- environment-led compositions with restrained UI ornament;
- black lacquer, dark jade, aged gold, ivory parchment, and limited cinnabar;
- ink-wash mountain depth, celestial geometry, and cultivation ritual motifs;
- quiet centers and strong edge framing so runtime text and controls remain legible;
- no baked Vietnamese or English gameplay text;
- no branded logo or wordmark generation in this scope.

The following concept scenes are the primary composition references:

- `01-login.jpg` and `02-character-creation.jpg` for the dedicated auth/creation vista;
- `05-realm.jpg` for the ascending realm vista;
- `06-technique.jpg` for the technique display plinth;
- `07-skill.jpg` for the neutral skill-tree substrate;
- `08-body.jpg` for the cultivation figure and meridian overlay;
- `09-exploration.jpg` for map chrome only;
- `12-equipment.jpg` for the equipment paperdoll base;
- `13-tribulation.jpg` for storm layers and the tribulation dais.

## Chosen Architecture

Use layered, future-proof assets rather than scene screenshots or monolithic composites.

- Organic raster illustrations are generated as separate transparent or opaque layers.
- Stable utility symbols are authored as deterministic SVGs.
- Runtime owns labels, nodes, routes, progress states, locks, selected states, animation, VFX, and content art.
- Every raster family provides `@1x` and `@2x` exports with stable paths.
- Scene boards and contact sheets are review-only artifacts, never runtime substitutes.

Flat composite screenshots are rejected because they would bake changing content into the art. Reuse-only/CSS substitutes are rejected where the current assets visibly fail the approved concept direction.

## Deliverable Packages

### 1. Huyen Kim Symbol Set

Create a coherent monochrome SVG symbol family for stable navigation and utilities. The initial set is:

- `back`, `close`, `home`, `character`, `realm`, `skill`, `body`, `technique`, `inventory`, `exploration`, `alchemy`, `equipment`, `quest`, `settings`, `feedback`, `auto-farm`, `confirm`, and `lock`.

Symbols must remain readable at 20, 24, and 32 CSS pixels. Runtime owns tint, hover, selected, disabled, attention, and notification states.

### 2. Realm Ascent Vista

Create a text-free, five-layer parallax ascent substrate for the 812 x 610 scene region. The aligned stack is `00-sky`, `01-far-mountains`, `02-mid-ascent`, `03-summit-architecture`, and `04-low-mist`. It establishes lower mist, a rising mountain/pagoda path, and a luminous summit while preserving negative space for the runtime 18-node ladder and the right-side detail rail.

It must contain no nodes, numbers, realm emblems, progress tracks, labels, or lock states.

### 3. Body Cultivation Diagram Kit

Create two aligned transparent layers:

- a neutral seated cultivation figure with no named identity, equipment, costume-specific faction marks, or portrait detail;
- a separate meridian/energy overlay with a central dantian glow and restrained non-semantic channel paths.

Runtime owns the eight meridian orbs, chapter-specific labels, tier chips, unlocked states, investment animation, and exact semantic node positions.

### 4. Tribulation Environment Kit

Create reusable transparent layers compatible with an existing world background:

- far storm-cloud layer;
- near storm/vortex layer;
- central tribulation dais/rock platform;
- restrained sky-vignette layer when needed for contrast.

Runtime owns lightning bolts, flashes, debris, screen shake, phase transitions, characters, enemies, and all gameplay meters.

### 5. Equipment Paperdoll Base

Create a neutral standing cultivation mannequin/figure on transparency. It must not wear item-specific equipment, imply a fixed player identity, or contain slot frames.

Runtime owns equipped-item art, sockets, slot states, comparison arrows, rarity tint, highlights, and interaction feedback.

### 6. Exploration Map Chrome Kit

Create the Huyen Kim frame, edge treatment, inner mask, and divider grammar for the 700 x 524 map canvas. No geography, chapter landmarks, route lines, stage nodes, boss marks, labels, or reward content may be painted into the asset.

The frame must remain compatible with future light parchment, dark ink, and detailed painted substrates.

### 7. Technique Display Plinth

Create a central ritual plinth and restrained celestial support halo based on the composition of scene 06. The art provides a stable presentation stage only.

Technique scrolls, books, icons, names, grades, material art, rank nodes, and upgrade effects remain content/runtime owned.

### 8. Neutral Skill-Tree Substrate

Create a text-free, four-layer parallax celestial/ink substrate for the 640 x 470 tree canvas. The aligned stack is `00-sky`, `01-far-mountains`, `02-celestial-field`, and `03-atmosphere`. It keeps a quiet center, non-semantic concentric celestial fields, and restrained mountain depth derived from scene 07. It must not contain endpoints, connectors, sockets, or a countable branch pattern.

Runtime owns the core node, branch nodes, skill icons, edges, topology, costs, locks, levels, element colors, and selection states. The substrate must not imply a fixed node count or branch layout.

### 9. Auth and Character-Creation Vista

Create one dedicated six-layer parallax world vista shared by login and character creation. The aligned stack is `00-sky`, `01-far-mountains`, `02-mid-landscape`, `03-focal-architecture`, `04-low-mist`, and `05-foreground`. It should preserve the concept's moonlit immortal mountains, layered waterfalls, pagoda silhouettes, restrained blossom framing, and strong negative-space zones for the right-side auth scroll and creation controls.

No player character, logo, title lettering, auth card, talent cards, or gameplay content is baked into this vista. A character may be composed later as a separate content asset. Layers share the same canvas, focal alignment, and bleed margin; near layers may move farther than far layers, while reduced-motion renders every layer at zero offset.

## Explicit Exclusions

Do not create:

- entity spritesheets, portraits, enemies, bosses, companions, or fixed player characters;
- technique illustrations, scroll/book content, or technique icons;
- skill icons, skill-node content, or authored skill-tree topology;
- pill, material, item, equipment, reward, or currency icons;
- realm emblems, quest thumbnails, stage thumbnails, or chapter landmarks;
- painted Son Ha geography;
- animated VFX, effect spritesheets, lightning frames, or combat animation;
- runtime text, numbers, labels, logos, or wordmarks;
- frontend/runtime wiring.

## File Contract

Production files live under:

`game/public/assets/ui/huyen-kim/`

New folders:

- `symbols/`
- `scene/realm/`
- `scene/body/`
- `scene/tribulation/`
- `scene/equipment/`
- `scene/map/`
- `scene/technique/`
- `scene/skill/`
- `scene/auth/`

Every raster source is exported as lossless sRGB PNG with alpha when the layer requires transparency. Background art is never delivered as a single flattened production image: every declared parallax layer uses the same canvas and records `depth`, `motion`, maximum drift, and reduced-motion behavior. Production filenames use kebab-case canonical IDs and `@1x` / `@2x` suffixes. SVG symbols use a `0 0 24 24` view box, no embedded text, and `currentColor`-compatible monochrome paths.

## Geometry and Safe Areas

Each scene package records:

- canonical dimensions;
- alpha requirement;
- transparent margins;
- content-safe regions;
- alignment anchors;
- runtime-owned overlays and states;
- reference scene provenance.

Key layout targets:

- realm parallax layers: aligned 812 x 610 canvases;
- body focus kit: 640 x 520 aligned layers;
- map chrome: 700 x 524;
- skill substrate parallax layers: aligned 640 x 470 canvases;
- technique plinth: fits the 448 x 480 artifact-vista region;
- auth parallax layers: aligned 1672 x 941 canvases with composition proven at the 1280 x 720 logical stage;
- equipment paperdoll: 380 x 610 transparent canvas;
- tribulation layers: aligned 1672 x 941 transparent canvases so runtime can composite them without per-layer offsets.

## Manifest and Handoff

Extend `game/docs/design/huyen-kim-ui-art-manifest.json` with the nine packages. Every new record declares status, files, dimensions, alpha, safe areas, runtime state strategy, scene consumers, and explicit exclusions.

Extend `game/docs/design/huyen-kim-ui-art-production-report.md` with:

- production provenance;
- per-package QA status;
- excluded content confirmation;
- contact-sheet paths;
- handoff notes for frontend consumers;
- exact unresolved gaps, if any.

## Visual QA

Create review-only contact sheets and scene boards:

- stable symbol legibility at 20/24/32 px;
- realm, body, map, technique, skill, equipment, tribulation, and auth package sheets;
- composition boards for scenes 01/02, 05, 06, 07, 08, 10, 12, and 13;
- parallax QA boards at neutral, minimum, and maximum drift, proving that no layer exposes empty seams or breaks focal alignment;
- alpha/margin overlays and safe-area overlays;
- `@1x` / `@2x` dimension and alignment parity.

Reject an asset when it contains baked gameplay text/content, implies a fixed mutable topology, clips important silhouettes, lacks required transparency, fails crop safety, or breaks the Huyen Kim material/palette grammar.

## Verification and Completion Boundary

The task is complete only when:

- all nine packages have stable production paths and manifest records;
- contact sheets and composition boards pass visual inspection;
- dimensions, alpha, safe areas, and paired-scale alignment are mechanically checked;
- inventory/manifest/report parity is verified;
- no production frontend or gameplay file is modified;
- the repository-required P3, P18, P4, and sequential review evidence is recorded for the final aggregate state;
- a Devin handoff names exact consumers, runtime-owned responsibilities, exclusions, and remaining blockers.

Commit, push, merge, deployment, and frontend wiring require separate user authorization.
