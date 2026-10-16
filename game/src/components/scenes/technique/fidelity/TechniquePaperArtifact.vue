<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ITEM_QUALITY_ORDER } from '@/core/item/ItemQuality'
import SlotView from '@/components/common/SlotView.vue'
import type { TechniqueUiModel } from './techniqueUi'

const STAGE_CALLIGRAPHY_BY_ID: Record<string, string> = {
  so_nhap: 'Sơ',
  tieu_thanh: 'Tiểu',
  dai_thanh: 'Đại',
  vien_man: 'Viên',
}
const STAGE_CALLIGRAPHY_ORDER = ['Sơ', 'Tiểu', 'Đại', 'Viên'] as const

const props = defineProps<{ model: TechniqueUiModel; selected: string }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()

const fill = computed(() =>
  Number.isFinite(props.model.masteryPercent)
    ? Math.max(0, Math.min(100, props.model.masteryPercent))
    : 0,
)

const rarityRank = computed(() => {
  const qualityKey = props.model.qualityKey
  if (!qualityKey) return 1
  const idx = ITEM_QUALITY_ORDER.indexOf(qualityKey)
  return idx >= 0 ? idx + 1 : 1
})

function stageGlyph(id: string, index: number): string {
  return STAGE_CALLIGRAPHY_BY_ID[id] ?? STAGE_CALLIGRAPHY_ORDER[index] ?? 'Sơ'
}
</script>
<template>
  <section class="technique-artifact" :aria-label="t('technique.artifact')">
    <div class="technique-slot-wrap">
      <SlotView
        class="technique-slot"
        variant="technique"
        static
        :item="model.name || 'technique'"
        :icon="model.art"
        :label="t('technique.artifactAlt')"
        :rarity-rank="rarityRank"
      />
    </div>
    <p v-if="model.artTemporary" class="technique-art-caption">{{ t('technique.temporaryArt') }}</p>
    <div class="technique-track">
      <h2>{{ t('technique.training') }}</h2>
      <div class="technique-stages">
        <button
          v-for="(stage, index) in model.stages"
          :key="stage.id"
          :class="['technique-stage', stage.state, { selected: selected === stage.id }]"
          :aria-pressed="selected === stage.id"
          :aria-current="stage.state === 'current' ? 'step' : undefined"
          @click="emit('select', stage.id)"
        >
          <span class="technique-stage-seal" aria-hidden="true">{{ stageGlyph(stage.id, index) }}</span>
          <span>{{ stage.label }}</span>
        </button>
      </div>
      <div class="technique-mastery-label">
        <span>{{ model.rankLabel }}</span>
        <span>{{ model.masteryLabel }}</span>
      </div>
      <div
        class="technique-mastery"
        role="progressbar"
        :aria-label="t('technique.mastery')"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-valuenow="fill"
        :style="{ '--mastery-color': model.progressColor || '#d4a548' }"
      >
        <span :style="{ width: `${fill}%` }" />
      </div>
    </div>
  </section>
</template>
<style scoped>
.technique-artifact {
  position: absolute;
  left: 538px;
  top: 166px;
  width: 441px;
  height: 553px;
  background: #f4e7ce;
  border: 18px solid transparent;
  border-image: url('/assets/ui/tien-hiep-2026-10/realm/active-card-frame-v1.svg') 24 / 18px stretch;
  box-shadow: 0 2px 5px #53351630;
  color: #241708;
}
.technique-slot-wrap {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  width: min(82%, 280px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}
.technique-slot {
  width: 100%;
  height: 100%;
}
.technique-art-caption {
  position: absolute;
  top: 320px;
  left: 0;
  width: 100%;
  text-align: center;
  color: #6b5635;
  font-size: 11px;
  margin: 0;
}
.technique-track {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 12px;
  color: #241708;
}
h2 {
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #3b2810;
  text-align: center;
}
h2::before,
h2::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #a68b4688;
}
.technique-stages {
  display: flex;
  position: relative;
  justify-content: space-between;
}
.technique-stage {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  background: none;
  border: 0;
  padding: 0 4px;
  color: #7d7567;
  font: 600 12.5px var(--font-display, Georgia, serif);
  cursor: pointer;
}
.technique-stage.reached,
.technique-stage.current {
  color: #241708;
}
.technique-stage-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 38px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-family: 'UTM OngDoGia', 'Ma Shan Zheng', 'ZCOOL XiaoWei', var(--font-display, Georgia, serif);
  font-size: 30px;
  font-weight: 400;
  line-height: 1;
  color: #8b857a;
  -webkit-text-stroke: 1.2px rgba(215, 206, 190, 0.7);
  paint-order: stroke fill;
  transition: transform 160ms ease, filter 160ms ease;
}
.technique-stage.reached .technique-stage-seal,
.technique-stage.current .technique-stage-seal {
  color: #120d07;
  -webkit-text-stroke: 3px #eab94f;
  paint-order: stroke fill;
  filter:
    drop-shadow(0 1px 2px rgba(24, 16, 6, 0.45))
    drop-shadow(0 0 5px rgba(234, 185, 79, 0.5));
}
.technique-stage.current .technique-stage-seal {
  -webkit-text-stroke: 3.2px #f3c85f;
  filter:
    drop-shadow(0 1px 2px rgba(24, 16, 6, 0.55))
    drop-shadow(0 0 8px rgba(243, 200, 95, 0.75));
}
.selected .technique-stage-seal {
  transform: scale(1.08);
}
.technique-stage:hover .technique-stage-seal {
  filter: brightness(1.08);
}
.technique-stage:focus-visible {
  outline: 2px solid #8a6420;
  outline-offset: 4px;
}
.technique-mastery-label {
  display: flex;
  justify-content: space-between;
  margin: 14px 0 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: #3b2810;
}
.technique-mastery {
  height: 10px;
  border: 1px solid #a48845;
  background: rgba(36, 23, 8, 0.2);
  border-radius: 6px;
  padding: 1px;
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.3),
    0 0 8px color-mix(in srgb, var(--mastery-color, #d4a548) 38%, transparent);
}
.technique-mastery span {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--mastery-color, #d4a548) 72%, #1e1408),
    var(--mastery-color, #d4a548) 65%,
    color-mix(in srgb, var(--mastery-color, #d4a548) 78%, #ffffff)
  );
  box-shadow:
    0 0 8px color-mix(in srgb, var(--mastery-color, #d4a548) 75%, transparent),
    0 0 14px color-mix(in srgb, var(--mastery-color, #d4a548) 45%, transparent),
    inset 0 1px 1px rgba(255, 255, 255, 0.45);
  animation: technique-mastery-glow 2.8s ease-in-out infinite;
  transition: width 240ms ease;
}
@keyframes technique-mastery-glow {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .technique-mastery span {
    animation: none;
  }
}
</style>
