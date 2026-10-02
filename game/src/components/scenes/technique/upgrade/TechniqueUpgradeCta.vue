<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BetaTechniqueGradeAdvance } from '@/core/betaScopeTechniqueDomain'

// Ceremonial CTA: quotes the price line even while disabled (contract -
// "a greyed button renders the price line"), then the disabledReason
// hint underneath. .technique-scene__grade-btn preserved for tests.
const props = defineProps<{
  gradeAdvance: BetaTechniqueGradeAdvance
}>()

const emit = defineEmits<{ advance: [] }>()

const { t } = useI18n()

const reasonText = computed(() => {
  switch (props.gradeAdvance.disabledReason) {
    case 'grade-ceiling': return t('panels.skillPath.technique.reasonGradeCeiling')
    case 'realm-gate': return t('panels.skillPath.technique.reasonRealmGate')
    case 'insufficient-material': return t('panels.skillPath.technique.reasonInsufficientMaterial')
    case 'busy': return t('panels.skillPath.technique.reasonBusy')
    default: return null
  }
})
</script>

<template>
  <div class="technique-upgrade-cta">
    <GameButton
      class="technique-scene__grade-btn"
      variant="primary"
      size="lg"
      :disabled="!gradeAdvance.available"
      @click="emit('advance')"
    >
      {{ t('panels.skillPath.technique.gradeAction') }}
      <template v-if="gradeAdvance.cost !== undefined">
        — {{ formatNumber(gradeAdvance.cost) }} {{ gradeAdvance.materialName }} ({{ formatNumber(gradeAdvance.owned ?? 0) }})
      </template>
    </GameButton>
    <p v-if="reasonText" class="technique-upgrade-cta__reason">{{ reasonText }}</p>
  </div>
</template>

<style scoped>
.technique-upgrade-cta {
  display: flex;
  flex-direction: column;
  gap: var(--hk-space-2);
  align-items: stretch;
  margin-top: auto;
}

.technique-upgrade-cta__reason {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--hk-text-muted);
  text-align: center;
}
</style>
