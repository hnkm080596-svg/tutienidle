<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from '@/components/common/art/EquipmentArtCard.vue'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentArtSlot from '@/components/common/art/EquipmentArtSlot.vue'
import { equipmentArt, equipmentItems } from './equipment/equipmentPreviewData'
const { t } = useI18n()
const tab = shallowRef('materials')
const category = shallowRef('all')
const query = shallowRef('')
const selected = shallowRef('')
const reversed = shallowRef(false)
const tabs = ['materials', 'pills', 'decompose']
const notice = shallowRef('')
const filters = ['all', 'weapon', 'helmet', 'armor', 'boots', 'ring', 'necklace']
const materials = ['linh_moc', 'linh_khoang']
const pills = [
  'tu_linh_dan',
  'to_cot_dan',
  'thoi_the_dan',
  'phi_van_dan',
  'khai_linh_dan',
  'hoi_xuan_dan',
  'hoi_linh_dan',
  'duong_than_dan',
]
const items = computed(() => {
  const all =
    tab.value === 'decompose'
      ? equipmentItems.map((item) => ({ ...item, label: t(`eq.slots.${item.slot}`) }))
      : (tab.value === 'materials' ? materials : pills).map((id) => ({
          id,
          slot: '',
          quality: 'gold' as const,
          icon: resolveAssetUrl(
            `/assets/${tab.value === 'materials' ? 'materials' : 'pills'}/${id}.png`,
          ),
          label: t(`ip.items.${id}`),
        }))
  const results = all.filter(
    (item) =>
      (tab.value !== 'decompose' || category.value === 'all' || item.slot === category.value) &&
      item.label.toLocaleLowerCase('vi').includes(query.value.toLocaleLowerCase('vi')),
  )
  return reversed.value ? [...results].reverse() : results
})
const cells = computed(() => Array.from({ length: 48 }, (_, i) => items.value[i] ?? null))
const paper = {
  backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')`,
  '--inventory-brush': `url('${equipmentArt('equipment-tab-brush-v1')}')`,
}
function chooseTab(id: string) {
  tab.value = id
  category.value = 'all'
  query.value = ''
  selected.value = ''
  notice.value = ''
}
</script>
<template>
  <section class="home-inventory-panel" :style="paper" data-testid="home-inventory-panel">
    <header>
      <h1>{{ t('ip.title') }}</h1>
      <img :src="equipmentArt('equipment-divider-v1')" alt="" />
    </header>
    <nav class="inventory-tabs" :aria-label="t('ip.title')">
      <button
        v-for="id in tabs"
        :key="id"
        :class="{ active: tab === id }"
        :aria-pressed="tab === id"
        :data-testid="`inventory-tab-${id}`"
        @click="chooseTab(id)"
      >
        {{ t(`ip.${id}`)
        }}<img v-if="tab === id" :src="equipmentArt('equipment-divider-v1')" alt="" />
      </button>
    </nav>
    <div class="inventory-toolbar">
      <label class="inventory-search"
        ><span aria-hidden="true">⌕</span
        ><input v-model="query" :aria-label="t('ip.search')" :placeholder="t('ip.search')"
      /></label>
      <nav v-if="tab === 'decompose'" class="inventory-filters" :aria-label="t('ip.filter')">
        <EquipmentArtButton
          v-for="id in filters"
          :key="id"
          filter-art
          :gold="category === id"
          :aria-pressed="category === id"
          @click="category = id"
          >{{ t(`ip.filters.${id}`) }}</EquipmentArtButton
        >
      </nav>
      <span class="inventory-count">{{ t('ip.count', { n: items.length }) }}</span>
    </div>
    <div class="inventory-workspace" :class="{ decomposing: tab === 'decompose' }">
      <div class="inventory-grid">
        <EquipmentArtSlot
          v-for="(item, i) in cells"
          :key="i"
          :icon="item?.icon"
          :label="item?.label ?? t('ip.empty')"
          :quality="item?.quality"
          :empty="!item"
          :selected="!!item && selected === item.id"
          :data-testid="`inventory-cell-${i}`"
          @select="selected = item?.id ?? ''"
        />
      </div>
      <EquipmentArtCard v-if="tab === 'decompose'" class="decompose-card">
        <h2>{{ t('ip.decompose') }}</h2>
        <p>{{ t('ip.decomposeHint') }}</p>
        <EquipmentArtSlot
          class="decompose-target"
          :icon="equipmentItems.find((item) => item.id === selected)?.icon"
          :label="t('ip.selected')"
          :empty="!selected"
        />
        <h3>{{ t('ip.result') }}</h3>
        <img
          class="decompose-material"
          :src="resolveAssetUrl('/assets/materials/linh_khoang.png')"
          alt=""
        />
        <p>{{ t('ip.items.linh_khoang') }} × 5</p>
        <EquipmentArtButton
          gold
          :disabled="!selected"
          data-testid="inventory-decompose"
          @click="notice = t('ip.previewNotice')"
          >{{ t('ip.decompose') }}</EquipmentArtButton
        ><small role="status">{{ notice }}</small>
      </EquipmentArtCard>
    </div>
    <footer class="inventory-footer">
      <span>{{ t('ip.count', { n: items.length }) }}</span>
      <div class="inventory-pages">
        <EquipmentArtButton square-art :aria-label="t('ip.previous')" disabled>‹</EquipmentArtButton
        ><EquipmentArtButton square-art gold aria-current="page">1</EquipmentArtButton
        ><EquipmentArtButton square-art :aria-label="t('ip.next')" disabled>›</EquipmentArtButton>
      </div>
      <EquipmentArtButton
        filter-art
        class="inventory-sort"
        :gold="reversed"
        @click="reversed = !reversed"
        >↕ {{ t('ip.sort') }}</EquipmentArtButton
      >
    </footer>
  </section>
</template>
<style scoped>
.home-inventory-panel {
  position: absolute;
  left: 24%;
  top: 12.5%;
  width: 74%;
  height: 75%;
  z-index: 20;
  padding: 16px 20px 18px;
  background: #f2e4c8 center/cover no-repeat;
  border: 3px double #b28a43;
  color: #302519;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
header {
  position: relative;
  inset: auto;
  transform: none;
  padding: 0;
  margin: 0;
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 30px;
  border-bottom: 1px solid #b28a43;
}
h1 {
  position: static;
  transform: none;
  font-size: 38px;
  line-height: 1.15;
  margin: 0;
}
header img {
  width: 180px;
  height: 23px;
  object-fit: contain;
  opacity: 0.65;
}
.inventory-tabs {
  display: flex;
  gap: 30px;
  height: 45px;
  flex: none;
  align-items: center;
  border-bottom: 1px solid #b28a4355;
}
.inventory-tabs button {
  position: relative;
  isolation: isolate;
  background: transparent;
  border: 0;
  min-width: 155px;
  font: 700 21px var(--pc-font-body);
  color: #35291a;
  cursor: pointer;
  height: 34px;
}
.inventory-tabs button.active:before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--inventory-brush) center/contain no-repeat;
}
.inventory-tabs button img {
  position: absolute;
  left: 0;
  bottom: -4px;
  width: 100%;
  height: 10px;
  object-fit: contain;
}
.inventory-tabs button:hover {
  color: #976426;
}
.inventory-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 57px;
  flex: none;
}
.inventory-search {
  display: flex;
  align-items: center;
  gap: 9px;
  flex: 1;
  min-width: 170px;
  height: 37px;
  border: 2px double #a48242;
  background: #23241e;
  color: #e6d6af;
  padding: 0 9px;
  box-shadow: inset 0 0 3px #0008;
}
.inventory-search span {
  font-size: 25px;
}
.inventory-search input {
  background: transparent;
  border: 0;
  color: #f2e4c4;
  min-width: 0;
  width: 100%;
  font: 15px var(--pc-font-body);
  outline: none;
}
.inventory-search:focus-within {
  outline: 1px solid #c69c53;
  outline-offset: 2px;
}
.inventory-search input::placeholder {
  color: #cbb990;
}
.inventory-filters {
  display: flex;
  gap: 4px;
}
.inventory-filters button {
  width: 75px;
  height: 35px;
  padding: 0;
  font-size: 12px;
}
.inventory-count {
  font-size: 13px;
  white-space: nowrap;
}
.inventory-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 5px;
  flex: 1;
  min-height: 0;
}
.inventory-footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  height: 55px;
  margin-top: 10px;
  border-top: 1px solid #b28a4377;
  font-size: 15px;
}
.inventory-pages {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 7px;
}
.inventory-pages button {
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 20px;
}
.inventory-pages button:disabled {
  opacity: 0.7;
  cursor: default;
}
.inventory-sort {
  width: 135px;
  height: 40px;
  padding: 0;
  font-size: 17px;
}
</style>
<style scoped>
.inventory-filters button {
  white-space: nowrap;
  line-height: 1.2;
  padding: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
}
.inventory-sort {
  white-space: nowrap;
  line-height: 1.2;
  display: grid;
  place-items: center;
}
</style>

<style scoped>
.inventory-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
}
.inventory-workspace.decomposing .inventory-grid {
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(0, 1fr));
}
.decompose-card {
  width: 245px;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.decompose-card h2 {
  font-size: 23px;
  margin: 0;
}
.decompose-card h3 {
  font-size: 17px;
  margin: 6px 0;
}
.decompose-card p {
  font-size: 13px;
  text-align: center;
  margin: 0;
}
.decompose-target {
  width: 80px;
  height: 80px;
  flex: none;
}
.decompose-material {
  width: 50px;
  height: 50px;
  object-fit: contain;
}
.decompose-card > button:last-of-type {
  width: 100%;
  height: 40px;
  margin-top: auto;
}
.decompose-card small {
  font-size: 11px;
  min-height: 26px;
  text-align: center;
}
</style>
