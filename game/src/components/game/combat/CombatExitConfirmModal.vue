<script setup lang="ts">
// 6A-T6 (2026-09-01, spec §3) — confirm modal thoát trận, extract từ
// CombatControlBar (L173-182 + confirmExit L47-55): scene exit-zone
// (canvas) emit 'combat_exit_request' → modal này mở; logic confirm
// giữ NGUYÊN (abandonBattle → manual → exitCombatScene →
// combat_scene_exit). Gate: chỉ Stage (Tribulation có flow riêng).
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useGameManager } from '@/composables/useGameState'
import GameButton from '@/components/common/GameButton.vue'

const { t } = useI18n()
const ui = useUiStore()
const gameManager = useGameManager()

const visible = ref(false)

function onExitRequest() {
  // Scene chỉ request; Stage gate giữ tại render (v-if) để Tribulation
  // không bao giờ thấy modal dù event phát nhầm.
  if (ui.combatOrigin === 'stage') {
    visible.value = true
  }
}

function confirmExit() {
  gameManager.abandonBattle()

  ui.battleRunMode = 'manual'
  ui.exitCombatScene()
  gameManager.eventBus.emit('combat_scene_exit', undefined)

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
  <div
    v-if="visible"
    class="combat-exit-confirm__overlay"
    @click.self="visible = false"
  >
    <div class="combat-exit-confirm">
      <p class="combat-exit-confirm__text">{{ t('combat.overlay.exitConfirm.message') }}</p>

      <div class="combat-exit-confirm__actions">
        <GameButton variant="secondary" size="sm" @click="visible = false">{{ t('combat.overlay.exitConfirm.stay') }}</GameButton>
        <GameButton variant="danger" size="sm" @click="confirmExit">{{ t('combat.overlay.exitConfirm.exit') }}</GameButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-exit-confirm__overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--ink-950) 70%, transparent);
}

.combat-exit-confirm {
  box-sizing: border-box;
  padding: 24px 28px;
  background: var(--ink-900);
  border: 1px solid var(--frame-outer);
  border-radius: 10px;
  max-width: min(360px, calc(100vw - 48px));
}

.combat-exit-confirm__text {
  margin: 0 0 18px;
  color: var(--text-primary);
  font-size: var(--text-body);
}

.combat-exit-confirm__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
