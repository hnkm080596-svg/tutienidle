<script setup lang="ts">
// Scene 01 mode-tabs region (spec: 1048/300/496/44, navigation family,
// tab-seal chrome). Ref: swallowtail banner pair - active jade, inactive
// dark. role=tablist + aria-selected + arrow-key navigation (UI-003).
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

const mode = defineModel<'login' | 'register'>({ required: true })
const { t } = useI18n()

function switchTab(target: 'login' | 'register') {
  mode.value = target
  document.getElementById(`auth-tab-${target}`)?.focus()
}
</script>

<template>
  <div class="auth-tabs" role="tablist" :aria-label="t('onboarding.auth.eyebrow')" data-hk-region="mode-tabs">
    <button
      id="auth-tab-login"
      role="tab"
      type="button"
      class="auth-tabs__tab"
      :aria-selected="mode === 'login'"
      :tabindex="mode === 'login' ? 0 : -1"
      :class="{ active: mode === 'login' }"
      @click="mode = 'login'"
      @keydown.right.prevent="switchTab('register')"
    >
      <InkNineSlice chrome-id="tab-seal" layer="surface" :tint-var="mode === 'login' ? '--hk-jade' : undefined" />
      <span class="auth-tabs__label">{{ t('onboarding.auth.tabs.login') }}</span>
    </button>
    <button
      id="auth-tab-register"
      role="tab"
      type="button"
      class="auth-tabs__tab"
      :aria-selected="mode === 'register'"
      :tabindex="mode === 'register' ? 0 : -1"
      :class="{ active: mode === 'register' }"
      @click="mode = 'register'"
      @keydown.left.prevent="switchTab('login')"
    >
      <InkNineSlice chrome-id="tab-seal" layer="surface" :tint-var="mode === 'register' ? '--hk-jade' : undefined" />
      <span class="auth-tabs__label">{{ t('onboarding.auth.tabs.register') }}</span>
    </button>
  </div>
</template>

<style scoped>
.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  /* spec region h 44 design px (44/941) */
  min-height: 4.68vh;
}
.auth-tabs__tab {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  /* spec tab h 44 design px (44/941) */
  min-height: 4.68vh;
  border: 0;
  padding: 8px 10px;
  background: transparent;
  color: var(--paper-text-muted, #6b6860);
  font-family: var(--hk-font-ui, inherit);
  font-weight: 700;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: color var(--hk-motion-micro, 150ms) var(--hk-ease-standard, ease);
}
.auth-tabs__tab.active {
  color: var(--hk-ivory, #ede6d6);
}
.auth-tabs__tab:not(.active):hover {
  color: var(--paper-text, #211f1a);
}
.auth-tabs__tab:focus-visible {
  outline: 2px solid var(--hk-gold-muted, #7a6234);
  outline-offset: 2px;
}
.auth-tabs__label {
  position: relative;
  z-index: 3;
}
</style>
