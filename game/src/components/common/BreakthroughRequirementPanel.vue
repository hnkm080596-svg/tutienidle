<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useTribulation } from '@/composables/useTribulation'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'

// Task 9.1 — panel xác nhận đơn giản: cảnh báo "không thể mặc trang bị
// khi độ kiếp" + 2 nút. Auto-unequip do triggerBreakthrough() lo.
const { t } = useI18n({ useScope: 'local' })
const store = useBreakthroughRequirementStore()
const { triggerBreakthrough } = useTribulation()

function onConfirm() {
  store.close()
  triggerBreakthrough()
}

function onCancel() {
  store.close()
}
</script>

<template>
  <OverlayPanel
    :open="store.isOpen"
    :title="t('tribulation.stillEquipped.title')"
    width="min(420px, 94vw)"
    @close="onCancel"
  >
    <div class="breakthrough-confirm">
      <p class="breakthrough-confirm__warning">{{ t('tribulation.stillEquipped.subtitle') }}</p>

      <div class="breakthrough-confirm__actions">
        <GameButton variant="ghost" size="sm" @click="onCancel">{{ t('tribulation.stillEquipped.cancel') }}</GameButton>
        <GameButton size="sm" @click="onConfirm">{{ t('tribulation.stillEquipped.confirm') }}</GameButton>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.breakthrough-confirm {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breakthrough-confirm__warning {
  margin: 0;
  padding: 8px 12px;
  font-size: var(--text-sm);
  text-align: center;
  color: var(--danger, #c0392b);
  border: 1px dashed currentColor;
  border-radius: var(--radius-sm);
}

.breakthrough-confirm__actions {
  display: flex;
  gap: 10px;
}

.breakthrough-confirm__actions > * {
  flex: 1;
}
</style>
