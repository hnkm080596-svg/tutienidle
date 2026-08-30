<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 2 (doc §12.1): cảnh giới/tầng, trần theo
// player, EXP hiện tại/yêu cầu, trạng thái chạm trần. 3 trạng thái
// (doc §12.1): đang luyện / đầy chờ chủ nhân / đạt trần content — kết
// hợp toán %/label kiểu TechniquePanel.vue với union trạng thái +
// dòng message kiểu LuyenThePanel.vue.
import { computed } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import Bar from '@/components/common/primitives/Bar.vue'
import type { ArtifactExpStatus } from '@/core/artifact/ArtifactProgression'

const props = defineProps<{
  realmLevel: number
  experience: number
  required: number
  status: ArtifactExpStatus
}>()

const statusMessage = computed(() => {
  switch (props.status) {
    case 'content_ceiling':
      return 'Đã đạt trần nội dung hiện tại'
    case 'capped_by_player':
      return 'Đầy — chờ chủ nhân đột phá thêm'
    default:
      return undefined
  }
})
</script>

<template>
  <div class="artifact-exp-bar" :class="`artifact-exp-bar--${status}`">
    <div class="artifact-exp-bar__head">
      <span>Trúc Cơ tầng {{ realmLevel }}</span>
      <span v-if="status !== 'content_ceiling'">{{ formatNumber(experience) }} / {{ formatNumber(required) }}</span>
      <span v-else>Viên Mãn</span>
    </div>

    <Bar
      class="artifact-exp-bar__track"
      :value="experience"
      :max="required"
      :height="8"
    />

    <p v-if="statusMessage" class="artifact-exp-bar__status">{{ statusMessage }}</p>
  </div>
</template>

<style scoped>
.artifact-exp-bar {
  padding: var(--space-3);
  border-bottom: 1px solid var(--ink-line);
}

.artifact-exp-bar__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-1);
  color: var(--paper-text);
  font-size: var(--text-body);
}

.artifact-exp-bar__track {
  border-radius: 4px;
  --bar-track: var(--ink-950);
  --bar-from: var(--chrome-300);
  --bar-to: var(--chrome-300);
}

.artifact-exp-bar--content_ceiling .artifact-exp-bar__track {
  --bar-from: var(--jade);
  --bar-to: var(--jade);
}

.artifact-exp-bar--capped_by_player .artifact-exp-bar__track {
  --bar-from: var(--azure);
  --bar-to: var(--azure);
}

.artifact-exp-bar__status {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--paper-text-muted);
}
</style>
