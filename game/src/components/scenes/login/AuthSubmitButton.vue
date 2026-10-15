<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
defineProps<{ mode: 'login' | 'register'; canSubmit: boolean; submitting: boolean }>()
const { t } = useI18n()
</script>

<template>
  <GameButton class="auth-primary-action pc-paper-button pc-paper-button--secondary" type="submit" variant="ghost" size="lg"
    :disabled="!canSubmit" :loading="submitting" data-hk-region="primary-action">
    <span class="auth-primary-action__text">{{ t(`onboarding.auth.tabs.${mode}`) }}</span>
  </GameButton>
</template>

<style scoped>
.auth-primary-action {
  width: 100%;
  margin: 8px 0;
  min-height: 58px;
  padding: 14px 28px;
  overflow: visible;
  color: #f5e6c6;
  font: 600 22px var(--font-display, Georgia, serif);
  text-shadow: none;
  transition: filter 160ms, transform 160ms;
}
.auth-primary-action :deep(.game-button__label) { position: static; }
.auth-primary-action__text { position: relative; z-index: 1; display: block; line-height: 1.2; }
.auth-primary-action:disabled { opacity: .6; }
/* Owner ruling 2026-10-10: art-only swap - the submit wears the in-game
   enhance button's equipment-filter-* pill instead of the paper slice. */
/* #app anchor (1,2,1): pc-paper-production.css re-arms border-image-source on
   :is(#app,body) .game-button--ghost::before at (1,1,1) - class-only overrides
   lose to it regardless of order. */
#app .auth-primary-action.pc-paper-button::before { border: 0; border-image: none; background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / 100% 100% no-repeat; }
#app .auth-primary-action.pc-paper-button::after { content: none; }
/* QA fixpoint 2026-10-10: the ghost variant frames a 1px hairline around
   the pill art (GameButton --ghost border) - zero it at the element. */
#app .auth-primary-action.pc-paper-button { border: 0; }
/* Hover takes the clean gold pill (equipment-filter-selected) - the
   stock hover art bakes a black smoke fill over the label. .game-button
   makes it (1,5,1): strictly above the entry recipe's hover ::before
   filter recipe (1,4,1), and filter:none kills the leftover glow. */
#app .auth-primary-action.pc-paper-button.game-button:not(:disabled):is(:hover, :focus-visible)::before { border-image: none; background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png'); filter: none; }
#app .auth-primary-action.pc-paper-button.game-button:not(:disabled):active::before { border-image: none; background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png'); filter: none; }
/* QA fixpoint 2026-10-10 (round-3): .pc-paper-button makes it (1,5,0) -
   strictly above the entry recipe's (1,4,0) hover color; without it the
   tie broke on bundle order only. */
#app .auth-primary-action.pc-paper-button:not(:disabled):is(:hover, :focus-visible) { color: #30210e; }
.auth-primary-action:focus-visible { outline: 2px solid #715923; outline-offset: 3px; box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .auth-primary-action { transition: none; } }
</style>
