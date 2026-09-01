<script setup lang="ts">
// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 5/6) - mỗi
// route Kiếm Tu DÙNG 1 active skill duy nhất ở slot 0 (Kiếm Trận tiền
// hóa hoặc Bạt Kiếm Thức), KHÔNG còn chain slot 1/2/4 (bỏ 3-skill kit
// cũ + slot Kiếm Trận riêng đã dỡ). 
//
// 6A-T7 (2026-09-01) — nhận thêm từ CombatControlBar (sẽ xóa T8):
// slider Nhịp Tụ Lực (bat_kiem) + Ult button + auto toggle. Build HUD
// là surface bottom-center duy nhất của route HUD từ 6A.
import { computed, onMounted } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation, batKiemTickSeconds } from '@/composables/useCombatSkillPresentation'
import { useCadenceSmoothing } from '@/composables/useCadenceSmoothing'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import { canUseUltimate } from '@/core/battle/UltimateSystem'
import { getFormationSwordCount } from '@/data/progression/KiemTuNodes'
import GameButton from '@/components/common/GameButton.vue'

const { loadout, skillFor, tuLucState } = useCombatSkillPresentation()
const { stateVersion } = useStateVersion()

const player = usePlayerStoreShim()
const gameManager = useGameManager()

const primary = computed(() => loadout.value.find(entry => entry.slotIndex === 0))

// Bạt Kiếm dùng execution 'channel' - slot 0 không tự hiển tiến độ để
// tách qua buildLoadoutPresentation() nên vẽ riêng progress bar đọc
// tuLucState (CombatEntity.tuLucElapsed/tuLucActive + nhịp UI slider).
const tuLucPercent = computed(() => {
  const state = tuLucState.value

  if (!state || !state.active || state.tickSeconds <= 0) {
    return 0
  }

  return Math.min(100, (state.elapsed / state.tickSeconds) * 100)
})

// Audit P1-4 - smoothing chủ-presentation cho đòn chính (cadence KT),
// cùng lớp dùng chung với Mortal HUD.
const cadenceRemaining = useCadenceSmoothing(
  () => ({
    remaining: primary.value?.cadenceRemaining ?? 0,
    total: primary.value?.cadenceTotal ?? 0,
  }),
  () => {
    const battle = gameManager.getBattle()

    return battle !== null && isBattleInProgress(battle.state)
  },
)

// ==== 6A-T7: Slider Nhịp Tụ Lực (migrate từ ControlBar L135-150) ====
// Cố ý KHÔNG persist giá trị chọn giữa các trận (dev-phase, "đơn
// giản: không nhớ, mặc định 3 mỗi trận") — mount lại mỗi lần vào trận
// (HUD chỉ sống trong CombatSceneOverlay) nên reset về 3 VÀ đồng bộ
// lại override bên BattleSystem (nó không tự reset giữa các trận).
onMounted(() => {
  if (player.kiemTuRoute === 'bat_kiem') {
    batKiemTickSeconds.value = 3

    gameManager.battleSystem.setChannelTickSeconds('bat_kiem_thuat', 3)
  }
})

function onTuLucTickInput(event: Event) {
  const seconds = Number((event.target as HTMLInputElement).value)

  batKiemTickSeconds.value = seconds

  gameManager.battleSystem.setChannelTickSeconds('bat_kiem_thuat', seconds)
}

// ==== 6A-T7: Ult Kiếm Tu (migrate từ ControlBar L60-121, spec 2026-08-29 mục 2/3.4/6) ====
const ultAutoEnabled = computed({
  get: () => gameManager.battleSystem.ultAutoEnabled,
  set: (value: boolean) => {
    gameManager.battleSystem.ultAutoEnabled = value
  },
})

const ultInfo = computed(() => {
  stateVersion.value

  if (player.cultivationPath !== 'kiem_tu') {
    return null
  }

  const route = player.kiemTuRoute
  if (!route) {
    return null
  }

  const ultSkillId = route === 'kiem_tran' ? 'tru_tien_kiem_tran' : 'kiem_khai_thien_mon'
  const learned = gameManager.skillManager.get(ultSkillId)?.unlocked ?? false

  if (!learned) {
    return null
  }

  return {
    skillId: ultSkillId,
    name: route === 'kiem_tran' ? 'Tru Tiên Kiếm Trận' : 'Kiếm Khai Thiên Môn',
  }
})

const canFireUlt = computed(() => {
  stateVersion.value

  const battle = gameManager.getBattle()
  if (!battle || !ultInfo.value) {
    return false
  }

  const route = player.kiemTuRoute!
  return canUseUltimate(battle, route, getSwordCountForBattle()).ok
})

function fireUltimate() {
  gameManager.battleSystem.tryPlayerUltimate()
}

function getSwordCountForBattle(): number {
  const entries = gameManager.skillManager.getLoadoutEntries()
  let highest = 2
  for (const entry of entries) {
    const count = getFormationSwordCount(entry.skill.id)
    if (count !== undefined && count > highest) {
      highest = count
    }
  }
  return highest
}

// usePlayerStore import giữ dưới cùng để tránh circular doc-block.
import { usePlayerStore } from '@/stores/player'

function usePlayerStoreShim() {
  return usePlayerStore()
}
</script>

<template>
  <div class="kiem-tu-combat-hud">
    <div class="kiem-tu-combat-hud__row">
      <CombatSkillSlot
        v-if="primary && primary.skillId"
        class="kiem-tu-combat-hud__basic"
        :skill="skillFor(primary)"
        :remaining="cadenceRemaining"
        :total="primary.cadenceTotal ?? 0"
        :is-masked="cadenceRemaining > 0"
        :is-out-of-range="primary.state === 'out_of_range'"
      />

      <!-- 6A-T7: slider Nhịp Tụ Lực (từ ControlBar) — chỉ route bat_kiem. -->
      <div v-if="player.kiemTuRoute === 'bat_kiem'" class="kiem-tu-combat-hud__tu-luc-config">
        <label class="kiem-tu-combat-hud__tu-luc-label" for="tu-luc-tick-slider">
          Nhịp Tụ Lực: {{ batKiemTickSeconds }}s
        </label>

        <input
          id="tu-luc-tick-slider"
          type="range"
          min="3"
          max="9"
          step="1"
          :value="batKiemTickSeconds"
          @input="onTuLucTickInput"
        />
      </div>

      <!-- 6A-T7: Ult Kiếm Tu (từ ControlBar) — manual + auto toggle. -->
      <GameButton
        v-if="ultInfo"
        class="kiem-tu-combat-hud__ult"
        variant="danger"
        size="sm"
        :disabled="!canFireUlt"
        @click="fireUltimate"
      >
        ⚔ {{ ultInfo.name }}
      </GameButton>

      <label v-if="ultInfo" class="kiem-tu-combat-hud__ult-auto">
        <input v-model="ultAutoEnabled" type="checkbox" />
        Tự động
      </label>
    </div>

    <div v-if="tuLucState" class="kiem-tu-combat-hud__tu-luc">
      <div class="kiem-tu-combat-hud__tu-luc-fill" :style="{ width: `${tuLucPercent}%` }" />
      <span class="kiem-tu-combat-hud__tu-luc-label">Tụ Lực {{ tuLucState.elapsed.toFixed(1) }}/{{ tuLucState.tickSeconds }}s</span>
    </div>
  </div>
</template>

<style scoped>
.kiem-tu-combat-hud {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kiem-tu-combat-hud__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.kiem-tu-combat-hud__basic {
  width: 88px;
}

/* 6A-T7 — slider + ult từ ControlBar, style chuyển namespace. */
.kiem-tu-combat-hud__tu-luc-config {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kiem-tu-combat-hud__tu-luc-label {
  font-size: var(--text-body);
  color: var(--chrome-300);
  white-space: nowrap;
}

.kiem-tu-combat-hud__tu-luc-config input[type='range'] {
  width: 90px;
}

.kiem-tu-combat-hud__ult {
  padding: 6px 12px;
}

.kiem-tu-combat-hud__ult-auto {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-body);
  color: var(--chrome-300);
  cursor: pointer;
}

.kiem-tu-combat-hud__tu-luc {
  position: relative;
  width: 100%;
  height: 14px;
  overflow: hidden;
  background: var(--ink-950);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.kiem-tu-combat-hud__tu-luc-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--jade), var(--gold-500));
  transition: width 0.1s linear;
}

.kiem-tu-combat-hud__tu-luc-label {
  position: relative;
  z-index: 1;
  display: grid;
  height: 100%;
  place-items: center;
  font-size: 9px;
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}
</style>
