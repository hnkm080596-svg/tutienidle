# Dong Fu modular parallax assets

Runtime composes ten full-canvas `1672 × 941` textures in this order:

1. `times/<time>/00-sky.png` — opaque paper sky and primary light.
2. `times/<time>/01-high-clouds.png` — transparent high cloud bands.
3. `times/<time>/02-light-veil.png` — transparent horizon illumination and haze.
4. `seasons/<season>/03-far-mountains.png` — pale far peaks.
5. `seasons/<season>/04-distant-ledges.png` — substantial distant ledges and sparse pines.
6. `seasons/<season>/05-mid-landscape.png` — middle cliffs, pines and waterfalls.
7. `seasons/<season>/06-water-valley.png` — river, islands, reflections and valley haze.
8. `seasons/<season>/07-sect-ground.png` — straight buildable cliff and fixed center dais.
9. `seasons/<season>/08-low-mist.png` — drifting low mist ribbons.
10. `seasons/<season>/09-foreground.png` — near rocks, branches, vegetation and mist.

There are four time sets (`morning`, `noon`, `evening`, `night`) and four season sets (`spring`, `summer`, `autumn`, `winter`): 12 time textures plus 28 seasonal textures, yielding all 16 combinations from 40 runtime PNGs. Only `00-sky.png` is opaque PNG24; all other textures are RGBA PNGs with genuine alpha.

`DongFuScene.vue` reads the shared combat `ThanhVanVariant`, preloads all ten incoming textures, then swaps and crossfades the stack as one unit. A failed incoming texture leaves the previous complete stack visible.

`previews/<season>-<time>.png` and `previews/all-16-contact-sheet.png` are flattened QA artifacts only. They must not be referenced by runtime code.
