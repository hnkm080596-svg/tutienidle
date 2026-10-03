# Huyen Kim Stable Scene Art - Frontend Handoff

## Handoff status

The stable scene-art package is ready for frontend integration review. This handoff adds no Vue, Pinia, Phaser, gameplay, routing, or state changes. It deliberately excludes volatile content art.

- Forensic source commit: `211a62e4b61c6686534cc2c3f07bc52e0a94a01f`.
- Canonical manifest: `docs/design/huyen-kim-ui-art-manifest.json`.
- Extension contract: `public/assets/ui/huyen-kim/_source/stable-scene-extension.json`.
- Generated QA ledger: `public/assets/ui/huyen-kim/_source/stable-scene-extension-qa.json`.
- Prompt provenance: `docs/design/huyen-kim-stable-scene-art-prompts.md`.
- Visual evidence: `public/assets/ui/huyen-kim/preview/09-stable-symbols.png` through `14-parallax-motion-qa.png`.

## Delivered surface

The extension contains nine packages:

1. `huyen-kim-ui-symbol-set`: 18 monochrome `currentColor` SVG symbols.
2. `auth-creation-vista`: six aligned parallax layers.
3. `realm-ascent-vista`: five aligned parallax layers.
4. `body-diagram-kit`: meditating figure plus non-semantic meridian overlay.
5. `tribulation-environment-kit`: far storm, near storm, dais, and vignette layers.
6. `equipment-paperdoll-base`: neutral standing figure only.
7. `exploration-map-chrome-kit`: frame, clipping mask, and chapter divider only.
8. `technique-display-plinth`: empty display stage only.
9. `neutral-skill-tree-substrate`: four aligned parallax layers.

Production totals for this extension are 26 paired-scale raster assets (52 PNG files) and 18 SVG symbols. The existing chrome pack remains 42 paired-scale raster assets (84 PNG files). Aggregate production output is 154 files.

## Parallax is a required contract

Do not flatten the auth, realm, or skill backgrounds into a single production image. Load and render each stack in the exact declared order from the extension contract:

- `auth-creation`: `L0` through `L5`.
- `realm-ascent`: `L0` through `L4`.
- `skill-tree`: `L0` through `L3`.

Rules:

- All layers in one stack share one canvas and camera. Do not crop or independently reframe a layer.
- `L0` is the only opaque layer. Every higher layer preserves alpha.
- Use the declared `max_drift_px` as a hard maximum, not a target that must always be reached.
- Near layers may move more than far layers. Apply smooth pointer or camera interpolation; never snap.
- For `prefers-reduced-motion: reduce`, every layer offset is exactly zero.
- Preserve cover bleed when scaling a world vista. Never reveal transparent or page-colored seams at maximum drift.
- Compute overscan per layer from its declared maximum drift: after cover-fitting the canvas, render at least `2 * max_drift_px.x` extra width and `2 * max_drift_px.y` extra height in rendered coordinates, center that overscan, then clamp translation to the declared drift. Hidden overflow alone is not sufficient.
- `preview/14-parallax-motion-qa.png` is the visual oracle for neutral, maximum-negative, and maximum-positive drift.

The flattened master images under `_source/generated/*-master.png` are provenance inputs only. They must not be imported by runtime code.

## Scene consumer map

| Scene | Stable art | Recommended presentation | Runtime remains authoritative for |
|---|---|---|---|
| 01 Login | `scene/auth/*` | six absolutely layered `<img>` elements in one clipped cover container | logo, auth modes, fields, errors, actions, session state |
| 02 Character Creation | `scene/auth/*` | reuse the auth parallax presenter; do not duplicate or flatten it | name, talent roll/cards, character, validation, confirm state |
| 05 Realm | `scene/realm/*` | five absolutely layered `<img>` elements inside the scroll scene canvas | 18 rungs, labels, progress, requirements, locks, selection, breakthrough |
| 06 Technique | `scene/technique/*` | transparent `<img>` below the runtime artifact slot and above the substrate | technique illustration, name, grade, rank, materials, upgrade result |
| 07 Skill | `scene/skill/*` | four absolutely layered `<img>` elements below the SVG/DOM node graph | nodes, edges, topology, icons, levels, costs, locks, element tint |
| 08 Body | `scene/body/*` | figure `<img>` plus aligned meridian-overlay `<img>`; runtime nodes on top | meridian orbs, named points, tiers, chapter state, invest animation |
| 10 Exploration | `scene/map/*` | frame `<img>`, CSS/SVG mask from the mask asset, divider `<img>`; runtime canvas inside | geography, routes, stages, boss marks, labels, chapter state |
| 12 Equipment | `scene/equipment/*` | transparent paperdoll `<img>` below six DOM/runtime sockets | item art, six sockets, rarity, selection, stats, operations |
| 14 Tribulation | `scene/tribulation/*` | layered absolute `<img>` elements; dais below character, storms/vignette around VFX | characters, lightning/VFX, questions, meters, phases, shake, outcome |
| Global navigation | `symbols/*.svg` | inline SVG/component or mask using `currentColor`; never rasterize state variants | state, color, hover, selected, disabled, attention, notification |

## Volatile art boundary

Do not infer, generate, or substitute any of the following during frontend integration:

- entity spritesheets, animated characters, enemies, or portraits;
- technique illustrations;
- skill icons or authored skill-tree topology;
- pill, material, item, equipment, reward, realm-emblem, quest, stage, boss, or chapter content art;
- painted Son Ha geography;
- animated VFX or baked state variants.

Use current runtime content, existing placeholders, or data-driven slots for those surfaces. If a required content asset is absent, expose the existing neutral placeholder behavior and report the gap. Do not turn a stable substrate into gameplay truth.

## Frontend authority rules

Read `docs/design/frontend-contract.md` before implementation. The frontend consumes canonical GameManager read-model verdicts and mutations; it does not derive progression or beta scope from raw player state.

- `scope-hidden` means no DOM surface, no locked teaser, no tooltip, and no deep link.
- Never make art arrival or animation completion award resources, spend costs, advance progression, or determine a battle/tribulation outcome.
- Runtime text stays in i18n. No label may be baked into a PNG or SVG.
- Interactive semantics, keyboard focus, state reasons, and accessible labels remain DOM/runtime responsibilities.
- Symbols use `currentColor`; do not create raster state copies.

## Recommended integration order

1. Add a typed asset registry whose values come from the extension manifest; do not scatter string paths through components.
2. Add one reusable parallax presenter that consumes ordered layers, bounded drift, and reduced-motion policy.
3. Integrate the auth stack and prove cover/resize behavior.
4. Integrate realm and skill stacks without changing their read-model or topology owners.
5. Integrate independent body, technique, map, equipment, and tribulation layers.
6. Replace eligible navigation glyphs with the stable SVG symbol set.
7. Run real-browser visual checks at the layout breakpoints declared by `huyen-kim-scene-layout-spec.md`.

## Stop and replan conditions

Stop implementation and report the mismatch if any of these occur:

- a declared manifest path is missing or dimensions differ;
- a stack requires independent cropping to align;
- maximum drift exposes a seam;
- a screen needs art that belongs to the volatile-content exclusion list;
- the implementation would need to derive a beta/progression verdict outside the canonical read-model;
- a scope-hidden surface would become mounted or visible;
- presentation would become gameplay authority;
- a new public store/service API or Phaser scene topology change appears necessary.

## Acceptance evidence for the implementation task

The frontend task is not complete until it provides:

- manifest/path census and type-check evidence;
- focused tests for registry ordering, reduced motion, and scope-hidden absence;
- browser screenshots of every affected scene at the required breakpoints;
- neutral and maximum parallax drift proof with no seams;
- keyboard/focus/accessibility proof for changed controls;
- console-error check;
- P3, P18, P4, and sequential resulting-state reviews required by `AGENTS.md`.
