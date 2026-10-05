<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import TranPhapPanel from '@/components/panels/TranPhapPanel.vue'
import CompanionPanel from '@/components/panels/CompanionPanel.vue'
import ArtifactPanel from '@/components/panels/ArtifactPanel.vue'
import ChieuMoTab from '@/components/panels/worker-lodge/ChieuMoTab.vue'
import DuyenPhanTab from '@/components/panels/worker-lodge/DuyenPhanTab.vue'
import QuaTangTab from '@/components/panels/worker-lodge/QuaTangTab.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import OfflineSummaryModal from '@/components/common/OfflineSummaryModal.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
import LoreCodexModal from '@/components/panels/LoreCodexModal.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
const { t } = useI18n()
const ui = useUiStore()
const tabs = [
  { id: 'tran_phap', label: 'panels.tranPhap.title' },
  { id: 'companion', label: 'companion.title' },
  { id: 'artifact', label: 'panels.artifact.title' },
  { id: 'chieu_mo', label: 'workerLodge.tabs.chieuMo' },
  { id: 'duyen_phan', label: 'workerLodge.tabs.duyenPhan' },
  { id: 'qua_tang', label: 'workerLodge.tabs.quaTang' },
  { id: 'system', label: 'layout.functionOverlay.titles.settings' },
] as const
type Tab = typeof tabs[number]['id']
const selected = ref<Tab>('tran_phap')
const dialog = ref<'confirm' | 'feedback' | 'lore' | 'offline' | null>(null)
function select(id: Tab) {
  ui.closeHomeOverlays()
  selected.value = id
  dialog.value = null
  // This separate HTML entry intentionally previews release-hidden surfaces.
  if (id === 'tran_phap' || id === 'companion' || id === 'artifact') ui.standalonePanel = id
}
const world = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png')
</script>
<template>
  <main class="secondary-preview" :style="{ backgroundImage: `url('${world}')` }">
    <nav class="secondary-preview__tabs" :style="{ zIndex: OVERLAY_LAYERS.tooltip }">
      <button v-for="tab in tabs" :key="tab.id" :aria-pressed="selected === tab.id" :data-preview-tab="tab.id" @click="select(tab.id)">{{ t(tab.label) }}</button>
    </nav>
    <TranPhapPanel v-if="selected === 'tran_phap'" />
    <CompanionPanel v-else-if="selected === 'companion'" />
    <ArtifactPanel v-else-if="selected === 'artifact'" />
    <OverlayPanel v-else :open="true" :title="t(tabs.find(tab => tab.id === selected)!.label)" width="min(1000px, 92vw)" height="min(680px, 80vh)" @close="select('tran_phap')">
      <ChieuMoTab v-if="selected === 'chieu_mo'" />
      <DuyenPhanTab v-else-if="selected === 'duyen_phan'" />
      <QuaTangTab v-else-if="selected === 'qua_tang'" />
      <div v-else class="secondary-preview__system">
        <button data-preview-dialog="confirm" @click="dialog = 'confirm'">{{ t('panels.common.confirm') }}</button>
        <button data-preview-dialog="offline" @click="dialog = 'offline'">{{ t('combat.offline.title') }}</button>
        <button data-preview-dialog="feedback" @click="dialog = 'feedback'">{{ t('betaFeedback.title') }}</button>
        <button data-preview-dialog="lore" @click="dialog = 'lore'">{{ t('panels.common.close') }}</button>
      </div>
    </OverlayPanel>
    <ConfirmModal :open="dialog === 'confirm'" :title="t('panels.common.confirm')" :message="t('account.abandon.body')" @confirm="dialog = null" @cancel="dialog = null" />
    <OfflineSummaryModal v-if="dialog === 'offline'" :elapsed-seconds="1593" :cultivation="6729" @close="dialog = null" />
    <FeedbackDialog :open="dialog === 'feedback'" @close="dialog = null" />
    <LoreCodexModal :content="dialog === 'lore' ? { title: t('panels.artifact.title'), description: t('account.abandon.body') } : null" @close="dialog = null" />
    <Tooltip />
  </main>
</template>
<style scoped>
.secondary-preview { position: fixed; inset: 0; background-size: cover; background-position: center; }
.secondary-preview__tabs { position: fixed; left: 50%; top: 8px; transform: translateX(-50%); display: flex; gap: 4px; white-space: nowrap; }
.secondary-preview__tabs button { border: 1px solid #b99953; padding: 8px 15px; background: #15221e; color: #eddeb6; font: 15px var(--font-display); cursor: pointer; }
.secondary-preview__tabs button[aria-pressed=true] { background: #e6d3a7; color: #30291d; }
.secondary-preview__system { display: flex; gap: 16px; }
.secondary-preview__system button { padding: 12px 24px; background: #15221e; color: #eddeb6; border: 1px solid #b99953; font: 17px var(--font-display); }
</style>
