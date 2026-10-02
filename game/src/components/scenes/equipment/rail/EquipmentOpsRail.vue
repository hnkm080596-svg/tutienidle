<script setup lang="ts">
// Scene 12 ops rail (spec region ops-rail, 132 x 610): hanging-seal strip
// inside the scroll content - the Trang Bi view seal plus one seal per op
// the beta allow-list admits (tabs arrive pre-filtered by the scene).
import { useI18n } from 'vue-i18n'
import EquipmentOpsSeal from './EquipmentOpsSeal.vue'

const { t } = useI18n()

// Rail emits the workspace id - 'equip' for the view seal or an op id;
// typed as a callback prop so callers keep their own id union.
const props = defineProps<{
  active: string
  tabs: readonly { id: string; labelKey: string }[]
  onSelect: (id: string) => void
}>()
</script>

<template>
  <nav
    class="equipment-ops-rail"
    data-hk-region="ops-rail"
    :aria-label="t('panels.equipmentHall.rail.aria')"
  >
    <!-- qi-hall__tabs: class carried over from the old shell's TabBar so
         existing DOM contracts keep resolving; styling is owned by this
         component, not the .qi-hall__* sheet. -->
    <ul class="equipment-ops-rail__list qi-hall__tabs">
      <li class="equipment-ops-rail__item">
        <EquipmentOpsSeal
          :label="t('panels.bag.tabs.equipment')"
          symbol="equipment"
          :active="active === 'equip'"
          @click="props.onSelect('equip')"
        />
      </li>
      <li v-for="tab in tabs" :key="tab.id" class="equipment-ops-rail__item">
        <EquipmentOpsSeal
          :label="t(tab.labelKey)"
          :active="active === tab.id"
          @click="props.onSelect(tab.id)"
        />
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.equipment-ops-rail {
  height: 100%;
  min-height: 0;
}

.equipment-ops-rail__list {
  height: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(6px, 0.9cqh, 12px);
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%);
}
.equipment-ops-rail__list::-webkit-scrollbar { display: none; }

.equipment-ops-rail__item {
  flex: 0 0 auto;
  width: min(100%, 96px);
  display: flex;
  justify-content: center;
}
</style>
