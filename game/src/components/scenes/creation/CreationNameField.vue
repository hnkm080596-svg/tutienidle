<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const model = defineModel<string>({ required: true })
defineProps<{ disabled?: boolean }>()
const { t } = useI18n()
</script>

<template>
  <label class="creation-name-field">
    <span class="creation-name-field__label">{{ t('onboarding.creation.nameStep.label') }}</span>
    <input v-model="model" maxlength="20" :disabled="disabled"
      :placeholder="t('onboarding.creation.nameStep.placeholder')"
      data-testid="creation-name-input" aria-describedby="creation-name-desc" />
  </label>
</template>

<style scoped>
.creation-name-field { display: block; }
.creation-name-field__label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.creation-name-field input { box-sizing: border-box; width: 100%; height: 36px; padding: 6px 12px; border: 1px solid #a99d80; border-radius: 3px; background: linear-gradient(110deg, #faf4e680, #9e98712b); color: #302f25; font: 16px var(--hk-font-display, Georgia, serif); box-shadow: inset 0 0 0 1px #fff9e394; }
.creation-name-field input::placeholder { color: #80745d; opacity: 1; }
.creation-name-field input:focus { outline: 2px solid #557253; outline-offset: 1px; }
</style>
