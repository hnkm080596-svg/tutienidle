<script setup lang="ts">
// Scene 05 rail section header: small gold diamond gem + display text
// (ref: "Tu Luyen Tien Do", "Thien Phu Canh Gioi", ... bullets).
defineProps<{ title: string }>()
</script>

<template>
  <h3 class="realm-section">
    <i class="realm-section__gem art-needed" data-art-id="realm-section-gem" aria-hidden="true" />
    <span>{{ title }}</span>
  </h3>
</template>

<style scoped>
.realm-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--hk-text-secondary, #b8ae97);
  font: 600 var(--text-xs) var(--font-display, serif);
  letter-spacing: 0.1em;
}
/* Gold diamond bullet (temp art - ref's tiny lozenge before each
   section label). */
.realm-section__gem {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  transform: rotate(45deg);
  background: linear-gradient(135deg, #e8c35a, #b99a55);
  box-shadow: 0 0 5px rgba(232, 195, 90, 0.5);
}
</style>
