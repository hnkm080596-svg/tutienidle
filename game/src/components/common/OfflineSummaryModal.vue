<script setup lang="ts">
// Beta Phase 4 (mục XIV tài liệu) — thay console.log('Offline:'...) cũ
// trong App.vue's onMounted(). Chỉ hiện Thời gian + Tu vi — hệ thống
// offline hiện tại (core/idle/OfflineProgressSystem.ts) CHỈ tích tu
// vi, không có material/tài nguyên nào khác để hiện thêm (mockup mục
// XIV có "+ Tài nguyên/+ Progress" nhưng đó là ví dụ minh hoạ, không
// phải data thật đang có).
//
// M-UI-OVERHAUL: renders on SysModalBase (system console chrome, focus
// trap, Escape). Scrim-click stays disabled - the player must press
// Continue explicitly (UI-015).
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { useI18n } from 'vue-i18n'
import GameButton from './GameButton.vue'
import StatRow from './primitives/StatRow.vue'
import SysModalBase from './system/SysModalBase.vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

const props = defineProps<{
  elapsedSeconds: number

  cultivation: number
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <!-- Always-open while mounted: GameRoot gates the component itself on
       offlineSummary.data. class + continue-button class are e2e anchors. -->
  <SysModalBase
    :open="true"
    :title="t('combat.offline.title')"
    width="min(420px, 92vw)"
    :layer="OVERLAY_LAYERS.modal"
    :close-on-scrim="false"
    card-class="offline-summary"
    @close="emit('close')"
  >
    <ul class="offline-summary__rows">
      <StatRow :label="t('combat.offline.labels.duration')">{{ formatDuration(props.elapsedSeconds) }}</StatRow>

      <!-- Chỉ Thời gian + Tu vi — core/idle/OfflineProgressSystem.ts
           CHỈ tính cultivationPerSecond * elapsedSeconds, không có
           nguồn thu offline nào khác trong game logic hiện tại. Mở
           rộng OfflineSummaryData (stores/offlineSummary.ts) + thêm
           row tương ứng nếu sau này OfflineProgressSystem có nguồn
           thu mới. -->
      <StatRow :label="t('combat.offline.labels.cultivation')" tone="positive">{{ formatNumber(Math.floor(props.cultivation)) }}</StatRow>
    </ul>

    <GameButton class="offline-summary__continue" variant="system" @click="emit('close')">{{ t('combat.offline.continue') }}</GameButton>
  </SysModalBase>
</template>

<style scoped>
.offline-summary__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: var(--text-body);
  color: var(--sys-text, var(--paper-text, #211f1a));
}

.offline-summary__rows :deep(.stat-row__value) {
  font-weight: 600;
}

.offline-summary__continue {
  margin-top: 14px;
}
</style>
