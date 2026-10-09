<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentArtCard from '@/components/common/art/EquipmentArtCard.vue'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
type BodyTab = 'ren' | 'khai' | 'dan'
const { t } = useI18n()
const tabs: BodyTab[] = ['ren', 'khai', 'dan']
const tab = shallowRef<BodyTab>('ren')
const renStep = shallowRef(1)
const khaiStep = shallowRef(3)
const danStep = shallowRef(8)
const page = shallowRef(0)
const processes = ['bi', 'nhuc', 'huyet', 'cot', 'tang', 'mach'] as const
const tiers = ['gray', 'gold'] as const
const process = computed(() => processes[Math.floor(renStep.value / 2) % 6]!)
const tier = computed(() => renStep.value % 2)
const step = computed(() =>
  tab.value === 'ren' ? renStep.value : tab.value === 'khai' ? khaiStep.value : danStep.value,
)
const points = computed(() => {
  const base = [
    [50, 19],
    [50, 32],
    [35, 38],
    [65, 38],
    [50, 45],
    [15, 73],
    [85, 73],
    [50, 60],
    [27, 83],
    [73, 83],
  ]
  return base.map(([x, y], i) => ({
    x: x! + (page.value === 0 ? 0 : Math.sin((i + page.value) * 1.7) * 4),
    y: y! + (page.value === 0 ? 0 : Math.cos((i + page.value) * 1.3) * 3),
  }))
})
const edges = [
  [0, 1],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 6],
  [4, 7],
  [7, 8],
  [7, 9],
] as const
const bodyArt = (name: string) =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/body/${name}-v1.png`)
const paper = {
  backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')`,
}
function lineStyle(a: number, b: number) {
  const p = points.value[a]!,
    q = points.value[b]!
  const dx = (q.x - p.x) * 5,
    dy = (q.y - p.y) * 5.329
  return {
    left: `${p.x}%`,
    top: `${p.y}%`,
    width: `${Math.hypot(dx, dy) / 5}%`,
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
  }
}
function upgrade() {
  if (tab.value === 'ren') renStep.value = (renStep.value + 1) % 12
  else if (tab.value === 'khai') khaiStep.value = (khaiStep.value + 1) % 11
  else danStep.value = (danStep.value + 1) % 9
}
const galaxy = [
  { id: 'core', x: 50, y: 49, w: 8, angle: 0, duration: 0, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 18, angle: 0, duration: 19, reverse: false },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 21, angle: -24, duration: 27, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 30, angle: 38, duration: 33, reverse: false },
  { id: 'orbit-circle', x: 50, y: 49, w: 39, angle: 65, duration: 43, reverse: true },
  { id: 'orbit-ellipse', x: 50, y: 49, w: 48, angle: -52, duration: 51, reverse: false },
]
</script>
<template>
  <section class="home-body-panel" :style="paper" data-testid="home-body-panel">
    <header>
      <h1>{{ t('bp.title') }}</h1>
      <img
        :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-divider-v1.png')"
        alt=""
      />
    </header>
    <p class="body-subtitle">{{ t('bp.subtitle') }}</p>
    <div class="body-layout">
      <nav class="body-family" :aria-label="t('bp.title')">
        <img class="family-spine" :src="bodyArt('meridian-tube-lit')" alt="" />
        <EquipmentArtButton
          v-for="(id, i) in tabs"
          :key="id"
          :gold="tab === id"
          :aria-pressed="tab === id"
          :data-testid="`body-tab-${id}`"
          @click="tab = id"
        >
          <img
            class="family-icon"
            :src="bodyArt(`navigation-${id}-${tab === id ? 'lit' : 'unlit'}`)"
            alt=""
          />{{ t(`bp.${id}`) }}
        </EquipmentArtButton>
      </nav>
      <div class="body-center">
        <div class="body-stage" data-testid="body-stage">
          <img class="body-silhouette" :src="bodyArt('silhouette-seated')" alt="" />
          <div
            v-if="tab === 'ren'"
            class="body-process body-skin-layer"
            :class="{ lit: tier === 1 }"
            data-process="bi"
            :data-tier="tier"
          >
            <img :src="bodyArt('silhouette-seated')" alt="" />
          </div>
          <div
            v-if="tab === 'ren'"
            class="body-process body-muscle-layer"
            data-process="nhuc"
            :data-tier="tier"
          >
            <img
              v-for="side in ['left', 'right']"
              :key="side"
              :class="side"
              :src="bodyArt(`biceps-${side}-${tier === 0 ? 'unlit' : 'lit'}`)"
              alt=""
            />
          </div>
          <template v-if="tab === 'ren'">
            <img
              class="body-blood"
              :src="bodyArt(`anatomy-blood-${tier ? 'lit' : 'unlit'}`)"
              alt=""
            />
            <div class="body-spine">
              <span class="spine-core" :class="{ lit: tier === 1 }"></span>
              <img
                v-for="n in 10"
                :key="n"
                :src="bodyArt(`anatomy-vertebra-${tier ? 'lit' : 'unlit'}`)"
                alt=""
                data-testid="body-vertebra"
              />
            </div>
            <img
              class="body-heart"
              :src="bodyArt(`anatomy-heart-${tier ? 'lit' : 'unlit'}`)"
              alt=""
            />
            <div class="body-forehead">
              <img
                class="forehead-ring"
                :src="bodyArt(`forehead-ring-${tier ? 'lit' : 'unlit'}`)"
                alt=""
              />
              <img
                v-for="(point, i) in [
                  { x: 50, y: 4 },
                  { x: 10, y: 73 },
                  { x: 90, y: 73 },
                ]"
                :key="i"
                class="forehead-node"
                :style="{ left: point.x + '%', top: point.y + '%' }"
                :src="bodyArt(`forehead-node-${tier ? 'lit' : 'unlit'}`)"
                alt=""
                data-testid="body-forehead-node"
              />
            </div>
          </template>
          <template v-if="tab === 'khai'">
            <div
              v-for="([a, b], i) in edges"
              :key="`line-${i}`"
              class="body-meridian-line"
              :class="{ energized: b < khaiStep }"
              :style="lineStyle(a, b)"
            >
              <img :src="bodyArt(`meridian-tube-${b < khaiStep ? 'lit' : 'unlit'}`)" alt="" /><span
                v-if="b < khaiStep"
                class="meridian-flow"
              ></span>
            </div>
            <img
              v-for="(point, i) in points"
              :key="i"
              class="body-meridian-node"
              :style="{ left: `${point.x}%`, top: `${point.y}%` }"
              :src="bodyArt(`meridian-node-${i < khaiStep ? 'lit' : 'unlit'}`)"
              alt=""
              data-testid="body-meridian-node"
            />
          </template>
          <template v-if="tab === 'dan'">
            <img
              v-for="(piece, i) in galaxy"
              :key="i"
              class="body-galaxy-piece"
              :class="{ orbiting: i < danStep && piece.id.startsWith('orbit') }"
              :style="{
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                width: `${piece.w}%`,
                '--orbit-angle': `${piece.angle}deg`,
                animationDuration: `${piece.duration}s`,
                animationDirection: piece.reverse ? 'reverse' : 'normal',
                animationDelay: `${-i * 7}s`,
              }"
              :src="bodyArt(`galaxy-${piece.id}-${i < danStep ? 'lit' : 'unlit'}`)"
              alt=""
            />
            <img
              class="body-galaxy-stars"
              :src="bodyArt(`galaxy-stars-${danStep > 4 ? 'lit' : 'unlit'}`)"
              alt=""
            />
          </template>
        </div>
        <div v-if="tab === 'ren'" class="body-caption">
          {{ processes.map((id) => t(`bp.${id}`)).join(' · ') }} · {{ t(`bp.${tiers[tier]}`) }}
        </div>
        <div v-else-if="tab === 'khai'" class="body-pagination">
          <EquipmentArtButton
            square-art
            :aria-label="t('bp.previous')"
            @click="page = (page + 7) % 8"
            >‹</EquipmentArtButton
          ><span>{{ page + 1 }} / 8</span
          ><EquipmentArtButton square-art :aria-label="t('bp.next')" @click="page = (page + 1) % 8"
            >›</EquipmentArtButton
          >
        </div>
        <div v-else class="body-caption">{{ t('bp.cycle') }}</div>
      </div>
      <EquipmentArtCard class="body-stat-card">
        <div class="body-card-title">
          <img :src="bodyArt(`navigation-${tab}-lit`)" alt="" />
          <h2>{{ t(`bp.${tab}`) }}</h2>
        </div>
        <p class="body-description">{{ t(`bp.${tab}Desc`) }}</p>
        <h3>{{ t('bp.progress') }}</h3>
        <div class="body-progress-value">
          {{
            tab === 'ren'
              ? t(`bp.${process}`)
              : tab === 'khai'
                ? `${khaiStep} / 10`
                : t('bp.cycle')
          }}<span>Lv. {{ step + 1 }}</span>
        </div>
        <EquipmentEnergyTube
          :fill="tab === 'ren' ? tier * 100 : tab === 'khai' ? khaiStep * 10 : danStep * 12.5"
          color="#eec76c"
        />
        <h3>{{ t('bp.stats') }}</h3>
        <dl class="body-stat-list">
          <div v-for="(id, i) in ['hp', 'defense', 'resist', 'reduction']" :key="id">
            <dt>{{ t(`bp.${id}`) }}</dt>
            <dd>{{ ['+320', '+28', '+6%', '+4%'][i] }}</dd>
          </div>
        </dl>
        <h3>{{ t('bp.materials') }}</h3>
        <div class="body-materials">
          <div v-for="(id, i) in ['crystal', 'jade', 'coin']" :key="id">
            <img
              :src="resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/controls/resource-${id}-v1.png`)"
              alt=""
            /><span>{{ ['12/10', '8/5', '3/3'][i] }}</span>
          </div>
        </div>
        <EquipmentArtButton gold class="body-upgrade" data-testid="body-upgrade" @click="upgrade">{{
          t('bp.upgrade')
        }}</EquipmentArtButton>
      </EquipmentArtCard>
    </div>
  </section>
</template>
<style scoped>
.home-body-panel {
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
  height: 48px;
  display: flex;
  align-items: center;
  gap: 30px;
  border-bottom: 1px solid #b28a43;
}
h1 {
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
.body-subtitle {
  margin: 8px 0;
  font-size: 15px;
}
.body-layout {
  height: calc(100% - 81px);
  display: grid;
  grid-template-columns: 20% 50% 30%;
  min-height: 0;
}
.body-family {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 8px 8px 8px 18px;
  isolation: isolate;
}
.family-spine {
  position: absolute;
  left: 4px;
  top: 15%;
  width: 12px;
  height: 70%;
  object-fit: fill;
  z-index: -1;
}
.body-family > button {
  height: 66px;
  padding-left: 37px;
  font-size: 17px;
  white-space: nowrap;
}
.family-icon {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 55px;
  height: 55px;
  object-fit: contain;
}
.body-center {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-height: 0;
  padding: 0 4px;
}
.body-stage {
  position: relative;
  aspect-ratio: 1215/1295;
  height: calc(100% - 35px);
  max-width: 100%;
  flex: none;
  isolation: isolate;
}
.body-silhouette {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
.body-process {
  position: absolute;
  left: 23%;
  top: 34%;
  width: 54%;
  height: 27%;
  object-fit: contain;
  pointer-events: none;
}

.body-caption {
  height: 35px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
}
.body-pagination {
  height: 35px;
  display: flex;
  align-items: center;
  gap: 25px;
  font-size: 20px;
}
.body-pagination button {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 22px;
}
.body-meridian-node {
  position: absolute;
  width: 12%;
  height: 10%;
  object-fit: contain;
  transform: translate(-50%, -50%);
  z-index: 3;
  pointer-events: none;
}
.body-meridian-line {
  position: absolute;
  height: 12px;
  transform-origin: left center;
  z-index: 2;
  pointer-events: none;
}
.body-meridian-line img {
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.meridian-flow {
  position: absolute;
  top: 43%;
  left: 8%;
  width: 84%;
  height: 14%;
  background: linear-gradient(90deg, transparent 20%, #fff3b2 45%, transparent 65%);
  background-size: 200% 100%;
  animation: meridian-flow 2.4s linear infinite;
}
.body-galaxy-piece {
  position: absolute;
  height: auto;
  transform: translate(-50%, -50%) rotate(var(--orbit-angle));
  pointer-events: none;
}
.body-galaxy-piece.orbiting {
  animation: orbit-drift 28s linear infinite;
}
.body-galaxy-stars {
  position: absolute;
  left: 34%;
  top: 46%;
  width: 32%;
  height: 20%;
  object-fit: contain;
  pointer-events: none;
}
.body-stat-card {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
}
.body-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body-card-title img {
  width: 62px;
  height: 62px;
  object-fit: contain;
}
.body-card-title h2 {
  margin: 0;
  font-size: 26px;
}
.body-description {
  font-size: 13px;
  line-height: 1.4;
  padding-bottom: 9px;
  border-bottom: 1px solid #b28a4377;
  margin: 4px 0 8px;
}
h3 {
  font-size: 15px;
  margin: 10px 0 7px;
  color: #ebd49e;
}
.body-progress-value {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}
.body-stat-list {
  margin: 0;
  flex: 1;
}
.body-stat-list > div {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid #b28a4333;
  font-size: 14px;
}
.body-stat-list dd {
  margin: 0;
  color: #a3d793;
}
.body-materials {
  display: flex;
  justify-content: space-evenly;
  gap: 6px;
}
.body-materials > div {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #a3d793;
}
.body-materials img {
  width: 43px;
  height: 43px;
  object-fit: contain;
}
.body-upgrade {
  width: 100%;
  height: 55px;
  flex: none;
  font-size: 21px;
  padding: 0;
  margin-top: 9px;
}
@keyframes meridian-flow {
  to {
    background-position: -200% 0;
  }
}
@keyframes orbit-drift {
  to {
    transform: translate(-50%, -50%) rotate(calc(var(--orbit-angle) + 360deg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .meridian-flow,
  .body-galaxy-piece.orbiting {
    animation: none;
  }
}
</style>

<style scoped>
.body-card-title img {
  width: 48px;
  height: 48px;
}
.body-card-title h2 {
  font-size: 23px;
}
.body-description {
  font-size: 12px;
  min-height: 35px;
  margin: 3px 0 4px;
  padding-bottom: 5px;
  flex: none;
}
.body-stat-card h3 {
  font-size: 14px;
  margin: 6px 0 4px;
  flex: none;
}
.body-stat-card > .equipment-energy-tube {
  flex: none;
}
.body-stat-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.body-stat-list > div {
  padding: 5px 0;
  font-size: 13px;
  flex: 1;
  align-items: center;
  min-height: 0;
}
.body-materials img {
  width: 32px;
  height: 32px;
}
.body-upgrade {
  height: 44px;
  margin-top: 6px;
  font-size: 20px;
}
.body-materials,
.body-card-title,
.body-progress-value {
  flex: none;
}
</style>

<style scoped>
.family-spine {
  left: 8px;
  top: 50%;
  width: 300px;
  height: 14px;
  object-fit: fill;
  transform: translate(-50%, -50%) rotate(90deg);
}
</style>

<style scoped>
.body-process.body-skin-layer,
.body-process.body-muscle-layer {
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.body-skin-layer {
  mask-image: linear-gradient(transparent 29%, #000 34%, #000 67%, transparent 74%);
}
.body-skin-layer img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 1px #aaaaaa);
}
.body-skin-layer.lit img {
  filter: drop-shadow(0 0 2px #ffe5a0) drop-shadow(0 0 5px #eaba4d);
}
.body-muscle-layer img {
  position: absolute;
  top: 39%;
  width: 11%;
  height: 22%;
  object-fit: contain;
  pointer-events: none;
}
.body-muscle-layer .left {
  left: 27%;
  transform: rotate(26deg);
}
.body-muscle-layer .right {
  right: 27%;
  transform: rotate(-26deg);
}
.body-process.tier-1 {
  filter: none;
}
</style>

<style scoped>
.body-blood {
  position: absolute;
  left: 18%;
  top: 33%;
  width: 64%;
  height: 35%;
  object-fit: contain;
  pointer-events: none;
  opacity: 0.7;
}
.body-spine {
  position: absolute;
  left: 48.5%;
  top: 31%;
  width: 3%;
  height: 34%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}
.body-spine img {
  width: 100%;
  height: 8%;
  object-fit: contain;
  z-index: 1;
}
.spine-core {
  position: absolute;
  top: 3%;
  bottom: 3%;
  width: 1px;
  background: #8f9397;
}
.spine-core.lit {
  background: #efca6b;
  box-shadow: 0 0 3px #eec46c;
}
.body-heart {
  position: absolute;
  left: 54%;
  top: 38%;
  width: 8%;
  height: 12%;
  object-fit: contain;
  pointer-events: none;
}
.body-forehead {
  position: absolute;
  left: 47.7%;
  top: 19%;
  width: 4.6%;
  aspect-ratio: 1;
  pointer-events: none;
}
.forehead-ring {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.forehead-node {
  position: absolute;
  width: 17%;
  height: 17%;
  object-fit: contain;
  transform: translate(-50%, -50%);
}
.body-caption {
  font-size: 14px;
}
.body-galaxy-stars {
  left: 40%;
  top: 42%;
  width: 20%;
  height: 14%;
}
.body-galaxy-piece.orbiting {
  animation-timing-function: linear;
}
</style>

<style scoped>
.body-stat-card {
  transform: translateY(-28px);
  height: 100%;
}
</style>
