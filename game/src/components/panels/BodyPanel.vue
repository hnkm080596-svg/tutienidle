<script setup lang="ts">
// Huyen Kim scene 08 - Dao The / Kinh Mach dedicated imperial scroll.
//
// Extracted from RealmPanel (mission sec.10): Body owns Luyen The ->
// Bat Mach -> Chu Thien as its own scene; Realm keeps only the Thien Lo
// ascent. The silhouette + meridian overlay stay decorative substrate -
// chapter rail, sections, costs and unlocks all read canonical runtime
// state (BodyProgressionSystem via the same read calls RealmPanel used).
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import BodyRefinementSection from '@/components/panels/realm/BodyRefinementSection.vue'
import MeridianSection from '@/components/panels/realm/MeridianSection.vue'
import ZhouTianSection from '@/components/panels/realm/ZhouTianSection.vue'
import BodyChapterNav, { type BodyChapterEntry } from '@/components/panels/realm/BodyChapterNav.vue'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import { getBodyChapterProgress, isBodyChapterUnlocked } from '@/core/realm/body/BodyProgressionSystem'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'

const ui = useUiStore()
const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

const BODY_CHAPTER_LABEL_KEYS: Record<BodyChapterId, string> = {
  body_refinement: 'panels.realm.bodyRefinement.title',
  meridian: 'panels.realm.meridian.title',
  zhou_tian: 'panels.realm.zhouTian.title',
}
const BODY_CHAPTER_ORDER: readonly BodyChapterId[] = ['body_refinement', 'meridian', 'zhou_tian']

const bodyChapters = computed<BodyChapterEntry[]>(() => {
  stateVersion.value

  return BODY_CHAPTER_ORDER.map(id => {
    const progress = getBodyChapterProgress(player.$state, id)
    return {
      id,
      label: t(BODY_CHAPTER_LABEL_KEYS[id]),
      unlocked: isBodyChapterUnlocked(player.$state, id),
      completed: progress.completed,
      total: progress.total,
    }
  })
})

const selectedChapter = ref<BodyChapterId | null>(null)
const activeChapter = computed<BodyChapterId>(
  () =>
    selectedChapter.value
    ?? bodyChapters.value.find(chapter => chapter.unlocked && chapter.completed < chapter.total)?.id
    ?? bodyChapters.value.find(chapter => chapter.unlocked)?.id
    ?? 'body_refinement',
)

const BODY_FIGURE_SRC = stableSceneArtUrl('body-cultivation-figure', '@2x')
const BODY_MERIDIAN_OVERLAY_SRC = stableSceneArtUrl('body-meridian-overlay', '@2x')

// Spec 08 meridian orb ring (Ky Kinh Bat Mach = 8 canonical nodes): the
// orbit of eight orbs around the figure reads the meridian chapter's
// real progress - lit for completed nodes, dim otherwise. Decorative
// placement only; no domain data is synthesized for the visual.
const MERIDIAN_ORB_COUNT = 8
const meridianProgress = computed(() => {
  stateVersion.value
  return getBodyChapterProgress(player.$state, 'meridian')
})

// Landed-chapter flash on the silhouette (same beat RealmPanel owned).
const bodyIgniting = ref(false)
let igniteTimer: ReturnType<typeof setTimeout> | undefined

const bodyCompletedTotal = computed(() =>
  bodyChapters.value.reduce((sum, chapter) => sum + chapter.completed, 0),
)

watch(bodyCompletedTotal, (now, before) => {
  if (now <= before) {
    return
  }

  bodyIgniting.value = true
  clearTimeout(igniteTimer)
  igniteTimer = setTimeout(() => {
    bodyIgniting.value = false
  }, 1400)
})

onBeforeUnmount(() => clearTimeout(igniteTimer))

function close() { ui.closeHomeOverlays() }
</script>

<template>
  <ImperialScrollScene
    scene="body"
    :open="ui.standalonePanel === 'body'"
    :title="t('panels.realm.body.title')"
    @close="close"
  >
    <div class="body-scene">
      <!-- Chapter rail: Luyen The -> Bat Mach -> Chu Thien -->
      <nav class="body-scene__rail" aria-label="body chapters">
        <BodyChapterNav
          :chapters="bodyChapters"
          :active-id="activeChapter"
          @select="id => { selectedChapter = id }"
        />
      </nav>

      <!-- Central anchor: cultivation figure + aligned meridian overlay +
           the Bat Mach orb ring (8 authored meridian nodes, lit by real
           chapter progress). -->
      <div class="body-scene__figure" :class="{ 'is-igniting': bodyIgniting }">
        <img class="body-scene__figure-img" :src="BODY_FIGURE_SRC" alt="" aria-hidden="true" />
        <img class="body-scene__figure-overlay" :src="BODY_MERIDIAN_OVERLAY_SRC" alt="" aria-hidden="true" />
        <div class="body-scene__orbits" aria-hidden="true">
          <span
            v-for="orb in MERIDIAN_ORB_COUNT"
            :key="orb"
            class="body-scene__orbit-arm"
            :style="{ '--orb-i': orb - 1 }"
          >
            <span
              class="body-scene__orb"
              :class="{ 'is-lit': orb <= meridianProgress.completed }"
            />
          </span>
        </div>
      </div>

      <!-- Active chapter detail (runtime-owned nodes/costs/gains) -->
      <div class="body-scene__chapter">
        <BodyRefinementSection v-if="activeChapter === 'body_refinement'" />
        <MeridianSection v-else-if="activeChapter === 'meridian'" />
        <ZhouTianSection v-else />
      </div>
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Spec 08: chapter rail | figure focus | detail. Content box = 1244x702
   design (outer 1540 minus rails); rail 132, figure ~640 canvas, rest detail. */
.body-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(120px, 168px) minmax(180px, 1fr) minmax(0, 1.35fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 18px;
  padding: 6px 2px;
}

.body-scene__rail { min-height: 0; overflow-y: auto; }

.body-scene__figure {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  background: var(--hk-surface-base, #0b0f0d);
  overflow: hidden;
}
.body-scene__figure::before {
  content: '';
  position: absolute;
  inset: 8% 14%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--hk-glow-jade, rgba(63, 166, 139, 0.35)), transparent 72%);
  opacity: 0.35;
  pointer-events: none;
}
.body-scene__figure-img { position: relative; width: min(88%, 390px); height: auto; }
/* Meridian overlay shares the figure's 640x520 canvas: same width box
   centered identically keeps the authored alignment. */
.body-scene__figure-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(88%, 390px);
  height: auto;
  pointer-events: none;
}
.body-scene__figure.is-igniting { animation: body-ignite-flash 1400ms var(--hk-ease-standard, ease) 1; }
.body-scene__figure.is-igniting::before { opacity: 0.8; }

/* Eight meridian orbs on a slow ring around the figure - placement is
   decorative, lit state is canonical chapter progress. */
.body-scene__orbits {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(84%, 380px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: body-orbit-spin 36s linear infinite;
}
/* Each orb rides a full-height spoke rotated by its meridian index -
   percentages resolve against the orbit container, not the dot. */
.body-scene__orbit-arm {
  position: absolute;
  inset: 0;
  transform: rotate(calc(var(--orb-i) * 45deg));
}
.body-scene__orb {
  position: absolute;
  left: 50%;
  top: 0;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--hk-ink, #5b6266);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-surface-base, #0b0f0d) 70%, transparent);
}
.body-scene__orb.is-lit {
  background: var(--hk-jade-soft, #67c4ab);
  box-shadow: 0 0 10px var(--hk-glow-jade, rgba(63, 166, 139, 0.6));
}
@keyframes body-orbit-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .body-scene__orbits { animation: none; }
}

.body-scene__chapter {
  min-height: 0;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
  padding: 4px 8px;
}

@keyframes body-ignite-flash {
  0% { box-shadow: inset 0 0 0 0 var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  30% { box-shadow: inset 0 0 60px 8px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  100% { box-shadow: inset 0 0 0 0 transparent; }
}

@container (max-width: 900px) {
  .body-scene { grid-template-columns: 1fr; grid-template-rows: auto minmax(180px, 34%) 1fr; overflow-y: auto; }
  .body-scene__rail { overflow-y: visible; }
  .body-scene__rail :deep(.body-chapters) { flex-direction: row; flex-wrap: wrap; }
}
</style>
