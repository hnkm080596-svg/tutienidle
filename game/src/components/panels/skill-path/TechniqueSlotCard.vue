<script setup lang="ts">
// Home Hub Phase 6 - trich tu LoadoutManager.vue's khoi "slot cong
// phap" (icon/ten/level-bar). P7-M7: nguoi dung duy nhat con lai la
// TechniquePanel.vue (hero variant) - doc chung nguon qua
// techniqueManager, tranh nhieu noi tu ve nhieu kieu khac nhau.
//
// BETA FE-CONTRACT (work-order sec.4A): card gio THUAN hien thi
// BetaTechniqueSurfaceModel (realmAdvanceOps) - band label suy tu
// model.tier, thanh exp = model.mastery / model.masteryForNextRank,
// day khi model.rankCapped. Khong tu suy ra tier/cost/rank-cap nua.
//
// Tooltip co cau truc (xem TechniqueTooltipContent trong
// composables/useTooltip.ts) - hinh + khoi Chien Dau lay tu
// model.sections.
import { computed } from 'vue'
import SlotView from '../../common/SlotView.vue'
import TechniqueRuneRing from './TechniqueRuneRing.vue'
import Bar from '../../common/primitives/Bar.vue'
import InkNineSlice from '../../common/primitives/InkNineSlice.vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { usePlayerStore } from '@/stores/player'
import type { TechniqueTooltipContent } from '@/composables/useTooltip'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import { TECHNIQUE_TIER_LABELS } from '@/core/technique/TechniqueProgression'
import { ITEM_QUALITY_LABELS } from '@/core/item/ItemQuality'
import { formatNumber } from '@/core/format/NumberFormatter'

// UI redesign Step 12 (Tam Phap, spec muc 15) - "Tam phap hien tai
// lon, cac tam phap khac nho hon" can 1 bien the hero (icon lon,
// layout doc, badge trang thai). P7-M7: hero variant chi con
// TechniquePanel.vue dung; 'normal' giu mac dinh cho moi noi khac -
// prop optional, mac dinh giu nguyen hanh vi cu.
withDefaults(defineProps<{
  label: string
  size?: 'normal' | 'hero'
}>(), {
  size: 'normal',
})

const gameManager = useGameManager()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const model = computed(() => {
  stateVersion.value

  return gameManager.realmAdvanceOps.getBetaTechniqueSurfaceModel(player.$state)
})

const technique = computed(() =>
  model.value.state === 'available' ? model.value : undefined,
)

// Band badge: four-tier vocabulary suy tu model.tier + Canh (grade)
// hien tai - label table lookup only, no band derivation.
const currentTierLabel = computed(() => {
  const active = technique.value

  return active?.tier !== undefined && active.grade !== undefined
    ? `${TECHNIQUE_TIER_LABELS[active.tier]} · Cảnh ${active.grade}`
    : ''
})

// Thanh exp = mastery / masteryForNextRank; rankCapped -> full
// (khong con rank ke de tien).
const tierExpValue = computed(() => {
  const active = technique.value

  return active && !active.rankCapped ? active.mastery ?? 0 : 1
})

const tierExpMax = computed(() => {
  const active = technique.value

  return active && !active.rankCapped ? active.masteryForNextRank ?? 1 : 1
})

const tierExpLabel = computed(() => {
  const active = technique.value

  if (!active) {
    return ''
  }

  if (active.rankCapped) {
    return `Cấp ${active.rank} · Viên Mãn · ${active.quality ? ITEM_QUALITY_LABELS[active.quality] : ''}`
  }

  return `Cấp ${active.rank} · ${formatNumber(active.mastery ?? 0)} / ${formatNumber(active.masteryForNextRank ?? 0)} · ${active.quality ? ITEM_QUALITY_LABELS[active.quality] : ''}`
})

const tooltipContent = computed<TechniqueTooltipContent | undefined>(() => {
  const active = technique.value

  if (!active) {
    return undefined
  }

  return {
    kind: 'technique',

    name: active.name ?? '',

    imagePath: active.icon,

    elementLabel: active.element ? ELEMENT_LABELS[active.element] : undefined,

    description: active.description,

    sections: [...active.sections],
  }
})
</script>

<template>
  <div class="technique-card" :class="{ 'technique-card--hero': size === 'hero' }" v-tooltip="tooltipContent">
    <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" />
    <div class="technique-card__icon-wrap">
      <!-- SS18 Dao Quyen - 10-rune rank ring around the hero icon. -->
      <TechniqueRuneRing
        v-if="size === 'hero'"
        class="technique-card__ring"
        :lit="technique?.rank ?? 0"
      />
      <SlotView
        class="technique-card__icon"
        :item="technique ?? null"
        :label="technique?.name ?? label"
        :icon="technique?.icon"
      />
    </div>

    <div class="technique-card__info">
      <span class="technique-card__name">
        {{ technique?.name ?? `— ${label} —` }}
        <span v-if="technique" class="technique-card__tier">{{ currentTierLabel }}</span>
      </span>

      <span v-if="technique" class="technique-card__empty">{{ technique.description }}</span>

      <span v-else class="technique-card__empty">Trống — tự cấp khi bước vào nghề nghiệp tu luyện</span>

      <Bar v-if="technique" class="technique-card__tier-bar" :value="tierExpValue" :max="tierExpMax" :height="4" />

      <span v-if="technique" class="technique-card__tier-label">{{ tierExpLabel }}</span>

      <span v-if="size === 'hero' && technique" class="technique-card__status">ĐANG TU LUYỆN</span>
    </div>
  </div>
</template>

<style scoped>
.technique-card {
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

/* Kich thuoc icon co dinh tuong minh - flex-basis (SlotView KHONG tu
   set flex) quyet dinh kich co tren truc row, khong con dua vao tie
   injection-order voi width:100% noi bo cua SlotView.vue. */
.technique-card__icon-wrap {
  position: relative;
  z-index: 3;
  flex: 0 0 56px;
  width: 56px;
}

.technique-card__icon {
  position: relative;
  z-index: 3;
  width: 100%;
}

/* SS18 - the rune ring overhangs the icon; dots orbit its rim. */
.technique-card__ring {
  position: absolute;
  inset: -16%;
  width: 132%;
  height: 132%;
  z-index: 2;
  pointer-events: none;
}

.technique-card__info {
  position: relative;
  z-index: 3;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.technique-card__name {
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.technique-card__empty {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.technique-card__tier {
  margin-left: 4px;
  padding: 1px 5px;
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--mineral-gold);
  border: 1px solid currentColor;
  border-radius: 999px;
  white-space: nowrap;
}

.technique-card__tier-bar {
  margin-top: 2px;
  border-radius: 2px;
}

.technique-card__tier-label {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

/* Bien the hero (spec muc 15 "Tam phap hien tai lon") - layout doc,
   icon lon han, ten co the xuong dong thay vi ellipsis. */
.technique-card--hero {
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  width: 100%;
  max-width: 220px;
  margin: 0 auto;
  padding: 14px 10px;
}

.technique-card--hero .technique-card__icon-wrap {
  flex: 0 0 auto;
  width: 46%;
}

/* SS18 - grade reads as a seal tier: framed gold chip, display font. */
.technique-card--hero .technique-card__tier {
  padding: 2px 8px;
  border: 1px solid var(--hk-gold-muted, #7a6234);
  border-radius: var(--hk-radius-sm, 4px);
  background: color-mix(in srgb, var(--hk-gold, #c99a4a) 12%, transparent);
  color: var(--hk-gold-bright, #e8c35a);
  font-family: var(--hk-font-display, var(--font-display));
  letter-spacing: 0.05em;
}

.technique-card--hero .technique-card__info {
  align-items: center;
}

.technique-card--hero .technique-card__name {
  font-family: var(--font-display);
  font-size: var(--text-title);
  white-space: normal;
}

.technique-card--hero .technique-card__empty {
  white-space: normal;
}

.technique-card--hero .technique-card__tier-bar {
  width: 80%;
}

.technique-card__status {
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
