<script setup lang="ts">
import { dialogArt } from './dialogArt'

// Long ornament divider slice - decorative separator between a dialog's
// message and its detail content (see confirm-dialog-mock). Renders at
// the caller's chosen width; aspect is preserved by the art itself.
const dividerUrl = dialogArt('divider-ornate-v1')
</script>

<template>
  <img class="ornate-divider" :src="dividerUrl" alt="" aria-hidden="true" draggable="false" />
</template>

<style scoped>
.ornate-divider {
  display: block;
  flex: none;
  width: 96%;
  margin: 0.6cqh 0;
  pointer-events: none;
  user-select: none;
}
</style>
