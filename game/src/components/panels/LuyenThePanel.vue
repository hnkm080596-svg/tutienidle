<script setup lang="ts">
// Realm Passive & Pressure System (2026-08-20) — panel Luyện Thể, cùng
// pattern overlay với SkillPathPanel.vue/TechniquePanel.vue/
// RealmPanel.vue. Tinh Hoa Phàm Thể tự động nạp tiến độ (2026-08-30):
// quái rơi → stream tím bay về người chơi → App.vue investBodyRefinement()
// (xem core/realm/BodyRefinementSystem.ts) — tuần tự, đầy 1 tầng mới
// sang tầng kế. Panel chỉ HIỂN THỊ tiến độ, không còn nút/nắm tay.
//
// KHÔNG còn giới hạn riêng Phàm Nhân (2026-08-22) — CẢ truy cập LẪN
// đầu tư đều hoạt động ở mọi Cảnh Giới, để Tinh Hoa Phàm Thể còn tồn
// trong túi (chưa kịp tiêu hết trước khi rời Phàm Nhân) vẫn tiếp tục
// đổi được thành chỉ số thay vì kẹt vĩnh viễn. requiredRealmLevel (pace theo
// tầng Phàm Nhân) tự bypass sau khi rời realm — xem
// BodyRefinementSystem.isTierRequiredRealmLevelMet(). Bậc Nhập Đạo (thưởng lúc Lễ
// Nhập Môn) vẫn CHỈ chốt theo tiến độ tại đúng thời điểm ritual đó
// (GameManager.chooseCultivationPath(), không đổi) — đầu tư thêm sau
// đó vẫn lên chỉ số trực tiếp (buildTierModifiers) nhưng không kéo
// ngược Bậc Nhập Đạo đã chốt, đúng tinh thần "thưởng cho ai xong SỚM,
// không phạt ai xong TRỄ, không ép ai phải xong".
//
// Cơ chế "càng nhiều tầng hoàn thành → bậc Nhập Đạo càng cao" CỐ Ý
// không hiện số bậc/công thức ra UI (2026-08-22, theo đúng tinh thần
// "đột phá ẩn" đã áp dụng cho Căn Cơ Trúc Cơ — xem FoundationType.ts)
// — người chơi chỉ thấy TIẾN ĐỘ đầu tư (tầng đã hoàn thành) và kết quả
// CỤ THỂ (stat buff thật ở RealmPanel.vue), không thấy con số
// "bậc X/6" nào để đoán/min-max ngược công thức.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { BODY_REFINEMENT_TIERS } from '@/data/realm/BodyRefinement'
import { getActiveTierIndex, getTierCap, isActiveTierUnlocked, isTierRequiredRealmLevelMet } from '@/core/realm/BodyRefinementSystem'
import { statLabel } from '@/core/stats/StatLabels'
import { formatNumber } from '@/core/format/NumberFormatter'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const { t } = useI18n({ useScope: 'local' })

const activeTierIndex = computed(() => {
  stateVersion.value

  return getActiveTierIndex(player.$state)
})

const tierUnlocked = computed(() => {
  stateVersion.value

  return isActiveTierUnlocked(player.$state)
})

const tierRows = computed(() => {
  stateVersion.value

  return BODY_REFINEMENT_TIERS.map((tier, index) => {
    const cap = getTierCap(index)

    let progress = 0
    let status: 'done' | 'active' | 'realm_locked' | 'locked' = 'locked'

    if (index < player.bodyRefinementCompletedTiers) {
      progress = cap
      status = 'done'
    } else if (index === player.bodyRefinementCompletedTiers) {
      progress = player.bodyRefinementCurrentTierProgress
      // requiredRealmLevel gate (2026-08-20) — tầng ĐÚNG lượt đầu tư nhưng
      // chưa đạt Phàm Nhân tầng yêu cầu vẫn hiện riêng biệt (không lẫn
      // với các tầng sau, còn chưa tới lượt hoàn toàn). Tự bypass sau
      // khi rời Phàm Nhân (xem isTierRequiredRealmLevelMet()) nên trạng thái
      // này chỉ còn xảy ra khi player vẫn đang ở Phàm Nhân.
      status = isTierRequiredRealmLevelMet(player.$state, index) ? 'active' : 'realm_locked'
    }

    return {
      id: tier.id,
      name: tier.name,
      description: tier.description,
      statLabels: tier.stats.map(stat => statLabel(stat)).join(' / '),
      requiredRealmLevel: tier.requiredRealmLevel,
      progress,
      cap,
      percent: cap > 0 ? Math.min(100, (progress / cap) * 100) : 0,
      status,
    }
  })
})

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'luyen_the'" :title="t('panels.luyenThe.title')" width="min(560px, 90vw)" height="85vh" @close="close">
    <div class="luyen-the-panel__card">
      <div class="luyen-the-panel__summary">
        <span>{{ t('panels.luyenThe.summary', { completed: player.bodyRefinementCompletedTiers }) }}</span>
      </div>

      <p class="luyen-the-panel__note">
        {{ t('panels.luyenThe.note') }}
      </p>

      <template v-if="activeTierIndex !== undefined">
        <div class="luyen-the-panel__tiers">
          <div
            v-for="row in tierRows"
            :key="row.id"
            class="luyen-the-panel__tier"
            :class="`luyen-the-panel__tier--${row.status}`"
          >
            <div class="luyen-the-panel__tier-head">
              <span class="luyen-the-panel__tier-name">{{ row.name }}</span>
              <span class="luyen-the-panel__tier-stat">{{ row.statLabels }}</span>
            </div>

            <p class="luyen-the-panel__tier-desc">{{ row.description }}</p>

            <p v-if="row.status === 'realm_locked'" class="luyen-the-panel__tier-lock">
              {{ t('panels.luyenThe.tierLock', { level: row.requiredRealmLevel }) }}
            </p>

            <Bar class="luyen-the-panel__tier-bar" :value="row.progress" :max="row.cap" :height="5" />

            <span class="luyen-the-panel__tier-progress">
              {{ formatNumber(row.progress) }} / {{ formatNumber(row.cap) }}
            </span>
          </div>
        </div>
      </template>

      <EmptyState v-else size="lg">{{ t('panels.luyenThe.empty') }}</EmptyState>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.luyen-the-panel__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  font-family: var(--font-body);
  color: var(--paper-text);
}

/* Số tầng hoàn thành là headline của cả panel — trước đây chìm cùng cỡ
   với ghi chú bên dưới (2026-08-30 frontend-design pass). */
.luyen-the-panel__summary {
  display: flex;
  justify-content: space-between;
  font: 700 var(--text-title) var(--font-display);
  color: var(--paper-text);
}

.luyen-the-panel__note {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--jade);
}

.luyen-the-panel__tiers {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.luyen-the-panel__tier {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  opacity: 0.55;
}

.luyen-the-panel__tier--active {
  opacity: 1;
  border-color: var(--chrome-300);
}

.luyen-the-panel__tier--realm_locked {
  opacity: 0.8;
  border-color: var(--ink-line-soft);
}

.luyen-the-panel__tier--done {
  opacity: 1;
}

.luyen-the-panel__tier-lock {
  margin: 2px 0 6px;
  font-size: var(--text-sm);
  color: var(--crimson);
}

.luyen-the-panel__tier-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.luyen-the-panel__tier-name {
  font-weight: 600;
  color: var(--chrome-100);
  font-size: var(--text-md);
}

.luyen-the-panel__tier-stat {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.luyen-the-panel__tier-desc {
  margin: 2px 0 6px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.luyen-the-panel__tier-bar {
  border-radius: 3px;
}

.luyen-the-panel__tier-progress {
  display: block;
  margin-top: 3px;
  font-size: var(--text-md);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}
</style>
