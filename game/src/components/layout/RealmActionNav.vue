<script setup lang="ts">
// Bottom bar, bên PHẢI (đối xứng DongFuQuickNav bên trái) — nút tắt
// các hệ thống "signature" theo cảnh giới. Luyện Thể (2026-08-22) KHÔNG
// còn giới hạn riêng Phàm Nhân nữa — luôn hiện để người chơi xem lại
// tiến độ/kết quả dù đã rời Phàm Nhân (panel tự chuyển read-only, xem
// LuyenThePanel.vue's isPhamNhan). Hệ thống tương lai (vd Trúc Cơ →
// Pháp Bảo, CHƯA phát triển) sẽ thêm entry RIÊNG với điều kiện hiện
// của chính nó vào ACTIONS bên dưới — không dùng chung 1 cờ theo
// realmId nữa (mỗi hệ thống tự quyết định khi nào đáng hiện).
import { computed } from 'vue'
import { useUiStore, type StandalonePanel } from '@/stores/ui'

const ui = useUiStore()

interface RealmAction {
  label: string
  panel: Exclude<StandalonePanel, null>
}

// Thêm entry mới ở đây khi 1 hệ thống signature khác ra đời (vd Pháp
// Bảo cho Trúc Cơ).
const ACTIONS: RealmAction[] = [
  { label: 'Luyện Thể', panel: 'luyen_the' },
]

const actions = computed(() => ACTIONS)
</script>

<template>
  <div v-if="actions.length > 0" class="realm-action-nav">
    <button
      v-for="action in actions"
      :key="action.panel"
      type="button"
      class="realm-action-nav__btn"
      :class="{ 'is-active': ui.standalonePanel === action.panel }"
      @click="ui.toggleStandalonePanel(action.panel)"
    >
      <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="7" width="3" height="6" rx="1" stroke-linejoin="round" />
        <rect x="15" y="7" width="3" height="6" rx="1" stroke-linejoin="round" />
        <line x1="5" y1="10" x2="15" y2="10" stroke-linecap="round" />
      </svg>
      <span>{{ action.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.realm-action-nav {
  display: flex;
  align-items: stretch;
  gap: var(--space-1);
}

/* WS4 — đồng bộ shortcut sizing với DongFuQuickNav (72-88px, tap >= 40). */
.realm-action-nav__btn {
  position: relative;
  width: clamp(72px, 7vw, 88px);
  min-height: var(--tap-min);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.15s ease, background 0.15s ease;
}

.realm-action-nav__btn span {
  font-size: var(--text-xs);
  line-height: var(--lh-tight);
  white-space: nowrap;
}

.realm-action-nav__btn::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 3px;
  height: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.15s ease;
}

.realm-action-nav__btn:hover {
  color: var(--gold-300);
  background: rgba(255, 255, 255, 0.04);
}

.realm-action-nav__btn.is-active {
  color: var(--gold-500);
  background: rgba(255, 213, 79, 0.1);
}

.realm-action-nav__btn.is-active::after {
  background: var(--gold-500);
}

.realm-action-nav__btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring-gold);
}
</style>
