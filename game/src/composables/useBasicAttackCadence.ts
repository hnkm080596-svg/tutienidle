import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useCombatSkillPresentation } from './useCombatSkillPresentation'

// electron-combat-timing-smoothing-plan.md mục 8 — làm HUD nhịp đánh
// (Trảm) mượt mà KHÔNG đổi gameplay: `basicAttack` (useCombatSkillPresentation)
// vẫn là snapshot AUTHORITATIVE, chỉ đọc lại mỗi khi stateVersion đổi
// (~100ms/lần, xem SpeedSettings.ts). rAF ở đây CHỈ nội suy giá trị HIỂN
// THỊ giữa 2 snapshot — không mutate Battle/Skill/Pinia, không phát
// lệnh cast/trừ mana/đặt cooldown, dừng khi component unmount, đóng
// băng khi isAdvancing === false.
export function useBasicAttackCadence() {
  const { basicAttack, basicAttackSkill } = useCombatSkillPresentation()

  const displayRemaining = ref(0)

  // Anchor — giá trị/mốc thời gian THẬT của snapshot gần nhất, KHÔNG
  // phải reactive state (không cần Vue theo dõi, chỉ rAF đọc/ghi).
  let anchorRemaining = 0
  let anchorTimestamp = 0
  let rafHandle: number | undefined

  function resync() {
    anchorRemaining = basicAttack.value?.cadenceRemaining ?? 0
    anchorTimestamp = performance.now()
    displayRemaining.value = anchorRemaining
  }

  // Snapshot mới (mỗi lần stateVersion đổi) LUÔN thay thế anchor —
  // đây chính là "hiệu chỉnh về runtime thật" bắt buộc theo plan, tránh
  // rAF tự trôi dạt tích luỹ sai số qua nhiều chu kỳ.
  watch(basicAttack, resync, { immediate: true })

  function frame() {
    const snapshot = basicAttack.value

    if (snapshot?.isAdvancing) {
      const elapsedSeconds = (performance.now() - anchorTimestamp) / 1000

      displayRemaining.value = Math.max(0, anchorRemaining - elapsedSeconds)
    } else {
      // Pause/countdown/stun/freeze/không còn quái sống — đóng băng ở
      // giá trị anchor hiện tại, KHÔNG tự đếm tiếp.
      displayRemaining.value = anchorRemaining
    }

    rafHandle = requestAnimationFrame(frame)
  }

  onMounted(() => {
    rafHandle = requestAnimationFrame(frame)
  })

  onUnmounted(() => {
    if (rafHandle !== undefined) {
      cancelAnimationFrame(rafHandle)
    }
  })

  return { basicAttack, basicAttackSkill, displayRemaining }
}
