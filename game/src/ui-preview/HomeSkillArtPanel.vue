<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import SkillNodeArtButton from '@/components/common/SkillNodeArtButton.vue'
import { useI18n } from 'vue-i18n'
import type { SkillUiNode, SkillUiEdge } from '@/components/scenes/skill/fidelity/skillUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
const { t } = useI18n()
function nodeKind(id: string): 'parent' | 'main' | 'sub' | 'passive' { return id === 'core' ? 'parent' : id === 'root' ? 'main' : id === 'passive' ? 'passive' : 'sub' }
const elementIds = ['fire', 'wood', 'water', 'metal', 'earth'] as const
type ElementId = typeof elementIds[number]
const element = shallowRef<ElementId>('fire')
const selectedId = shallowRef('root')
const notice = shallowRef('')
const elements = computed(() => elementIds.map(id => ({ id, label: t(`element.${id}`), icon: resolveAssetUrl(`/assets/ui/elements/el-${id}.png`) })))
const nodes = computed<SkillUiNode[]>(() => {
  const icon = resolveAssetUrl(`/assets/ui/elements/el-${element.value}.png`)
  const make = (id: string, name: string, x: number, y: number, state: SkillUiNode['state'], level: string): SkillUiNode => ({
    id, name, icon, x, y, state, level,
    description: id === 'root' && element.value === 'fire' ? t('fireDescription') : t('description'),
    experience: '1.240 / 2.500',
    stats: [{ id: 'effect', label: t('effect'), value: t('effectValue') }],
    conditions: state === 'locked' ? [t('lockedHint')] : [],
    costLabel: state === 'learned' ? '' : t('costSample'),
    actionLabel: state === 'learned' ? '' : state === 'available' ? t('upgrade') : t('upgrade'),
    actionDisabled: state !== 'available',
    actionHint: state === 'locked' ? t('fixtureNote') : '',
  })
  return [make('core', t('skillName.core'), 355, 195, 'learned', '3 / 10'), make('root', t(`skillName.${element.value}`), 355, 36, 'learned', '3 / 10'), make('a', t(`branch.${element.value}.a`), 169, 148, 'learned', '1 / 5'), make('b', t(`branch.${element.value}.b`), 540, 148, 'available', '0 / 5'), make('passive', t(`branch.${element.value}.passive`), 169, 310, 'available', '0 / 5'), make('future-a', t('future'), 355, 359, 'locked', '0 / 5'), make('future-b', t('future'), 540, 310, 'locked', '0 / 5')]
})
const edges: readonly SkillUiEdge[] = [{ from: 'core', to: 'root' }, { from: 'core', to: 'a' }, { from: 'core', to: 'b' }, { from: 'a', to: 'passive' }, { from: 'core', to: 'future-a' }, { from: 'b', to: 'future-b' }]
const connections = computed(() => edges.flatMap(edge => {
  const from = nodes.value.find(node => node.id === edge.from)
  const to = nodes.value.find(node => node.id === edge.to)
  return from && to ? [{ id: edge.to, x1: from.x, y1: from.y + 30, x2: to.x, y2: to.y + 30, active: from.state === 'learned' && to.state === 'learned' }] : []
}))
const selected = computed(() => nodes.value.find(node => node.id === selectedId.value) ?? nodes.value[0] ?? null)
function chooseElement(id: string) { if (elementIds.includes(id as ElementId)) { element.value = id as ElementId; selectedId.value = 'root'; notice.value = '' } }

import PcPaperButton from '@/components/common/PcPaperButton.vue'
const panelStyle = { backgroundImage: `url("${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')}")`, '--skill-card': `url("${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')}")` }
</script><template>
<section class="home-skill-panel" :style="panelStyle" data-testid="home-skill-panel"><header><h1>{{ t('skill.title') }}</h1><nav><button v-for="item in elements" :key="item.id" :class="{active:element===item.id}" @click="chooseElement(item.id)"><img :src="item.icon" alt=""><span>{{ item.label }}</span></button></nav></header><div class="home-skill-content"><section class="home-skill-tree"><svg class="skill-connection-art" viewBox="0 0 710 460" preserveAspectRatio="none"><defs><filter id="skill-flow-glow"><feGaussianBlur stdDeviation="1.8"/></filter></defs><g v-for="line in connections" :key="line.id" :class="{ 'connection-active': line.active }"><image :href="resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/skill-connection-pipe-v1.png')" :x="line.x1" :y="line.y1-7" :width="Math.hypot(line.x2-line.x1,line.y2-line.y1)" height="14" preserveAspectRatio="none" :transform="`rotate(${Math.atan2(line.y2-line.y1,line.x2-line.x1)*180/Math.PI} ${line.x1} ${line.y1})`" /><template v-if="line.active"><line class="connection-flow connection-flow-glow" pathLength="100" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"/><line class="connection-flow" pathLength="100" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"/></template></g></svg><SkillNodeArtButton v-for="node in nodes" :key="node.id" class="positioned-skill-art-node" :style="{left:node.x/710*100+'%',top:(node.y+30)/460*100+'%'}" :kind="nodeKind(node.id)" :icon="node.icon" :label="node.name" :level="node.level" :selected="selectedId===node.id" :locked="node.state==='locked'" @select="selectedId=node.id" /></section><aside class="home-skill-card" v-if="selected"><h2>{{ selected.name }}</h2><p>{{ selected.level }} · {{ t(`skill.state.${selected.state}`) }}</p><p>{{ selected.description }}</p><h3>{{ t('skill.effects') }}</h3><dl><div v-for="row in selected.stats" :key="row.id"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl><h3>{{ t('skill.conditions') }}</h3><p>{{ selected.conditions[0] || t('skill.noConditions') }}</p><p>{{ selected.costLabel }}</p><PcPaperButton variant="secondary" :disabled="selected.actionDisabled" @click="notice=t('notice')">{{ t('upgrade') }}</PcPaperButton><p role="status">{{ notice }}</p></aside></div></section>
</template>
<style scoped>
.home-skill-panel {position:absolute;left:24%;top:12.5%;width:74%;height:75%;z-index:20;padding:20px 24px 22px;background-color:#f2e4c8;background-size:cover;background-position:center;background-repeat:no-repeat;border:3px double #b28a43;color:#302519;overflow:hidden;}.home-skill-panel header {height:83px;border-bottom:1px solid #b28a43;display:flex;justify-content:space-between;align-items:center;}.home-skill-panel h1 {font-size:38px;margin:0;}.home-skill-panel nav {display:flex;gap:15px;}.home-skill-panel nav button {background:transparent;border:0;color:#49351b;font:17px var(--pc-font-body);cursor:pointer;display:grid;justify-items:center;gap:3px;}.home-skill-panel nav img {height:36px;width:36px;object-fit:contain;}.home-skill-panel nav button.active {border-bottom:2px solid #b18940;}.home-skill-content {display:grid;grid-template-columns:1.65fr 1fr;gap:15px;height:calc(100% - 97px);margin-top:14px;}.home-skill-tree {position:relative;min-height:0;}.home-skill-tree>svg {position:absolute;inset:0;width:100%;height:100%;}.home-skill-tree small {font-size:12px;}.home-skill-card {position:relative;isolation:isolate;color:#f0dfbb;padding:18px 20px;overflow:auto;scrollbar-width:none;}.home-skill-card::before {content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;border:15px solid transparent;border-image:var(--skill-card) 90 fill /15px stretch;}.home-skill-card h2 {font-size:24px;margin:0 0 10px;border-bottom:1px solid #a98745;padding-bottom:9px;}.home-skill-card p {font-size:14px;line-height:1.45;margin:10px 0;}.home-skill-card h3 {font-size:17px;border-bottom:1px solid #a98745;padding-bottom:5px;}.home-skill-card dl {font-size:14px;}.home-skill-card dl>div {display:flex;justify-content:space-between;margin:8px 0;}.home-skill-card dd {margin:0;}.home-skill-card button {width:100%;font-size:19px;}
.positioned-skill-art-node {position:absolute;transform:translate(-50%,-50%);}.skill-connection-art {pointer-events:none;}.connection-outline {stroke:#513c1e;stroke-width:5;}.connection-base {stroke:#9d804b;stroke-width:2;}.connection-knot {fill:#e0b665;stroke:#614621;stroke-width:1.5;}.connection-active .connection-base {stroke:#d9ad56;}.connection-flow {stroke:#fff0aa;stroke-width:2;stroke-dasharray:9 91;stroke-linecap:round;animation:skill-line-energy 3s linear infinite;}.connection-flow-glow {stroke:#ffd36c;stroke-width:6;filter:url(#skill-flow-glow);opacity:.7;}@keyframes skill-line-energy {from {stroke-dashoffset:100;}to {stroke-dashoffset:0;}}@media(prefers-reduced-motion:reduce){.connection-flow {animation:none;stroke-dasharray:none;opacity:.4;}}
</style>






