<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtButton from '@/components/common/art/EquipmentArtButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
const { t } = useI18n()
const index = shallowRef(3)
const realm = shallowRef(0)
const moving = shallowRef(false)
const milestones = [1, 4, 8, 12, 13, 16, 18]
const asset = (name: string) => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${name}-v1.png`)
const paper = { backgroundImage: `url('${asset('source/shared-paper-page')}')` }
function advance() {
  if (moving.value) return
  moving.value = true
  index.value = (index.value + 1) % milestones.length
}
function tribulation() {
  if (moving.value || milestones[index.value]! < 12) return
  moving.value = true
  realm.value = (realm.value + 1) % 2
  index.value = 0
}
</script>
<template>
  <section class="home-realm-panel" :style="paper" data-testid="home-realm-panel">
    <header>
      <h1>{{ t('rp.title') }}</h1>
      <img :src="asset('controls/equipment-divider')" alt="" />
    </header>
    <p class="realm-subtitle">{{ t('rp.subtitle') }}</p>
    <div class="realm-timeline">
      <div
        class="realm-track"
        :style="{ transform: `translateX(calc(50% - ${index * 170}px))` }"
        data-testid="realm-track"
      >
        <div
          v-for="(level, i) in milestones"
          :key="level"
          class="realm-milestone"
          :class="{ current: i === index, locked: i > index }"
          :style="{ left: `${i * 170}px` }"
        >
          <img :src="asset(`realm/landscape-${(i % 3) + 1}`)" alt="" /><b>{{
            t('rp.floor', { n: level })
          }}</b
          ><span>{{ t(i < index ? 'rp.reached' : i === index ? 'rp.current' : 'rp.locked') }}</span>
        </div>
      </div>
      <Transition name="realm-card" mode="out-in" @after-enter="moving = false">
        <section
          :key="`${realm}-${index}`"
          class="realm-active-card"
          data-testid="realm-active-card"
        >
          <h2>{{ t(realm === 0 ? 'rp.mortal' : 'rp.qi') }}</h2>
          <p>
            {{
              t('rp.level', { name: t(realm === 0 ? 'rp.mortal' : 'rp.qi'), n: milestones[index] })
            }}
          </p>
          <img class="realm-meditation" :src="asset('realm/meditation')" alt="" />
          <div class="realm-cultivation">
            <span>{{ t('rp.cultivation') }}</span
            ><span>650 / 1.000</span>
          </div>
          <EquipmentEnergyTube :fill="65" color="#edc672" />
          <div class="realm-speed">
            <span>+2 / {{ t('rp.second') }}</span
            ><span>{{ t('rp.estimate') }} 2p 55s</span>
          </div>
          <h3>{{ t('rp.conditions') }}</h3>
          <ul>
            <li>
              <span class="condition-check">✓</span>{{ t('rp.level', { n: milestones[index] }) }}
            </li>
            <li><span class="condition-check">✓</span>{{ t('rp.chapter') }}</li>
          </ul>
          <div class="realm-actions">
            <EquipmentArtButton
              gold
              class="realm-upgrade"
              :aria-disabled="moving"
              data-testid="realm-upgrade"
              @click="advance"
              >{{ t('rp.advance') }}</EquipmentArtButton
            >
            <EquipmentArtButton
              :gold="milestones[index]! >= 12"
              class="realm-upgrade"
              :class="{ 'tribulation-locked': milestones[index]! < 12 }"
              :aria-disabled="moving || milestones[index]! < 12"
              data-testid="realm-tribulation"
              @click="tribulation"
              >{{ t('rp.tribulation') }}</EquipmentArtButton
            >
          </div>
        </section>
      </Transition>
    </div>
    <footer class="realm-bottom">
      <section>
        <h3>{{ t('rp.effects') }}</h3>
        <p>{{ t('rp.noEffects') }}</p>
        <small>{{ t('rp.effectHint') }}</small>
      </section>
      <section>
        <h3>{{ t('rp.introduction') }}</h3>
        <p>{{ t('rp.description') }}</p>
      </section>
    </footer>
  </section>
</template>
<style scoped>
.home-realm-panel {
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
  height: 48px;
  display: flex;
  align-items: center;
  gap: 30px;
  margin: 0;
  padding: 0;
  transform: none;
  border-bottom: 1px solid #b28a43;
}
h1 {
  position: static;
  font-size: 38px;
  line-height: 1.15;
  margin: 0;
  transform: none;
}
header img {
  width: 180px;
  height: 23px;
  object-fit: contain;
  opacity: 0.65;
}
.realm-subtitle {
  font-size: 15px;
  margin: 8px 0;
}
.realm-timeline {
  position: relative;
  height: calc(100% - 171px);
  min-height: 0;
  isolation: isolate;
}
.realm-track {
  position: absolute;
  left: 0;
  top: 35%;
  width: 100%;
  height: 150px;
  transition: transform 700ms cubic-bezier(0.25, 0.7, 0.2, 1);
  will-change: transform;
}
.realm-track:before {
  content: '';
  position: absolute;
  left: -1000px;
  right: -1000px;
  top: 48px;
  height: 4px;
  background: linear-gradient(#d4b264, #79532d, #dfc689);
}
.realm-milestone {
  position: absolute;
  width: 110px;
  margin-left: -55px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition:
    opacity 300ms,
    filter 500ms;
}
.realm-milestone img {
  width: 100px;
  height: 100px;
  object-fit: contain;
}
.realm-milestone b {
  font-size: 18px;
}
.realm-milestone span {
  font-size: 12px;
  background: #24241c;
  color: #ebd6a6;
  border: 1px solid #a48142;
  padding: 3px 13px;
}
.realm-milestone.locked img {
  filter: grayscale(1);
  opacity: 0.7;
}
.realm-milestone.current {
  opacity: 0;
}
.realm-active-card {
  position: absolute;
  left: 50%;
  top: -12px;
  transform: translateX(-50%);
  width: 270px;
  height: calc(100% + 4px);
  padding: 12px 15px;
  background: #f4e7ce;
  border: 3px double #af8540;
  box-shadow: 0 2px 5px #53351630;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 2;
  clip-path: inset(-10px);
}
.realm-active-card:before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px solid #ba985c;
  pointer-events: none;
}
.realm-active-card h2 {
  font-size: 26px;
  text-align: center;
  margin: 0;
}
.realm-active-card > p {
  text-align: center;
  margin: 0;
  font-size: 17px;
}
.realm-meditation {
  width: 100%;
  min-height: 0;
  flex: 1;
  object-fit: contain;
}
.realm-cultivation,
.realm-speed {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.realm-speed {
  font-size: 12px;
  margin-top: 2px;
}
.realm-active-card h3 {
  font-size: 14px;
  text-align: center;
  margin: 5px 0 2px;
  border-top: 1px solid #b3945a;
  padding-top: 6px;
}
.realm-active-card ul {
  padding: 0;
  list-style: none;
  margin: 0;
  font-size: 12px;
  display: grid;
  gap: 4px;
}
.condition-check {
  display: inline-grid;
  place-items: center;
  border: 1px solid #9b773b;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  background: #72824d;
  color: #f6e9c5;
  margin-right: 7px;
}
.realm-upgrade {
  height: 39px;
  flex: none;
  width: 100%;
  padding: 0;
  font-size: 19px;
  margin-top: 3px;
}
.realm-card-enter-active {
  transition:
    clip-path 450ms ease,
    opacity 450ms ease;
}
.realm-card-leave-active {
  transition:
    clip-path 250ms ease,
    opacity 250ms ease;
}
.realm-card-enter-from,
.realm-card-leave-to {
  clip-path: circle(48px at 50% 45%);
  opacity: 0.15;
}
.realm-bottom {
  height: 88px;
  border: 2px double #b28a43;
  display: grid;
  grid-template-columns: 65% 35%;
  padding: 8px 18px;
  gap: 15px;
  background: #f6e9d055;
}
.realm-bottom section + section {
  border-left: 1px solid #b28a43;
  padding-left: 18px;
}
.realm-bottom h3 {
  margin: 0 0 5px;
  font-size: 17px;
  border-bottom: 1px solid #b28a4366;
  padding-bottom: 4px;
}
.realm-bottom p {
  font-size: 13px;
  margin: 0 0 4px;
}
.realm-bottom small {
  font-size: 11px;
}
@media (prefers-reduced-motion: reduce) {
  .realm-track,
  .realm-milestone,
  .realm-card-enter-active,
  .realm-card-leave-active {
    transition: none;
  }
}
</style>
<style scoped>
.realm-active-card {
  border: 18px solid transparent;
  border-image: url('/assets/ui/tien-hiep-2026-10/realm/active-card-frame-v1.svg') 24 / 18px stretch;
  padding: 9px 12px;
  top: -20px;
  background: #f4e7ce;
}
.realm-active-card:before {
  display: none;
}
.realm-meditation {
  width: 100%;
}
</style>

<style scoped>
.realm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex: none;
  margin-top: 3px;
}
.realm-actions .realm-upgrade {
  font-size: 15px;
  height: 39px;
  margin-top: 0;
}
.tribulation-locked {
  filter: saturate(0.25);
  opacity: 0.65;
  cursor: default;
}
</style>
