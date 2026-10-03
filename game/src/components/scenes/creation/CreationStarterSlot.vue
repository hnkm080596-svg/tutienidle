<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationChoiceGrid from './CreationChoiceGrid.vue'
import CreationChoiceTile from './CreationChoiceTile.vue'
import CreationSkillSymbol from './CreationSkillSymbol.vue'
import type { CreationSkillOption } from './creationPreview'
defineProps<{ options: readonly CreationSkillOption[] }>()
const { t } = useI18n()
</script>

<template>
  <section data-hk-region="starter-slot">
    <CreationSectionHeader icon="skill" :title="t('onboarding.creation.starterSlot.title')">
      <template #hint>{{ t('onboarding.creation.hoverDetail') }}</template>
    </CreationSectionHeader>
    <!-- Cosmetic preview only: display cards, no control semantics, no pick. -->
    <CreationChoiceGrid :items="options" :label="t('onboarding.creation.starterSlot.title')">
      <template #default="{ item }">
        <CreationChoiceTile
          :name="item.name" :icon="item.icon" symbol="skill"
          :tooltip="{ title: item.name, description: item.description }" :selected="false" display
        >
          <template v-if="!item.icon" #icon><CreationSkillSymbol :motif="item.motif" /></template>
        </CreationChoiceTile>
      </template>
    </CreationChoiceGrid>
  </section>
</template>
