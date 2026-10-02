<script setup lang="ts">
// Scene 08 region `figure-focus` (design 436/176/640/520): the painted
// backdrop plate, cultivation silhouette + aligned meridian overlay
// (stable art slots kept verbatim for the e2e contract), the Bat Mach
// orb ring, and the progress strip at the region's foot. The figure
// keeps the landed-chapter ignite flash from the pre-scaffold layout.
import { onBeforeUnmount, ref, watch } from 'vue'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'
import type { BodyChapterModel } from './useBodySceneModel'
import type { BodyUnitView } from './bodySceneModel'
import BodyOrbRing from './BodyOrbRing.vue'
import BodyProgressStrip from './BodyProgressStrip.vue'

const props = defineProps<{
  chapter: BodyChapterModel
  unit: BodyUnitView | null
}>()

const BODY_FIGURE_SRC = stableSceneArtUrl('body-cultivation-figure', '@2x')
const BODY_MERIDIAN_OVERLAY_SRC = stableSceneArtUrl('body-meridian-overlay', '@2x')

// Landed-chapter flash on the silhouette (same beat the pre-scaffold
// panel owned): total completed units rising ignites the figure once.
const bodyIgniting = ref(false)
let igniteTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.chapter.completed,
  (now, before) => {
    if (now <= before) return
    bodyIgniting.value = true
    clearTimeout(igniteTimer)
    igniteTimer = setTimeout(() => {
      bodyIgniting.value = false
    }, 1400)
  },
)

onBeforeUnmount(() => clearTimeout(igniteTimer))
</script>

<template>
  <div class="body-focus" data-hk-region="figure-focus">
    <div class="body-focus__vista art-needed" data-art-id="body-vista" aria-hidden="true">
      <span class="body-focus__sun" />
      <span class="body-focus__ridge body-focus__ridge--far" />
      <span class="body-focus__ridge body-focus__ridge--near" />
    </div>

    <div class="body-focus__stage" :class="{ 'is-igniting': bodyIgniting }">
      <img class="body-scene__figure-img" :src="BODY_FIGURE_SRC" alt="" aria-hidden="true" />
      <img class="body-scene__figure-overlay" :src="BODY_MERIDIAN_OVERLAY_SRC" alt="" aria-hidden="true" />
      <BodyOrbRing />
      <span class="body-focus__dais art-needed" data-art-id="body-dais" aria-hidden="true" />
    </div>

    <div class="body-focus__footer">
      <BodyProgressStrip :chapter="chapter" :unit="unit" />
    </div>
  </div>
</template>

<style scoped>
.body-focus {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  background: var(--hk-surface-base, #0b0f0d);
}

/* Painted vista placeholder - ink wash landscape bands behind the
   figure until the authored backdrop lands. */
.body-focus__vista {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(49, 95, 85, 0.32) 0%, transparent 55%),
    linear-gradient(180deg, #101a16 0%, #0b0f0d 60%, #0e1411 100%);
}
.body-focus__sun {
  position: absolute;
  top: 12%;
  left: 50%;
  width: 17%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(244, 217, 139, 0.5) 0%, rgba(244, 217, 139, 0.12) 55%, transparent 72%);
}
.body-focus__ridge {
  position: absolute;
  left: -8%;
  right: -8%;
  height: 42%;
  bottom: -6%;
  background:
    linear-gradient(200deg, transparent 42%, rgba(20, 32, 26, 0.9) 43%, rgba(10, 14, 11, 0.96) 78%);
}
.body-focus__ridge--far {
  bottom: 8%;
  opacity: 0.55;
  transform: scaleX(1.1) scaleY(-1);
  filter: blur(1px);
}

.body-focus__stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.body-focus__stage.is-igniting { animation: body-ignite-flash 1400ms var(--hk-ease-standard, ease) 1; }

.body-scene__figure-img {
  position: relative;
  width: min(62%, 330px);
  height: auto;
}
/* Meridian overlay shares the figure canvas: identical centered box
   keeps the authored alignment (contract from the pre-scaffold scene). */
.body-scene__figure-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(62%, 330px);
  height: auto;
  pointer-events: none;
}

.body-focus__dais {
  position: absolute;
  left: 50%;
  bottom: 4%;
  width: 46%;
  height: 9%;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(181, 68, 50, 0.28) 0%, rgba(49, 95, 85, 0.2) 55%, transparent 78%);
}

.body-focus__footer {
  position: relative;
  padding: 0 12px 12px;
}

@keyframes body-ignite-flash {
  0% { box-shadow: inset 0 0 0 0 var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  30% { box-shadow: inset 0 0 60px 8px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  100% { box-shadow: inset 0 0 0 0 transparent; }
}
</style>
