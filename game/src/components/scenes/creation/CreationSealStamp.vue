<script setup lang="ts">
// Scene 02 prop - the cinnabar seal stamp pressed beside the title in the
// ref. Art-qa wave B: the placeholder CSS stamp is hidden until the seal
// art lands - the span keeps the data-art-id hook but paints nothing.
</script>

<template>
  <span
    class="creation-seal-stamp art-needed"
    data-art-id="creation-title-seal"
    aria-hidden="true"
  />
</template>

<style scoped>
/* Hidden per wave B: no invented CSS art stands in for the missing seal
   painting. The element stays mounted so the art-request id still maps
   to a DOM anchor. */
.creation-seal-stamp {
  display: inline-block;
  width: clamp(22px, 2.6vw, 34px);
  aspect-ratio: 5 / 6;
  visibility: hidden;
}
</style>
