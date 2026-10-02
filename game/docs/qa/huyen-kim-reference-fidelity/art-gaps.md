# Huyen Kim Reference Fidelity - Art Gaps

Format per plan §4.2: scene + region, ref crop, runtime state, asset id/path, size/canvas, alpha, nine-slice/text-safe rect, layer/depth/drift, current defect, acceptance.

Excluded content art (spritesheets, portraits, item/skill/material icons, content illustrations, boss/stage art, animated VFX) is out of scope per mission §3 and is NOT listed as a blocker.

## Stable-art gaps (blocking visual acceptance until delivered or accepted with exception)

### GAP-01 Dong Fu world kit mood
- Scene/region: S03 Dong Fu `vista` full-bleed.
- Ref crop: `references/huyen-kim/scenes/03-dong-fu.jpg` - moonlit blue-teal night world, golden lantern glow, waterfall, floating temple islands.
- Runtime state: `spring/morning` default variant -> sepia daylight scroll (before/03-dong-fu-closed.png).
- Existing asset: `public/assets/backgrounds/dong-fu/modular/{times}/{night}/ + {seasons}/{spring}/` all 10 layers exist. The night variant is materially closer to ref mood.
- Defect: composition is fixable in layout; mood match depends on variant choice. DEFAULT is pinned by a 2026-08-26 requirement; variants rotate post-battle anyway.
- Resolution path: NOT an art request - presentation decision. Evaluate `spring+night` (or `summer+night`) as the pinned preset or accept morning. Acceptance: evidence frame at night variant vs ref annotated.
- Status: OPEN (decision pending; not blocking layout work).

### GAP-02 Scroll-interior vista substrate
- Scene/region: S05 Realm `ascent-map`, S07 Skill `tree-canvas`, S18 Quest interior, S04 Character focal background, S06 Technique artifact-vista backdrop.
- Ref crop: `05-realm.jpg` `07-skill.jpg` `17-quest.jpg` - scroll interiors are painted landscapes, not flat paper.
- Runtime state: `imperial-scroll-body` chrome renders flat parchment; realm-ascent/skill-tree stacks exist but only Realm mounts its stack (region-sized); quest/character/technique interiors have no vista substrate.
- Existing asset: realm-ascent L0-L4 (812x610), skill-tree L0-L3 (640x470) fit their spec regions exactly. Character/quest have NO dedicated interior vista asset in the pack.
- Art request needed IF generic interior vista required: `scene/interior-vista@1x/@2x` (one reusable painted landscape ~1244x610 canvas, alpha base matching scroll body) to serve character/quest/technique interiors. OR accept parchment+grain for those scenes (quest ref's interior painting arguably substitutes content space).
- Status: OPEN pending Task-5/6/10 review of how much vista each interior actually needs.

### GAP-03 Building plaque orientation
- Scene/region: S03 Dong Fu hotspot plaques.
- Ref crop: `03-dong-fu.jpg` - vertical hanging dark tags with vertical gold text.
- Runtime state: horizontal pills at authored anchors (before/03-dong-fu-*.png).
- Existing asset: `building-plaque` chrome slot is ready - need to verify its drawn orientation at runtime scale before requesting a vertical variant.
- Status: OPEN - verify orientation first; art request only if slot is horizontal-only.

### GAP-04 (none yet)

## Excluded-content placeholders (NOT blockers, per mission §3)

- Technique artifact/book centerpiece (content illustration) -> use `technique-display-plinth` + neutral slot.
- Skill node icons beyond dao-luan-node/rune-node chrome -> runtime glyph/symbol.
- Inventory/equipment item icons -> existing SlotView art.
- Alchemy materials -> chip/slot chrome only.
- Enemy portraits in exploration detail -> existing roster art slots.
- Tribulation entity figure -> existing renderer layers.
- Victory/Defeat calligraphy flourish art -> app-rendered title over `ceremony-ribbon` ornament.

## Decisions to confirm during implementation

- Whether S04 Character interior keeps flat paper or gets a subtle vista wash (ref shows full-bleed vista behind panels - the scroll envelope still frames it).
- Currency pills: verify all 3 SPIRIT_STONE_MATERIALS tiers render (before shot showed 1 pill on fresh mortal - check if zero tiers are hidden or collapsed).
