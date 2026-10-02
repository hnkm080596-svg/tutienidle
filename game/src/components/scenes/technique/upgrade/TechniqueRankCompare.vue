<script setup lang="ts">
// Compare header of the upgrade panel: "Phẩm {from} » Phẩm {to}".
// Labels arrive pre-localized (gradeNode key). The ref's stat-compare
// rows have no model source — the model exposes no next-grade stat
// preview, so only the grade jump is rendered (flagged in report).
defineProps<{
  fromLabel: string
  toLabel: string
}>()
</script>

<template>
  <div class="technique-rank-compare">
    <span class="technique-rank-compare__grade technique-rank-compare__grade--from">{{ fromLabel }}</span>
    <span class="technique-rank-compare__arrow" aria-hidden="true">»</span>
    <span class="technique-rank-compare__grade technique-rank-compare__grade--to">{{ toLabel }}</span>
  </div>
</template>

<style scoped>
.technique-rank-compare {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--hk-space-3);
  padding: var(--hk-space-2) var(--hk-space-3);
  background: rgba(185, 154, 85, 0.08);
  border: 1px solid var(--hk-border-muted);
  border-radius: var(--hk-radius-sm);
}

.technique-rank-compare__grade {
  font-family: var(--font-display);
  font-size: var(--text-body);
  color: var(--hk-text-primary);
}

.technique-rank-compare__grade--to {
  color: var(--hk-jade-soft);
  font-weight: 700;
}

.technique-rank-compare__arrow {
  color: var(--hk-gold);
  font-size: var(--text-title);
  line-height: 1;
}
</style>
