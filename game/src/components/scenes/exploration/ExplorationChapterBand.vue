<script setup lang="ts">
// Scene 09 scaffold - one chapter band inside the map field (ref: three
// horizontal tracks, each a realm-colored wash with its chapter seal on
// the left, numbered floor nodes on a winding trail, boss medallion at
// the right end). layoutChapterBandTrail owns node geometry.
import { computed } from 'vue'
import type { Stage } from '@/core/stage/Stage'
import type { StageSurfaceModel } from '@/core/game/GameManagerStageOps'
import { layoutChapterBandTrail } from '@/components/panels/stageTrailLayout'
import { disabledReasonLabel } from './disabledReasonLabel'
import { useI18n } from 'vue-i18n'
import ExplorationChapterMarker from './ExplorationChapterMarker.vue'
import ExplorationStageNode from './ExplorationStageNode.vue'

const props = defineProps<{
  chapter: number
  label: string
  stages: Stage[]
  models: Map<string, StageSurfaceModel>
  selectedStageId: string | null
  bossSealUrl: string | null
}>()

const emit = defineEmits<{
  (e: 'select-stage', stageId: string): void
}>()

const { t } = useI18n()

const trail = computed(() => layoutChapterBandTrail(props.stages.length))

function tooltipFor(stage: Stage): string | undefined {
  if (stage.id === props.selectedStageId) {
    return undefined
  }
  const model = props.models.get(stage.id)
  return model?.state === 'locked'
    ? disabledReasonLabel(model.disabledReason, t)
    : stage.description
}
</script>

<template>
  <section
    class="exploration-band"
    :class="`exploration-band--ch${props.chapter}`"
    :data-chapter="props.chapter"
  >
    <span class="exploration-band__wash art-needed" :data-art-id="`exploration-band-vista-ch${props.chapter}`" aria-hidden="true" />
    <ExplorationChapterMarker :chapter="props.chapter" :label="props.label" />

    <div class="exploration-band__trail">
      <svg
        v-if="trail.pathD"
        class="stage-map__trail"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path :d="trail.pathD" class="stage-map__trail-path" />
      </svg>
      <ExplorationStageNode
        v-for="(stage, index) in props.stages"
        :key="stage.id"
        :stage="stage"
        :model="props.models.get(stage.id)"
        :point="trail.points[index]"
        :selected="stage.id === props.selectedStageId"
        :is-last="index === props.stages.length - 1"
        :boss-seal-url="props.bossSealUrl"
        :tooltip-text="tooltipFor(stage)"
        @select="emit('select-stage', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.exploration-band {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  border-radius: var(--radius-sm);
}

/* Temp vista wash per realm - the real chapter terrain painting lands
   with the map substrate (art inventory: exploration-band-vista-ch*). */
.exploration-band__wash {
  position: absolute;
  inset: 2px 0;
  border-radius: var(--radius-sm);
  pointer-events: none;
}

.exploration-band--ch1 .exploration-band__wash {
  background:
    radial-gradient(ellipse 70% 90% at 30% 60%, color-mix(in srgb, #315f55 16%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, #315f55 7%, var(--paper-100)) 0%, color-mix(in srgb, #315f55 14%, var(--paper-200)) 100%);
}
.exploration-band--ch2 .exploration-band__wash {
  background:
    radial-gradient(ellipse 70% 90% at 30% 60%, color-mix(in srgb, #3d5a78 16%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, #3d5a78 7%, var(--paper-100)) 0%, color-mix(in srgb, #3d5a78 14%, var(--paper-200)) 100%);
}
.exploration-band--ch3 .exploration-band__wash {
  background:
    radial-gradient(ellipse 70% 90% at 30% 60%, color-mix(in srgb, #5a4a78 16%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, #5a4a78 7%, var(--paper-100)) 0%, color-mix(in srgb, #5a4a78 14%, var(--paper-200)) 100%);
}

.exploration-band__trail {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
}

.exploration-band__trail .stage-map__trail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.exploration-band__trail .stage-map__trail-path {
  fill: none;
  stroke: color-mix(in srgb, var(--scene-portal-accent) 70%, var(--brush-950) 12%);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 18 9;
  opacity: 0.8;
  vector-effect: non-scaling-stroke;
}
</style>
