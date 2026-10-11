<script setup lang="ts">
// Claim CTA (Codex landscape port): gold EquipmentArtButton at the
// bottom of the detail card + the status small, like the preview. The
// ref's "Tiep Tuc Nhiem Vu" deep-link stays RESERVED; the only action
// the surface admits is Nhan Thuong (claim) via questOps.claimQuest.
// Disabled reasons come from the model's claim.disabledReason
// verbatim.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import type { BetaQuestSurfaceModel } from '@/core/betaScopeQuestDomain'

const props = defineProps<{
  row: BetaQuestSurfaceModel
  onClaim: (questId: string) => void
}>()

const { t } = useI18n()

// Model-resolved claimability (mirrors the old panel: claimed ||
// !available disables); the mutation itself is questOps.claimQuest.
// A row without a claim verdict is malformed - render nothing.
const claim = computed(() => props.row.claim ?? null)
const claimed = computed(() => claim.value?.claimed ?? false)
const disabled = computed(() => claimed.value || !claim.value?.available)

const note = computed(() => {
  if (claim.value?.disabledReason === 'missing-turnin-items' && props.row.turnIn) {
    return t('panels.quest.bagShortfall', {
      have: props.row.turnIn.owned,
      need: props.row.turnIn.required,
    })
  }
  if (claim.value?.disabledReason === 'incomplete') {
    return t('panels.quest.scene.reasonIncomplete')
  }
  return null
})
</script>

<template>
  <footer v-if="claim" class="quest-claim">
    <EquipmentArtButton
      gold
      class="quest-claim__button"
      :disabled="disabled"
      @click="!disabled && onClaim(row.id)"
    >
      {{ claimed ? t('panels.quest.actions.claimed') : t('panels.quest.actions.claim') }}
    </EquipmentArtButton>
    <small v-if="note" class="quest-claim__note" role="status">{{ note }}</small>
  </footer>
</template>

<style scoped>
.quest-claim {
  margin-top: auto;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quest-claim__button { align-self: stretch; min-height: 38px; }

.quest-claim__note {
  font-size: 10px;
  color: #d9c69a;
  text-align: center;
}
</style>
