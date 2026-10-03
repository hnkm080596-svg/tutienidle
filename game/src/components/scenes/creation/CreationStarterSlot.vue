<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationChoicePager from './CreationChoicePager.vue'
import CreationChoiceTile from './CreationChoiceTile.vue'
import CreationSkillSymbol from './CreationSkillSymbol.vue'
import type { CreationSkillOption } from './creationPreview'
const selected = defineModel<string>({ required: true })
defineProps<{ options: readonly CreationSkillOption[]; disabled?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <section data-hk-region="starter-slot">
    <CreationSectionHeader icon="skill" :title="t('onboarding.creation.starterSlot.title')">
      <template #hint>{{ t('onboarding.creation.chooseOne') }}</template>
    </CreationSectionHeader>
    <CreationChoicePager :items="options" :busy="disabled" :label="t('onboarding.creation.starterSlot.title')">
      <template #default="{ item }">
        <CreationChoiceTile :name="item.name" :icon="item.icon" symbol="skill"
          :tooltip="{ title: item.name, description: item.description }"
          :selected="selected === item.id" :disabled="disabled"
          :data-testid="`creation-skill-${item.id}`" @select="selected = item.id">
          <template v-if="!item.icon" #icon><CreationSkillSymbol :motif="item.motif" /></template>
        </CreationChoiceTile>
      </template>
      <template #action><span class="creation-starter-note">{{ t('onboarding.creation.hoverDetail') }}</span></template>
    </CreationChoicePager>
  </section>
</template>

<style scoped>
.creation-starter-note { color: #7c715c; font-size: 11px; }
</style>
