<script setup lang="ts">
// Scene 03 vista fallback (spec region `vista`): the flat CSS stand-in
// painted only while the parallax PNG stack loads. Every surface here is
// temporary CSS art pending the vista paint set (see
// docs/design/art-requests/03-dong-fu.md) - each carries
// art-needed + data-art-id for the art inventory.
</script>

<template>
  <div class="dong-fu-vista-fallback" aria-hidden="true">
    <div
      class="home-scene__sky"
      art-needed
      data-art-id="dong-fu-vista-sky"
    />
    <div
      class="home-scene__mountains home-scene__mountains--far"
      art-needed
      data-art-id="dong-fu-vista-mountains-far"
    />
    <div
      class="home-scene__mountains"
      art-needed
      data-art-id="dong-fu-vista-mountains"
    />
    <div
      class="home-scene__ground"
      art-needed
      data-art-id="dong-fu-vista-ground"
    />
  </div>
</template>

<style scoped>
.dong-fu-vista-fallback {
  position: absolute;
  inset: 0;
}

.dong-fu-vista-fallback > * {
  position: absolute;
}

.home-scene__sky {
  inset: 0;
  background: linear-gradient(180deg, var(--ink-950) 0%, var(--ink-900) 38%, var(--ink-800) 62%, var(--ink-800) 100%);
}

.home-scene__mountains {
  left: 0;
  right: 0;
  top: 28%;
  height: 32%;
  background-color: var(--ink-900);
  opacity: 0.9;
  clip-path: polygon(0% 100%, 0% 62%, 9% 40%, 18% 58%, 27% 30%, 38% 52%, 48% 22%, 60% 50%, 71% 34%, 82% 56%, 91% 38%, 100% 60%, 100% 100%);
}

.home-scene__mountains--far {
  top: 32%;
  height: 30%;
  background-color: var(--ink-900);
  opacity: 0.75;
  clip-path: polygon(0% 100%, 0% 74%, 12% 56%, 24% 70%, 36% 48%, 50% 66%, 63% 46%, 76% 68%, 88% 52%, 100% 72%, 100% 100%);
}

.home-scene__ground {
  left: 0;
  right: 0;
  bottom: 0;
  top: 64%;
  background: linear-gradient(180deg, var(--ink-900) 0%, var(--ink-900) 55%, var(--ink-950) 100%);
  border-top: 1px solid color-mix(in srgb, var(--text-primary) 4%, transparent);
}
</style>
