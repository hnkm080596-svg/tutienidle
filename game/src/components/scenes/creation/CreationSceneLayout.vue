<script setup lang="ts">
// Scene 02 (R00) layout shell — design space 1672×941
// (huyen-kim-scene-layout-spec.json scene_id "02"):
//   vista           0/0/940/941   left 56% art column (full-bleed underneath)
//   back-btn        24/24/96/40   top-left ghost
//   creation-scroll 940/90/660/760 right ~39.5% imperial scroll
// Slots map one region each; children own the region internals.
</script>

<template>
  <main class="creation-layout" data-testid="character-creation-screen" data-hk-scene="creation">
    <div class="creation-layout__vista" data-hk-region="vista">
      <slot name="vista" />
    </div>
    <div class="creation-layout__back" data-hk-region="back-btn">
      <slot name="back" />
    </div>
    <div class="creation-layout__scroll" data-hk-region="creation-scroll">
      <slot name="scroll" />
    </div>
  </main>
</template>

<style scoped>
.creation-layout {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--hk-surface-base, #101718);
}

/* vista is a full-bleed art bed; its focus column is the left ~56%. */
.creation-layout__vista {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.creation-layout__back {
  position: absolute;
  /* 24/1672 · 24/941 */
  left: 1.44%;
  top: 2.55%;
  z-index: 12;
}

.creation-layout__scroll {
  position: absolute;
  /* 940/1672 · 90/941 · 660/1672 · 760/941 */
  left: 56.22%;
  top: 9.56%;
  width: 39.47%;
  min-width: 500px;
  height: 80.77%;
  z-index: 10;
}

@media (max-width: 1100px) {
  .creation-layout {
    overflow-y: auto;
  }
  .creation-layout__scroll {
    left: 4%;
    top: 8%;
    width: 92%;
    min-width: 0;
    height: 84%;
  }
}
</style>
