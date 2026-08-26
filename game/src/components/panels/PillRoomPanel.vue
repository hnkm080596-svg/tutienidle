<script setup lang="ts">
// Đan Phòng (2026-08-25) — Luyện Đan qua AlchemyView + túi Đan.
import AlchemyView from './AlchemyView.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
</script>

<template>
  <div class="pill-room">
    <div class="pill-room__crafting">
      <AlchemyView />
    </div>

    <div class="pill-room__bag">
      <PillBagSection />
    </div>
  </div>
</template>

<style scoped>
.pill-room {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.pill-room__crafting {
  flex: 1 1 60%;
  min-height: 0;
  border-bottom: 1px solid var(--ink-line);
}

.pill-room__bag {
  flex: 1 1 40%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
}
</style>
