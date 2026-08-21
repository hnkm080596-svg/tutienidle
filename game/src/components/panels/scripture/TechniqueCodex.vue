<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — catalog TOÀN BỘ công pháp trong
// data, không chỉ những cái đã học. Đã học → dùng lại TechniqueSlotCard
// (Phase 6, equip/unequip y hệt Động Phủ/LoadoutManager). Chưa học →
// hiện tên/mô tả (sẵn trên template tĩnh, KHÔNG lộ stat/modifiers),
// làm mờ, không click được — cơ chế HỌC (qua item drop, xem
// GameManager.grantItemDrops()'s case 'technique') đã hoạt động sẵn,
// panel này chỉ là UI browse, không thêm cơ chế mới.
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import TechniqueSlotCard from '../loadout-sections/TechniqueSlotCard.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { TECHNIQUES } from '@/data/technique/Techniques'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Tâm Pháp hợp nhất (2026-08-15) — không còn 3 nhóm theo type, chỉ 1
// danh sách phẳng toàn bộ công pháp trong data.
const techniqueRows = computed(() => {
  stateVersion.value

  return TECHNIQUES.map(technique => ({
    id: technique.id,
    name: technique.name,
    description: technique.description,
    owned: gameManager.techniqueManager.has(technique.id),
  }))
})
</script>

<template>
  <div class="technique-codex">
    <div class="technique-codex__group">
      <h5 class="technique-codex__title">Tâm Pháp</h5>

      <!-- Đã trang bị (nếu có) — dùng chung TechniqueSlotCard, biến thể
           hero (Step 12, spec mục 15) khớp focal point "Bí kíp/sách"
           của chính màn Tàng Kinh Các (spec mục 23). -->
      <TechniqueSlotCard label="Tâm Pháp" size="hero" />

      <div class="technique-codex__grid">
        <SlotView
          v-for="entry in techniqueRows"
          :key="entry.id"
          class="technique-codex__slot"
          :class="{ 'is-locked': !entry.owned }"
          :item="entry.owned ? entry : null"
          :label="entry.owned ? entry.name : '???'"
          :description="entry.owned ? entry.description : 'Chưa học được công pháp này.'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.technique-codex {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--font-body);
}

.technique-codex__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.technique-codex__title {
  margin: 0;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--gold-500);
}

.technique-codex__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.technique-codex__slot {
  flex: 0 0 56px;
  width: 56px;
}

.technique-codex__slot.is-locked {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}
</style>
