<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import EquipmentArtCard from './equipment/EquipmentArtCard.vue'
import EquipmentArtButton from './equipment/EquipmentArtButton.vue'
import EquipmentArtSlot from './equipment/EquipmentArtSlot.vue'
import EquipmentEnergyTube from './equipment/EquipmentEnergyTube.vue'
import { equipmentArt } from './equipment/equipmentPreviewData'
const { t } = useI18n()
const tab = shallowRef('deploy')
const formation = shallowRef(0)
const cell = shallowRef(0)
const person = shallowRef(0)
const notice = shallowRef('')
const ids = ['qingshuangzi', 'zuofeng', 'jinglian', 'gaosheng', 'ziyuan', 'fenli', 'youzhu']
const placements = shallowRef<(number | null)[]>([0, null, 1, null, 2, null, 3, null, null])
const portrait = (i: number) =>
  resolveAssetUrl(`/assets/characters/animated/${ids[i]}/portrait/${ids[i]}-queue.png`)
const names = ['balance', 'defense', 'attack']
const picked = computed(() => placements.value[cell.value])
const paper = {
  backgroundImage: `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}')`,
  '--formation-brush': `url('${equipmentArt('equipment-tab-brush-v1')}')`,
}
function assign(i: number) {
  person.value = i
  placements.value = placements.value.map((value, index) =>
    index === cell.value ? i : value === i ? null : value,
  )
  notice.value = ''
}
function reset() {
  placements.value = [0, null, 1, null, 2, null, 3, null, null]
  notice.value = ''
}
</script>
<template>
  <section class="home-formation-panel" :style="paper" data-testid="home-formation-panel">
    <header>
      <h1>{{ t('fp.title') }}</h1>
      <img :src="equipmentArt('equipment-divider-v1')" alt="" />
    </header>
    <nav class="formation-tabs">
      <button
        v-for="id in ['deploy', 'formations', 'rank']"
        :key="id"
        :class="{ active: tab === id }"
        :aria-pressed="tab === id"
        :data-testid="`formation-tab-${id}`"
        @click="tab = id"
      >
        {{ t(`fp.${id}`) }}
      </button>
    </nav>
    <div class="formation-content">
      <div class="formation-board">
        <div class="formation-current">
          <small>{{ t('fp.current') }}</small
          ><b>{{ t(`fp.${names[formation]}`) }}</b
          ><span class="formation-mini-grid"><i v-for="n in 9" :key="n"></i></span>
        </div>
        <img class="formation-brush" :src="equipmentArt('equipment-brush-circle-v1')" alt="" />
        <div class="formation-grid">
          <button
            v-for="(occupant, i) in placements"
            :key="i"
            :class="{ selected: cell === i, locked: i === 8 }"
            :disabled="i === 8"
            :aria-label="t('fp.cell', { n: i + 1 })"
            :aria-pressed="cell === i"
            @click="cell = i"
          >
            <img class="formation-cell-frame" :src="equipmentArt('item-slot-v1')" alt="" /><img
              v-if="occupant !== null"
              class="formation-person"
              :src="portrait(occupant)"
              alt=""
            /><span v-else>{{ i === 8 ? '×' : '＋' }}</span>
          </button>
        </div>
      </div>
      <EquipmentArtCard class="formation-details"
        ><h2>{{ t(tab === 'rank' ? 'fp.rank' : 'fp.choose') }}</h2>
        <div class="formation-choices">
          <button
            v-for="(id, i) in names"
            :key="id"
            :class="{ selected: formation === i }"
            :aria-pressed="formation === i"
            @click="formation = i"
          >
            <span class="formation-mini-grid"><i v-for="n in 9" :key="n"></i></span
            ><b>{{ t(`fp.${id}`) }}</b>
          </button>
        </div>
        <template v-if="tab !== 'rank'"
          ><h3>{{ t('fp.information') }}</h3>
          <div class="formation-info-art">
            <h4>{{ t(`fp.${names[formation]}`) }}</h4>
            <p>{{ t(`fp.description${formation}`) }}</p>
          </div>
          <h3>{{ t('fp.position') }}</h3>
          <div class="formation-position">
            <img v-if="picked !== null" :src="portrait(picked!)" alt="" />
            <div>
              <b>{{ t('fp.cell', { n: cell + 1 }) }}</b>
              <p>{{ t(picked === null ? 'fp.empty' : 'fp.assigned') }}</p>
              <small>{{ t('fp.hint') }}</small>
            </div>
          </div></template
        >
        <template v-else
          ><h3>{{ t('fp.rankProgress') }}</h3>
          <EquipmentEnergyTube :fill="65" color="#e3bd65" />
          <p>{{ t('fp.rankHint') }}</p>
          <EquipmentArtButton gold @click="notice = t('fp.preview')">{{
            t('fp.rank')
          }}</EquipmentArtButton></template
        >
      </EquipmentArtCard>
    </div>
    <EquipmentArtCard class="formation-roster"
      ><div class="roster-main">
        <h3>{{ t('fp.roster') }}</h3>
        <div class="formation-roster-items">
          <EquipmentArtSlot
            v-for="(id, i) in ids"
            :key="id"
            :icon="portrait(i)"
            :label="t('fp.person', { n: i + 1 })"
            :selected="person === i"
            @select="assign(i)"
          />
        </div>
      </div>
      <div class="formation-actions">
        <EquipmentArtButton @click="reset">{{ t('fp.reset') }}</EquipmentArtButton
        ><EquipmentArtButton
          gold
          data-testid="formation-confirm"
          @click="notice = t('fp.preview')"
          >{{ t('fp.confirm') }}</EquipmentArtButton
        ><small role="status">{{ notice }}</small>
      </div></EquipmentArtCard
    >
  </section>
</template>
<style scoped>
.home-formation-panel {
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
.formation-tabs {
  display: flex;
  height: 42px;
  flex: none;
  gap: 25px;
  border-bottom: 1px solid #ac874855;
}
.formation-tabs button {
  position: relative;
  isolation: isolate;
  background: transparent;
  border: 0;
  font: 700 20px var(--pc-font-body);
  color: #382b1b;
  width: 160px;
  cursor: pointer;
}
.formation-tabs button.active:before {
  content: '';
  position: absolute;
  inset: 3px;
  z-index: -1;
  background: var(--formation-brush) center/contain no-repeat;
}
.formation-content {
  display: grid;
  grid-template-columns: 44% 56%;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 10px 12px 10px 0;
}
.formation-board {
  position: relative;
  min-height: 0;
  isolation: isolate;
}
.formation-brush {
  position: absolute;
  left: 12%;
  top: 0;
  width: 88%;
  height: 100%;
  object-fit: contain;
  opacity: 0.6;
  z-index: -1;
}
.formation-current {
  position: absolute;
  left: 0;
  top: 4%;
  width: 95px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  padding: 12px 7px;
  border: 1px solid #b69351;
  background: #292920bb;
  color: #f2dfb6;
  z-index: 2;
}
.formation-current b {
  text-align: center;
}
.formation-grid {
  position: absolute;
  left: 24%;
  top: 1%;
  bottom: 1%;
  width: 73%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 7px;
}
.formation-grid button {
  position: relative;
  border: 0;
  background: transparent;
  padding: 0;
  min-height: 0;
  cursor: pointer;
}
.formation-cell-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
.formation-person {
  position: absolute;
  inset: 8%;
  width: 84%;
  height: 84%;
  object-fit: contain;
  filter: sepia(0.3);
}
.formation-grid button > span {
  position: relative;
  color: #e7d9bd;
  font-size: 35px;
}
.formation-grid button.selected .formation-cell-frame {
  filter: brightness(1.5) drop-shadow(0 0 4px #edbc68);
}
.formation-grid button:hover:not(:disabled) .formation-cell-frame {
  filter: brightness(1.25);
}
.formation-grid button.locked {
  opacity: 0.45;
  cursor: default;
}
.formation-grid button.locked span {
  color: #c97755;
}
.formation-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding: 12px 16px;
}
.formation-details h2 {
  margin: 0;
  font-size: 20px;
}
.formation-details h3 {
  margin: 3px 0;
  font-size: 17px;
  color: #ead09a;
  border-bottom: 1px solid #b0904b77;
  padding-bottom: 5px;
}
.formation-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.formation-choices button {
  background: #1c2824;
  border: 1px solid #826737;
  color: #ead6ae;
  padding: 7px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.formation-choices button:nth-child(2) {
  background: #202c35;
}
.formation-choices button:nth-child(3) {
  background: #382923;
}
.formation-choices button.selected {
  border-color: #edc475;
  box-shadow: 0 0 5px #d9a74888;
}
.formation-choices b {
  font: 700 13px var(--pc-font-body);
}
.formation-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  width: 48px;
  height: 48px;
  align-items: center;
}
.formation-mini-grid i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #d3ac69;
  box-shadow: 0 0 3px #d7b577;
}
.formation-mini-grid i:nth-child(3n) {
  opacity: 0.45;
}
.formation-choices button:nth-child(2) i {
  background: #a9c8dc;
}
.formation-choices button:nth-child(3) i {
  background: #c76e52;
}
.formation-info-art {
  padding: 9px 12px;
  border: 1px solid #b0904b77;
  background: url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') right/cover;
  color: #38291a;
}
.formation-info-art h4 {
  margin: 0 0 5px;
  font-size: 17px;
}
.formation-info-art p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.formation-position {
  display: flex;
  gap: 15px;
  min-height: 0;
  flex: 1;
  align-items: center;
}
.formation-position img {
  width: 70px;
  height: 90px;
  object-fit: contain;
}
.formation-position b {
  font-size: 15px;
}
.formation-position p {
  font-size: 13px;
  margin: 7px 0;
}
.formation-position small {
  font-size: 11px;
  color: #c8b795;
}
.formation-roster {
  display: flex;
  gap: 18px;
  flex: none;
  height: 117px;
  padding: 8px 14px;
}
.roster-main {
  flex: 1;
  min-width: 0;
}
.roster-main h3 {
  font-size: 15px;
  margin: 0 0 5px;
}
.formation-roster-items {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7px;
  height: 76px;
}
.formation-actions {
  width: 230px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-content: center;
  gap: 7px;
}
.formation-actions button {
  height: 36px;
  font-size: 15px;
  padding: 0;
  white-space: nowrap;
}
.formation-actions small {
  grid-column: 1/-1;
  min-height: 24px;
  font-size: 11px;
  text-align: center;
}
</style>
<style scoped>
.formation-details{gap:5px;overflow:hidden;}
.formation-details>h2,.formation-details>h3,.formation-choices,.formation-info-art{flex:none;}
.formation-choices .formation-mini-grid{width:38px;height:38px;gap:4px;}
.formation-choices button{padding:5px;}
.formation-info-art{padding:6px 10px;}.formation-info-art p{font-size:12px;}
.formation-position{overflow:hidden;min-height:0;}
.formation-position img{height:100%;max-height:70px;flex:none;}
.formation-position p{margin:4px 0;}.formation-position small{display:block;max-width:230px;}
</style>
