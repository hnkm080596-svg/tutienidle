<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from '@/components/common/art/EquipmentArtCard.vue'
import EquipmentPaperdollPreview from './equipment/EquipmentPaperdollPreview.vue'
import EquipmentBagPreview from './equipment/EquipmentBagPreview.vue'
import EquipmentForgePreview from './equipment/EquipmentForgePreview.vue'
import {
  equipmentArt,
  equipmentTabs,
  type EquipmentPreviewSlot,
  type EquipmentPreviewTab,
} from './equipment/equipmentPreviewData'
const { t } = useI18n()
const tab = shallowRef<EquipmentPreviewTab>('equipment')
const selectedSlot = shallowRef<EquipmentPreviewSlot>('weapon')
const notice = shallowRef('')
const style = {
  backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')`,
  '--equipment-tab-brush': `url('${equipmentArt('equipment-tab-brush-v1')}')`,
}
function chooseTab(id: EquipmentPreviewTab) {
  tab.value = id
  notice.value = ''
}
function chooseSlot(id: EquipmentPreviewSlot) {
  selectedSlot.value = id
  notice.value = ''
}
</script>
<template>
  <section class="home-equipment-panel" :style="style" data-testid="home-equipment-panel">
    <header class="equipment-panel-heading">
      <h1>{{ t('eq.title') }}</h1>
      <img :src="equipmentArt('equipment-divider-v1')" alt="" />
    </header>
    <nav class="equipment-panel-tabs" :aria-label="t('eq.title')">
      <button
        v-for="id in equipmentTabs"
        :key="id"
        type="button"
        :class="{ active: tab === id }"
        :aria-pressed="tab === id"
        :data-testid="`equipment-tab-${id}`"
        @click="chooseTab(id)"
      >
        {{ t(`eq.tabs.${id}`)
        }}<img v-if="tab === id" :src="equipmentArt('equipment-divider-v1')" alt="" />
      </button>
    </nav>
    <div class="equipment-panel-content">
      <EquipmentPaperdollPreview :selected="selectedSlot" @select="chooseSlot" />
      <EquipmentArtCard class="equipment-right-workspace" :data-selected-equipment="selectedSlot"
        ><EquipmentBagPreview
          v-if="tab === 'equipment'"
          @notice="notice = $event" /><EquipmentForgePreview
          v-else
          :key="tab"
          :tab="tab"
          @notice="notice = $event"
      /></EquipmentArtCard>
    </div>
    <div v-if="notice" class="equipment-preview-notice" role="status">{{ notice }}</div>
  </section>
</template>
<style scoped>
.home-equipment-panel {
  position: absolute;
  left: 24%;
  top: 12.5%;
  width: 74%;
  height: 75%;
  z-index: 20;
  padding: 16px 20px 18px;
  background-color: #f2e4c8;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  border: 3px double #b28a43;
  color: #302519;
  overflow: hidden;
}
.equipment-panel-heading {
  height: 48px;
  display: flex;
  align-items: center;
  gap: 30px;
  border-bottom: 1px solid #b28a43;
}
.equipment-panel-heading h1 {
  font-size: 38px;
  line-height: 1.15;
  margin: 0;
}
.equipment-panel-heading img {
  height: 23px;
  width: 180px;
  object-fit: contain;
  opacity: 0.65;
}
.equipment-panel-tabs {
  display: flex;
  align-items: center;
  height: 42px;
  gap: 12px;
  width: 620px;
}
.equipment-panel-tabs > button {
  position: relative;
  flex: 1;
  min-height: 33px;
  padding: 3px 12px 5px;
  border: 0;
  background: transparent;
  font: 700 19px var(--pc-font-body);
  color: #423019;
  cursor: pointer;
  white-space: nowrap;
}
.equipment-panel-tabs > button {
  isolation: isolate;
}
.equipment-panel-tabs > button.active {
  color: #231b0c;
}
.equipment-panel-tabs > button.active::before {
  content: '';
  position: absolute;
  inset: 0 -4px;
  z-index: -1;
  background: var(--equipment-tab-brush) center/contain no-repeat;
  pointer-events: none;
}
.equipment-panel-tabs > button > img {
  position: absolute;
  left: 0;
  bottom: -3px;
  width: 100%;
  height: 12px;
  object-fit: contain;
  pointer-events: none;
}
.equipment-panel-tabs > button:hover {
  color: #9a6527;
}
.equipment-panel-tabs > button:focus-visible {
  outline: 2px solid #a17a36;
  outline-offset: 1px;
}
.equipment-panel-content {
  height: calc(100% - 98px);
  margin-top: 8px;
  display: grid;
  grid-template-columns: 36% minmax(0, 1fr);
  gap: 14px;
}
.equipment-right-workspace {
  height: 100%;
  padding: 14px 16px;
}
.equipment-preview-notice {
  position: absolute;
  right: 27px;
  top: 27px;
  z-index: 2;
  pointer-events: none;
  background: #23261fee;
  border: 1px solid #a78643;
  padding: 6px 12px;
  text-align: center;
  font-size: 12px;
  color: #f4ddb0;
}
</style>
