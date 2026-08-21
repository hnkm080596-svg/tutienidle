<script setup lang="ts">
// Phù Viện (Home Hub Phase 4) — y hệt FormationAltarPanel.vue, dùng
// TalismanBagSection thay FormationBagSection. UI redesign Step 9 —
// pendingEquipTarget giờ trỏ sang 'inventory', xem ghi chú
// FormationAltarPanel.vue.
import { computed } from 'vue'
import RecipeCraftingView from './RecipeCraftingView.vue'
import TalismanBagSection from './bag-sections/TalismanBagSection.vue'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const selectedTalismanId = computed(() =>
  ui.pendingEquipTarget?.kind === 'talisman' ? ui.pendingEquipTarget.id : null,
)

function toggleTalismanSelection(talismanId: string) {
  if (selectedTalismanId.value === talismanId) {
    ui.pendingEquipTarget = null

    return
  }

  ui.pendingEquipTarget = { kind: 'talisman', id: talismanId }
  ui.leftPanelMode = 'inventory'
}
</script>

<template>
  <BuildingConstructionGate building-id="talisman_institute">
    <div class="talisman-institute">
      <div class="talisman-institute__crafting">
        <RecipeCraftingView result-type="talisman" />
      </div>

      <div class="talisman-institute__bag">
        <TalismanBagSection :selected-id="selectedTalismanId" @toggle="toggleTalismanSelection" />
      </div>
    </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.talisman-institute {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.talisman-institute__crafting {
  flex: 1 1 60%;
  min-height: 0;
  border-bottom: 1px solid var(--ink-line);
}

.talisman-institute__bag {
  flex: 1 1 40%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
}
</style>
