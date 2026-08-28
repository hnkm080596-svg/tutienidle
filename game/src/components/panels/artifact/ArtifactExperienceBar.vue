<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 2 (doc §12.1): cảnh giới/tầng, trần theo
// player, EXP hiện tại/yêu cầu, trạng thái chạm trần. 3 trạng thái
// (doc §12.1): đang luyện / đầy chờ chủ nhân / đạt trần content — kết
// hợp toán %/label kiểu TechniquePanel.vue với union trạng thái +
// dòng message kiểu LuyenThePanel.vue.
import { computed } from 'vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { ArtifactExpStatus } from '@/core/artifact/ArtifactProgression'

const props = defineProps<{
  realmLevel: number
  experience: number
  required: number
  status: ArtifactExpStatus
}>()

const percent = computed(() =>
  props.required > 0 ? Math.min(100, (props.experience / props.required) * 100) : 100,
)

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

    <div class="artifact-exp-bar__track">
      <div class="artifact-exp-bar__fill" :style="{ width: `${percent}%` }" />
    </div>

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
  color: var(--text-primary);
  font-size: var(--text-body);
}

.artifact-exp-bar__track {
  height: 8px;
  border-radius: 4px;
  background: var(--ink-950);
  overflow: hidden;
}

.artifact-exp-bar__fill {
  height: 100%;
  background: var(--chrome-300);
  transition: width 0.2s ease;
}

.artifact-exp-bar--content_ceiling .artifact-exp-bar__fill {
  background: var(--jade);
}

.artifact-exp-bar--capped_by_player .artifact-exp-bar__fill {
  background: var(--azure);
}

.artifact-exp-bar__status {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
