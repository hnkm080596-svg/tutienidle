<script setup lang="ts">
// Slice 7 (2026-09-04) — 3 nút cố định basic/special/ultimate cho
// turn-based manual cast. Entry thứ tự [basic, special, ultimate] từ
// buildTurnSkillPresentation (slotList). Slot không sẵn sàng bị DISABLE
// (chặn trước, spec Slice 7 §4). Targeting vẫn hoàn toàn tự động.
//
// Bảng 9.5 #5 (2026-09-07) — tên/tooltip skill thật: entry mang
// skillName/skillDescription từ TurnSkillDisplayMeta (mapping skillId →
// display metadata); fallback nhãn role (Thường/Đặc Biệt/Tuyệt Kỹ) khi
// id không có trong map. Tooltip qua tooltipOverride của CombatSkillSlot.
import { computed, onMounted } from 'vue'
import CombatSkillSlot from './CombatSkillSlot.vue'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import { useGameManager } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import type { TurnSkillSlotRole } from '@/core/battle/turn/TurnSkillAction'
import type { TooltipContent } from '@/composables/useTooltip'

const ROLE_ORDER: readonly TurnSkillSlotRole[] = ['basic', 'special', 'ultimate']

const ROLE_LABELS: Record<TurnSkillSlotRole, string> = {
  basic: 'Thường',
  special: 'Đặc Biệt',
  ultimate: 'Tuyệt Kỹ',
}

// Bảng 9.5 #5 — nhãn hiển thị do CombatSkillSlot tự resolve qua
// displayLabel prop (skillName → fallback emptyLabel). Bar chỉ truyền
// metadata; tooltip qua tooltipFor() bên dưới.
function tooltipFor(entry: TurnSkillPresentationEntry): TooltipContent | undefined {
  if (!entry.skillName || !entry.skillDescription) {
    return undefined
  }

  return { title: entry.skillName, description: entry.skillDescription }
}

// Slice 7 master plan Task 9 — mode toggle đọc/ghi ui.combatInputMode
// (persist per-device), đồng bộ GameManager flag (plain class, không
// import Pinia — UI layer gọi setter, cùng pattern battleRunMode).
const ui = useUiStore()
const gameManager = useGameManager()
const { isAwaitingChoice, isBattleFighting, slotList, chooseSlot } = useTurnCombatManual()

const isManualMode = computed(() => ui.combatInputMode === 'manual')

function setManualMode(enabled: boolean): void {
  ui.setCombatInputMode(enabled ? 'manual' : 'auto')

  gameManager.setBattleManualMode(enabled)
}

// Sync persisted mode → GameManager khi bar mount lần đầu (reload page:
// ui flag persist, GameManager flag mặc định false).
onMounted(() => {
  gameManager.setBattleManualMode(ui.combatInputMode === 'manual')
})

const visible = computed(() => isBattleFighting.value)

const SLOT_EMPTY: TurnSkillPresentationEntry = {
  skillId: '',
  cooldownRemaining: 0,
  cooldownTotal: 0,
  resourceCost: 0,
  state: 'empty',
}

function entryAt(index: number): TurnSkillPresentationEntry {
  return slotList.value[index] ?? SLOT_EMPTY
}

function isTappable(entry: TurnSkillPresentationEntry): boolean {
  return entry.state === 'ready' && isAwaitingChoice.value
}

function tapSlot(role: TurnSkillSlotRole): void {
  chooseSlot(role)
}
</script>

<template>
  <div v-if="visible" class="turn-combat-skill-bar">
    <div class="turn-combat-skill-bar__slots">
      <button
        v-for="(role, index) in ROLE_ORDER"
        :key="role"
        type="button"
        class="turn-combat-skill-bar__slot-button"
        :class="{ 'is-tappable': isTappable(entryAt(index)) }"
        :disabled="!isTappable(entryAt(index))"
        :aria-label="`Dùng ${ROLE_LABELS[role]}`"
        @click="tapSlot(role)"
      >
        <CombatSkillSlot
          :empty-label="ROLE_LABELS[role]"
          :display-label="entryAt(index).skillName"
          :remaining="entryAt(index).cooldownRemaining"
          :total="entryAt(index).cooldownTotal"
          :is-masked="entryAt(index).state === 'cooldown'"
          :resource-cost="entryAt(index).resourceCost"
          :is-insufficient-resource="entryAt(index).state === 'blocked_resource'"
          :tooltip-override="tooltipFor(entryAt(index))"
        />
      </button>
    </div>

    <label class="turn-combat-skill-bar__mode-toggle">
      <input
        type="checkbox"
        :checked="isManualMode"
        @change="setManualMode(($event.target as HTMLInputElement).checked)"
      />
      <span>Thủ công</span>
    </label>

    <span v-if="isAwaitingChoice" class="turn-combat-skill-bar__awaiting">Đến lượt bạn — chọn kỹ năng</span>
  </div>
</template>

<style scoped>
.turn-combat-skill-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.turn-combat-skill-bar__slots {
  display: flex;
  gap: 8px;
}

.turn-combat-skill-bar__slot-button {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.turn-combat-skill-bar__slot-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.turn-combat-skill-bar__slot-button.is-tappable {
  outline: 2px solid var(--jade, #4caf50);
  outline-offset: 2px;
}

.turn-combat-skill-bar__mode-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs, 12px);
  color: var(--text-muted, #999);
  cursor: pointer;
}

.turn-combat-skill-bar__awaiting {
  font-size: var(--text-xs, 12px);
  color: var(--jade, #4caf50);
}
</style>
