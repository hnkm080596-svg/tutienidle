<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TalentDefinition } from '@/core/talent/Talent'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationChoiceGrid from './CreationChoiceGrid.vue'
import TalentCard from './TalentCard.vue'
import GameButton from '@/components/common/GameButton.vue'
defineProps<{ talents: TalentDefinition[]; selectedIds: string[]; rolling: boolean; error: string; creating: boolean }>()
const emit = defineEmits<{ toggle: [talent: TalentDefinition]; reroll: [] }>()
const { t } = useI18n()
</script>

<template>
  <section data-hk-region="talent-section">
    <CreationSectionHeader icon="realm" :title="t('onboarding.creation.talentStep.sectionTitle')">
      <template #hint>
        <GameButton class="creation-reroll" variant="secondary" size="sm" :disabled="rolling || creating" data-testid="creation-reroll" @click="emit('reroll')">
          {{ t('onboarding.creation.talentStep.reroll') }}
        </GameButton>
        <span class="creation-hint">{{ t('onboarding.creation.chooseOne') }}</span>
      </template>
    </CreationSectionHeader>
    <CreationChoiceGrid
      :items="talents" :busy="rolling || creating" :label="t('onboarding.creation.talentStep.sectionTitle')"
      role="radiogroup" data-hk-region="talent-grid"
    >
      <template #default="{ item }">
        <TalentCard :talent="item" :selected="selectedIds.includes(item.id)" :disabled="rolling || creating" @toggle="emit('toggle', item)" />
      </template>
      <template #empty>{{ rolling ? t('onboarding.creation.talentStep.rolling') : error }}</template>
    </CreationChoiceGrid>
  </section>
</template>

<style scoped>
.creation-hint { margin-left: 6px; }
/* wave B chrome: the reroll control rides the drawn button-compact
   slice via GameButton secondary sm. */
.creation-reroll { font: 12px var(--hk-font-display, Georgia, serif); }
.creation-reroll:focus-visible { outline: 2px solid #315f55; outline-offset: 2px; }
</style>
