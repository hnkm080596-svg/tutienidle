<script setup lang="ts">
// Scene 08 BODY (Dao The / Kinh Mach) - imperial-scroll interior grid
// after the layout spec: chapter-rail | figure-focus + tier-chips |
// detail-panel. Presentation restructure only - the region components
// read canonical body-chapter read-models through the scene model and
// keep every invest/lock/hidden contract intact.
import { computed, ref } from 'vue'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import { useBodySceneModel, BODY_CHAPTER_ORDER } from './useBodySceneModel'
import BodyChapterRail from './BodyChapterRail.vue'
import BodyFigureFocus from './BodyFigureFocus.vue'
import BodyTierRail from './BodyTierRail.vue'
import BodyRefinementDetail from './BodyRefinementDetail.vue'
import BodyMeridianDetail from './BodyMeridianDetail.vue'
import BodyZhouTianDetail from './BodyZhouTianDetail.vue'

const model = useBodySceneModel()

const pickedChapter = ref<BodyChapterId | null>(null)
const activeChapterId = computed<BodyChapterId>(
  () =>
    pickedChapter.value
    ?? model.chapters.value.find(chapter => chapter.unlocked && chapter.completed < chapter.total)?.id
    ?? model.chapters.value.find(chapter => chapter.unlocked)?.id
    ?? 'body_refinement',
)

const activeModel = computed(() => model.chapter(activeChapterId.value))
const viewedUnit = computed(() => model.viewedUnit(activeChapterId.value))

const DETAIL_COMPONENTS = {
  body_refinement: BodyRefinementDetail,
  meridian: BodyMeridianDetail,
  zhou_tian: BodyZhouTianDetail,
} as const

const activeDetail = computed(() => DETAIL_COMPONENTS[activeChapterId.value])

function selectChapter(id: BodyChapterId): void {
  pickedChapter.value = id
}

function selectUnit(id: string): void {
  model.selectUnit(activeChapterId.value, id)
}
</script>

<template>
  <div class="body-scene">
    <BodyChapterRail
      class="body-scene__rail"
      :chapters="model.chapters.value"
      :active-id="activeChapterId"
      @select="selectChapter"
    />

    <div class="body-scene__center">
      <BodyFigureFocus
        class="body-scene__figure"
        :chapter="activeModel"
        :unit="viewedUnit"
      />
      <BodyTierRail
        class="body-scene__chips"
        :chips="activeModel.chips"
        :selected-id="viewedUnit?.id ?? null"
        @select="selectUnit"
      />
    </div>

    <component
      :is="activeDetail"
      class="body-scene__detail"
      :chapter="activeModel"
      :unit="viewedUnit"
      @invest="model.investActive(activeChapterId)"
    />
  </div>
</template>

<style scoped>
/* Spec 08: content box = 1244x702 design (outer 1540 minus rails);
   chapter-rail 132/610, figure-focus 640/520 + tier-chips 640/56,
   detail-panel 440/610. Fractions preserve the reference placement. */
.body-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 10.6%) minmax(0, 51.4%) minmax(0, 35.4%);
  grid-template-rows: minmax(0, 1fr);
  /* Spec 08 column gaps: 16 design px between rail | figure | detail on
     the 1244 band -> 1.29% each (16/1244, same convention as the
     character scene; a raw 16px renders ~1.306x and overflows the
     right edge ~9.6 design px). */
  column-gap: 1.29%;
  padding: 6px 2px;
}

.body-scene__rail { min-width: 0; }

.body-scene__center {
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* Spec 08: tier-chips sit 8 design px under figure-focus -> 8/610. */
  gap: 1.31%;
}
.body-scene__figure { flex: 1; min-height: 0; }
.body-scene__chips { flex: 0 0 auto; }

.body-scene__detail { min-width: 0; min-height: 0; }

@container (max-width: 900px) {
  .body-scene {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr) minmax(0, 1.2fr);
    row-gap: 10px;
    overflow-y: auto;
  }
  .body-scene__center { min-height: 340px; }
}
</style>
