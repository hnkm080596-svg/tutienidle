<script setup lang="ts">
// Scene 08 region `tier-chips` (design 436/704/640/56): the selector row
// under the figure - one chip per unit of the active chapter (ref's
// "Tier 1..5" row generalized to the real authored units).
import { useI18n } from 'vue-i18n'
import type { BodyChipView } from './bodySceneModel'
import BodyTierChip from './BodyTierChip.vue'

defineProps<{
  chips: BodyChipView[]
  selectedId: string | null
}>()

const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
</script>

<template>
  <div class="body-tiers" data-hk-region="tier-chips" :aria-label="t('panels.body.tierRailAria')">
    <BodyTierChip
      v-for="chip in chips"
      :key="chip.id"
      :chip="chip"
      :selected="chip.id === selectedId"
      @select="id => emit('select', id)"
    />
  </div>
</template>

<style scoped>
.body-tiers {
  display: flex;
  align-items: stretch;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.body-tiers::-webkit-scrollbar { display: none; }
</style>
