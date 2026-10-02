<script setup lang="ts">
// Scene 02 Dao Danh section - seal header + subtitle line + name field +
// length hint (region name-section 988/150/564/170 in design px).
import { useI18n } from 'vue-i18n'
import CreationSectionHeader from './CreationSectionHeader.vue'
import CreationNameField from './CreationNameField.vue'

defineProps<{
  modelValue: string
  validName: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()
</script>

<template>
  <section class="creation-name-section" data-hk-region="name-section">
    <CreationSectionHeader icon="character" :title="t('onboarding.creation.nameStep.sectionTitle')" />
    <CreationNameField
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <small class="creation-name-section__hint" :class="{ valid: validName }">
      {{ t('onboarding.creation.nameStep.minLengthHint', { length: modelValue.length }) }}
    </small>
    <span id="creation-name-desc" class="creation-name-section__desc">
      {{ t('onboarding.creation.nameStep.description') }}
    </span>
  </section>
</template>

<style scoped>
.creation-name-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: clamp(4px, 1vh, 10px);
}

.creation-name-section__hint {
  display: block;
  color: #6b6151;
  font-size: var(--text-xs);
}

.creation-name-section__hint.valid {
  color: #2f7a63;
}

/* Description stays in the a11y tree without adding a line the ref card
   does not carry. */
.creation-name-section__desc {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
