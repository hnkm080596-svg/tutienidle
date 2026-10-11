<script setup lang="ts">
// Detail progress section (Codex landscape port): plaque header +
// EnergyTube with the 'x / y' amount, same as the preview's
// .quest-progress block inside the detail card.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import QuestSectionPlaque from './QuestSectionPlaque.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{ row: BetaQuestSurfaceModel }>()

const { t } = useI18n()

const fill = computed(() =>
  props.row.target > 0 ? Math.min(props.row.progress, props.row.target) / props.row.target : 0,
)
const amountText = computed(() => `${Math.min(props.row.progress, props.row.target)} / ${props.row.target}`)
</script>

<template>
  <QuestSectionPlaque :text="t('panels.quest.scene.progress')" />
  <div class="quest-progress-meter">
    <EquipmentEnergyTube class="quest-progress-meter__tube" :fill="fill" color="#e7bb62" />
    <span>{{ amountText }}</span>
  </div>
</template>

<style scoped>
.quest-progress-meter {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
}
.quest-progress-meter__tube { flex: 1; min-width: 0; }
.quest-progress-meter span { white-space: nowrap; }
</style>
