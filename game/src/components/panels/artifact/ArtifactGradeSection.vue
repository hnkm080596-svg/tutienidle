<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 3 (doc §12.1): phẩm, bonus, số Đoán Bảo
// Thạch, chi phí, nút Nâng Phẩm.
import { computed } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import GameButton from '@/components/common/GameButton.vue'
import StatRow from '@/components/common/primitives/StatRow.vue'

const props = defineProps<{
  gradeLabel: string
  multiplierPercentLabel: string
  stoneAmount: number
  upgradeCost?: number
  nextGradeLabel?: string
  disabled: boolean
}>()

const emit = defineEmits<{ upgrade: [] }>()

const canAfford = computed(() =>
  props.upgradeCost !== undefined && props.stoneAmount >= props.upgradeCost,
)
</script>

<template>
  <div class="artifact-grade">
    <StatRow label="Phẩm">{{ gradeLabel }}</StatRow>

    <StatRow label="Hệ số hiệu quả">{{ multiplierPercentLabel }}</StatRow>

    <StatRow label="Đoán Bảo Thạch">{{ formatNumber(stoneAmount) }}</StatRow>

    <template v-if="upgradeCost !== undefined">
      <GameButton
        class="artifact-grade__upgrade"
        size="sm"
        :disabled="disabled || !canAfford"
        @click="emit('upgrade')"
      >
        Nâng Phẩm lên {{ nextGradeLabel }} ({{ formatNumber(upgradeCost) }} đá)
      </GameButton>

      <p v-if="disabled" class="artifact-grade__hint">Chỉ nâng phẩm được ngoài combat.</p>
    </template>

    <p v-else class="artifact-grade__hint">Đã đạt phẩm cao nhất.</p>
  </div>
</template>

<style scoped>
.artifact-grade {
  padding: var(--space-3);
  border-bottom: 1px solid var(--ink-line);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.artifact-grade ul {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-body);
}

.artifact-grade .stat-row__value {
  color: var(--chrome-100);
  font-weight: 600;
}

.artifact-grade__upgrade {
  margin-top: var(--space-2);
  padding: 10px 14px;
  border: 1px solid var(--chrome-500);
}

.artifact-grade__upgrade:disabled {
  opacity: 0.4;
  background: transparent;
  color: var(--text-secondary);
}

.artifact-grade__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
