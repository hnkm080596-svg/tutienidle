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
import EquipmentPaperdoll from '@/components/panels/EquipmentPaperdoll.vue'
import EquipmentBagRail from './equipment-hall/EquipmentBagRail.vue'
import EnhanceTab from './equipment-hall/EnhanceTab.vue'
import WashTab from './equipment-hall/WashTab.vue'
import RefineTab from './equipment-hall/RefineTab.vue'
import DissolveTab from './equipment-hall/DissolveTab.vue'
import DecomposeTab from './equipment-hall/DecomposeTab.vue'
import { HALL_SELECTION_KEY } from './equipment-hall/hallSelection'
import { isBetaEquipmentTab } from '@/core/betaScope'
import './equipment-hall/qi-hall.css'

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
const { t } = useI18n()

// BETA SCOPE LOCK v2 (Phase-6): the rendered tab list comes from the
// betaScope equipment-tab allow-list (enhance + dissolve) - wash /
// refine / decompose are scope-hidden, so no tab button exists and no
// ops entry point survives in beta.
const TABS = [
  { id: 'enhance', label: t('panels.equipmentHall.tabs.enhance') },
  { id: 'wash', label: t('panels.equipmentHall.tabs.wash') },
  { id: 'refine', label: t('panels.equipmentHall.tabs.refine') },
  { id: 'dissolve', label: t('panels.equipmentHall.tabs.dissolve') },
  { id: 'decompose', label: t('panels.equipmentHall.tabs.decompose') },
] as const

type TabId = (typeof TABS)[number]['id']

const visibleTabs = TABS.filter((tab) => isBetaEquipmentTab(tab.id))

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
    <!-- Huyen Kim scene 12: the paperdoll IS the focal presentation
         column (runtime sockets over the painted base); the operation
         workspace keeps the canonical tab bodies. -->
    <div class="qi-hall-scene__focal">
      <EquipmentPaperdoll />
    </div>

    <!-- Spec 12: compact bag column - unequipped gear rail between the
         paperdoll and the ops workspace; click equips via canonical op. -->
    <div class="qi-hall-scene__bag">
      <EquipmentBagRail />
    </div>

    <div class="qi-hall-scene__ops">
      <TabBar
        class="qi-hall__tabs"
        :tabs="visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }))"
        :model-value="activeTab"
        @update:model-value="switchTab($event as TabId)"
      />

      <div class="qi-hall-scene__workspace">
        <EnhanceTab v-if="activeTab === 'enhance'" />
        <WashTab v-else-if="activeTab === 'wash'" />
        <RefineTab v-else-if="activeTab === 'refine'" />
        <DissolveTab v-else-if="activeTab === 'dissolve'" />

        <!-- ===== PHÂN GIẢI (Task 14) — khoáng → Luyện Khí Tinh Hoa ===== -->
        <section v-else-if="activeTab === 'decompose'" class="qi-hall__body qi-hall__decompose">
          <DecomposeTab />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qi-hall {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(64px, 0.18fr) minmax(0, 1.6fr);
  gap: 16px;
  height: 100%;
  min-height: 0;
  padding: 6px 2px;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.qi-hall-scene__focal {
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qi-hall-scene__focal :deep(.paperdoll) {
  width: 100%;
  height: 100%;
  max-height: 100%;
}

.qi-hall-scene__ops {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--hk-surface-raised, var(--ink-800));
  border: 1px solid var(--hk-border-muted, var(--ink-line-soft));
  border-radius: var(--hk-radius-md, 8px);
  overflow: hidden;
}

.qi-hall-scene__workspace {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.qi-hall-scene__bag {
  min-height: 0;
  display: flex;
}

@container (max-width: 860px) {
  .qi-hall { grid-template-columns: 1fr 64px; grid-template-rows: minmax(180px, 30%) 1fr; overflow-y: auto; }
  .qi-hall-scene__bag { grid-column: 2; grid-row: 1 / -1; }
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

/* The `.qi-hall__*` tab-body vocabulary (body/split/decompose included —
   this shell's own DecomposeTab wrapper also uses it) lives in the shared
   unscoped sheet ./equipment-hall/qi-hall.css, imported above. Keeping any
   of those selectors scoped here would re-open the specificity war on
   child tab roots (equal (0,2,0), bundle order decides) — see the sheet
   header and tests/architecture/qiHallLayoutOwnership.test.ts. */
</style>
