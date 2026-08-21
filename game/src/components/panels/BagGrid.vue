<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUiStore, type BagTab } from '@/stores/ui'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import EquipmentBagSection from './bag-sections/EquipmentBagSection.vue'
import MaterialBagSection from './bag-sections/MaterialBagSection.vue'
import PillBagSection from './bag-sections/PillBagSection.vue'
import TalismanBagSection from './bag-sections/TalismanBagSection.vue'
import FormationBagSection from './bag-sections/FormationBagSection.vue'

// Home Hub Phase 2 — BagGrid.vue giờ CHỈ còn là composer mỏng (tab
// switcher + hint bar), logic từng loại túi đã tách ra
// components/panels/bag-sections/ để 4 panel khu vực mới (Đan Phòng/
// Trận Đài/Phù Viện/Khí Đường) dùng lại được — Hành Trang vẫn giữ
// nguyên hành vi cũ 100% (5 tab, pending-select nội bộ trong panel
// này, KHÔNG dùng ui.pendingEquipTarget — đó là cơ chế RIÊNG cho luồng
// điều hướng liên-panel mới, xem stores/ui.ts).
const BAG_TABS: { tab: BagTab; label: string }[] = [
  { tab: 'equipment', label: 'Trang Bị' },
  { tab: 'material', label: 'Nguyên Liệu' },
  { tab: 'pill', label: 'Đan Dược' },
  { tab: 'talisman', label: 'Phù Chú' },
  { tab: 'formation', label: 'Trận Pháp' },
]

const ui = useUiStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// Phù Chú/Trận Pháp cần chọn 1 món trang bị làm đích sau khi chọn vật
// phẩm — "chờ chọn đích" thay vì áp/khảm ngay khi bấm vào phù/trận.
// Chỉ 1 trong 2 có giá trị tại 1 thời điểm (chọn cái này tự huỷ cái kia).
const pendingTalismanId = ref<string | null>(null)
const pendingFormationId = ref<string | null>(null)

// UI redesign Step 9 (Equipment/Luyện Khí) — Khí Đường thu gọn về
// THUẦN Luyện Khí (bỏ hẳn paperdoll + bag equip, xem
// EquipmentHallPanel.vue), luồng "chọn 1 trang bị làm đích" liên-panel
// từ Trận Đài/Phù Viện (ui.pendingEquipTarget, đặt bởi
// FormationAltarPanel.vue/TalismanInstitutePanel.vue) giờ trỏ THẲNG
// vào đây (Kho → tab Trang Bị) thay vì Khí Đường — đúng bản chất hành
// động (chọn ĐỒ ĐANG MẶC, không phải rèn), khỏi phải giữ 1 bản
// EquipmentBagSection thứ 2 chỉ để phục vụ riêng luồng này. Cross-panel
// LUÔN ưu tiên hơn 2 ref cục bộ (không thể đồng thời xảy ra thực tế —
// đến từ panel khác nghĩa là chưa kịp tự chọn phù/trận ở đây).
const equipmentPendingTarget = computed(() => {
  if (ui.pendingEquipTarget) {
    return ui.pendingEquipTarget
  }

  if (pendingTalismanId.value) {
    return { kind: 'talisman' as const, id: pendingTalismanId.value }
  }

  if (pendingFormationId.value) {
    return { kind: 'formation' as const, id: pendingFormationId.value }
  }

  return null
})

// Tab hiển thị thật — cross-panel pending LUÔN ép về 'equipment' dù
// ui.activeBagTab đang lưu tab khác (người chơi có thể đã ở Kho, tab
// Nguyên Liệu chẳng hạn, trước khi bấm khảm Trận từ Trận Đài).
const activeTab = computed<BagTab>(() => (ui.pendingEquipTarget ? 'equipment' : ui.activeBagTab))

// UI redesign Step 10 (Inventory, spec mục 13) — header "Kho Vật" cần
// 1 con số thật đi kèm (mockup gốc dùng "126/200" kiểu sức chứa cố
// định, nhưng bag trong game này KHÔNG có capacity cap — mọi
// *Bag.getAll() đều không giới hạn, xem core/*/*.ts) nên hiện SỐ MÓN
// đang sở hữu trong tab đang mở thay vì bịa 1 con số mẫu số giả. Đếm
// trên TOÀN BỘ *Bag (kể cả trang bị đang mặc) — không khớp tuyệt đối
// số ô hiện trong lưới lúc đang có pendingTarget (equipment tab ẩn bớt
// đồ đang mặc/lọc riêng vũ khí, xem EquipmentBagSection.vue) nhưng đó
// là trạng thái nhất thời, không đáng thêm 1 bản filter trùng ở đây.
const BAG_COUNTS: Record<BagTab, () => number> = {
  equipment: () => gameManager.equipmentBag.getAll().length,
  material: () => gameManager.materialBag.getAll().length,
  pill: () => gameManager.pillBag.getAll().length,
  talisman: () => gameManager.talismanBag.getAll().length,
  formation: () => gameManager.formationBag.getAll().length,
}

const activeTabCount = computed(() => {
  stateVersion.value

  return BAG_COUNTS[activeTab.value]()
})

function cancelPending() {
  pendingTalismanId.value = null
  pendingFormationId.value = null
  ui.pendingEquipTarget = null
}

function onEquipmentResolved() {
  pendingTalismanId.value = null
  pendingFormationId.value = null

  // Đến từ Trận Đài/Phù Viện — resolve xong (áp/khảm thành công) tự
  // điều hướng quay lại đúng panel gốc (cắt nguyên logic từ
  // EquipmentHallPanel.vue cũ khi dời luồng này sang đây).
  const target = ui.pendingEquipTarget

  ui.pendingEquipTarget = null

  if (target?.kind === 'formation') {
    ui.leftPanelMode = 'formation_altar'
  } else if (target?.kind === 'talisman') {
    ui.leftPanelMode = 'talisman_institute'
  }
}

function toggleTalismanSelection(talismanId: string) {
  if (pendingTalismanId.value === talismanId) {
    pendingTalismanId.value = null

    return
  }

  pendingTalismanId.value = talismanId
  pendingFormationId.value = null
  ui.setActiveBagTab('equipment')
}

function toggleFormationSelection(formationId: string) {
  if (pendingFormationId.value === formationId) {
    pendingFormationId.value = null

    return
  }

  pendingFormationId.value = formationId
  pendingTalismanId.value = null
  ui.setActiveBagTab('equipment')
}
</script>

<template>
  <div class="bag-grid">
    <!-- UI redesign Step 10 (spec mục 13) — header "KHO VẬT" của
         mockup gốc. Không hiện "món/tổng sức chứa" như mockup (bag
         không có capacity cap thật, xem ghi chú activeTabCount) — chỉ
         số món ĐANG SỞ HỮU trong tab mở, thật 100%. -->
    <div class="bag-grid__header">
      <span class="bag-grid__title">Kho Vật</span>
      <span class="bag-grid__count">{{ activeTabCount }} món</span>
    </div>

    <div class="bag-grid__tabs">
      <div v-if="equipmentPendingTarget" class="bag-grid__hint">
        <span>{{ equipmentPendingTarget.kind === 'talisman' ? 'Chọn 1 trang bị để áp Phù Chú' : 'Chọn 1 vũ khí để khảm Trận Pháp' }}</span>

        <button type="button" @click="cancelPending">Hủy</button>
      </div>

      <template v-else>
        <button
          v-for="entry in BAG_TABS"
          :key="entry.tab"
          type="button"
          :class="{ 'is-active': ui.activeBagTab === entry.tab }"
          @click="ui.setActiveBagTab(entry.tab)"
        >
          {{ entry.label }}
        </button>
      </template>
    </div>

    <div class="bag-grid__body">
      <EquipmentBagSection
        v-if="activeTab === 'equipment'"
        :pending-target="equipmentPendingTarget"
        @resolved="onEquipmentResolved"
      />

      <MaterialBagSection v-else-if="activeTab === 'material'" />

      <PillBagSection v-else-if="activeTab === 'pill'" />

      <TalismanBagSection
        v-else-if="activeTab === 'talisman'"
        :selected-id="pendingTalismanId"
        @toggle="toggleTalismanSelection"
      />

      <FormationBagSection
        v-else-if="activeTab === 'formation'"
        :selected-id="pendingFormationId"
        @toggle="toggleFormationSelection"
      />
    </div>
  </div>
</template>

<style scoped>
.bag-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 8px;
  gap: 8px;
  box-sizing: border-box;
  font-family: var(--font-body);
  color: var(--text-primary);
}

.bag-grid__header {
  flex: 0 0 auto;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.bag-grid__title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
}

.bag-grid__count {
  font-size: 0.66rem;
  color: var(--text-muted);
}

.bag-grid__tabs {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: stretch;
  gap: 4px;
}

/* "vuông/gọn" (spec mục 13's Tab rule) — chip viền thay underline-tab
   cũ, cùng ngôn ngữ hình khối với .enhance-view__ops button
   (EquipmentHallPanel.vue) thay vì bịa 1 kiểu tab mới. */
.bag-grid__tabs button {
  justify-self: stretch;
  padding: 4px 2px;
  font-size: 0.64rem;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.bag-grid__hint {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 0 6px;
  background: var(--ink-800);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
  color: var(--gold-500);
  font-size: 0.68rem;
}

.bag-grid__hint button {
  flex: 0 0 auto;
  font-size: 0.65rem;
  padding: 3px 10px;
}

.bag-grid__tabs button.is-active {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.bag-grid__body {
  flex: 1;
  min-height: 0;
}
</style>
