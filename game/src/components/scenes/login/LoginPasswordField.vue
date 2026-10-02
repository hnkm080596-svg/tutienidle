<script setup lang="ts">
// Scene 01 password field - same icon-field grammar as the id field.
// Leading glyph = delivered `lock` stable symbol. The ref's eye-toggle
// is an audit RESERVED detail: intentionally not scaffolded.
import { useI18n } from 'vue-i18n'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

const password = defineModel<string>({ required: true })
const { t } = useI18n()
</script>

<template>
  <label class="auth-field-row" for="auth-input-password">
    <span class="sr-only">{{ t('onboarding.auth.labels.password') }}</span>
    <span class="auth-field">
      <InkNineSlice chrome-id="text-field" layer="surface" />
      <HuyenKimSymbol name="lock" class="auth-field__icon" />
      <input
        id="auth-input-password"
        v-model="password"
        autocomplete="current-password"
        type="password"
        :placeholder="t('onboarding.auth.placeholders.password')"
      />
    </span>
  </label>
</template>

<style scoped>
.auth-field-row {
  display: grid;
  gap: 4px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.auth-field {
  position: relative;
  display: block;
  isolation: isolate;
}
.auth-field .ink-nine-slice {
  z-index: 0;
}
.auth-field__icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  color: var(--hk-text-secondary, #b8ae97);
  font-size: var(--text-sm);
  pointer-events: none;
}
.auth-field input {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  border: 0;
  border-radius: 2px;
  padding: 12px 16px 12px 40px;
  outline: none;
  background: transparent;
  color: var(--hk-text-primary, #ede6d6);
}
.auth-field input::placeholder {
  color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 42%, transparent);
}
.auth-field input:focus {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-gold, #c99a4a) 45%, transparent);
}
</style>
