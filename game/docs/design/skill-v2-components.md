# Skill UI components

User correction: deliver reusable nodes and information panel. Topology, number of nodes and positions vary per type, NOT a universal radial skill tree. The layout in SkillPreview is a disposable fixture only. No background generated; uses DongFuVista outside the shared paper and PaperPanelNavigation.

`SkillPaperNode`: icon, name, formatted level, learned/available/locked, selected, optional prominent. Emits select even while locked for inspection. No coordinates or graph knowledge inside this component. Separate generated ring, icon, lock, learned badge, selected outline and text.

`SkillPaperTree`: positions supplied nodes and connects supplied edges; no orbit/constellation decoration or assumed topology. Invalid endpoint edges are omitted. Host validates real graph data later.

`SkillPaperDetails`: selected node description/rows/state. Emits upgrade intent only. Fixed notice region; body scrolls independently. Uses a separate light-paper inset frame, reusing paper-nine-slice.png with 300px source slices and 35px rendered corners. Thin antique-gold inner line; no black inset box or scroll rollers. Full frame remains within parent paper. Browser screenshot: skill-v2-info-frame.png at 1280x720.

## Temporary art

Built-in imagegen, transparent background, saved as `public/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png`. No gameplay icon replaced.

Prompt: one front-on circular annular skill-node frame, antique gold double rim with charcoal engraved incisions, restrained cloud filigree and four jade inlays; empty transparent center and transparent corners; crisp readability at 64px; no icon, text, badge, lock, glow, scene, paper or panel. Neutral reusable frame, states and icon added by UI.

## Hooks

- UI-32: SkillFidelityScene receives nodes/edges/elements/selection/navigation/notice; emits selection, element selection, navigation and upgrade. Preview URL `/ui-skill.html`.
- UI-33: SkillPaperNode receives visual state; icons freely replaceable. Element art used as temporary glyph, not final per-skill art.
- UI-34: SkillPaperDetails receives already formatted node details. No calculation of effects, prerequisites, costs or level.
- UI-35: graph host supplies coordinates and edges independently for each type. Existing live graph engine remains unchanged.

All values and edges in preview are display fixtures, not canonical graph or combat rules. Full QA/OCR/release validation is not claimed.
