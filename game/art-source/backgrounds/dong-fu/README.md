# Dong Fu modular art source

Edit target: `approved/dong-fu-master.png`.

Preserve in every season: mountain and ledge silhouettes, river islands, the long straight cliff baseline, building gaps, exact center cultivation dais, and full-canvas alignment.

Generate every overlay on perfectly uniform white xuan paper with no checkerboard and no colored chroma. Never add buildings, characters, UI, text, seals, purple, or magenta. Time plates contain only sky and light; season plates contain landscape and weather.

## Seasonal treatments

- Spring: soft gray ink, pale jade shoots, restrained blossom marks, and light rain mist.
- Summer: deeper ink, full dark-green pines, stronger waterfalls, and humid rolling cloud.
- Autumn: warm earth and restrained cinnabar, sparse falling leaves, and clearer dry air.
- Winter: near-monochrome ink, snow on ledges and pines, thinner vegetation, and cold fog.

## Time treatments

- Morning: warm ivory dawn, low luminous haze, and long soft cloud bands.
- Noon: whiter paper light, crisp ink contrast, and reduced warmth.
- Evening: muted antique-gold and cinnabar wash with darker cloud undersides.
- Night: charcoal-indigo ink wash, moonlit paper highlights, and no neon-blue glow.

## Plate contract

All source and runtime plates use a `1672 × 941` canvas. The approved master is the geometry and style anchor. The four accepted seasonal masters live in `seasonal-masters/`. A layer extraction may remove content but must not reposition retained content.

The generated isolated-ground candidates were rejected because object isolation recentered their baselines. Runtime `07-sect-ground.png` files are therefore masked directly from their aligned seasonal masters with the same fixed coordinate mask, preserving the straight buildable baseline and central dais between seasons.

The approved repaired masks live in `layer-masks/`. Run `scripts/refine-dong-fu-sect-ground-alpha.ps1` to rebuild each runtime layer from its immutable seasonal master plus that season's mask. The masks clear the pale rectangular paper matte around the center dais while keeping the dais and straight baseline. The script never feeds runtime output back into extraction, so repeated runs cannot erode soft ink edges.

Runtime skies are opaque PNG24; every other runtime plate is RGBA with genuine transparency. White extraction plates are converted with a per-pixel white unmatte so pale brush edges do not retain opaque paper or a checkerboard.
