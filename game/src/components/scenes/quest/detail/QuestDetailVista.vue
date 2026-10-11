<script setup lang="ts">
// Detail banner (Codex landscape port): painted landscape strip across
// the top of the detail card with the quest name + its group under a
// dark gradient, like the approved preview's .quest-banner. No
// per-quest vista art exists in the model yet - the shared warm vista
// stands in until row.image is assigned.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t, te } = useI18n()

const art = computed(() => ({
  backgroundImage: `url('${resolveAssetUrl(props.row.image ?? '/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png')}')`,
}))

const groupLabel = computed(() => {
  const id = props.row.group ?? props.row.cadence
  const key = `panels.quest.groups.${id}`
  return te(key) ? t(key) : t(`panels.quest.cadence.${props.row.cadence}`)
})
</script>

<template>
  <div class="quest-detail-vista" :style="art">
    <h2 class="quest-detail-vista__name">{{ row.name }}</h2>
    <p class="quest-detail-vista__group">{{ groupLabel }}</p>
  </div>
</template>

<style scoped>
.quest-detail-vista {
  position: relative;
  isolation: isolate;
  height: 78px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 8px;
  box-sizing: border-box;
  background-position: center;
  background-size: cover;
}
.quest-detail-vista::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(transparent, #141511e8);
}
.quest-detail-vista__name {
  margin: 0;
  font-size: 20px;
  color: #ffe6aa;
  text-shadow: 0 2px 4px #000;
}
.quest-detail-vista__group {
  margin: 2px 0 0;
  font-size: 12px;
}
</style>
