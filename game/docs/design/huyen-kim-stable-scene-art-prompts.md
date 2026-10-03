# Huyen Kim Stable Scene Art - ImageGen Prompt Ledger

Built-in ImageGen is the production source for the organic raster inputs below. Every reusable background is authored as a master composition and then extracted into a registered parallax stack. The local concept images are style and composition references only, never functional truth or output screenshots.

Shared direction for every prompt:

- Use case: `stylized-concept`.
- Production game asset for the Huyen Kim Son Thuy interface.
- Quiet, elegant, environment-led xianxia illustration.
- Dark lacquer and mineral ink, aged gold, restrained jade, ivory mist, limited cinnabar.
- Painterly ink-wash depth with polished game-art finish.
- No text, letters, numbers, logo, watermark, signature, UI controls, icons, badges, node topology, item art, or checkerboard.
- Preserve generous negative space and unclipped silhouettes.

Parallax extraction contract:

- Every layer preserves the exact master canvas, camera, horizon, scale, and object coordinates.
- Layer `00` is a complete opaque sky. Every later layer has true transparency.
- Extraction removes all unrequested depth planes instead of repainting them at a different position.
- The aligned layers must reconstruct a coherent scene and tolerate their declared independent drift.
- Reduced-motion presentation uses zero layer offset.

## 1. Auth and Character-Creation Parallax Vista

- Master source: `_source/generated/auth-creation-master.png`
- Production sources:
  - `_source/generated/auth-creation-00-sky.png`
  - `_source/generated/auth-creation-01-far-mountains.png`
  - `_source/generated/auth-creation-02-mid-landscape.png`
  - `_source/generated/auth-creation-03-focal-architecture.png`
  - `_source/generated/auth-creation-04-low-mist.png`
  - `_source/generated/auth-creation-05-foreground.png`
- References: `01-login.jpg`, `02-character-creation.jpg`
- Background: opaque master; opaque sky plus five transparent aligned layers.

```text
Use case: stylized-concept
Asset type: full-screen login and character-creation world vista
Input images: Image 1 and Image 2 are composition, palette, atmosphere, and worldbuilding references only; do not reproduce their UI, text, logo, or characters
Primary request: create one reusable moonlit immortal-mountain vista that supports both login and character creation
Scene/backdrop: layered waterfalls, distant pagodas, cloud seas, one luminous moon, restrained blossom framing at the outer edges, quiet foreground rock ledges
Composition/framing: landscape 16:9; scenery dominant; visually calm and lower-detail negative space across the right third for a runtime scroll panel; no foreground character
Style/medium: refined xianxia ink-wash painting with high-end game environment polish
Lighting/mood: tranquil moon-gold atmosphere, deep blue-black mineral shadows, ivory mist
Constraints: opaque complete background; no text, logo, UI, form, card, portrait, person, talent illustration, icon, watermark, or signature
```

Layer extraction prompts use the master image as their only input:

```text
00-sky: Preserve the exact master canvas and camera. Remove every mountain, pagoda, waterfall, cloud bank, tree, blossom, lantern, and rock. Reconstruct only the complete opaque moonlit blue-black sky, moon, stars, and distant celestial glow. No transparency and no UI or text.

01-far-mountains: Preserve the exact master canvas and coordinates. Isolate only the palest most-distant mountain silhouettes and distant cloud sea. Remove sky, middle terrain, architecture, waterfalls, mist veils, blossoms, rocks, and foreground objects. True transparent background.

02-mid-landscape: Preserve the exact master canvas and coordinates. Isolate only middle-distance mountains, cloud terraces, and waterfalls. Remove sky, far silhouettes, focal pagodas and bridges, low mist veil, blossoms, rocks, and foreground objects. True transparent background.

03-focal-architecture: Preserve the exact master canvas and coordinates. Isolate only the focal pagodas, bridges, their supporting ledges, and directly attached waterfall details. Remove sky, far and middle landscape planes, low mist, blossoms, rocks, and foreground framing. True transparent background.

04-low-mist: Preserve the exact master canvas and coordinates. Isolate only the low cloud and mist veils with soft feathered alpha edges. Remove every solid object, sky fill, mountain, building, waterfall, tree, flower, and rock. True transparent background.

05-foreground: Preserve the exact master canvas and coordinates. Isolate only the nearest blossom-tree framing, foreground rocks, lantern, and near ledges. Remove sky, distant and middle scenery, focal architecture, waterfalls, and mist veils. True transparent background.
```

## 2. Realm Ascent Parallax Vista

- Master source: `_source/generated/realm-ascent-master.png`
- Production sources:
  - `_source/generated/realm-ascent-00-sky.png`
  - `_source/generated/realm-ascent-01-far-mountains.png`
  - `_source/generated/realm-ascent-02-mid-ascent.png`
  - `_source/generated/realm-ascent-03-summit-architecture.png`
  - `_source/generated/realm-ascent-04-low-mist.png`
- Reference: `05-realm.jpg`
- Background: opaque master; opaque sky plus four transparent aligned layers.

```text
Use case: stylized-concept
Asset type: scenic substrate inside a realm-progression scroll
Input images: Image 1 is a composition and atmosphere reference only; remove all UI, nodes, numbers, paths, labels, characters, and icons
Primary request: create a vertical-feeling mountain ascent landscape from lower mist to a luminous summit
Scene/backdrop: cascading immortal mountains, narrow waterfalls, small distant pagodas, cloud terraces, a bright celestial summit near the upper center
Composition/framing: landscape panel; natural visual flow rises from lower-left through the center to the summit; keep broad quiet zones for an 18-node runtime ladder
Style/medium: elegant xianxia ink-wash environment with restrained aged-gold celestial accents
Constraints: opaque substrate; no nodes, route line, circles, numbers, labels, emblems, character, UI, watermark, or signature
```

Layer extraction prompts use the master image as their only input:

```text
00-sky: Preserve the exact master canvas and camera. Remove all mountains, waterfalls, cloud terraces, pagodas, ledges, and low mist. Reconstruct only the complete opaque sky, moonlight, stars, and summit glow. No transparency and no UI or text.

01-far-mountains: Preserve the exact master canvas and coordinates. Isolate only the most distant pale mountain silhouettes and remote cloud sea. Remove sky, ascent terrain, waterfalls, summit architecture, and low mist. True transparent background.

02-mid-ascent: Preserve the exact master canvas and coordinates. Isolate only the middle ascent terrain, cascading cliffs, natural terraces, and waterfalls that lead toward the summit. Remove sky, far silhouettes, summit architecture, and low mist veil. True transparent background.

03-summit-architecture: Preserve the exact master canvas and coordinates. Isolate only the luminous summit, summit pagodas, bridges, and their immediate supporting ledges. Remove sky, far and middle terrain, waterfalls not attached to the summit, and low mist. True transparent background.

04-low-mist: Preserve the exact master canvas and coordinates. Isolate only the lower cloud sea and soft mist veils. Remove every solid object, sky fill, mountain, waterfall, bridge, and building. True transparent background.
```

## 3. Body Cultivation Figure

- Output source: `_source/generated/body-cultivation-figure.png`
- Reference: `08-body.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: neutral cultivation-body diagram figure cutout
Input images: Image 1 is a pose, lighting, and material reference only; do not copy UI, nodes, labels, costume identity, or scenery
Primary request: a single anonymous cultivator seated in symmetrical lotus meditation, front-facing, whole body visible
Subject: neutral dark mineral-ink silhouette with restrained ivory edge light and aged-gold inner warmth; calm hands resting at the lower abdomen; no identifiable face or faction costume
Composition/framing: centered and symmetrical, generous transparent margin, head to full seated legs completely unclipped
Constraints: true transparent background; no meridian dots, semantic nodes, text, labels, scenery, platform, halo topology, weapons, equipment, logo, watermark, or signature
```

## 4. Tribulation Storm - Far Layer

- Output source: `_source/generated/tribulation-storm-far.png`
- Reference: `13-tribulation.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: distant storm-cloud overlay for a tribulation world scene
Input images: Image 1 is an atmosphere and palette reference only; exclude its characters, lightning, chains, UI, text, and mountains
Primary request: a wide layer of distant charcoal storm clouds and subtle celestial vortex mist
Composition/framing: wide panoramic cloud mass concentrated in the upper half, feathered translucent edges, quiet open center for runtime lightning
Style/medium: xianxia ink-wash storm painting, mineral blue-black with restrained cold jade highlights
Constraints: true transparent background; clouds only; no lightning bolt, dragon, face, character, debris, chain, text, UI, watermark, or signature
```

## 5. Tribulation Storm - Near Layer

- Output source: `_source/generated/tribulation-storm-near.png`
- Reference: `13-tribulation.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: foreground storm and vortex overlay for a tribulation world scene
Input images: Image 1 is an atmosphere and palette reference only; exclude its characters, lightning, chains, UI, and text
Primary request: dramatic near storm wisps and a broken circular cloud vortex framing an empty center
Composition/framing: wide layer; heavier cloud masses toward upper corners and side edges; transparent central strike corridor and transparent lower third
Style/medium: refined xianxia ink-wash storm with subtle aged-gold and cold-jade rim light
Constraints: true transparent background; no lightning bolt, dragon, face, character, debris, chain, text, UI, watermark, or signature
```

## 6. Tribulation Dais

- Output source: `_source/generated/tribulation-dais.png`
- Reference: `13-tribulation.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: central ritual platform cutout for a tribulation scene
Input images: Image 1 is a material, scale, and atmosphere reference only; remove its character, lightning, chains, UI, and text
Primary request: an empty floating black-stone cultivation dais with restrained antique-gold rune grooves and broken rock edges
Composition/framing: front three-quarter view, wide low platform centered in the lower half, enough clear top surface for a runtime character, full silhouette unclipped
Style/medium: polished xianxia environment prop, dark mineral stone, aged gold, faint jade underglow
Constraints: true transparent background; empty platform; no person, creature, weapon, lightning, chain, text, icon, UI, watermark, or signature
```

## 7. Tribulation Sky Vignette

- Output source: `_source/generated/tribulation-sky-vignette.png`
- Reference: `13-tribulation.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: subtle full-screen atmospheric vignette overlay
Input images: Image 1 is a palette and dramatic-value reference only
Primary request: restrained translucent blue-black storm vignette with faint inward mist and a very subtle warm celestial glow near upper center
Composition/framing: transparent center and lower middle, soft darkening along outer edges, no discrete objects
Style/medium: painterly ink-wash atmosphere
Constraints: true transparent background; atmosphere only; no clouds with faces, lightning, character, mountain, chain, text, UI, watermark, or signature
```

## 8. Equipment Paperdoll Base

- Output source: `_source/generated/equipment-paperdoll-base.png`
- Reference: `12-equipment.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: neutral standing paperdoll base for an equipment interface
Input images: Image 1 is a stance, silhouette, and palette reference only; do not copy equipment items, sockets, UI, scenery, or character identity
Primary request: one anonymous adult cultivator standing front-facing in a calm neutral pose, arms slightly away from torso so runtime equipment slots remain readable
Subject: simplified dark ink mannequin with layered plain cultivation under-robe, subtle ivory rim light, no face identity and no item-specific armor
Composition/framing: centered whole body from head to feet, symmetrical, generous transparent margin, no clipping
Constraints: true transparent background; no weapon, helmet, necklace, ring, armor set, boots emphasis, socket, halo, text, UI, logo, watermark, or signature
```

## 9. Technique Display Plinth

- Output source: `_source/generated/technique-display-plinth.png`
- Reference: `06-technique.jpg`
- Background: transparent.

```text
Use case: stylized-concept
Asset type: empty ritual display plinth for a technique interface
Input images: Image 1 is a focal-composition, material, and lighting reference only; remove its book, scroll, text, UI, rank nodes, icons, and scenery
Primary request: an empty circular cultivation plinth with a restrained celestial support halo behind the display zone
Composition/framing: vertical panel; platform in lower third, open transparent artifact zone above it, halo has no sockets or countable node pattern
Style/medium: polished xianxia ritual prop, dark jade stone, aged gold filigree, subtle ivory qi light
Constraints: true transparent background; no book, scroll, technique icon, material, character, text, label, rank node, UI, watermark, or signature
```

## 10. Neutral Skill-Tree Parallax Substrate

- Master source: `_source/generated/skill-tree-master.png`
- Production sources:
  - `_source/generated/skill-tree-00-sky.png`
  - `_source/generated/skill-tree-01-far-mountains.png`
  - `_source/generated/skill-tree-02-celestial-field.png`
  - `_source/generated/skill-tree-03-atmosphere.png`
- Reference: `07-skill.jpg`
- Background: opaque master; opaque sky plus three transparent aligned layers.

```text
Use case: stylized-concept
Asset type: neutral scenic substrate behind a runtime skill tree
Input images: Image 1 is a composition, depth, and palette reference only; remove the fire dragon, all nodes, connectors, icons, labels, character, and UI
Primary request: a quiet celestial ink landscape with subtle concentric atmospheric fields and distant mountain depth
Composition/framing: landscape panel with an uncluttered center and balanced negative space across the full canvas; no countable orbit, branch, endpoint, or fixed path
Style/medium: refined Huyen Kim xianxia ink-wash environment, dark mineral sky, aged-gold stardust, restrained jade haze
Constraints: opaque substrate; no creature, flame motif, node, socket, route line, connector, icon, text, label, character, UI, watermark, or signature
```

Layer extraction prompts use the master image as their only input:

```text
00-sky: Preserve the exact master canvas and camera. Remove all mountains, cloud banks, mist, blossoms, rings, lines, dots, and celestial topology. Reconstruct only the complete opaque moonlit mineral sky, moon, stars, and diffuse glow. No transparency and no UI or text.

01-far-mountains: Preserve the exact master canvas and coordinates. Isolate only the distant mountain silhouettes. Remove sky, clouds, mist, blossoms, celestial arcs, lines, dots, and every node-like mark. True transparent background.

02-celestial-field: Preserve the exact master canvas and coordinates. Isolate only diffuse incomplete celestial arcs and fine stardust. Remove every discrete glowing circle, endpoint, socket, connected node, route-like line, mountain, cloud, blossom, and sky fill. The result must not imply a countable runtime topology. True transparent background.

03-atmosphere: Preserve the exact master canvas and coordinates. Isolate only soft cloud, mist, and restrained atmospheric bloom with feathered edges. Remove sky fill, mountains, blossoms, celestial lines, circles, endpoints, and node-like marks. True transparent background.
```
