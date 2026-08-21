<script setup lang="ts">
// UI redesign (spec mục 3/25 — Bottom quick navigation) — CHỈ 4 hệ
// thống cấp cao (Nhân Vật/Kho/Kỹ Năng/Tâm Pháp), không liệt kê Đan/Phù/
// Khí/Trận/Thám Hiểm/Tàng Kinh Các (đã có world location riêng ở
// Động Phủ, xem HomeBuildingIcons.vue). "Kỹ Năng"/"Tâm Pháp" (2026-08-20)
// giờ mở 2 overlay ĐỘC LẬP (SkillPathPanel.vue/TechniquePanel.vue, xem
// ui.standalonePanel) thay vì cùng panel 'loadout' (LoadoutManager.vue,
// đã xoá) khác tab như trước.
import { useUiStore, type LeftPanelMode } from '@/stores/ui'

const ui = useUiStore()

function open(mode: Exclude<LeftPanelMode, null>) {
  ui.leftPanelMode = mode
}
</script>

<template>
  <div class="dongfu-quicknav">
    <button
      type="button"
      class="dongfu-quicknav__btn"
      :class="{ 'is-active': ui.leftPanelMode === 'character' }"
      @click="open('character')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="10" cy="6.5" r="3.2" />
        <path d="M3.5 17c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" stroke-linecap="round" />
      </svg>
      <span>Nhân Vật</span>
    </button>

    <button
      type="button"
      class="dongfu-quicknav__btn"
      :class="{ 'is-active': ui.leftPanelMode === 'inventory' }"
      @click="open('inventory')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 8h14l-1 9H4L3 8Z" stroke-linejoin="round" />
        <path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2" stroke-linecap="round" />
      </svg>
      <span>Kho</span>
    </button>

    <button
      type="button"
      class="dongfu-quicknav__btn"
      :class="{ 'is-active': ui.standalonePanel === 'skill' }"
      @click="ui.toggleStandalonePanel('skill')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
        <path d="M10 2.5l1.9 4.1 4.4.5-3.3 3 .9 4.4L10 12.4l-3.9 2.1.9-4.4-3.3-3 4.4-.5L10 2.5Z" />
      </svg>
      <span>Kỹ Năng</span>
    </button>

    <button
      type="button"
      class="dongfu-quicknav__btn"
      :class="{ 'is-active': ui.standalonePanel === 'technique' }"
      @click="ui.toggleStandalonePanel('technique')"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M5 3h8l2 2v12H5V3Z" stroke-linejoin="round" />
        <line x1="7.5" y1="7" x2="12.5" y2="7" stroke-linecap="round" />
        <line x1="7.5" y1="10" x2="12.5" y2="10" stroke-linecap="round" />
      </svg>
      <span>Tâm Pháp</span>
    </button>
  </div>
</template>

<style scoped>
.dongfu-quicknav {
  display: flex;
  align-items: stretch;
  gap: 2px;
}

.dongfu-quicknav__btn {
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.15s ease, background 0.15s ease;
}

.dongfu-quicknav__btn span {
  font-size: 0.6rem;
}

.dongfu-quicknav__btn:hover {
  color: var(--gold-300);
  background: rgba(255, 255, 255, 0.04);
}

.dongfu-quicknav__btn.is-active {
  color: var(--gold-500);
  background: rgba(255, 213, 79, 0.08);
}
</style>
