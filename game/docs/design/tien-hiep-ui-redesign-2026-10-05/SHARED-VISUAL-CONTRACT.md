# Visual fidelity first

The user rejected the previous implementation as inconsistent and unlike the references. Current work establishes a coherent reusable visual system before further functional integration. Technical verification of the prior state is not visual approval.

## Canonical visual references

The approved Kho Vat and Luyen The references own palette, continuous-page composition, hierarchy and decorative restraint. They do not authorize new gameplay functions. Dong Phu and opening reuse the approved warm ink landscape direction. Dynamic character art remains user-owned.

## Shared component ownership

- `PcPaperScene`: one 1440x810 page surface, header/title ornament/underline, tabs/tools/workspace/footer geometry, optional navigation region. No domain/store imports.
- `PcPaperTabs`: one visual selection recipe, labels and selected state supplied by the consumer.
- `PcPaperButton`: primary gold and secondary charcoal variants, same typography/border vocabulary.
- `pc-paper-slot`: one inventory/material/equipment slot treatment.
- `pc-paper-inspector`: one charcoal details/costs/action region.
- `PcPaperIcons`: one authored transparent brush family; semantic icon identity is independent of the scene.
- Body diagram overlay: reusable golden node/path presentation over existing figure art; does not own gameplay or generate a replacement character.

## Shared artwork

- `source/shared-paper-page-v1.png`: intentionally opaque full-page watercolor paper, derived from approved Kho Vat. Reused across main pages rather than one generated screenshot per scene.
- `source/shared-title-cloud-v1.png`: transparent Chinese ochre cloud title ornament; no paper rectangle or labels.
- `source/brush-icons-atlas-v1.png`: 24-icon shared atlas; exported without flattening to `icons/*.png`. Each exported cell has alpha min0 and is non-opaque. Earlier detailed icon atlas is a discarded candidate, not integrated production art.
- `source/body-glyphs-atlas-v1.png`: six anatomical glyphs exported to `icons/body-*.png`; transparent warm-gold glyphs replace temporary vector marks.
- `controls/item-slot-v1.png`: one tight-cropped authored square slot, delicate cloud-etched corners and warm charcoal surface; transparent exterior, opaque interior by design.
- `controls/button-{primary,secondary}-v1.png`: two common painted controls, transparent outside their chamfered silhouettes. Nine-slice consumption preserves the shared corners across sizes.
- `controls/landmark-v1.png`: one transparent-edged cream landmark banner reused on all home landmarks.
- `controls/resource-*-v1.png`: four shared jade/coin/crystal/essence resources, actual alpha retained.
- `controls/body-diagram-v1.png`: transparent anatomical cultivation schematic extracted from the approved body reference. Reused by body, meridian and circulation; this is not replacement main-character art.
- `PcPaperDialog`: one flow-sized compact paper host for retreat, confirmation, feedback, entitlement and save errors; no rectangular cream margin outside the fine frame.
- `PcBodyDiagram`: a shared anchored diagram and restrained CSS/SVG light layer, decorative and pointer-transparent. Reduced motion retains the diagram and disables the animation.
- Typography: locally bundled Source Serif 4 regular/bold with Vietnamese coverage, shared `--pc-font-body` and `--pc-font-title`. Font files and SIL Open Font License are under `public/assets/fonts/source-serif-4/`; official source is Google Fonts Source Serif 4. No remote font request is needed at runtime.
- Original generated sources remain intact; export scripts only split or crop bounds and preserve authored alpha. `controls/*manifest.json` records dimensions and measured alpha ranges. Prompts live in `SHARED-CONTROLS-PROMPTS.json`.

## Proof before migration

Standalone `/ui-design-system.html` renders static inventory/body/equipment examples using these same components. Compare complete screenshots with the approved references at1672x941 and1280x720. Check title baseline, continuous paper, tab position, grid/inspector proportion, semantic icon readability, and consistent frame/button/slot treatment. Do not claim success merely because URLs resolve or interactions work.

Production fidelity roots and adapters have not been migrated to this new shell. Existing implemented UI remains the visually rejected baseline until the shared composition is established. Further wiring consumes existing models/intents; it must adapt to the accepted visual regions rather than redefining the visual concept around old layout constraints.

## Shared style does not mean identical scene layout

The first generic node-workspace examples for map, graph and progression are rejected as scene designs. A component exercise is not a complete scene. Map requires chapter/landscape/details regions; skills require circular branching nodes and an inspector; realm requires a horizontal realm sequence, current-realm hero card and effect/lore strip. These consume the same primitives without duplicating page art or reducing every system to an interchangeable diagram.

Auxiliary static designs cover formation, item tooltip, offline result dialog and settings. Compact overlays use their own shared popup geometry while preserving the same paper/ink/gold vocabulary. No full cream screenshot rectangle may be used as an icon, ornament or popup cutout.
