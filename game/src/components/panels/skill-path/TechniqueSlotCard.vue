<script setup lang="ts">
// Home Hub Phase 6 - trich tu LoadoutManager.vue's khoi "slot cong
// phap" (icon/ten/level-bar). P7-M7: nguoi dung duy nhat con lai la
// TechniqueBand.vue (hero variant) - doc chung nguon qua
// techniqueManager, tranh nhieu noi tu ve nhieu kieu khac nhau.
//
// P7-M3 - canonical 0-or-1 technique: doc thang
// gameManager.techniqueManager.getActive() (khong can tham so). Card
// gio THUAN hien thi rank/mastery/grade/quality: band label suy tu
// rank (getTechniqueTierForRank), thanh exp = mastery / cost(grade),
// day khi rank cham cap 10 (xem TechniqueProgression.ts).
//
// Tooltip co cau truc (xem TechniqueTooltipContent trong
// composables/useTooltip.ts) - hinh + khoi Chien Dau, xay qua
// buildTechniqueSections() (composables/useTechniqueSections.ts) -
// TechniqueBand.vue dung lai y het cho khoi thong tin inline, khong
// chi luc hover.
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import Bar from '../../common/primitives/Bar.vue'
import InkNineSlice from '../../common/primitives/InkNineSlice.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import type { TechniqueTooltipContent } from '@/composables/useTooltip'
import { buildTechniqueSections } from '@/composables/useTechniqueSections'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import {
  getTechniqueMasteryForNextRank,
  getTechniqueTierForRank,
  TECHNIQUE_RANK_CAP,
  TECHNIQUE_TIER_LABELS,
} from '@/core/technique/TechniqueProgression'
import { ITEM_QUALITY_LABELS } from '@/core/item/ItemQuality'
import { formatNumber } from '@/core/format/NumberFormatter'

// UI redesign Step 12 (Tam Phap, spec muc 15) - "Tam phap hien tai
// lon, cac tam phap khac nho hon" can 1 bien the hero (icon lon,
// layout doc, badge trang thai). P7-M7: hero variant chi con
// TechniqueBand.vue dung; 'normal' giu mac dinh cho moi noi khac -
// prop optional, mac dinh giu nguyen hanh vi cu.
withDefaults(defineProps<{
  label: string
  size?: 'normal' | 'hero'
}>(), {
  size: 'normal',
})

const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

const equipped = computed(() => {
  stateVersion.value

  return gameManager.techniqueManager.getActive()
})

// Band badge: four-tier vocabulary suy tu rank + Canh (grade) hien tai.
const currentTierLabel = computed(() => {
  const technique = equipped.value

  return technique ? `${TECHNIQUE_TIER_LABELS[getTechniqueTierForRank(technique.rank)]} · Cảnh ${technique.grade}` : ''
})

// Thanh exp = mastery / cost(grade); rank cap -> full (không còn rank
// kế để tiến).
const tierExpValue = computed(() => {
  const technique = equipped.value

  return technique && technique.rank < TECHNIQUE_RANK_CAP ? technique.mastery : 1
})

const tierExpMax = computed(() => {
  const technique = equipped.value

  return technique && technique.rank < TECHNIQUE_RANK_CAP
    ? getTechniqueMasteryForNextRank(technique.grade)
    : 1
})

const tierExpLabel = computed(() => {
  const technique = equipped.value

  if (!technique) {
    return ''
  }

  if (technique.rank >= TECHNIQUE_RANK_CAP) {
    return `Cấp ${TECHNIQUE_RANK_CAP} · Viên Mãn · ${ITEM_QUALITY_LABELS[technique.quality]}`
  }

  return `Cấp ${technique.rank} · ${formatNumber(technique.mastery)} / ${formatNumber(getTechniqueMasteryForNextRank(technique.grade))} · ${ITEM_QUALITY_LABELS[technique.quality]}`
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

    sections: buildTechniqueSections(technique),
  }
})
</script>

<template>
  <div class="loadout-card" :class="{ 'loadout-card--hero': size === 'hero' }" v-tooltip="tooltipContent">
    <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" />
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

      <Bar v-if="equipped" class="loadout-card__tier-bar" :value="tierExpValue" :max="tierExpMax" :height="4" />

      <span v-if="equipped" class="loadout-card__tier-label">{{ tierExpLabel }}</span>

      <span v-if="size === 'hero' && equipped" class="loadout-card__status">ĐANG TU LUYỆN</span>
    </div>
  </div>
</template>

<style scoped>
.loadout-card {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  background: transparent;
  border: 0;
  border-radius: 0;
  text-align: left;
  font-family: var(--font-body);
  color: var(--paper-text);
  width: 100%;
  box-sizing: border-box;
}

/* Kích thước icon cố định tường minh — flex-basis (SlotView KHÔNG tự
   set flex) quyết định kích cỡ trên trục row, không còn dựa vào tie
   injection-order với width:100% nội bộ của SlotView.vue. */
.loadout-card__icon {
  position: relative;
  z-index: 3;
  flex: 0 0 56px;
  width: 56px;
}

.loadout-card__info {
  position: relative;
  z-index: 3;
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
  color: var(--paper-text-soft);
}

.loadout-card__tier {
  margin-left: 4px;
  padding: 1px 5px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--mineral-gold);
  border: 1px solid currentColor;
  border-radius: 999px;
  white-space: nowrap;
}

.loadout-card__tier-bar {
  margin-top: 2px;
  border-radius: 2px;
}

.loadout-card__tier-label {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

/* Biến thể hero (spec mục 15 "Tâm pháp hiện tại lớn") — layout dọc,
   icon lớn hẳn, tên có thể xuống dòng thay vì ellipsis. */
.loadout-card--hero {
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
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
  font-size: var(--text-title);
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
