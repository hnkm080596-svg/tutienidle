<script setup lang="ts">
// Scene 02 Thien Phu section - seal header + pick hint + 3x3 offer grid +
// reroll action (region talent-grid 988/340/564/360, roll size 9).
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import type { TalentDefinition } from '@/core/talent/Talent'
import CreationSectionHeader from './CreationSectionHeader.vue'
import TalentCard from './TalentCard.vue'

defineProps<{
  talents: TalentDefinition[]
  selectedIds: string[]
  rolling: boolean
  error: string
  creating: boolean
}>()

const emit = defineEmits<{ toggle: [talent: TalentDefinition]; reroll: [] }>()
const { t } = useI18n()
</script>

<template>
  <section class="creation-talent-section" data-hk-region="talent-section">
    <CreationSectionHeader icon="realm" :title="t('onboarding.creation.talentStep.sectionTitle')">
      <template #hint>
        <template v-if="selectedIds.length">{{ t('onboarding.creation.talentStep.selected', { count: selectedIds.length }) }}</template>
        <template v-else>{{ t('onboarding.creation.talentStep.hint') }}</template>
      </template>
    </CreationSectionHeader>

    <p v-if="rolling && talents.length === 0" class="creation-talent-section__status">
      {{ t('onboarding.creation.talentStep.rolling') }}
    </p>
    <p v-else-if="error && talents.length === 0" class="creation-talent-section__status">
      {{ error }}
    </p>
    <div
      v-else
      class="creation-talent-section__grid"
      :class="{ 'is-rolling': rolling }"
      :aria-busy="rolling"
      data-hk-region="talent-grid"
    >
      <TalentCard
        v-for="talent in talents"
        :key="talent.id"
        :talent="talent"
        :selected="selectedIds.includes(talent.id)"
        :disabled="rolling || creating"
        @toggle="emit('toggle', talent)"
      />
    </div>

    <div class="creation-talent-section__actions">
      <GameButton variant="secondary" size="sm" :disabled="rolling || creating" @click="emit('reroll')">
        {{ t('onboarding.creation.talentStep.reroll') }}
      </GameButton>
    </div>
  </section>
</template>

<style scoped>
.creation-talent-section {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.creation-talent-section__status {
  flex: 1;
  min-height: 120px;
  display: grid;
  place-items: center;
  margin: 0;
  color: var(--hk-gold, #c99a4a);
  font-family: var(--hk-font-display, var(--font-display));
}

.creation-talent-section__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  /* spec card = 176x112 design px; rows pinned so the grid cannot push the
     footer past the scroll edge */
  grid-auto-rows: clamp(96px, 12vh, 114px);
  gap: 8px;
  align-content: start;
}

.creation-talent-section__grid.is-rolling {
  opacity: 0.45;
  pointer-events: none;
}

.creation-talent-section__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: clamp(6px, 1vh, 10px);
  /* Pull the reroll button off the parchment's right edge - flush
     flex-end put it under the scroll's painted rim; 10px still left
     the button's right cap clipped under the rim art. */
  margin-right: 34px;
}

@media (max-width: 760px) {
  .creation-talent-section__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
