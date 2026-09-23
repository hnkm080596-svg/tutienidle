<script setup lang="ts">
// Home Hub Phase 2 — bản modal PERSISTENT-CLICK của Tooltip.vue (vốn
// chỉ hiện khi hover, biến mất ngay khi rời chuột) — dùng cho Tàng
// Kinh Các's Lore tab (Phase 7): người chơi bấm vào 1 lore item, đọc
// trọn mô tả, tự đóng khi bấm ra ngoài/nút đóng, KHÔNG tự ẩn theo
// chuột như Tooltip. Style nhất quán NavMenuOverlay.vue.
// M-UI-OVERHAUL: renders on SysModalBase (system console + focus trap +
// scrim-click/Escape close).
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import SysModalBase from '@/components/common/system/SysModalBase.vue'

const props = defineProps<{
  content: { title: string; description: string } | null
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <SysModalBase
    :open="props.content !== null"
    :title="props.content?.title ?? ''"
    width="min(480px, 92vw)"
    :layer="OVERLAY_LAYERS.modal"
    card-class="lore-modal"
    @close="emit('close')"
  >
    <p class="lore-modal__description">{{ props.content?.description }}</p>

    <GameButton class="lore-modal__close" variant="system" size="sm" @click="emit('close')">{{ t('panels.common.close') }}</GameButton>
  </SysModalBase>
</template>

<style scoped>
.lore-modal__description {
  margin: 0 0 20px;
  color: var(--sys-text, var(--text-primary));
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: 1.5;
  white-space: pre-line;
}

.lore-modal__close {
  display: block;
  margin: 0 auto;
  padding: 6px 24px;
}
</style>
