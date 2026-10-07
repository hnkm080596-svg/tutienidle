<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EquipmentArtCard from './EquipmentArtCard.vue'
import EquipmentArtSlot from './EquipmentArtSlot.vue'
import {
  equipmentArt,
  equipmentSlots,
  equipmentItemIcon,
  equipmentStats,
  type EquipmentPreviewSlot,
} from './equipmentPreviewData'
defineProps<{ selected: EquipmentPreviewSlot }>()
const emit = defineEmits<{ select: [slot: EquipmentPreviewSlot] }>()
const { t } = useI18n()
</script>
<template>
  <section class="equipment-fixed-left" data-testid="equipment-fixed-left">
    <div class="equipment-paperdoll-stage">
      <img class="equipment-idle-brush" :src="equipmentArt('equipment-brush-circle-v1')" alt="" />
      <div
        v-for="(slot, index) in equipmentSlots"
        :key="slot"
        class="equipment-equipped-slot"
        :class="{ 'right-column': index > 2 }"
        :style="{ top: `${(index % 3) * 33.33}%` }"
      >
        <EquipmentArtSlot
          circular
          :icon="equipmentItemIcon(slot)"
          :label="t(`eq.slots.${slot}`)"
          :selected="selected === slot"
          :data-testid="`equipment-equipped-${slot}`"
          @select="emit('select', slot)"
        />
        <b>{{ t(`eq.slots.${slot}`) }}</b>
      </div>
    </div>
    <EquipmentArtCard class="equipment-contributed-stats">
      <h2>{{ t('eq.contributed') }}</h2>
      <dl>
        <div v-for="stat in equipmentStats" :key="stat.id">
          <dt>
            <span aria-hidden="true">{{ stat.glyph }}</span
            >{{ t(`eq.stats.${stat.id}`) }}
          </dt>
          <dd>{{ stat.current }}</dd>
        </div>
      </dl>
    </EquipmentArtCard>
  </section>
</template>
<style scoped>
.equipment-fixed-left {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-height: 0;
  min-width: 0;
}
.equipment-paperdoll-stage {
  flex: 1;
  position: relative;
  min-height: 0;
}
.equipment-idle-brush {
  position: absolute;
  left: 14%;
  top: 4%;
  width: 72%;
  height: 91%;
  object-fit: contain;
  opacity: 0.64;
  pointer-events: none;
}
.equipment-equipped-slot {
  position: absolute;
  left: 0;
  width: 91px;
  height: 33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 1px;
}
.equipment-equipped-slot.right-column {
  left: auto;
  right: 0;
}
.equipment-equipped-slot .equipment-art-slot {
  flex: none;
  width: 88px;
  height: 80px;
}
.equipment-equipped-slot b {
  font-size: 13px;
  line-height: 1.15;
  color: #3a2a14;
}
.equipment-contributed-stats {
  flex: none;
  height: 119px;
  padding: 11px 14px;
}
.equipment-contributed-stats h2 {
  margin: 0 0 9px;
  font-size: 18px;
  text-align: center;
  line-height: 1.2;
}
.equipment-contributed-stats dl {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 15px;
}
.equipment-contributed-stats dl > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}
.equipment-contributed-stats dt {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.equipment-contributed-stats dt span {
  font: 17px/1 serif;
}
.equipment-contributed-stats dd {
  margin: 0;
  color: #ebce84;
  white-space: nowrap;
}
</style>
