<script setup lang="ts">
// Claim CTA: the audit's corrected verdict - the ref's "Tiep Tuc Nhiem
// Vu" deep-link stays RESERVED; the only action the surface admits is
// Nhan Thuong (claim) via questOps.claimQuest. Disabled reasons come
// from the model's claim.disabledReason verbatim.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  row: BetaQuestSurfaceModel
  onClaim: (questId: string) => void
}>()

const { t } = useI18n()

// Model-resolved claimability (mirrors the old panel: claimed ||
// !available disables); the mutation itself is questOps.claimQuest.
const claimed = computed(() => props.row.claim.claimed)
const disabled = computed(() => claimed.value || !props.row.claim.available)

const note = computed(() => {
  if (props.row.claim.disabledReason === 'missing-turnin-items' && props.row.turnIn) {
    return t('panels.quest.bagShortfall', {
      have: props.row.turnIn.owned,
      need: props.row.turnIn.required,
    })
  }
  if (props.row.claim.disabledReason === 'incomplete') {
    return t('panels.quest.scene.reasonIncomplete')
  }
  return null
})
</script>

<template>
  <footer class="quest-claim">
    <p v-if="note" class="quest-claim__note">{{ note }}</p>
    <GameButton
      size="lg"
      class="quest-claim__button"
      :disabled="disabled"
      @click="!disabled && onClaim(row.id)"
    >
      {{ claimed ? t('panels.quest.actions.claimed') : t('panels.quest.actions.claim') }}
    </GameButton>
  </footer>
</template>

<style scoped>
.quest-claim {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--hk-border-muted, var(--paper-line));
}

.quest-claim__note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--hk-text-muted, #b8ad97);
  text-align: center;
}

.quest-claim__button {
  align-self: stretch;
}
</style>
