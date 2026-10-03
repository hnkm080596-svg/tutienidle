<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { TalentDefinition } from '@/core/talent/Talent'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationChoicePager from './CreationChoicePager.vue'
import TalentCard from './TalentCard.vue'
defineProps<{ talents: TalentDefinition[]; selectedIds: string[]; rolling: boolean; error: string; creating: boolean }>()
const emit = defineEmits<{ toggle: [talent: TalentDefinition]; reroll: [] }>()
const { t } = useI18n()
</script>

<template>
  <section data-hk-region="talent-section">
    <CreationSectionHeader icon="realm" :title="t('onboarding.creation.talentStep.sectionTitle')">
      <template #hint>{{ t('onboarding.creation.chooseOne') }}</template>
    </CreationSectionHeader>
    <CreationChoicePager :items="talents" :busy="rolling || creating" :label="t('onboarding.creation.talentStep.sectionTitle')" data-hk-region="talent-grid">
      <template #default="{ item }">
        <TalentCard :talent="item" :selected="selectedIds.includes(item.id)" :disabled="rolling || creating" @toggle="emit('toggle', item)" />
      </template>
      <template #empty>{{ rolling ? t('onboarding.creation.talentStep.rolling') : error }}</template>
      <template #action>
        <button class="creation-reroll" type="button" :disabled="rolling || creating" data-testid="creation-reroll" @click="emit('reroll')">
          {{ t('onboarding.creation.talentStep.reroll') }}
        </button>
      </template>
    </CreationChoicePager>
  </section>
</template>

<style scoped>
.creation-reroll { padding: 3px 0; border: 0; background: none; color: #66532d; font: 12px var(--hk-font-display, Georgia, serif); cursor: pointer; }
.creation-reroll:hover { color: #214e3e; }
.creation-reroll:focus-visible { outline: 2px solid #315f55; outline-offset: 2px; }
</style>
