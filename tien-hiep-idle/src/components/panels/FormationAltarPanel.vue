<script setup lang="ts">
// Trận Đài (Home Hub Phase 4) — ghép RecipeCraftingView (không sửa)
// + FormationBagSection. Chọn "khảm vào vũ khí" → set
// ui.pendingEquipTarget rồi điều hướng sang Kho (equipment giờ ở panel
// KHÁC, không còn là tab-flip trong cùng 1 panel như BagGrid.vue cũ).
// UI redesign Step 9 — trỏ sang 'inventory' (KHÔNG còn 'equipment_hall',
// Khí Đường đã thu gọn về thuần Luyện Khí, không còn bag equip) —
// BagGrid.vue đọc pendingEquipTarget để ép tab Trang Bị + hiện hint,
// xử lý xong tự quay lại đây.
import { computed } from 'vue'
import RecipeCraftingView from './RecipeCraftingView.vue'
import FormationBagSection from './bag-sections/FormationBagSection.vue'
import BuildingConstructionGate from './BuildingConstructionGate.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const selectedFormationId = computed(() =>
  ui.pendingEquipTarget?.kind === 'formation' ? ui.pendingEquipTarget.id : null,
)

function toggleFormationSelection(formationId: string) {
  if (selectedFormationId.value === formationId) {
    ui.pendingEquipTarget = null

    return
  }

  ui.pendingEquipTarget = { kind: 'formation', id: formationId }
  ui.leftPanelMode = 'inventory'
}
</script>

<template>
  <BuildingConstructionGate building-id="formation_altar">
    <div class="formation-altar">
      <div class="formation-altar__crafting">
        <RecipeCraftingView result-type="formation" />
      </div>

      <div class="formation-altar__bag">
        <FormationBagSection :selected-id="selectedFormationId" @toggle="toggleFormationSelection" />
      </div>
    </div>
  </BuildingConstructionGate>
</template>

<style scoped>
.formation-altar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.formation-altar__crafting {
  flex: 1 1 60%;
  min-height: 0;
  border-bottom: 1px solid var(--ink-line);
}

.formation-altar__bag {
  flex: 1 1 40%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
}
</style>
