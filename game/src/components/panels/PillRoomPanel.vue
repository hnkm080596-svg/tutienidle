<script setup lang="ts">
// Đan Phòng (Home Hub Phase 3) — panel khu vực ĐẦU TIÊN, validate
// pattern "ghép RecipeCraftingView (không sửa) + 1 bag-section" trước
// khi lặp lại cho Trận Đài/Phù Viện/Khí Đường. Không có pending-target
// flow (uống pill tức thời, không cần chọn đích).
import RecipeCraftingView from './RecipeCraftingView.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
</script>

<template>
  <BuildingConstructionGate building-id="pill_room">
    <div class="pill-room">
      <div class="pill-room__crafting">
        <RecipeCraftingView result-type="pill" />
      </div>

      <div class="pill-room__bag">
        <PillBagSection />
      </div>
    </div>
  </BuildingConstructionGate>
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
