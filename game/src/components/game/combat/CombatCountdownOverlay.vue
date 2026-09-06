<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'

// Countdown 3 giây trước trận (2026-08-22, giống vạch xuất phát đua xe)
// — BattleSystem.start() đã spawn quái đầu + emitPositions() ngay lập
// tức (CombatScene vẽ quái đứng yên bình thường), chỉ CHẶN combat logic
// (movement/attack) cho tới khi battle.state chuyển 'countdown' →
// 'fighting' (xem BattleSystem.update()'s countdown branch). Hiện cho
// MỌI loại trận (Stage lẫn Tribulation) — khác CombatResultModal.vue
// (chỉ hiện cho Stage vì Tribulation có luồng kết quả riêng), vì đây
// chỉ là hiệu ứng chờ vào trận, không phải kết quả.
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()

// KHÔNG chain qua 1 computed trung gian trả về object Battle (mutate-in-
// place, LUÔN cùng 1 reference) — Vue coi "giá trị không đổi" theo
// Object.is() nên sẽ KHÔNG lan truyền xuống computed phụ thuộc dù field
// bên trong object đã đổi thật (bug thật đã gặp: số đếm đứng yên ở "3").
// Mỗi computed dưới đây tự đọc thẳng gameManager.getBattle() + tự khai
// stateVersion.value làm dependency riêng, trả về PRIMITIVE (boolean/số)
// để Vue so sánh đúng giá trị.
const visible = computed(() => {
  stateVersion.value

  return gameManager.getBattle()?.state === 'countdown'
})

// Fix (2026-09-06) — countdownSecondsRemaining chỉ tồn tại trên trận
// legacy (BattleSystem.ts, giây thật). Trận turn-based (TurnBattleSystem.ts
// — đường DUY NHẤT còn dùng cho Stage) đếm bằng countdownTurnsRemaining,
// đơn vị LƯỢT pacing dài BATTLE_FIXED_STEP_SECONDS = 0.1s (GameManager.ts)
// — thiếu nhánh này khiến overlay đọc field không tồn tại → luôn 0 →
// nhảy thẳng "Xuất Trận!" thay vì đếm 3, 2, 1. Ưu tiên field giây thật
// (legacy) nếu có, quy đổi /10 khi chỉ có field lượt (turn-based).
const countdownSeconds = computed(() => {
  stateVersion.value

  const battle = gameManager.getBattle()

  if (!battle) {
    return 0
  }

  if (battle.countdownSecondsRemaining !== undefined) {
    return battle.countdownSecondsRemaining
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
