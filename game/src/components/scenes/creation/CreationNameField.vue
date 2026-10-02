<script setup lang="ts">
// Scene 02 name field — the Đạo Danh text input on text-field chrome.
// Contract surface: data-testid="creation-name-input", maxlength 20,
// autofocus, disabled while the create call is in flight.
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="creation-name-field">
    <span class="creation-name-field__label">{{ t('onboarding.creation.nameStep.label') }}</span>
    <span class="creation-name-field__box">
      <InkNineSlice chrome-id="text-field" layer="surface" />
      <input
        :value="modelValue"
        maxlength="20"
        autofocus
        :disabled="disabled"
        :placeholder="t('onboarding.creation.nameStep.placeholder')"
        data-testid="creation-name-input"
        :aria-describedby="'creation-name-desc'"
        @input="onInput"
      />
    </span>
  </label>
</template>

<style scoped>
.creation-name-field {
  display: block;
}

.creation-name-field__label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.creation-name-field__box {
  position: relative;
  display: block;
  isolation: isolate;
}

.creation-name-field__box .ink-nine-slice {
  z-index: 0;
}

.creation-name-field__box input {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  padding: clamp(8px, 1.3vh, 12px) 14px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--hk-text-primary, #ede6d6);
  font: 600 var(--text-md, 15px) var(--hk-font-display, var(--font-display));
  text-align: center;
  outline: none;
}

.creation-name-field__box input::placeholder {
  color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 42%, transparent);
}

.creation-name-field__box input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-gold, #c99a4a) 45%, transparent);
}
</style>
