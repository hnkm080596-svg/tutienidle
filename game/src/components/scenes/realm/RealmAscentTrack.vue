<script setup lang="ts">
// Scene 05 ascent track: the luminous trail climbing the vista, rung
// medallions + realm banner plaques riding it, mist veil at the summit.
// internal-scroll region (spec: overflow internal-scroll, hidden
// scrollbars + scrollfade mask).
import { computed, onMounted, ref } from 'vue'
import type { RealmPassiveNode } from '@/data/realm/RealmPassiveNodes'
import RealmAscentNode from './RealmAscentNode.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  nodes: readonly RealmPassiveNode[]
  currentTier: number
  nextTier: number | null
  pathProgress: number
  sealChar?: string
}>()

const { t } = useI18n()

// DOM order high->low so the mortal rung sits at the BOTTOM of the
// ascent (same visual as the old column-reverse, but overflow now
// scrolls normally - column-reverse + overflow-y + space-evenly made
// the overflowing rungs unreachable and the ladder read as empty).
const reversedNodes = computed(() => [...props.nodes].reverse())

const trackEl = ref<HTMLElement | null>(null)
// Anchor the scroll at the bottom rung (current realm) on mount.
onMounted(() => {
  const el = trackEl.value
  if (el) el.scrollTop = el.scrollHeight
})
</script>

<template>
  <div
    ref="trackEl"
    class="realm-panel__nodes"
    :aria-label="t('panels.realm.nodes.aria')"
    :style="{ '--path-progress': `${pathProgress}%` }"
  >
    <!-- Luminous trail spine (art-needed): climbed share jade, rest ink. -->
    <i class="realm-track__trail art-needed" data-art-id="realm-path-trail" aria-hidden="true" />
    <!-- Mist veil over the summit - release-ceiling rungs fade into it. -->
    <i class="realm-track__mist art-needed" data-art-id="realm-summit-mist" aria-hidden="true" />

    <RealmAscentNode
      v-for="(node, index) in reversedNodes"
      :key="`${node.realmId}-${index}`"
      :node="node"
      :index="index"
      :current-tier="currentTier"
      :next-tier="nextTier"
      :seal-char="sealChar"
    />
  </div>
</template>

<style scoped>
.realm-panel__nodes {
  z-index: 1;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 10px;
  padding: 14px 0 20px;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}
.realm-panel__nodes::-webkit-scrollbar { display: none; }

/* Trail spine - climbs center-bottom to summit; climbed share jade. */
.realm-track__trail {
  position: absolute;
  top: 18px;
  bottom: 10px;
  left: 50%;
  width: 3px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: linear-gradient(
    to top,
    var(--hk-jade, #3fa68b) var(--path-progress, 0%),
    var(--hk-border-muted, #2a352f) var(--path-progress, 0%)
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--hk-jade, #3fa68b) 35%, transparent);
}

/* Summit mist veil. */
.realm-track__mist {
  position: absolute;
  left: 50%;
  top: -10px;
  width: 220px;
  height: 46px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--hk-text-secondary, #b8ae97) 15%, transparent), transparent 72%);
  filter: blur(5px);
  pointer-events: none;
}

@container (max-width: 860px) {
  .realm-panel__nodes { padding-left: 30px; }
  .realm-track__trail { left: 10px; }
}
</style>
