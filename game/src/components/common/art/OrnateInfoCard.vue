<script setup lang="ts">
import { dialogArt } from './dialogArt'

// Info-card row slice (ornate panel with a built-in dark item square on
// the left). The default slot renders in the cream zone right of the
// square and scrolls inside it when the content is taller; the optional
// `icon` slot fills the dark square. Art keeps its native 627x234 aspect.
const cardUrl = dialogArt('info-card-v1')
</script>

<template>
  <div class="ornate-info-card">
    <img class="ornate-info-card__art" :src="cardUrl" alt="" aria-hidden="true" draggable="false" />
    <div v-if="$slots.icon" class="ornate-info-card__icon"><slot name="icon" /></div>
    <div class="ornate-info-card__content"><slot /></div>
  </div>
</template>

<style scoped>
.ornate-info-card {
  position: relative;
  flex: none;
  width: var(--ornate-info-card-width, 100%);
  aspect-ratio: 627 / 234;
}

.ornate-info-card__art {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  user-select: none;
}

/* Dark item square occupies roughly x 12-40%, y 11-85% of the art. */
.ornate-info-card__icon {
  position: absolute;
  left: 13.5%;
  top: 14%;
  width: 25%;
  height: 70%;
  display: grid;
  place-items: center;
}

.ornate-info-card__icon :deep(img) {
  max-width: 82%;
  max-height: 82%;
  object-fit: contain;
}

/* Cream zone right of the square (below the card's inner ornament line);
   content scrolls inside instead of resizing the card. */
.ornate-info-card__content {
  position: absolute;
  left: 42.5%;
  right: 8.5%;
  top: 30%;
  bottom: 12%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(122, 90, 40, 0.4) transparent;
  color: var(--paper-text, #302719);
  font-family: var(--hk-font-ui);
  font-size: min(2.7cqh, var(--text-sm));
  line-height: 1.45;
}
</style>
