<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 4 (doc §12.1): 3 card Công/Thủ/Khống, bậc
// milestone 1/3/6/12/18, active state + nút chọn/đổi. Visual kiểu
// ElementPathList.vue (button-card, class is-selected/CSS var màu),
// nhưng LỰA CHỌN NÀY reversible-outside-combat (doc §7.1) nên KHÔNG
// dùng window.confirm như QuanKhiPanel.vue's lựa chọn vĩnh viễn.
import type { ArtifactPath, ArtifactPathDefinition } from '@/core/artifact/Artifact'

const PATH_COLOR_VAR: Record<ArtifactPath, string> = {
  attack: 'var(--crimson)',
  defense: 'var(--azure)',
  control: 'var(--jade)',
}

defineProps<{
  paths: ArtifactPathDefinition[]
  selectedPath?: ArtifactPath
  artifactLevel: number
  canChange: boolean
}>()

const emit = defineEmits<{ select: [path: ArtifactPath] }>()
</script>

<template>
  <div class="artifact-path-cards">
    <button
      v-for="pathDef in paths"
      :key="pathDef.path"
      type="button"
      class="artifact-path-cards__card"
      :class="{ 'is-selected': pathDef.path === selectedPath }"
      :style="{ '--path-color': PATH_COLOR_VAR[pathDef.path] }"
      :disabled="!canChange && pathDef.path !== selectedPath"
      @click="emit('select', pathDef.path)"
    >
      <span class="artifact-path-cards__name">{{ pathDef.name }}</span>

      <ul class="artifact-path-cards__milestones">
        <li
          v-for="milestone in pathDef.milestones"
          :key="milestone.level"
          :class="{ 'is-unlocked': artifactLevel >= milestone.level }"
          v-tooltip="{ title: `${milestone.name} (tầng ${milestone.level})`, description: milestone.description }"
        >
          <span class="artifact-path-cards__milestone-level">{{ milestone.level }}</span>
          <span class="artifact-path-cards__milestone-name">{{ milestone.name }}</span>
        </li>
      </ul>
    </button>

    <p v-if="!canChange" class="artifact-path-cards__warning">
      Không thể đổi hướng trong combat — sẽ áp dụng từ trận kế.
    </p>
  </div>
</template>

<style scoped>
.artifact-path-cards {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.artifact-path-cards__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  background: var(--ink-800);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-family: var(--font-body);
}

.artifact-path-cards__card:not(:disabled):hover {
  border-color: var(--path-color);
}

.artifact-path-cards__card.is-selected {
  border-color: var(--path-color);
  background: color-mix(in srgb, var(--path-color) 16%, var(--ink-800));
  box-shadow: 0 0 10px -3px var(--path-color);
}

.artifact-path-cards__card:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.artifact-path-cards__name {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--path-color);
}

.artifact-path-cards__milestones {
  display: flex;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.artifact-path-cards__milestones li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 2px;
  border-radius: 3px;
  background: var(--ink-950);
  opacity: 0.4;
}

.artifact-path-cards__milestones li.is-unlocked {
  opacity: 1;
  background: color-mix(in srgb, var(--path-color) 22%, var(--ink-950));
}

.artifact-path-cards__milestone-level {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--path-color);
}

.artifact-path-cards__milestone-name {
  font-size: 9px;
  text-align: center;
  color: var(--text-secondary);
  line-height: 1.2;
}

.artifact-path-cards__warning {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--gold-500);
}
</style>
