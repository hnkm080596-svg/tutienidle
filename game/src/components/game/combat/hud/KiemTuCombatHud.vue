<script setup lang="ts">
// skill-insight-and-auto-combat-hud-plan.md mục 7 — Kiếm Tu KHÔNG sao
// chép dải 5 ô của Pháp Tu. Ngự Kiếm Thuật (basic, chạy theo nhịp đánh)
// đứng riêng, 2 kỹ năng còn lại của kit (slot 1/2 — Thái Hư Nhất Kiếm/
// tuyệt kỹ) nối tiếp thành chuỗi "vận kiếm" — mỹ thuật chi tiết (kiếm
// trận/quỹ đạo thật) để phase thiết kế Kiếm Tu sau chốt, ở đây chỉ đảm
// bảo CONTRACT dữ liệu hiển thị đúng ngay từ đầu.
import { computed } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useCombatSkillPresentation } from '@/composables/useCombatSkillPresentation'
import { useBasicAttackCadence } from '@/composables/useBasicAttackCadence'

const { loadout, skillFor } = useCombatSkillPresentation()
const { basicAttack, basicAttackSkill, displayRemaining } = useBasicAttackCadence()

// Kiếm Tu kit chỉ dùng slot 0 (basic, hiện riêng)/1/2 — bỏ qua 2 slot
// cuối vốn dành cho Pháp Tu's 5-ô build (kit Kiếm Tu không cấp).
const chainEntries = computed(() => loadout.value.filter(entry => entry.slotIndex !== undefined && entry.slotIndex >= 1 && entry.slotIndex <= 2))
</script>

<template>
  <div class="kiem-tu-combat-hud">
    <CombatSkillSlot
      v-if="basicAttack"
      class="kiem-tu-combat-hud__basic"
      :skill="basicAttackSkill"
      :remaining="displayRemaining"
      :total="basicAttack.cadenceTotal"
      :is-masked="displayRemaining > 0"
      :tooltip-override="basicAttackSkill ? {
        title: basicAttackSkill.name,
        description: 'Nhịp đánh — đòn tự động theo tốc độ đánh, không phải hồi chiêu kỹ năng.',
      } : undefined"
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
          :is-insufficient-resource="entry.state === 'insufficient_resource'"
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
  gap: 14px;
}

.kiem-tu-combat-hud__basic {
  width: 88px;
}

.kiem-tu-combat-hud__chain {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* WS7 — slot chain 56px quá nhỏ, bump 68px. */
.kiem-tu-combat-hud__slot {
  width: 68px;
}

.kiem-tu-combat-hud__link {
  color: var(--gold-500);
  font-size: 0.9rem;
}
</style>
