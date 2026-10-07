# Static shared-paper baseline review

Reviewed 2026-10-05, read-only visual design review. This is a provisional baseline assessment, not production acceptance, function verification, or QA completion. Production migration is paused. No production files were edited.

## Evidence and reference authority

- Fresh browser captures at 1672 × 941: `runtime-evidence/independent-design-inventory-1672.png` and `independent-design-body-1672.png`, from `http://127.0.0.1:5449/ui-design-system.html?example=inventory|body` in the implementation worktree.
- Latest approved Kho Vật: `C:/Users/hnkm0/AppData/Local/Temp/codex-clipboard-f33f3af8-2093-421d-98d1-172b9431d4c4.png`.
- Approved Luyện Thể: `C:/Users/hnkm0/AppData/Local/Temp/codex-clipboard-1808328b-f319-458e-a43a-cfd9ef01f6d4.png`.
- Also inspected existing `design-paper-*` captures for equipment, graph, map, progression, list, settings, and crafting at 1672; inventory/body at 1280. Those captures are a prior static baseline and do not establish acceptance of subsequent edits.
- The earlier inventory nav-rail observation used the wrong older reference and is withdrawn. The latest approved inventory has no dark left rail.

## Prioritized mismatches

1. **High — body hero art and placement.** Current figure head is around y273 versus y205 in the reference. Current seated silhouette spans roughly 520px vertically versus about 620px in the reference. The straight gold segment overlay and broad glow read as a diagram placed over a black robe silhouette; the reference is anatomical ink art with fine meridian filaments, central spirals, and warm radiant points. Raster category icons improve the medallions but do not resolve the hero-art mismatch. `DesignSystemPreview.vue` and `PcBodyMeridianOverlay.vue` are the relevant static consumers.

2. **High — map, skills, and realm are placeholder compositions.** The inspected graph/map/progression screenshots reuse the same six square nodes on a polygon, with small icon substitutions and the same generic inspector. They do not establish distinct whole-scene designs. The reference-led alternatives require landscape/three-column map composition, realm timeline, and radial skill tree. The coordinator has already requested that redesign; this finding applies to the captured baseline, not an unseen future result.

3. **Medium — inventory grid geometry differs from the actual approved reference.** Latest approved inventory has 12 columns × 4 rows, with roughly 119px tiles spanning x92–1611 and y264–756. Current preview has 13 × 4, roughly 105px tiles spanning x111–1615 and y281–736. The current smaller grid starts about 17px lower and ends about 20px higher. Preserve this as a design choice requiring explicit visual acceptance rather than claiming exact reference geometry.

4. **Medium — repeated primitives look like CSS placeholders.** Slots use coarse opposing L corners, while the reference has fine antique-gold carved corners and clipped/chamfered outlines. Filter chips, pagination, and the main action use plain doubled rectangles and flat gradients instead of the same authored ornamental family. A shared raster slot replacement is in progress; the captured L corners should be re-reviewed after it lands. `pc-paper-scene.css`, `PcPaperButton.vue`, and `PcPaperTabs.vue` own these static styles.

5. **Medium — body inspector color and detail.** Current inspector starts around y203, reference y192. Its olive gradient and plain border feel flatter and greener than the reference's ink-charcoal rock texture, fine gold corner ornaments, and decorative heading separators. Current stat rows have no small gold icons and use long plain rules. The action is a pale flat rectangle versus the warmer amber, finely framed reference button. Text remains readable in the fresh capture; this is aesthetic mismatch, not a contrast-failure claim.

6. **Medium — shared title and tabs need authored treatment.** The current cloud underline sits beneath the word and intrudes into the title baseline; in the approved references the cloud curls flank the title and join a thinner ornamental divider. The upper-left branch also crosses the current title lettering. Current active tabs are a soft radial glow with a thin rule; the reference uses a broad brush-painted gold swash and decorated underline. Heading type is broadly comparable, but the composition around it is not yet comparable.

7. **Medium — remaining static archetypes are not complete scene designs.** List and settings reuse plain rows and a generic three-stat inspector. Crafting uses a large flat lotus glyph, three small materials, and two equally prominent action buttons. They demonstrate reusable containers but not yet the scene-specific hierarchy, illustration, or control grouping needed for visual acceptance. This finding is design-only; no conclusions about real gameplay controls are inferred from the static examples.

## What is working

The warm ivory paper, restrained gold outer frame, upper-right mountain/pagoda silhouette, dark collection cells, and ink serif headings are substantially closer to the approved direction than the rejected production baseline. The shared frame gives consistent bounds across the static examples. Inventory and body at 1280 did not show obvious text overlap in the inspected saved captures, but that is not acceptance of new assets or newly distinguished archetypes.

## Review boundary

This reviewer previously implemented collection production scenes, so that earlier slice was self-review. This static shared-paper composition and primitives were authored by other workers/coordinator and reviewed here independently. No production commands, read-models, eligibility rules, or function tests were reviewed in this pass. The browser was closed. The two fresh screenshots are intentional evidence artifacts. Final visual acceptance remains open and requires review of the resulting assets and distinct scene compositions.
