<script setup lang="ts">
// Task 19 (item-grade-quality-rework, rework P6) — shell shrunk to
// tab-bar + shared selection provide(); the 5 tab bodies now live in
// ./equipment-hall/*Tab.vue (EnhanceTab/WashTab/RefineTab/DissolveTab/
// DecomposeTab, the last already extracted in Task 14).
//
// Shared selection: ONLY Wash/Refine tabs inject HALL_SELECTION_KEY —
// verified by re-reading the pre-extraction template: Cường Hóa selects
// by SLOT (its own local selectedEnhanceSlot), and Hóa Luyện has its own
// independent Set-based multi-select. Neither needs selectedInstanceId.
import { ref, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import TabBar from '@/components/common/TabBar.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import EnhanceTab from './equipment-hall/EnhanceTab.vue'
import WashTab from './equipment-hall/WashTab.vue'
import RefineTab from './equipment-hall/RefineTab.vue'
import DissolveTab from './equipment-hall/DissolveTab.vue'
import DecomposeTab from './equipment-hall/DecomposeTab.vue'
import { HALL_SELECTION_KEY } from './equipment-hall/hallSelection'

// Khí Đường (2026-08-25, resource-professions-rework plan §7/§9.2) —
// bốn tab ĐÚNG contract: Cường Hóa (slot), Tẩy Luyện (identity substat
// theo phẩm Quáng), Tinh Luyện (dòng đủ điều kiện tăng 5–20%, clamp
// trần tier + khóa dòng N+L), Hóa
// Luyện (destructive → Tinh Hoa, batch all-or-nothing). Rework
// 2026-08-30: bỏ Nạp Điểm Rèn; cost Điểm Rèn Tẩy/Tinh theo quality.
//
// Redesign 2-cột "hiện tại / sau khi dùng chức năng" + preview-giữ-bỏ
// cho Tẩy/Tinh Luyện (2026-08-30, bug report — bố cục cũ trống trải,
// roll áp thẳng không cho xem trước rồi mới quyết định). Cường Hóa là
// phép tính XÁC ĐỊNH (không random) nên cột "sau" chỉ hiển thị kết quả
// tính trước, không cần cơ chế giữ/bỏ.
const { t } = useI18n({ useScope: 'local' })

const TABS = [
  { id: 'enhance', label: t('panels.equipmentHall.tabs.enhance') },
  { id: 'wash', label: t('panels.equipmentHall.tabs.wash') },
  { id: 'refine', label: t('panels.equipmentHall.tabs.refine') },
  { id: 'dissolve', label: t('panels.equipmentHall.tabs.dissolve') },
  { id: 'decompose', label: t('panels.equipmentHall.tabs.decompose') },
] as const

type TabId = (typeof TABS)[number]['id']

const activeTab = ref<TabId>('enhance')

function switchTab(tab: TabId) {
  activeTab.value = tab
}

// =========================
// Selection dùng chung — CHỈ Wash/Refine inject (xem ghi chú đầu file).
// Preview cục bộ của từng tab (pendingWashAffixes/pendingRefineValues)
// đã chuyển hẳn vào WashTab/RefineTab — v-if unmount khi đổi tab tự
// reset chúng, thay cho các lệnh reset thủ công cũ ở switchTab().
// =========================

const selectedInstanceId = ref<string | null>(null)

function selectEquipped(instanceId: string) {
  selectedInstanceId.value = instanceId
}

function clearSelection() {
  selectedInstanceId.value = null
}

provide(HALL_SELECTION_KEY, { selectedInstanceId, selectEquipped, clearSelection })
</script>

<template>
  <div class="qi-hall">
    <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />

    <!-- Header "Điểm Rèn món đang chọn" cũ đã BỎ (2026-08-30, bug report:
         thông tin không cần thiết) — số Điểm Rèn chỉ liên quan Tẩy/Tinh
         Luyện, tự hiện đúng ngay trong card của 2 tab đó, không cần lặp
         lại ở đầu panel cho cả Cường Hóa/Hóa Luyện không dùng tới nó. -->

    <!-- Nav chức năng lên NGAY đầu card, không nền riêng (2026-08-30,
         bug report) — bỏ hẳn header "Chọn một trang bị..." cũ. -->
    <TabBar
      class="qi-hall__tabs"
      :tabs="TABS.map((tab) => ({ id: tab.id, label: tab.label }))"
      :model-value="activeTab"
      @update:model-value="switchTab($event as TabId)"
    />

    <EnhanceTab v-if="activeTab === 'enhance'" />
    <WashTab v-else-if="activeTab === 'wash'" />
    <RefineTab v-else-if="activeTab === 'refine'" />
    <DissolveTab v-else-if="activeTab === 'dissolve'" />

    <!-- ===== PHÂN GIẢI (Task 14) — khoáng → Luyện Khí Tinh Hoa ===== -->
    <section v-else-if="activeTab === 'decompose'" class="qi-hall__body qi-hall__decompose">
      <DecomposeTab />
    </section>
  </div>
</template>

<style scoped>
.qi-hall {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.qi-hall > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

/* Nav lên đầu, KHÔNG nền riêng (2026-08-30, bug report) — hoà vào card
   giống Chip.vue paper-toned thay vì dải tối tách biệt. */
.qi-hall__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(var(--tab-columns, 4), 1fr);
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--paper-line);
  background: transparent;
}

/* Phần thân của mỗi tab con (Enhance/Wash/Refine/Dissolve tự mang class
   này trong template của CHÍNH nó — Vue scoped CSS không xuyên qua
   children nên style thật của .qi-hall__body/.qi-hall__decompose sống ở
   từng *Tab.vue; khối này chỉ còn phục vụ DecomposeTab wrapper trực
   tiếp render tại shell). */
.qi-hall__body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qi-hall__decompose {
  gap: 8px;
}
</style>
