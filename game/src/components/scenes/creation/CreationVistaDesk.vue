<script setup lang="ts">
// Scene 02 vista prop - the scholar's desk strip under the scroll in the
// ref: dark wood slab, a half-unrolled scroll, and an ember-warm incense
// burner at the far right. TEMP ART until the painted props land.
</script>

<template>
  <div class="creation-vista-desk">
    <div
      class="creation-vista-desk__slab art-needed"
      data-art-id="creation-vista-desk"
    />
    <!-- The lone cream desk-scroll prop read as a stray fragment floating
         under the scroll's bottom rail at runtime; drop it until the
         painted prop set lands. -->
    <div
      class="creation-vista-desk__burner art-needed"
      data-art-id="creation-desk-burner"
    />
  </div>
</template>

<style scoped>
.creation-vista-desk {
  position: absolute;
  /* desk band hugs the bottom-right of the scene, beneath the scroll */
  left: 52%;
  right: 0;
  bottom: 0;
  height: 17%;
  pointer-events: none;
}

.creation-vista-desk__slab {
  position: absolute;
  inset: 38% 0 0 0;
  background:
    linear-gradient(180deg, rgba(185, 154, 85, 0.30), transparent 14%),
    repeating-linear-gradient(90deg, rgba(237, 230, 214, 0.03) 0 6px, transparent 6px 22px),
    linear-gradient(180deg, #2a1f16 0%, #14100c 62%, #0b0806 100%);
  box-shadow: 0 -14px 30px rgba(5, 8, 9, 0.45);
}

.creation-vista-desk__scroll {
  position: absolute;
  left: 22%;
  bottom: 34%;
  width: 30%;
  height: 34%;
  border-radius: 4px;
  background:
    radial-gradient(50% 80% at 12% 50%, rgba(122, 98, 52, 0.9), rgba(122, 98, 52, 0) 60%),
    linear-gradient(100deg, #d8cdb2 0%, #ede6d6 30%, #c9bd9f 78%, #8f8368 100%);
  box-shadow: 0 4px 10px rgba(5, 8, 9, 0.55), inset -4px 0 8px rgba(122, 98, 52, 0.5);
  display: none;
}

.creation-vista-desk__burner {
  position: absolute;
  right: 6%;
  bottom: 42%;
  width: 13%;
  height: 46%;
  border-radius: 46% 46% 40% 40% / 60% 60% 34% 34%;
  background:
    radial-gradient(42% 30% at 50% 8%, rgba(232, 195, 90, 0.85), rgba(232, 195, 90, 0) 70%),
    radial-gradient(90% 70% at 50% 100%, #3d2c1a 30%, #191310 72%);
  box-shadow: 0 0 22px rgba(232, 195, 90, 0.28), inset 0 -8px 12px rgba(5, 8, 9, 0.6);
}
</style>
