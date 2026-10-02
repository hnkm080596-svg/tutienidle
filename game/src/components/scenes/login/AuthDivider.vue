<script setup lang="ts">
// Scene 01 divider region (spec: 1048/612/496/24, divider-ornament).
import { useI18n } from 'vue-i18n'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const { t } = useI18n()
const dividerOrnamentUrl = hkChromeUrl('divider-ornament')
</script>

<template>
  <div class="auth-divider" data-hk-region="divider">
    <img v-if="dividerOrnamentUrl" :src="dividerOrnamentUrl" alt="" aria-hidden="true" />
    <span>{{ t('onboarding.auth.divider') }}</span>
  </div>
</template>

<style scoped>
.auth-divider {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 24px;
  color: var(--paper-text-muted, #6b6860);
  font-size: var(--text-xs);
}
.auth-divider img {
  position: absolute;
  inset: 50% 0 auto;
  width: 100%;
  height: 14px;
  transform: translateY(-50%);
  object-fit: fill;
  opacity: 0.9;
  pointer-events: none;
}
.auth-divider span {
  position: relative;
  padding: 0 10px;
  background: var(--paper-50, #f5f0e4);
}
</style>
