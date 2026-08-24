<script setup lang="ts">
// Home Hub Phase 6 — trích từ LoadoutManager.vue's khối "slot công
// pháp" (icon/tên/level-bar), dùng chung cho CharacterPanel.vue,
// LoadoutManager.vue và TechniqueCodex.vue — cùng đọc chung nguồn qua
// techniqueManager, tránh nhiều nơi tự vẽ nhiều kiểu khác nhau.
//
// Tâm Pháp hợp nhất (2026-08-15) — KHÔNG còn 3 slot riêng (cultivation/
// combat/breakthrough), chỉ còn ĐÚNG 1 tâm pháp trang bị cho toàn hệ
// thống — bỏ hẳn prop `slot`, đọc thẳng gameManager.techniqueManager.
// getEquipped() (không cần tham số).
//
// PLAN HOÀN CHỈNH mục 5/9 rework (2026-08-20) — Tâm Pháp KHÔNG còn
// tháo/lắp thủ công được nữa (hoàn toàn theo nghề nghiệp đã chọn, xem
// CultivationPathKit.ts) — đã bỏ hẳn onClick/unequipTechnique, card giờ
// THUẦN hiển thị. Tier giờ suy từ player.techniqueExperience (thanh
// kinh nghiệm riêng của Tâm Pháp) thay vì player.realmId, xem
// TechniqueTier.ts — thêm hẳn thanh exp hiện tiến độ lên tier kế tiếp.
//
// Tooltip có cấu trúc (xem TechniqueTooltipContent trong
// composables/useTooltip.ts) — hình + 2 khối (Chiến Đấu/Tu Luyện), xây
// qua buildTechniqueSections() (đã tách ra composables/useTechniqueSections.ts
// để LoadoutManager.vue's tab Tâm Pháp dùng lại y hệt cho khối thông
// tin inline mới, không chỉ lúc hover).
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { TechniqueTooltipContent } from '@/composables/useTooltip'
import { buildTechniqueSections } from '@/composables/useTechniqueSections'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { getTechniqueInsightTotalRequired, getTechniqueTierProgress, TECHNIQUE_TIER_LABELS } from '@/core/technique/TechniqueTier'
import { formatNumber } from '@/core/format/NumberFormatter'

// UI redesign Step 12 (Tâm Pháp, spec mục 15) — "Tâm pháp hiện tại
// lớn, các tâm pháp khác nhỏ hơn" cần 1 biến thể hero (icon lớn, layout
// dọc, badge trạng thái) CHỈ cho LoadoutManager.vue's tab Tâm Pháp —
// CharacterPanel.vue (khối header hẹp) và TechniqueCodex.vue (danh
// sách thư viện, xem Step 20) vẫn dùng layout ngang gọn mặc định,
// KHÔNG đổi 2 chỗ đó — prop optional, mặc định giữ nguyên hành vi cũ.
const props = withDefaults(defineProps<{
  label: string
  size?: 'normal' | 'hero'
}>(), {
  size: 'normal',
})

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const equipped = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getEquipped()
})

const techniqueInsight = computed(() => equipped.value?.insight ?? 0)
const tierProgress = computed(() => {
  const technique = equipped.value
  return getTechniqueTierProgress(techniqueInsight.value, technique ? getTechniqueInsightTotalRequired(technique) : undefined)
})

const currentTierLabel = computed(() => TECHNIQUE_TIER_LABELS[tierProgress.value.tier])

// Thanh exp — undefined nextThreshold nghĩa là đã Viên Mãn (MAX, hiện
// đầy 100% thay vì chia cho undefined).
const tierExpPercent = computed(() => {
  const { lowerBound, nextThreshold } = tierProgress.value

  if (nextThreshold === undefined) {
    return 100
  }

  return Math.min(100, ((techniqueInsight.value - lowerBound) / (nextThreshold - lowerBound)) * 100)
})

const tierExpLabel = computed(() => {
  const { nextThreshold } = tierProgress.value

  if (nextThreshold === undefined) {
    return 'Viên Mãn'
  }

  return `${formatNumber(techniqueInsight.value)} / ${formatNumber(nextThreshold)}`
})

const tooltipContent = computed<TechniqueTooltipContent | undefined>(() => {
  const technique = equipped.value

  if (!technique) {
    return undefined
  }

  return {
    kind: 'technique',

    name: technique.name,

    imagePath: technique.icon,

    elementLabel: technique.element ? ELEMENT_LABELS[technique.element] : undefined,

    description: technique.description,

    sections: buildTechniqueSections(technique, gameManager, techniqueInsight.value),
  }
})
</script>

<template>
  <div class="loadout-card" :class="{ 'loadout-card--hero': size === 'hero' }" v-tooltip="tooltipContent">
    <SlotView
      class="loadout-card__icon"
      :item="equipped ?? null"
      :label="equipped?.name ?? label"
      :icon="equipped?.icon"
    />

    <div class="loadout-card__info">
      <span class="loadout-card__name">
        {{ equipped?.name ?? `— ${label} —` }}
        <span v-if="equipped" class="loadout-card__tier">{{ currentTierLabel }}</span>
      </span>

      <span v-if="equipped" class="loadout-card__empty">{{ equipped.description }}</span>

      <span v-else class="loadout-card__empty">Trống — tự cấp khi bước vào nghề nghiệp tu luyện</span>

      <div v-if="equipped" class="loadout-card__tier-bar">
        <div class="loadout-card__tier-fill" :style="{ width: `${tierExpPercent}%` }" />
      </div>

      <span v-if="equipped" class="loadout-card__tier-label">{{ tierExpLabel }}</span>

      <span v-if="size === 'hero' && equipped" class="loadout-card__status">ĐANG TU LUYỆN</span>
    </div>
  </div>
</template>

<style scoped>
.loadout-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  text-align: left;
  font-family: var(--font-body);
  color: var(--text-primary);
  width: 100%;
  box-sizing: border-box;
}

.loadout-card__icon {
  flex: 0 0 15%;
  width: 15%;
}

.loadout-card__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.loadout-card__name {
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loadout-card__empty {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.loadout-card__tier {
  margin-left: 4px;
  padding: 1px 5px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--gold-500);
  border: 1px solid var(--gold-500);
  border-radius: 999px;
  white-space: nowrap;
}

.loadout-card__tier-bar {
  height: 4px;
  margin-top: 2px;
  border-radius: 2px;
  background: var(--ink-700);
  overflow: hidden;
}

.loadout-card__tier-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
}

.loadout-card__tier-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Biến thể hero (spec mục 15 "Tâm pháp hiện tại lớn") — layout dọc,
   icon lớn hẳn, tên có thể xuống dòng thay vì ellipsis. */
.loadout-card--hero {
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  padding: 14px 10px;
}

.loadout-card--hero .loadout-card__icon {
  flex: 0 0 auto;
  width: 46%;
}

.loadout-card--hero .loadout-card__info {
  align-items: center;
}

.loadout-card--hero .loadout-card__name {
  font-family: var(--font-display);
  font-size: 0.95rem;
  white-space: normal;
}

.loadout-card--hero .loadout-card__empty {
  white-space: normal;
}

.loadout-card--hero .loadout-card__tier-bar {
  width: 80%;
}

.loadout-card__status {
  margin-top: 2px;
  padding: 2px 10px;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--jade);
  border: 1px solid var(--jade);
  border-radius: 999px;
}
</style>
