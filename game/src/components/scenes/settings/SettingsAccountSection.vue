<script setup lang="ts">
// Scene 16/17 account section (ref's Tài Khoản — remote mode only):
// guest upgrade card + ordered logout. Account/session state stays in
// the panel (the abandon + unsynced dialogs own it); this is the view.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import GuestUpgradeCard from '@/components/onboarding/GuestUpgradeCard.vue'
import SettingsSectionFrame from './SettingsSectionFrame.vue'

defineProps<{
  accountIsGuest: boolean
  pendingUpgradeLoginId: string | undefined
  logoutBusy: boolean
}>()
const showAccountUpgrade = defineModel<boolean>('showUpgrade', { required: true })
const emit = defineEmits<{ logout: []; finalized: [] }>()
const { t } = useI18n()
</script>

<template>
  <SettingsSectionFrame
    class="settings-panel__account"
    :title="t('panels.settings.sections.account')"
    :label="t('panels.settings.sections.accountAria')"
    data-hk-region="account"
  >
    <p class="settings-panel__section-note">
      {{ accountIsGuest ? t('panels.settings.account.guestNote') : t('panels.settings.account.registeredNote') }}
    </p>

    <GuestUpgradeCard
      v-if="accountIsGuest && showAccountUpgrade"
      :pending-login-id="pendingUpgradeLoginId"
      @finalized="showAccountUpgrade = false; emit('finalized')"
    />

    <div class="settings-panel__actions">
      <GameButton
        v-if="accountIsGuest && !showAccountUpgrade"
        variant="secondary"
        data-testid="settings-upgrade-button"
        @click="showAccountUpgrade = true"
      >
        {{ t('panels.settings.actions.upgrade') }}
      </GameButton>

      <GameButton
        variant="danger"
        :disabled="logoutBusy"
        data-testid="settings-logout-button"
        @click="emit('logout')"
      >
        {{ t('panels.settings.actions.logout') }}
      </GameButton>
    </div>
  </SettingsSectionFrame>
</template>

<style scoped>
.settings-panel__section-note {
  margin: 0 0 10px;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}
.settings-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.settings-panel__actions > .game-button {
  width: 100%;
}
</style>
