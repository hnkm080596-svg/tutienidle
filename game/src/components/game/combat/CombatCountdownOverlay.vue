<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

// Countdown 3 giay truoc tran (2026-08-22, giong vach xuat phat dua xe)
// - BattleSystem.start() da spawn quai dau + emitPositions() ngay lap
// tuc (CombatScene ve quai dung yen binh thuong), chi CHAN combat logic
// (movement/attack) cho toi khi battle.state chuyen 'countdown' ->
// 'fighting' (xem BattleSystem.update()'s countdown branch). Hien cho
// MOI loai tran (Stage lan Tribulation) - khac CombatResultModal.vue
// (chi hien cho Stage vi Tribulation co luong ket qua rieng), vi day
// chi la hieu ung cho vao tran, khong phai ket qua.
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// KHONG chain qua 1 computed trung gian tra ve object TurnBattle (mutate-in-
// place, LUON cung 1 reference) - Vue coi "gia tri khong doi" theo
// Object.is() nen se KHONG lan truyen xuong computed phu thuoc du field
// ben trong object da doi that (bug that da gap: so dem dung yen o "3").
// Moi computed duoi day tu doc thang gameManager.getTurnBattle() + tu khai
// stateVersion.value lam dependency rieng, tra ve PRIMITIVE (boolean/so)
// de Vue so sanh dung gia tri.
const visible = computed(() => {
  stateVersion.value

  return gameManager.getTurnBattle()?.state === 'countdown'
})

// TurnBattleSystem dem countdown bang countdownTurnsRemaining, don vi
// LUOT pacing dai BATTLE_FIXED_STEP_SECONDS = 0.1s (GameManager.ts) -
// quy doi /10 ra giay hien thi. (M13: nhanh countdownSecondsRemaining
// cua engine real-time da xoa - TurnBattle khong co field do.)
const countdownSeconds = computed(() => {
  stateVersion.value

  const battle = gameManager.getTurnBattle()

  if (!battle) {
    return 0
  }

  return (battle.countdownTurnsRemaining ?? 0) / 10
})

const displayNumber = computed(() => Math.ceil(countdownSeconds.value))

const label = computed(() => (displayNumber.value > 0 ? String(displayNumber.value) : t('combat.overlay.countdown.go')))
</script>

<template>
  <div v-if="visible" class="combat-countdown-overlay">
    <span :key="label" class="combat-countdown-overlay__number">{{ label }}</span>
  </div>
</template>

<style scoped>
.combat-countdown-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.combat-countdown-overlay__number {
  font-family: var(--font-display);
  font-size: var(--text-hero);
  font-weight: 700;
  color: var(--gold-300);
  text-shadow: 0 0 24px color-mix(in srgb, var(--gold-500) 60%, transparent), 0 2px 8px rgba(0, 0, 0, 0.8);
  animation: combat-countdown-pop 0.3s ease-out;
}

@keyframes combat-countdown-pop {
  from {
    transform: scale(1.6);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
