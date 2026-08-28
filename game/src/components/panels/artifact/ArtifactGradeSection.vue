<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 3 (doc §12.1): phẩm, bonus, số Đoán Bảo
// Thạch, chi phí, nút Nâng Phẩm.
import { computed } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'

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
    <div class="artifact-grade__row">
      <span class="artifact-grade__label">Phẩm</span>
      <span class="artifact-grade__value">{{ gradeLabel }}</span>
    </div>

    <div class="artifact-grade__row">
      <span class="artifact-grade__label">Hệ số hiệu quả</span>
      <span class="artifact-grade__value">{{ multiplierPercentLabel }}</span>
    </div>

    <div class="artifact-grade__row">
      <span class="artifact-grade__label">Đoán Bảo Thạch</span>
      <span class="artifact-grade__value">{{ formatNumber(stoneAmount) }}</span>
    </div>

    <template v-if="upgradeCost !== undefined">
      <button
        type="button"
        class="artifact-grade__upgrade"
        :disabled="disabled || !canAfford"
        @click="emit('upgrade')"
      >
        Nâng Phẩm lên {{ nextGradeLabel }} ({{ formatNumber(upgradeCost) }} đá)
      </button>

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

.artifact-grade__row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-body);
}

.artifact-grade__label {
  color: var(--text-secondary);
}

.artifact-grade__value {
  color: var(--gold-300);
  font-weight: 600;
}

.artifact-grade__upgrade {
  margin-top: var(--space-2);
  padding: 10px 14px;
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
  background: var(--gold-500);
  color: var(--gold-ink);
  font-weight: 700;
  cursor: pointer;
}

.artifact-grade__upgrade:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: transparent;
  color: var(--text-secondary);
}

.artifact-grade__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
