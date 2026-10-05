# Shared typography and anchored effects

Worktree: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`; branch: `codex/tien-hiep-ui-redesign`. Local changes only, no commit/push. This report covers the design-first examples, not production completion.

Source Serif 4 regular and bold are local files under `public/assets/fonts/source-serif-4/`, with the upstream SIL Open Font License. Source: [Google Fonts](https://fonts.google.com/specimen/Source+Serif+4). `pc-paper-type.css` owns the font faces and body/title variables. Titles use bold serif; content uses regular serif; buttons/tabs share the same family. The glyph verifier checks Latin, digits and every precomposed Vietnamese letter in both files. No remote font request is needed while playing.

`PcBodyDiagram.vue` owns the decorative raster, coordinate system and anchored effects used by Luyen The, Kinh Mach and Chu Thien. The diagram is extracted from the approved reference, not main-character art. One Arcadia-authored RGBA aura is reused at three existing authored nodes; one CSS/SVG line travels along the drawn centerline. Original effect source, atlas, provenance, alpha and isolated visual proof are in `art/vfx/pc-paper-meridian/`. The effect never advances cultivation or spends resources.

The image and SVG use the same 1174x1178 contain geometry. Effect nodes do not participate in layout, intercept input, or change diagram dimensions. Reduced motion disables the travelling line and uses the Arcadia still. No extra full-scene art was generated for these three consumers.

Browser evidence must load actual font files before capture. Typography changes invalidate previous text-flow evidence: repeat control containment in the viewport and inspector, then visually inspect complete scenes at 1672x941 and1280x720. The current gallery contains32 examples; `capture-pc-design-gallery.mjs` captures both sizes and checks image decode, font loading, page errors and control containment. Screenshot success is design evidence, not functional or aggregate QA acceptance.
