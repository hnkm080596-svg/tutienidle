# Character paper and figure

2026-10-03. Built-in ImageGen. Reference: `references/huyen-kim/scenes/04-character.jpg`.

Saved assets: `public/assets/ui/huyen-kim/scene/character-v2/figure.png` (transparent figure), `paper-nine-slice.png` (paper texture; CSS slice 300 each side, display border 83 design px). Existing element discs and dark nine-slice chrome are reused.

No Character background asset is used. The extra environment generation completed before the user's correction, was rejected, and remains outside the project. The host reuses the approved Dong Fu backdrop; the Character component contains only the paper panel and its contents.

## characterFigurePrompt

Use case: background-extraction. Image 1 is the exact pose and character target. Extract ONLY the seated long-haired male cultivator in the center, with black ivory and gold flowing ornate robes, red ribbons, one hand extended to the right palm up, the other arm relaxed across lap. Preserve his face, hair, clothing, pose and painterly realistic cultivation fantasy style closely. Full body entire trailing robe and hair inside frame, no crop. Remove every UI element, text, elemental orb, gold orbit line, background, paper scroll, mountains and plants. No magical orbs in the empty right palm. Genuine alpha transparency outside the character. Match the existing illustrated figure, not chibi, not modern cartoon. Square canvas tightly fitted around complete seated silhouette with small clear margin.

## characterPaperPrompt

Use case: precise-object-edit. Image 1 is a style reference for the cream PAPER SCROLL behind the character. Create a standalone square NINE-SLICE UI source texture for that aged ivory silk-paper panel. Warm ivory rice-paper with subtle ink wash mottling and fine natural fibers, gently darkened worn thin edge, delicate black ink and antique-gold curled ornamental CORNERS only, restrained gold flecks. All identifiable ornament must stay entirely inside the outer 20% corner squares. Middle edge strips must be straight with consistent thin ink-gold edging and can stretch; center must be quiet plain creamy parchment, no bamboo no pictures no text no glyphs. No roller attached, no poles, no title crest, no raised bevel or modern vector frame. Actual painted material matching reference paper. Flat orthographic square, generous blank interior for live UI. No people no interface content no circles no illustrations. Genuine alpha transparent outside minimal even margin. Edges and center will stretch separately, four corners stay fixed.
