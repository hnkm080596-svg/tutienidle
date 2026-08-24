<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 6 — chọn renderer theo
// trạng thái nhân vật. Path MỚI phải đăng ký renderer riêng ở đây;
// không tự rơi về giao diện năm ô của Pháp Tu (mặc định = Phàm Nhân,
// đúng hành vi hiện tại — undefined cultivationPath luôn đi kèm
// realmId === 'mortal', xem Player.ts's ghi chú cultivationPath).
import { computed } from 'vue'
import MortalCombatHud from './MortalCombatHud.vue'
import PhapTuCombatHud from './PhapTuCombatHud.vue'
import KiemTuCombatHud from './KiemTuCombatHud.vue'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()

const renderer = computed(() => {
  stateVersion.value

  switch (player.cultivationPath) {
    case 'phap_tu':
      return PhapTuCombatHud

    case 'kiem_tu':
      return KiemTuCombatHud

    default:
      return MortalCombatHud
  }
})
</script>

<template>
  <div class="combat-build-hud">
    <component :is="renderer" />
  </div>
</template>

<style scoped>
.combat-build-hud {
  pointer-events: auto;
}
</style>
