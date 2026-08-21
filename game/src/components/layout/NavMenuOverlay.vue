<script setup lang="ts">
import { useUiStore, type LeftPanelMode } from '@/stores/ui'

const ui = useUiStore()

// Home Hub (beta plan Phase 8) — 6 khu vực mới lên đầu (Động Phủ/Khí
// Đường/Trận Đài/Phù Viện/Đan Phòng/Tàng Kinh Các), tiện ích cũ giữ
// nguyên phía sau — 'character' TÁI DÙNG label "Động Phủ" thay "Nhân
// Vật" (cùng component CharacterPanel.vue, chỉ đổi tên hiển thị cho
// khớp Home Hub, xem Context #4 kế hoạch).
//
// Thám Hiểm rework (2026-08-14) — 'building' (Kiến Trúc) VÀ
// 'asset_reference' bị GỠ khỏi menu: Kiến Trúc thay bằng icon Building
// đặt trong Home Scene (xem HomeBuildingIcons.vue — mọi Building giờ
// xây/nâng cấp/thu hoạch qua icon, không qua panel liệt kê phẳng nữa),
// Asset Reference là dev-tool, không thuộc nav người chơi. 'exploration'
// đổi label "Thu Thập" → "Tầm Bảo" (chỉ đổi tên hiển thị, hệ thống
// gather nguyên liệu tự động phía sau KHÔNG đổi) — tránh nhầm với
// 'stage_select' (nhãn "Thám Hiểm", màn hình chọn Địa Giới/Màn trước
// khi vào trận, thay nút "Chiến Đấu" cũ).
//
// "Công Pháp" (mode 'loadout') tách thành 2 entry riêng (2026-08-20) —
// Kỹ Năng/Tâm Pháp giờ là overlay ĐỘC LẬP (ui.standalonePanel), không
// còn là 1 LeftPanelMode nữa nên entry không thể chỉ khai 1 `mode`
// string như trước — đổi shape sang isActive()/onClick() để 1 danh
// sách chứa được cả 2 loại đích (leftPanelMode VÀ standalonePanel).
const NAV_ENTRIES: { label: string; isActive: () => boolean; onClick: () => void }[] = [
  { label: 'Động Phủ', isActive: () => ui.leftPanelMode === 'character', onClick: () => open('character') },
  { label: 'Khí Đường', isActive: () => ui.leftPanelMode === 'equipment_hall', onClick: () => open('equipment_hall') },
  { label: 'Trận Đài', isActive: () => ui.leftPanelMode === 'formation_altar', onClick: () => open('formation_altar') },
  { label: 'Phù Viện', isActive: () => ui.leftPanelMode === 'talisman_institute', onClick: () => open('talisman_institute') },
  { label: 'Đan Phòng', isActive: () => ui.leftPanelMode === 'pill_room', onClick: () => open('pill_room') },
  { label: 'Tàng Kinh Các', isActive: () => ui.leftPanelMode === 'scripture_pavilion', onClick: () => open('scripture_pavilion') },
  { label: 'Hành Trang', isActive: () => ui.leftPanelMode === 'inventory', onClick: () => open('inventory') },
  { label: 'Kỹ Năng', isActive: () => ui.standalonePanel === 'skill', onClick: () => openStandalone('skill') },
  { label: 'Tâm Pháp', isActive: () => ui.standalonePanel === 'technique', onClick: () => openStandalone('technique') },
  { label: 'Realm Passive', isActive: () => ui.standalonePanel === 'realm_passive', onClick: () => openStandalone('realm_passive') },
  { label: 'Luyện Thể', isActive: () => ui.standalonePanel === 'luyen_the', onClick: () => openStandalone('luyen_the') },
  { label: 'Thám Hiểm', isActive: () => ui.leftPanelMode === 'stage_select', onClick: () => open('stage_select') },
  { label: 'Tầm Bảo', isActive: () => ui.leftPanelMode === 'exploration', onClick: () => open('exploration') },
  { label: 'Cài Đặt', isActive: () => ui.leftPanelMode === 'settings', onClick: () => open('settings') },
]

function open(mode: Exclude<LeftPanelMode, null>) {
  ui.leftPanelMode = mode
  ui.isNavMenuOpen = false
}

function openStandalone(panel: 'skill' | 'technique' | 'realm_passive' | 'luyen_the') {
  ui.standalonePanel = panel
  ui.isNavMenuOpen = false
}
</script>

<template>
  <Transition name="nav-menu-fade">
    <div v-if="ui.isNavMenuOpen" class="nav-menu-overlay" @click.self="ui.isNavMenuOpen = false">
      <div class="nav-menu-overlay__panel">
        <h3 class="nav-menu-overlay__title">Menu</h3>

        <div class="nav-menu-overlay__grid">
          <button
            v-for="entry in NAV_ENTRIES"
            :key="entry.label"
            type="button"
            class="nav-menu-overlay__item"
            :class="{ 'is-active': entry.isActive() }"
            @click="entry.onClick()"
          >
            {{ entry.label }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.nav-menu-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
  z-index: 50;
}

.nav-menu-overlay__panel {
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  padding: 24px 28px;
  min-width: 420px;
}

.nav-menu-overlay__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--gold-500);
  text-align: center;
}

.nav-menu-overlay__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.nav-menu-overlay__item {
  padding: 18px 8px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.8rem;
  cursor: pointer;
}

.nav-menu-overlay__item:hover {
  border-color: var(--gold-500);
}

.nav-menu-overlay__item.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
  background: var(--ink-700);
}

.nav-menu-fade-enter-active,
.nav-menu-fade-leave-active {
  transition: opacity 0.2s ease;
}

.nav-menu-fade-enter-from,
.nav-menu-fade-leave-to {
  opacity: 0;
}
</style>
