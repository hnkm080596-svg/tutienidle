<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from './equipment/EquipmentArtCard.vue'
import EquipmentArtButton from './equipment/EquipmentArtButton.vue'
import EquipmentArtSlot from './equipment/EquipmentArtSlot.vue'
import EquipmentEnergyTube from './equipment/EquipmentEnergyTube.vue'
const { t } = useI18n()
const pills = [
  'tu_linh_dan',
  'hoi_linh_dan',
  'thoi_the_dan',
  'duong_than_dan',
  'to_cot_dan',
  'phi_van_dan',
  'khai_linh_dan',
  'hoi_xuan_dan',
]
const selected = shallowRef('tu_linh_dan')
const pulse = shallowRef(false)
const progress = computed(() => (pulse.value ? [72, 65, 88, 81] : [42, 56, 68, 75]))
const asset = (name: string) => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${name}-v1.png`)
const pillArt = (id: string) => resolveAssetUrl(`/assets/pills/${id}.png`)
const ingredients = [
  { id: 'herb', icon: '/assets/materials/linh_moc.png', x: 15, y: 18, amount: '12 / 10' },
  { id: 'ore', icon: '/assets/materials/linh_khoang.png', x: 85, y: 18, amount: '8 / 5' },
  {
    id: 'crystal',
    icon: '/assets/ui/tien-hiep-2026-10/controls/resource-crystal-v1.png',
    x: 15,
    y: 82,
    amount: '3 / 3',
  },
  {
    id: 'jade',
    icon: '/assets/ui/tien-hiep-2026-10/controls/resource-jade-v1.png',
    x: 85,
    y: 82,
    amount: '2 / 1',
  },
]
const paper = { backgroundImage: `url('${asset('source/shared-paper-page')}')` }
function connector(x: number, y: number) {
  const dx = 50 - x,
    dy = 50 - y
  return {
    left: `${x}%`,
    top: `${y}%`,
    width: `${Math.hypot(dx, dy)}%`,
    transform: `rotate(${Math.atan2(dy, dx)}rad)`,
  }
}
function choosePill(id: string) {
  selected.value = id
  pulse.value = false
}
</script>
<template>
  <section class="home-alchemy-panel" :style="paper" data-testid="home-alchemy-panel">
    <header>
      <h1>{{ t('ap.title') }}</h1>
      <img :src="asset('controls/equipment-divider')" alt="" />
    </header>
    <p class="alchemy-subtitle">{{ t('ap.subtitle') }}</p>
    <div class="alchemy-layout">
      <nav class="alchemy-recipes" :aria-label="t('ap.recipes')">
        <EquipmentArtButton
          v-for="id in pills"
          :key="id"
          :gold="selected === id"
          :aria-pressed="selected === id"
          @click="choosePill(id)"
          ><img :src="pillArt(id)" alt="" /><span>{{
            t(`ip.items.${id}`)
          }}</span></EquipmentArtButton
        >
      </nav>
      <div class="alchemy-stage" :class="{ energized: pulse }" data-testid="alchemy-stage">
        <div
          v-for="material in ingredients"
          :key="material.id"
          class="alchemy-connector"
          :style="connector(material.x, material.y)"
        >
          <img :src="asset('body/meridian-tube-lit')" alt="" /><i v-if="pulse"></i>
        </div>
        <img
          class="alchemy-cauldron"
          :src="resolveAssetUrl('/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png')"
          alt=""
        />
        <div class="alchemy-pill-center">
          <img
            class="alchemy-pill-frame"
            :src="asset('controls/equipment-circle-frame')"
            alt=""
          /><img class="alchemy-pill-art" :src="pillArt(selected)" alt="" />
        </div>
        <div
          v-for="material in ingredients"
          :key="material.id"
          class="alchemy-ingredient"
          :style="{ left: material.x + '%', top: material.y + '%' }"
        >
          <EquipmentArtSlot
            :icon="resolveAssetUrl(material.icon)"
            :label="t(`ap.${material.id}`)"
          /><span>{{ material.amount }}</span>
        </div>
        <p class="alchemy-pill-name">{{ t(`ip.items.${selected}`) }}</p>
      </div>
      <EquipmentArtCard class="alchemy-progress-card">
        <div class="alchemy-card-heading">
          <img :src="pillArt(selected)" alt="" />
          <h2>{{ t(`ip.items.${selected}`) }}</h2>
        </div>
        <p>{{ t('ap.progressHint') }}</p>
        <section
          v-for="(id, i) in ['mastery', 'fire', 'purity', 'stability']"
          :key="id"
          class="alchemy-progress-row"
        >
          <div>
            <h3>{{ t(`ap.${id}`) }}</h3>
            <b>{{ progress[i] }}%</b>
          </div>
          <EquipmentEnergyTube
            :fill="progress[i]!"
            :color="['#e6b557', '#e77942', '#70b697', '#65aeda'][i]!"
          /><small>{{ t(`ap.${id}Hint`) }}</small>
        </section>
        <EquipmentArtButton
          gold
          class="alchemy-start"
          data-testid="alchemy-start"
          @click="pulse = !pulse"
          >{{ t('ap.start') }}</EquipmentArtButton
        >
      </EquipmentArtCard>
    </div>
  </section>
</template>
<style scoped>
.home-alchemy-panel {
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
}
header {
  position: relative;
  inset: auto;
  transform: none;
  padding: 0;
  margin: 0;
  height: 48px;
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
.alchemy-subtitle {
  font-size: 15px;
  margin: 8px 0;
}
.alchemy-layout {
  height: calc(100% - 81px);
  display: grid;
  grid-template-columns: 20% 50% 30%;
  min-height: 0;
}
.alchemy-recipes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  scrollbar-width: none;
  overscroll-behavior: contain;
  padding: 6px 9px 6px 0;
}
.alchemy-recipes::-webkit-scrollbar {
  display: none;
}
.alchemy-recipes button {
  height: 53px;
  flex: none;
  font-size: 15px;
  white-space: nowrap;
  padding: 0 6px 0 39px;
  display: flex;
  align-items: center;
}
.alchemy-recipes button img {
  position: absolute;
  left: 0;
  width: 43px;
  height: 43px;
  object-fit: contain;
}
.alchemy-recipes button span {
  position: relative;
}
.alchemy-stage {
  position: relative;
  align-self: center;
  aspect-ratio: 1;
  max-height: 100%;
  width: 100%;
  isolation: isolate;
}
.alchemy-cauldron {
  position: absolute;
  left: 18%;
  top: 19%;
  width: 64%;
  height: 66%;
  object-fit: contain;
  z-index: 2;
  pointer-events: none;
}
.alchemy-pill-center {
  position: absolute;
  left: 50%;
  top: 51%;
  width: 21%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  z-index: 3;
  display: grid;
  place-items: center;
}
.alchemy-pill-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 5px #e7ad4c);
}
.alchemy-pill-art {
  width: 59%;
  height: 59%;
  object-fit: contain;
  z-index: 1;
}
.alchemy-ingredient {
  position: absolute;
  width: 16%;
  height: 16%;
  transform: translate(-50%, -50%);
  z-index: 4;
}
.alchemy-ingredient span {
  display: block;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  background: #f3e5cae8;
  margin: 2px -7px;
  color: #55642d;
}
.alchemy-ingredient > .equipment-art-slot {
  height: 100%;
}
.alchemy-connector {
  position: absolute;
  height: 10px;
  transform-origin: left center;
  z-index: 1;
  pointer-events: none;
}
.alchemy-connector img {
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.alchemy-connector i {
  position: absolute;
  left: 4%;
  top: 42%;
  width: 92%;
  height: 16%;
  background: linear-gradient(90deg, transparent, #fff4b6, transparent);
  background-size: 200% 100%;
  animation: alchemy-flow 2.2s linear infinite;
}
.alchemy-pill-name {
  position: absolute;
  bottom: -2%;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}
.energized .alchemy-pill-frame {
  filter: drop-shadow(0 0 8px #f4c975);
}
.alchemy-progress-card {
  height: 100%;
  transform: translateY(-28px);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.alchemy-card-heading {
  display: flex;
  align-items: center;
  gap: 9px;
}
.alchemy-card-heading img {
  width: 43px;
  height: 43px;
  object-fit: contain;
}
.alchemy-card-heading h2 {
  font-size: 23px;
  margin: 0;
}
.alchemy-progress-card > p {
  font-size: 12px;
  line-height: 1.5;
  margin: 0 0 4px;
}
.alchemy-progress-row {
  flex: 1;
  min-height: 0;
  padding: 10px 10px 8px;
  border: 1px solid #b1914c88;
  background: #0e141333;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}
.alchemy-progress-row > div {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.alchemy-progress-row h3 {
  font-size: 16px;
  color: #ead29e;
  margin: 0;
}
.alchemy-progress-row b {
  font-size: 14px;
  font-weight: 400;
  color: #eac779;
}
.alchemy-progress-row small {
  font-size: 11px;
  color: #c9bc9e;
}
.alchemy-start {
  height: 44px;
  flex: none;
  padding: 0;
  font-size: 21px;
}
@keyframes alchemy-flow {
  to {
    background-position: -200% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .alchemy-connector i {
    animation: none;
  }
}
</style>
<style scoped>
.alchemy-pill-name {bottom:13%;left:29%;width:42%;font-size:17px;}
.alchemy-progress-row :deep(.equipment-energy-tube){height:10px;min-height:10px;flex:none;}
</style>
