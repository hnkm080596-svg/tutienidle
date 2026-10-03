<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationNameField from './CreationNameField.vue'
const model = defineModel<string>({ required: true })
defineProps<{ validName: boolean; disabled?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <section class="creation-name-section" data-hk-region="name-section">
    <CreationSectionHeader icon="character" :title="t('onboarding.creation.nameStep.sectionTitle')">
      <template #hint><span :class="{ valid: validName }">{{ model.length }}/20</span></template>
    </CreationSectionHeader>
    <CreationNameField v-model="model" :disabled="disabled" />
    <span id="creation-name-desc" class="creation-name-section__desc">{{ t('onboarding.creation.nameStep.description') }}</span>
  </section>
</template>

<style scoped>
.creation-name-section__desc { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.valid { color: #315f55; }
</style>
