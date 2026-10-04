<script setup lang="ts">
// Scene 15/16 actions region (spec: 526/690/620/80, button family).
// Audit EXACT: retry (danger, repeat-mode 3s countdown) + return home
// (secondary, 10s fallback countdown).
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { formatDuration } from '@/core/format/formatDuration'

defineProps<{
  isAutoRetrying: boolean
  retryCountdown: number
  returnCountdown: number
}>()
const emit = defineEmits<{ retry: []; returnHome: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="combat-defeat-panel__actions" data-hk-region="actions">
    <GameButton
      class="combat-defeat-panel__retry"
      variant="danger"
      :class="{ 'is-disabled': isAutoRetrying }"
      :disabled="isAutoRetrying"
      @click="emit('retry')"
    >
      {{ t('combat.defeat.retry') }}<template v-if="isAutoRetrying"> {{ t('combat.defeat.retryCountdown', { duration: formatDuration(retryCountdown, 'countdown') }) }}</template>
    </GameButton>

    <GameButton class="combat-defeat-panel__return" variant="secondary" @click="emit('returnHome')">
      {{ t('combat.defeat.returnHome') }} {{ t('combat.defeat.returnCountdown', { duration: formatDuration(returnCountdown, 'countdown') }) }}
    </GameButton>
  </div>
</template>

<style scoped>
.combat-defeat-panel__actions { display: flex; gap: 10px; }
.combat-defeat-panel__actions button { flex: 1; padding: 10px; }
.combat-defeat-panel__retry.is-disabled { background: var(--ink-700); color: var(--text-muted); }
.combat-defeat-panel__return:hover { border-color: var(--crimson); color: var(--crimson); }
</style>
