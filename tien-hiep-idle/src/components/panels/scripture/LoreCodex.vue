<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — grid vật phẩm lore SỞ HỮU
// (category 'other', vô thưởng vô phạt — xem data/materials/materials.ts's
// Tàn Quyển Trúc Cơ/Ngọc Giản Cũ/Nhật Ký Tu Sĩ/Mảnh Bia), click mở
// LoreCodexModal (Phase 2) đọc trọn mô tả — CHỈ hiện item ĐÃ NHẶT
// được, không liệt kê toàn bộ danh sách như TechniqueCodex (đúng tinh
// thần "manh mối phải tự tìm thấy", không phải browse catalog biết
// trước).
import { computed, ref } from 'vue'
import SlotView from '../../common/SlotView.vue'
import LoreCodexModal from '../LoreCodexModal.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const openedContent = ref<{ title: string; description: string } | null>(null)

const loreItems = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAll()
    .filter(stack => stack.material.category === 'other')
    .map(stack => ({
      key: stack.material.id,
      label: stack.material.name,
      description: stack.material.description,
      amount: stack.amount,
      onClick: () => {
        openedContent.value = { title: stack.material.name, description: stack.material.description ?? '' }
      },
    }))
})
</script>

<template>
  <div class="lore-codex">
    <p v-if="loreItems.length === 0" class="lore-codex__empty">Chưa tìm thấy manh mối nào.</p>

    <div v-else class="lore-codex__grid">
      <SlotView
        v-for="item in loreItems"
        :key="item.key"
        class="lore-codex__slot"
        :item="item"
        :label="item.label"
        :description="item.description"
        :amount="item.amount"
        @click="item.onClick"
      />
    </div>

    <LoreCodexModal :content="openedContent" @close="openedContent = null" />
  </div>
</template>

<style scoped>
.lore-codex {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
  box-sizing: border-box;
  font-family: var(--font-body);
}

.lore-codex__empty {
  margin: 0;
  padding: 12px;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: center;
}

.lore-codex__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lore-codex__slot {
  flex: 0 0 56px;
  width: 56px;
}
</style>
