<script setup lang="ts">
// Scene 09 scaffold - map-canvas region (spec 444/228/700/524). Chrome
// frame + painted mask are delivered stable art; the parchment field
// (ruling 04 - painted geography lands later) is the temp substrate.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/primitives/EmptyState.vue'

const scrollEl = ref<HTMLElement | null>(null)

const props = defineProps<{
  zoneName: string
  frameSrc: string
  dividerSrc: string
  maskSrc: string
  hasStages: boolean
}>()

const { t } = useI18n()

function scrollToChapter(chapter: number) {
  // scrollIntoView is absent under jsdom - guard with an optional call.
  scrollEl.value
    ?.querySelector(`.exploration-band[data-chapter="${chapter}"]`)
    ?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}

defineExpose({ scrollToChapter })
</script>

<template>
  <section class="stage-select__map-panel">
    <img class="stage-select__map-frame" :src="props.frameSrc" alt="" aria-hidden="true" />
    <!-- Pinned map header sits INSIDE the frame's interior band -
         it was previously the scroll region's first child, where
         the scrollfade top mask ate the title glyphs. -->
    <header class="stage-select__map-head">
      <h4 class="stage-select__title">{{ props.zoneName || t('panels.stageSelect.sections.selectFloor') }}</h4>
      <img class="stage-select__chapter-divider" :src="props.dividerSrc" alt="" aria-hidden="true" />
    </header>
    <div ref="scrollEl" class="stage-select__map-scroll scrollfade">
      <EmptyState v-if="!props.hasStages" size="sm">{{ t('panels.stageSelect.empty.noStages') }}</EmptyState>

      <div
        v-else
        class="stage-map art-needed"
        data-art-id="exploration-map-substrate"
        :style="{ '--map-mask': `url(${props.maskSrc})` }"
      >
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* exploration-map-chrome-kit: the panel is the (non-scrolling) frame's
   canvas; .stage-select__map-scroll carries the old overflow behavior. */
.stage-select__map-panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--paper-line);
  overflow: hidden;
  padding: 0;
}

/* The map head is pinned inside the frame interior so the scroll mask
   never fades it. */
.stage-select__map-head {
  position: absolute;
  top: 60px;
  left: 48px;
  right: 48px;
  z-index: 3;
}
.stage-select__map-head .stage-select__title { margin-bottom: 4px; }

.stage-select__title {
  margin: 0 0 8px;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-body);
}

.stage-select__chapter-divider {
  display: block;
  width: 100%;
  height: auto;
  max-height: 14px;
  object-fit: fill;
  margin: 0 0 8px;
  pointer-events: none;
}

.stage-select__map-scroll {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  /* The painted frame's inner border is ~28-40px at this canvas scale,
     and the pinned head band occupies ~90px - the node field starts
     under both and clears the bottom band. All three chapter bands
     fit inside the frame at design res (ref 09) without scrolling. */
  padding: 104px 36px 44px;
}

/* Scene 10: the floor field rides the vertical center of the map frame
   (auto margins collapse cleanly when many stages force scrolling). */
.stage-select__map-scroll > .empty-state { margin-block: auto; }

.stage-select__map-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  z-index: 1;
}

/* Scene 10 (Son Ha Do): the stage field is a parchment canvas - the
   chapter bands ride it, masked at the edges (stable map-content mask:
   alpha edges feather the field into the parchment). */
.stage-map {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-height: 0;
  /* The last chapter row's 'Tang N' + enemy-name copy hangs ~30px
     below its node disc - internal bottom room keeps it fully inside
     the painted mask instead of clipping at the map's bottom edge. */
  padding-bottom: 36px;
  -webkit-mask-image: var(--map-mask, none);
  mask-image: var(--map-mask, none);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.stage-select__map-panel .empty-state {
  color: var(--paper-text-muted);
  font-size: var(--text-xs);
}
</style>
