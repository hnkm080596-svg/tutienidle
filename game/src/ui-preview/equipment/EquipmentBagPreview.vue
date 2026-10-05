<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentArtButton from './EquipmentArtButton.vue'
import EquipmentArtSlot from './EquipmentArtSlot.vue'
import {
  equipmentFilters,
  equipmentItems,
  type EquipmentPreviewFilter,
} from './equipmentPreviewData'
const emit = defineEmits<{ notice: [message: string] }>()
const { t } = useI18n()
const filter = shallowRef<EquipmentPreviewFilter>('all')
const quality = shallowRef('all')
const order = shallowRef('default')
const selected = shallowRef('')
const cells = computed(() => {
  const items = equipmentItems.filter((item) => {
    const category =
      filter.value === 'all' ||
      (filter.value === 'jewelry'
        ? item.slot === 'necklace' || item.slot === 'ring'
        : filter.value === 'other'
          ? item.slot === 'boots' || item.slot === 'helmet'
          : item.slot === filter.value)
    return category && (quality.value === 'all' || item.quality === quality.value)
  })
  if (order.value === 'quality')
    items.sort(
      (a, b) =>
        ['gold', 'purple', 'blue'].indexOf(a.quality) -
        ['gold', 'purple', 'blue'].indexOf(b.quality),
    )
  return Array.from({ length: 40 }, (_, index) => items[index] ?? null)
})
</script>
<template>
  <div class="equipment-bag-workspace" data-testid="equipment-bag-workspace">
    <header>
      <h2>{{ t('eq.bag') }}</h2>
      <span>18/100</span
      ><EquipmentArtButton
        square-art
        :aria-label="t('eq.capacity')"
        @click="emit('notice', t('eq.capacityNotice'))"
        >＋</EquipmentArtButton
      >
      <EquipmentArtButton
        filter-art
        class="equipment-dissolve"
        data-testid="equipment-dissolve"
        @click="emit('notice', t('ip.dissolveNotice'))"
        >{{ t('ip.dissolve') }}</EquipmentArtButton
      >
    </header>
    <nav class="equipment-bag-filters" :aria-label="t('eq.bag')">
      <EquipmentArtButton
        v-for="id in equipmentFilters.filter((id) => id !== 'other')"
        filter-art
        :key="id"
        :gold="filter === id"
        :aria-pressed="filter === id"
        :data-testid="`equipment-filter-${id}`"
        @click="filter = id"
        >{{ t(`eq.filters.${id}`) }}</EquipmentArtButton
      >
    </nav>
    <div class="equipment-bag-grid">
      <EquipmentArtSlot
        v-for="(item, index) in cells"
        :key="index"
        :icon="item?.icon"
        :label="item ? t(`eq.slots.${item.slot}`) : t('eq.empty')"
        :quality="item?.quality"
        :empty="!item"
        :selected="!!item && selected === item.id"
        :data-testid="`equipment-bag-cell-${index}`"
        @select="selected = item!.id"
      />
    </div>
    <footer>
      <label
        >{{ t('eq.quality')
        }}<select v-model="quality" :aria-label="t('eq.quality')">
          <option v-for="id in ['all', 'gold', 'purple', 'blue']" :key="id" :value="id">
            {{ t(`eq.qualities.${id}`) }}
          </option>
        </select></label
      ><label
        >{{ t('eq.order')
        }}<select v-model="order" :aria-label="t('eq.order')">
          <option value="default">{{ t('eq.defaultOrder') }}</option>
          <option value="quality">{{ t('eq.qualityOrder') }}</option>
        </select></label
      >
    </footer>
  </div>
</template>
<style scoped>
.equipment-bag-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.equipment-bag-workspace header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  height: 33px;
  border-bottom: 1px solid #92783e66;
  padding-bottom: 6px;
}
.equipment-bag-workspace h2 {
  font-size: 24px;
  margin: 0;
  flex: 1;
  line-height: 1.2;
}
.equipment-bag-workspace header span {
  font-size: 15px;
}
.equipment-bag-workspace header button {
  font-size: 22px;
  min-height: 29px;
  padding: 2px 10px;
}
.equipment-bag-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  flex: none;
}
.equipment-bag-filters button {
  font-size: 13px;
  padding: 0 5px;
}
.equipment-bag-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(0, 1fr));
  gap: 5px;
  flex: 1;
  min-height: 0;
}
.equipment-bag-workspace footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  flex: none;
}
.equipment-bag-workspace label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c7b58f;
}
.equipment-bag-workspace select {
  min-width: 0;
  flex: 1;
  height: 29px;
  border: 1px solid #8e7440;
  background: #23251e;
  color: #eedfbf;
  font: 13px var(--pc-font-body);
  padding: 3px 7px;
}
.equipment-bag-workspace select:focus-visible {
  outline: 2px solid #e1b85f;
}
</style>

<style scoped>
.equipment-bag-workspace header .equipment-dissolve {
  width: 120px;
  height: 30px;
  min-height: 30px;
  padding: 0;
  font-size: 13px;
  white-space: nowrap;
}
</style>
