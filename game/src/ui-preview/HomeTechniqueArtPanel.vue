<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from './equipment/EquipmentArtCard.vue'
import EquipmentArtButton from './equipment/EquipmentArtButton.vue'
import EquipmentEnergyTube from './equipment/EquipmentEnergyTube.vue'
import SkillNodeArtButton from './SkillNodeArtButton.vue'
const { t } = useI18n()
const selected = shallowRef(2)
const gold = shallowRef(false)
const stages = ['entry', 'minor', 'major', 'complete'] as const
const asset = (path: string) => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${path}-v1.png`)
const paper = { backgroundImage: `url('${asset('source/shared-paper-page')}')` }
</script>
<template>
  <section class="home-technique-panel" :style="paper" data-testid="home-technique-panel">
    <header>
      <h1>{{ t('tp.title') }}</h1>
      <img :src="asset('controls/equipment-divider')" alt="" />
    </header>
    <p class="technique-subtitle">{{ t('tp.subtitle') }}</p>
    <div class="technique-layout">
      <div class="technique-visual">
        <div class="manual-heading">
          <img
            :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/icons/navigation-technique-v2.png')"
            alt=""
          />
          <div>
            <h2>{{ t('tp.name') }}</h2>
            <span>{{ t('tp.quality') }}</span>
          </div>
        </div>
        <div class="manual-art-space" data-testid="technique-art-space"></div>
        <div class="technique-milestones">
          <img class="milestone-line" :src="asset('body/meridian-tube-lit')" alt="" />
          <SkillNodeArtButton
            v-for="(stage, i) in stages"
            :key="stage"
            kind="passive"
            :icon="
              asset(
                `body/navigation-${i === 0 ? 'ren' : i === 1 ? 'khai' : 'dan'}-${i === 3 ? 'unlit' : 'lit'}`,
              )
            "
            :label="t(`tp.${stage}`)"
            level=""
            :locked="i === 3"
            :selected="selected === i"
            @select="selected = i"
          />
        </div>
      </div>
      <EquipmentArtCard class="technique-stat-card">
        <div class="technique-card-heading">
          <img
            :src="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/icons/navigation-technique-v2.png')"
            alt=""
          />
          <h2>{{ t('tp.progress') }}</h2>
        </div>
        <p class="technique-rank">{{ t('tp.rank') }}</p>
        <div class="mastery-label">
          <span>{{ t('tp.mastery') }}</span
          ><span>{{ gold ? '300 / 300' : '210 / 300' }}</span>
        </div>
        <EquipmentEnergyTube :fill="gold ? 100 : 70" color="#edc672" />
        <h3>{{ t('tp.stats') }}</h3>
        <dl>
          <div v-for="(id, i) in ['power', 'defense', 'mana']" :key="id">
            <dt>{{ t(`tp.${id}`) }}</dt>
            <dd>{{ ['+120', '+80', '+12%'][i] }}</dd>
          </div>
        </dl>
        <h3>{{ t('tp.advance') }}</h3>
        <div class="grade-comparison">
          <div>
            {{ t('tp.current') }}<b>{{ t('tp.grade1') }}</b>
          </div>
          <div>
            {{ t('tp.next') }}<b>{{ t('tp.grade2') }}</b>
          </div>
        </div>
        <div class="technique-cost">
          <img :src="asset('controls/resource-crystal')" alt="" /><span>{{ t('tp.material') }}</span
          ><b>1.280 / 800</b>
        </div>
        <EquipmentArtButton
          gold
          class="technique-upgrade"
          data-testid="technique-upgrade"
          @click="gold = !gold"
          >{{ t('tp.advance') }}</EquipmentArtButton
        >
      </EquipmentArtCard>
    </div>
  </section>
</template>
<style scoped>
.home-technique-panel {
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
.technique-subtitle {
  margin: 8px 0;
  font-size: 15px;
}
.technique-layout {
  height: calc(100% - 81px);
  display: grid;
  grid-template-columns: 70% 30%;
  min-height: 0;
}
.technique-visual {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px 24px 14px;
}
.manual-heading {
  display: flex;
  align-items: center;
  gap: 14px;
}
.manual-heading > img {
  width: 58px;
  height: 58px;
  object-fit: contain;
}
.manual-heading h2 {
  margin: 0 0 5px;
  font-size: 26px;
}
.manual-heading span {
  display: inline-block;
  padding: 4px 15px;
  background: #23231d;
  color: #ead19a;
  border: 1px solid #ae8848;
  font-size: 15px;
}
.manual-art-space {
  flex: 1;
  min-height: 0;
}
.technique-milestones {
  position: relative;
  display: flex;
  align-items: start;
  justify-content: space-between;
  isolation: isolate;
  padding: 0 10px;
}
.milestone-line {
  position: absolute;
  left: 9%;
  top: 30px;
  width: 82%;
  height: 11px;
  object-fit: fill;
  z-index: -1;
}
.technique-stat-card {
  height: 100%;
  transform: translateY(-28px);
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 8px;
}
.technique-card-heading {
  display: flex;
  align-items: center;
  gap: 5px;
}
.technique-card-heading img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}
.technique-card-heading h2 {
  font-size: 22px;
  line-height: 1.2;
  margin: 0;
}
.technique-rank {
  text-align: center;
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 8px;
  padding-bottom: 14px;
  border-bottom: 1px solid #ad8b4d77;
}
.mastery-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
h3 {
  color: #ead3a1;
  font-size: 20px;
  margin: 15px 0 2px;
  border-bottom: 1px solid #ad8b4d77;
  padding-bottom: 7px;
}
dl {
  margin: 0;
  flex: 1;
}
dl > div {
  display: flex;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid #ad8b4d33;
  font-size: 15px;
}
dd {
  margin: 0;
  color: #a3d793;
}
.grade-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  text-align: center;
  font-size: 15px;
}
.grade-comparison > div + div {
  border-left: 1px solid #ad8b4d77;
}
.grade-comparison b {
  display: block;
  color: #e9c86f;
  font-size: 19px;
  margin-top: 4px;
}
.grade-comparison > div + div b {
  color: #a3d793;
}
.technique-cost {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  margin-top: 9px;
}
.technique-cost img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.technique-cost b {
  margin-left: auto;
  color: #a3d793;
  font-weight: 400;
}
.technique-upgrade {
  height: 44px;
  flex: none;
  font-size: 21px;
  padding: 0;
  margin-top: 4px;
}
</style>
<style scoped>
.home-technique-panel > header { position:relative;inset:auto;transform:none;margin:0;padding:0;height:48px;min-height:48px;overflow:visible; }
.home-technique-panel > header h1 {position:static;transform:none;margin:0;line-height:1.15;}
.technique-stat-card{gap:5px;}
.technique-stat-card > * {flex-shrink:0;}
.technique-stat-card h3{font-size:18px;margin:9px 0 0;padding-bottom:5px;}
.technique-rank{font-size:15px;padding-bottom:8px;margin-bottom:4px;}
.technique-card-heading h2{font-size:20px;}
.technique-stat-card dl{flex:1;min-height:0;display:flex;flex-direction:column;}
.technique-stat-card dl>div{flex:1;align-items:center;padding:4px 0;font-size:14px;}
.technique-cost{margin-top:4px;}
.grade-comparison{font-size:14px;}.grade-comparison b{font-size:17px;}
</style>
