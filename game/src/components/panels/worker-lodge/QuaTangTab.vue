<script setup lang="ts">
// Qua Tang tab (M-F-COMPANION-GIFT) - the mail/gift surface inside
// WorkerLodgePanel: pending companionGifts records claim through the
// ops transaction; claimed records render as history. Presentation
// only - claimCompanionGift re-validates every gate on commit, and its
// kind:'loot' push is the SINGLE success-notification owner (this tab
// only warns on failure, never toasts on success).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useNotificationStore } from '@/stores/notification'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'
import { COMPANIONS } from '@/data/companion/Companions'
import type { ClaimCompanionGiftResult } from '@/core/game/GameManagerCompanionOps'

const { t } = useI18n()

const player = usePlayerStore()

const gameManager = useGameManager()

const { stateVersion, bumpState } = useStateVersion()

interface GiftRow {
  id: string
  name: string
  claimed: boolean
}

// PlayerData fields are Pinia-reactive via the player store - the ops
// layer mutates player.$state in place. Definition names resolve from
// the authored catalog; an unresolvable id falls back to the raw id so
// the record stays inspectable (the ops rejects its claim as
// 'unknown_gift' regardless).
const gifts = computed<GiftRow[]>(() => {
  stateVersion.value

  return player.companionGifts.map((record) => ({
    id: record.id,
    name: COMPANIONS.find((definition) => definition.id === record.definitionId)?.name ?? record.definitionId,
    claimed: record.claimed,
  }))
})

const pending = computed(() => gifts.value.filter((gift) => !gift.claimed))

const claimed = computed(() => gifts.value.filter((gift) => gift.claimed))

function claimErrorMessage(reason: Extract<ClaimCompanionGiftResult, { ok: false }>['reason']): string {
  switch (reason) {
    case 'unknown_gift':
      return t('quaTang.errors.unknownGift')
    case 'realm_locked':
      return t('quaTang.errors.realmLocked')
    case 'no_active_player':
      return t('quaTang.errors.noActivePlayer')
  }
}

function onClaim(giftId: string) {
  const result = gameManager.companionOps.claimCompanionGift(giftId)

  if (!result.ok) {
    useNotificationStore().push('warning', claimErrorMessage(result.reason))

    return
  }

  bumpState()
}
</script>

<template>
  <section class="qua-tang">
    <p class="qua-tang__hint">{{ t('quaTang.hint') }}</p>

    <div v-for="gift in pending" :key="gift.id" class="qua-tang__row">
      <span class="qua-tang__name">{{ gift.name }}</span>
      <GameButton class="qua-tang__claim" size="sm" @click="onClaim(gift.id)">
        {{ t('quaTang.claim') }}
      </GameButton>
    </div>

    <div v-if="claimed.length > 0" class="qua-tang__history">
      <h4 class="qua-tang__history-title">{{ t('quaTang.claimed') }}</h4>
      <div v-for="gift in claimed" :key="gift.id" class="qua-tang__claimed">
        <span class="qua-tang__name">{{ gift.name }}</span>
        <span class="qua-tang__badge">{{ t('quaTang.claimedBadge') }}</span>
      </div>
    </div>

    <p v-if="gifts.length === 0" class="qua-tang__empty">{{ t('quaTang.empty') }}</p>
  </section>
</template>

<style scoped>
.qua-tang {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qua-tang__hint {
  margin: 0;
  color: var(--paper-text-muted);
  font-size: var(--text-sm);
}

.qua-tang__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--jade) 40%, var(--paper-line));
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--jade) 10%, var(--paper-50));
}

.qua-tang__name {
  font-weight: 700;
  font-size: var(--text-sm);
}

.qua-tang__history {
  display: grid;
  gap: 6px;
}

.qua-tang__history-title {
  margin: 0;
  font: 700 var(--text-sm) var(--font-display);
  color: var(--paper-text-soft);
}

.qua-tang__claimed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--paper-100) 70%, transparent);
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.qua-tang__badge {
  color: var(--jade);
  font-size: var(--text-xs);
}

.qua-tang__empty {
  margin: 0;
  color: var(--paper-text-muted);
  font-size: var(--text-sm);
}
</style>
