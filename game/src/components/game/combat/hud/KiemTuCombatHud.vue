<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 + execution policy
// rework (combat-gate-teleport-autocast plan §11.3) — Kiếm Tu KHÔNG sao
// chép dải 5 ô của Pháp Tu. Ngự Kiếm Thuật (slot 0, policy 'attack_speed'
// — đọc cadence từ scheduler thống nhất) đứng riêng, 2 kỹ năng còn lại
// của kit (slot 1/2 — Thái Hư Nhất Kiếm/tuyệt kỹ) nối tiếp thành chuỗi
// "vận kiếm" — mỹ thuật chi tiết (kiếm trận/quỹ đạo thật) để phase thiết
// kế Kiếm Tu sau chốt, ở đây chỉ đảm bảo CONTRACT dữ liệu hiển thị đúng.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useCadenceSmoothing } from '@/composables/useCadenceSmoothing'
import { useGameManager } from '@/composables/useGameState'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

const { loadout, skillFor } = useCombatSkillPresentation()

const primary = computed(() => loadout.value.find(entry => entry.slotIndex === 0))

// Audit P1-4 — smoothing chỉ-presentation cho ô Ngự Kiếm (cadence),
// cùng lớp dùng chung với Mortal HUD.
const gameManager = useGameManager()

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

// Kiếm Tu kit chỉ dùng slot 0 (Ngự Kiếm, hiện riêng)/1/2 — bỏ qua 2 slot
// cuối vốn dành cho Pháp Tu's 5-ô build (kit Kiếm Tu không cấp).
const chainEntries = computed(() => loadout.value.filter(entry => entry.slotIndex !== undefined && entry.slotIndex >= 1 && entry.slotIndex <= 2))
</script>

<template>
  <div class="kiem-tu-combat-hud">
    <CombatSkillSlot
      v-if="primary && primary.skillId"
      class="kiem-tu-combat-hud__basic"
      :skill="skillFor(primary)"
      :remaining="cadenceRemaining"
      :total="primary.cadenceTotal ?? 0"
      :is-masked="cadenceRemaining > 0"
      :is-out-of-range="primary.state === 'out_of_range'"
    />

    <div class="kiem-tu-combat-hud__chain">
      <template v-for="(entry, index) in chainEntries" :key="entry.slotIndex">
        <span v-if="index > 0" class="kiem-tu-combat-hud__link">→</span>

        <CombatSkillSlot
          class="kiem-tu-combat-hud__slot"
          :skill="skillFor(entry)"
          :remaining="entry.cooldownRemaining"
          :total="entry.cooldownTotal"
          :is-masked="entry.state === 'cooldown'"
          :cast-remaining="entry.castRemaining"
          :cast-total="entry.castTotal"
          :is-casting="entry.state === 'casting'"
          :resource-cost="entry.resourceCost"
          :is-insufficient-resource="entry.state === 'blocked_resource'"
          :is-out-of-range="entry.state === 'out_of_range'"
          :is-unreleased="entry.state === 'unreleased'"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.kiem-tu-combat-hud {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.kiem-tu-combat-hud__basic {
  width: 88px;
}

.kiem-tu-combat-hud__chain {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* WS7 — slot chain 56px quá nhỏ; 72px cho khớp ô skill của Pháp Tu. */
.kiem-tu-combat-hud__slot {
  width: 72px;
}

.kiem-tu-combat-hud__link {
  color: var(--chrome-300);
  font-size: var(--text-body);
}
</style>
