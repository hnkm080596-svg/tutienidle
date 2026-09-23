<script setup lang="ts">
// 6A-T6 (2026-09-01, spec §3) — confirm modal thoát trận, extract từ
// CombatControlBar (L173-182 + confirmExit L47-55): scene exit-zone
// (canvas) emit 'combat_exit_request' → modal này mở; logic confirm
// giữ NGUYÊN (abandonBattle → manual → combat_scene_exit →
// combat_scene_exit) - now runs inside the closed curtain via
// useBattleActions.exitCombatToHome. Gate: Stage only (Tribulation has
// its own flow).
//
// M-UI-OVERHAUL: renders on SysModalBase. Teleport-to-body replaces the
// old pointer-events:auto workaround - the modal no longer lives inside
// the pointer-events:none combat overlay at all.
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import SysModalBase from '@/components/common/system/SysModalBase.vue'
import GameButton from '@/components/common/GameButton.vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

const { t } = useI18n()
const ui = useUiStore()
const gameManager = useGameManager()
const { exitCombatToHome } = useBattleActions()

const visible = ref(false)

function onExitRequest() {
  // Scene chỉ request; Stage gate giữ tại render (v-if) để Tribulation
  // không bao giờ thấy modal dù event phát nhầm.
  if (ui.combatOrigin === 'stage') {
    visible.value = true
  }
}

function confirmExit() {
  // Abandon + UI teardown run inside the closed curtain (abandonBattle
  // self-guards when the battle already ended on its own mid-close - the
  // exit still stands). The modal itself closes right away as click
  // feedback.
  exitCombatToHome({ abandon: true })

  visible.value = false
}

// Deferred follow-up (2026-09-03) — focus trap dùng chung (QA-003):
// Escape = HỦY thoát (Ở LẠI trận), KHÔNG BAO GIỜ exit qua Escape.
// (M-UI-OVERHAUL: scrim click is also cancel via SysModalBase @close.)
function cancelExit() {
  visible.value = false
}

onMounted(() => {
  gameManager.eventBus.on('combat_exit_request', onExitRequest)
})

onUnmounted(() => {
  gameManager.eventBus.off('combat_exit_request', onExitRequest)
})
</script>

<template>
  <SysModalBase
    :open="visible"
    :title="t('combat.overlay.exitConfirm.message')"
    width="min(360px, calc(100vw - 48px))"
    :layer="OVERLAY_LAYERS.modal"
    role="alertdialog"
    card-class="combat-exit-confirm"
    @close="cancelExit"
  >
    <div class="combat-exit-confirm__actions">
      <GameButton variant="system" size="sm" @click="cancelExit">{{ t('combat.overlay.exitConfirm.stay') }}</GameButton>
      <GameButton variant="system" accent-var="var(--sys-danger)" size="sm" @click="confirmExit">{{ t('combat.overlay.exitConfirm.exit') }}</GameButton>
    </div>
  </SysModalBase>
</template>

<style scoped>
.combat-exit-confirm__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
