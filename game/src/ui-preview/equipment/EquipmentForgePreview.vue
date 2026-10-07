<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentArtButton from './EquipmentArtButton.vue'
import EquipmentArtSlot from './EquipmentArtSlot.vue'
import EquipmentEnergyTube from './EquipmentEnergyTube.vue'
import {
  equipmentArt,
  equipmentStats,
  refineStats,
  washStats,
  type EquipmentPreviewTab,
} from './equipmentPreviewData'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const props = defineProps<{ tab: Exclude<EquipmentPreviewTab, 'equipment'> }>()
const emit = defineEmits<{ notice: [message: string] }>()
const { t } = useI18n()
const locked = shallowRef<readonly string[]>([])
const resultVisible = shallowRef(false)
const materialIcons = ['crystal', 'jade', 'essence', 'coin'].map((id) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/controls/resource-${id}-v1.png`),
)
const materials = computed(() =>
  props.tab === 'enhance'
    ? [
        { icon: materialIcons[0]!, label: t('eq.stone'), amount: '128/20' },
        { icon: materialIcons[3]!, label: t('eq.coin'), amount: '1.200.000/100.000' },
      ]
    : props.tab === 'wash'
      ? [
          { icon: materialIcons[1]!, label: '', amount: '12/6' },
          { icon: materialIcons[2]!, label: '', amount: '8/3' },
          { icon: materialIcons[3]!, label: '', amount: '200.000' },
        ]
      : materialIcons.map((icon, index) => ({
          icon,
          label: '',
          amount: ['12/10', '18/10', '10/10', '9/10'][index]!,
        })),
)
function toggleLock(id: string) {
  locked.value = locked.value.includes(id)
    ? locked.value.filter((value) => value !== id)
    : [...locked.value, id]
}
function previewAction() {
  if (props.tab === 'wash') resultVisible.value = true
  emit('notice', t('eq.previewNotice'))
}
function keepResult() {
  resultVisible.value = false
  emit('notice', t('eq.previewNotice'))
}
</script>
<template>
  <div
    class="equipment-forge-workspace"
    :class="`forge-${tab}`"
    :data-testid="`equipment-forge-${tab}`"
  >
    <h2>{{ t(`eq.tabs.${tab}`) }}</h2>
    <template v-if="tab === 'enhance'">
      <div class="equipment-enhancement-levels">
        <span v-for="level in [12, 13]" :key="level" class="equipment-level-seal"
          ><img :src="equipmentArt('equipment-level-seal-v1')" alt="" /><b>+{{ level }}</b></span
        ><span class="equipment-level-arrow" aria-hidden="true">»</span>
      </div>
      <h3 class="equipment-forge-divider">{{ t('eq.afterEnhance') }}</h3>
      <div class="equipment-enhancement-table">
        <div class="equipment-table-head">
          <span>{{ t('eq.current') }} (+12)</span><span>{{ t('eq.result') }} (+13)</span>
        </div>
        <div v-for="stat in equipmentStats" :key="stat.id" class="equipment-enhance-stat">
          <span class="equipment-stat-name"
            ><i aria-hidden="true">{{ stat.glyph }}</i
            >{{ t(`eq.stats.${stat.id}`) }}</span
          ><b>{{ stat.current }}</b
          ><span class="equipment-stat-arrow" aria-hidden="true">»</span
          ><strong>{{ stat.next }}</strong>
        </div>
      </div>
    </template>
    <template v-else-if="tab === 'wash'">
      <div class="equipment-wash-columns">
        <section>
          <h3>{{ t('eq.current') }}</h3>
          <div v-for="stat in washStats" :key="stat.id" class="equipment-affix-row">
            <span class="equipment-stat-name"
              ><i aria-hidden="true">{{ stat.glyph }}</i
              >{{ t(`eq.stats.${stat.id}`) }}</span
            ><b :style="{ color: stat.color }">{{ stat.current }}</b>
          </div>
        </section>
        <section>
          <h3>{{ t('eq.result') }}</h3>
          <div v-for="stat in washStats" :key="stat.id" class="equipment-affix-row">
            <span class="equipment-stat-name">{{ t(`eq.stats.${stat.id}`) }}</span
            ><b :style="{ color: stat.color }">{{ resultVisible ? stat.next : '—' }}</b
            ><EquipmentArtButton
              class="equipment-affix-lock"
              square-art
              :gold="locked.includes(stat.id)"
              :aria-label="
                t(locked.includes(stat.id) ? 'eq.unlock' : 'eq.lock', {
                  stat: t(`eq.stats.${stat.id}`),
                })
              "
              :aria-pressed="locked.includes(stat.id)"
              :data-testid="`equipment-lock-${stat.id}`"
              @click="toggleLock(stat.id)"
              ><svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10V7a5 5 0 0 1 10 0v3M6 10h12v11H6z" />
                <path d="M12 14v3" /></svg
            ></EquipmentArtButton>
          </div>
        </section>
      </div>
    </template>
    <template v-else>
      <div class="equipment-refinement-rows">
        <div v-for="(stat, index) in refineStats" :key="stat.id" class="equipment-refine-row">
          <span class="equipment-stat-name"
            ><i aria-hidden="true">{{ stat.glyph }}</i
            >{{ t(`eq.stats.${stat.id}`) }}</span
          >
          <div class="equipment-refine-current">
            <small>{{ t('eq.current') }}</small
            ><b>{{ stat.current }}</b>
          </div>
          <EquipmentEnergyTube :fill="stat.fill" :color="stat.color" />
          <div class="equipment-refine-next">
            <small>{{ t('eq.result') }}</small
            ><b>{{ stat.next }}</b>
          </div>
          <div class="equipment-refine-action">
            <EquipmentArtButton
              :data-testid="`equipment-refine-${stat.id}`"
              @click="previewAction"
              >{{ t('eq.tabs.refine') }}</EquipmentArtButton
            ><span><img :src="materialIcons[index]" alt="" />12/3</span>
          </div>
        </div>
      </div>
    </template>
    <h3 class="equipment-forge-divider material-divider">
      {{
        t(
          tab === 'enhance'
            ? 'eq.enhancementMaterials'
            : tab === 'wash'
              ? 'eq.washMaterials'
              : 'eq.refinementMaterials',
        )
      }}
    </h3>
    <div class="equipment-forge-materials">
      <div v-for="(material, index) in materials" :key="index" class="equipment-material">
        <div class="equipment-material-icon">
          <EquipmentArtSlot :icon="material.icon" :label="t('eq.materials')" empty />
        </div>
        <div>
          <span v-if="material.label">{{ material.label }}</span
          ><b>{{ material.amount }}</b>
        </div>
      </div>
    </div>
    <div class="equipment-forge-actions">
      <EquipmentArtButton gold :data-testid="`equipment-action-${tab}`" @click="previewAction">{{
        t(`eq.tabs.${tab}`)
      }}</EquipmentArtButton
      ><EquipmentArtButton
        v-if="tab === 'wash'"
        :disabled="!resultVisible"
        data-testid="equipment-keep-result"
        @click="keepResult"
        >{{ t('eq.keep') }}</EquipmentArtButton
      >
    </div>
  </div>
</template>
<style scoped>
.equipment-forge-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.equipment-forge-workspace h2 {
  font-size: 26px;
  margin: 0;
  border-bottom: 1px solid #9b7d4066;
  padding-bottom: 7px;
  line-height: 1.15;
}
.equipment-enhancement-levels {
  position: relative;
  display: flex;
  justify-content: center;
  gap: 120px;
  height: 76px;
  flex: none;
}
.equipment-level-seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
}
.equipment-level-seal img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.equipment-level-seal b {
  position: relative;
  z-index: 1;
  font-size: 30px;
  line-height: 1;
  color: #e8cb80;
}
.equipment-level-arrow {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: #dfb365;
  font-size: 40px;
}
.equipment-forge-divider {
  margin: 0;
  text-align: center;
  font-size: 16px;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 10px;
}
.equipment-forge-divider::before,
.equipment-forge-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #a4894e;
  opacity: 0.6;
}
.equipment-enhancement-table {
  border: 1px solid #92744280;
  padding: 3px 10px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.equipment-table-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  border-bottom: 1px solid #987b4850;
  padding: 3px 0 6px;
}
.equipment-enhance-stat {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 22px 0.85fr;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
  font-size: 13px;
  border-bottom: 1px solid #96764440;
}
.equipment-enhance-stat:last-child {
  border: 0;
}
.equipment-stat-name {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.equipment-stat-name i {
  font: 20px/1 serif;
  font-style: normal;
  color: #ecdab5;
}
.equipment-enhance-stat b {
  font-weight: 400;
}
.equipment-enhance-stat strong {
  color: #e6ca7d;
  text-align: right;
  font-weight: 500;
}
.equipment-stat-arrow {
  color: #c7a15e;
}
.equipment-forge-materials {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  flex: none;
  min-height: 53px;
}
.equipment-material {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.equipment-material-icon {
  width: 48px;
  height: 48px;
  flex: none;
}
.equipment-material > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.equipment-material b {
  font-weight: 400;
  color: #8bca8d;
  font-size: 13px;
  white-space: nowrap;
}
.equipment-forge-actions {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex: none;
}
.equipment-forge-actions > button {
  min-width: 220px;
  min-height: 42px;
  font-size: 23px;
  padding: 7px 25px;
}
.equipment-wash-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  flex: 1;
  min-height: 0;
}
.equipment-wash-columns > section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}
.equipment-wash-columns h3 {
  text-align: center;
  font-size: 19px;
  margin: 0;
  padding: 3px 0 6px;
  border-bottom: 1px solid #9d804a;
}
.equipment-affix-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid #987b4855;
  flex: 1;
  min-height: 0;
  font-size: 14px;
}
.equipment-affix-row b {
  font-weight: 500;
  margin-left: auto;
  white-space: nowrap;
}
.equipment-affix-lock {
  flex: none;
  width: 31px;
  height: 31px;
  min-height: 31px;
  padding: 5px;
}
.equipment-affix-lock svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
}
.forge-wash .equipment-material {
  flex-direction: column;
  gap: 4px;
}
.forge-wash .equipment-material-icon {
  height: 44px;
  width: 44px;
}
.forge-wash .equipment-forge-materials {
  gap: 43px;
}
.forge-wash .equipment-forge-actions > button {
  min-width: 0;
  flex: 1;
  font-size: 21px;
}
.equipment-refinement-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}
.equipment-refine-row {
  display: grid;
  grid-template-columns: 1.1fr 0.65fr 1.15fr 0.7fr 90px;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-height: 0;
  border: 1px solid #987b4855;
  padding: 4px 8px;
  font-size: 14px;
}
.equipment-refine-current,
.equipment-refine-next {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.equipment-refine-row small {
  font-size: 11px;
  white-space: nowrap;
  color: #c1b18d;
}
.equipment-refine-row b {
  font-size: 17px;
  font-weight: 500;
}
.equipment-refine-next b {
  color: #93cfa0;
}
.equipment-refine-action {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}
.equipment-refine-action > button {
  min-width: 100px;
  font-size: 12px;
  min-height: 27px;
  padding: 5px;
  white-space: nowrap;
}
.equipment-refine-action > span {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
}
.equipment-refine-action img {
  height: 14px;
  width: 14px;
  object-fit: contain;
}
.forge-refine .equipment-forge-materials {
  gap: 18px;
  min-height: 46px;
}
.forge-refine .equipment-material {
  flex-direction: column;
  gap: 2px;
}
.forge-refine .equipment-material-icon {
  width: 37px;
  height: 37px;
}
.forge-refine .equipment-material b {
  font-size: 11px;
}
.forge-refine .equipment-forge-actions > button {
  min-height: 35px;
  font-size: 20px;
}
</style>
