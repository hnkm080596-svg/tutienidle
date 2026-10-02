<script setup lang="ts">
// Scene 02 vista prop — the seated cultivator on the rock ledge, the ref's
// focal figure (R00 left half, facing the moon over the sea of clouds).
// TEMP ART: silhouette placeholder until Minh's figure painting lands.
</script>

<template>
  <div class="creation-vista-figure">
    <div
      class="creation-vista-figure__rock art-needed"
      data-art-id="creation-vista-rock"
    />
    <div
      class="creation-vista-figure__body art-needed"
      data-art-id="creation-vista-figure"
    />
  </div>
</template>

<style scoped>
.creation-vista-figure {
  position: absolute;
  /* seated figure + ledge dominate the vista's left half in the ref
     (~760×710 design px; the right edge slides under the scroll) */
  left: 4%;
  top: 9%;
  width: 46%;
  height: 86%;
  pointer-events: none;
}

/* Rock ledge under the figure — dark crag catching moon rim-light. */
.creation-vista-figure__rock {
  position: absolute;
  left: -16%;
  right: -24%;
  bottom: 2%;
  height: 36%;
  border-radius: 42% 58% 55% 45% / 60% 55% 45% 40%;
  background:
    radial-gradient(90% 60% at 30% 18%, rgba(185, 154, 85, 0.20), transparent 55%),
    radial-gradient(120% 90% at 60% 110%, #101718 40%, rgba(16, 23, 24, 0.2)),
    linear-gradient(160deg, #232d2c 0%, #101718 68%);
  box-shadow: inset 0 10px 22px rgba(185, 154, 85, 0.08), 0 -18px 38px rgba(5, 8, 9, 0.5);
}

/* Seated profile facing right: head + topknot, flowing hair behind,
   raised knees, robe pooling over the ledge. Ivory robe mass below,
   ink mass above — the ref's white-robe/black-hair read. */
.creation-vista-figure__body {
  position: absolute;
  left: 12%;
  top: 0;
  width: 70%;
  height: 84%;
  clip-path: polygon(
    58% 0%, 66% 1%, 71% 6%, 70% 12%, 66% 15%, 68% 20%,
    76% 28%, 79% 38%, 74% 48%, 79% 60%, 84% 76%, 88% 92%,
    74% 97%, 54% 98%, 38% 95%, 28% 89%, 24% 78%, 27% 66%,
    33% 54%, 38% 44%, 43% 34%, 48% 24%, 53% 15%, 54% 7%
  );
  background:
    radial-gradient(60% 26% at 58% 12%, #101718 55%, transparent 72%),
    linear-gradient(180deg, #101718 0%, #1b2621 34%, rgba(237, 230, 214, 0.55) 62%, rgba(237, 230, 214, 0.82) 100%);
  filter: drop-shadow(4px 2px 8px rgba(185, 154, 85, 0.35)) drop-shadow(-6px 0 14px rgba(5, 8, 9, 0.55));
}
</style>
