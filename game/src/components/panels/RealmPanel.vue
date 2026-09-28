<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import GameButton from '@/components/common/GameButton.vue'
import BodyRefinementSection from '@/components/panels/realm/BodyRefinementSection.vue'
import MeridianSection from '@/components/panels/realm/MeridianSection.vue'
import ZhouTianSection from '@/components/panels/realm/ZhouTianSection.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { CORE_REALM_LEVEL, getCurrentRealm, getNextRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import type { RealmPassiveNode } from '@/data/realm/RealmPassiveNodes'
import { REALM_PASSIVE_NODES } from '@/data/realm/RealmPassiveNodes'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'

// 2026-08-28 - tieu canh gioi tu tang khi du tu vi (App.vue's tick(),
// khong con nut Dot pha hay checkbox). Panel chi con nut dai canh
// gioi (Quan Khi / Truc Co / Do Kiep) - tach dung 2 loai nghi le.
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n()
const requirement = useBreakthroughRequirementStore()
const { realmStatPassiveRows } = useRealmStatPassives()

const currentTier = computed(() => getRealmTier(player.realmId))
const canBreakthrough = computed(() => gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state))
// M-QI-03 - normal Truc Co read-model. The gate rows are rendered for
// EVERY realm (mortal included) so the first major breakthrough button
// never sits dead with no explanation; realms with no player-gated
// transition simply return no rows. Hidden foundation inputs are never
// rows (QI-D6).
const requirements = computed(() =>
  gameManager.realmAdvanceOps.getBreakthroughRequirements(player.$state),
)
const nextRealmName = computed(() => getNextRealm(player.realmId)?.name ?? '')
const realmName = computed(() => getCurrentRealm(player.realmId).name)
// Idle-game readout under the cultivation bar: the live per-second rate
// (same snapshot the tick writes) plus the ETA to filling this floor.
const cultivationRate = computed(() => player.cultivationPerSecond)
const cultivationEta = computed(() => {
  if (cultivationRate.value <= 0) {
    return ''
  }

  const remaining = Math.max(0, player.cultivationRequired - player.cultivation)
  return formatDuration(remaining / cultivationRate.value)
})

// Mortal needs a lit home rung (ui-audit): REALM_PASSIVE_NODES starts at
// the mortal->qi_refining reward (unlockTier 2), so a mortal player saw
// nine locked nodes and no "you are here". The display list prepends the
// mortal rung only - the authored data stays reward-shaped.
const realmNodes: RealmPassiveNode[] = [
  {
    realmId: 'mortal',
    label: getCurrentRealm('mortal').name,
    unlockTier: getRealmTier('mortal'),
    comingSoon: false,
  },
  ...REALM_PASSIVE_NODES,
]
const majorBreakthroughLabel = computed(() => {
  if (player.realmId === 'mortal') return t('panels.realm.labels.quanKhi')
  if (player.realmId === 'qi_refining') return t('panels.realm.labels.foundation')
  return nextRealmName.value || t('panels.realm.labels.majorFallback')
})

function close() { ui.closeHomeOverlays() }
function majorBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'realm'" :title="t('panels.realm.title')" width="min(1120px, 94vw)" height="min(760px, 90vh)" variant="system" @close="close">
    <div class="realm-panel paper-on-sys">
      <div class="realm-panel__cultivator">
        <div class="realm-panel__aura" />
        <PlayerPortrait variant="cultivate" :height="150" animated />
        <strong class="realm-panel__name">{{ player.name }}</strong>
        <span class="realm-panel__realm-line">{{ t('panels.realm.tierLine', { realm: realmName, level: player.realmLevel }) }}</span>
      </div>

      <div class="realm-panel__cultivation">
        <Bar
          :value="player.cultivation"
          :max="player.cultivationRequired"
          :height="24"
          pill
          variant="system"
          class="realm-panel__cultivation-bar"
        >
          <template #label><span class="realm-panel__cultivation-label">{{ Math.floor(player.cultivation) }} / {{ Math.floor(player.cultivationRequired) }} {{ t('panels.realm.cultivationUnit') }}</span></template>
        </Bar>
        <div v-if="cultivationRate > 0" class="realm-panel__cultivation-meta">
          {{ t('panels.realm.rateEta', { rate: formatNumber(cultivationRate), unit: t('panels.realm.cultivationUnit'), eta: cultivationEta }) }}
        </div>
      </div>

      <div class="realm-panel__actions">
        <GameButton :disabled="!canBreakthrough" @click="majorBreakthrough">{{ majorBreakthroughLabel }}</GameButton>

        <ul v-if="requirements.length" class="realm-requirements">
        <li
          v-for="row in requirements"
          :key="row.key"
          class="realm-requirement"
          :class="{ 'realm-requirement--met': row.met }"
        >
          <span
            class="realm-requirement__marker"
            :aria-label="row.met ? t('panels.realm.requirements.met') : t('panels.realm.requirements.unmet')"
          >{{ row.met ? '✓' : '✗' }}</span>
          <span>{{
            row.key === 'level'
              ? t('panels.realm.requirements.level', { realm: realmName, level: CORE_REALM_LEVEL })
              : t('panels.realm.requirements.chapterClear')
          }}</span>
        </li>
      </ul>
      </div>

      <div class="realm-panel__nodes" :aria-label="t('panels.realm.nodes.aria')">
        <div
          v-for="(node, index) in realmNodes"
          :key="`${node.realmId}-${index}`"
          class="realm-node"
          :class="{ 'is-current': currentTier === node.unlockTier, 'is-complete': currentTier >= node.unlockTier, 'is-locked': node.comingSoon }"
        >
          <span class="realm-node__index">{{ index }}</span>
          <strong>{{ node.label }}</strong>
          <small v-if="node.comingSoon">{{ t('panels.realm.nodes.comingSoon') }}</small>
          <small v-else-if="currentTier === node.unlockTier">{{ t('panels.realm.nodes.current') }}</small>
          <small v-else>{{ currentTier > node.unlockTier ? t('panels.realm.nodes.unlocked') : t('panels.realm.nodes.locked') }}</small>
        </div>
      </div>

      <div v-if="realmStatPassiveRows.length" class="realm-panel__passives">
        <article v-for="row in realmStatPassiveRows" :key="row.id">
          <strong>{{ row.name }}</strong><span>{{ row.description }}</span>
        </article>
      </div>

      <!-- P7-M7 - unified body progression subviews (the retired
           LuyenThePanel's tier block + the Bat Mach read-only list
           + the Chu Thien steps column). -->
      <div class="realm-panel__body">
        <div class="realm-panel__body-col">
          <Eyebrow>{{ t('panels.realm.bodyRefinement.title') }}</Eyebrow>
          <BodyRefinementSection />
        </div>
        <div class="realm-panel__body-col">
          <Eyebrow>{{ t('panels.realm.meridian.title') }}</Eyebrow>
          <MeridianSection />
        </div>
        <div class="realm-panel__body-col">
          <Eyebrow>{{ t('panels.realm.zhouTian.title') }}</Eyebrow>
          <ZhouTianSection />
        </div>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.realm-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 20px; overflow-y: auto; }
.realm-panel__cultivator { position: relative; display: flex; flex-direction: column; align-items: center; color: var(--paper-text-soft); }
.realm-panel__cultivator strong { color: var(--paper-text); font-family: var(--font-display); }

/* Paper-to-sys remap moved to the .paper-on-sys utility in
   system-theme.css (single owner; applied on .realm-panel above). */
/* Ten/canh gioi khong co co chu tuong minh truoc day (2026-08-30
   frontend-design pass: dong nhan dien quan trong nhat panel lai nho
   nhat) - nang len dung co CharacterPanel's identity block dung. */
.realm-panel__name { font-size: var(--text-title); }
.realm-panel__realm-line { font-size: var(--text-body); font-weight: 600; color: var(--jade); }
.realm-panel__cultivation-label { font-size: var(--text-md); font-weight: 700; }
.realm-panel__cultivation-meta { margin-top: 5px; text-align: center; font-size: var(--text-xs); color: var(--paper-text-muted); font-variant-numeric: tabular-nums; }
.realm-panel__aura { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--chrome-500) 25%, transparent), transparent 68%); animation: realm-breathe 3s ease-in-out infinite; }
.realm-panel__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
.realm-panel__actions :deep(button:disabled) { opacity: .38; filter: grayscale(1); }
.realm-panel__actions label { color: var(--text-secondary); }
/* M-QI-03 - normal Truc Co requirement lines (unmet muted / met jade). */
.realm-requirements { flex: 0 0 100%; display: flex; flex-direction: column; gap: 4px; align-items: center; margin: 0; padding: 0; list-style: none; }
.realm-requirement { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--text-muted); }
.realm-requirement--met { color: var(--jade); }
.realm-requirement__marker { font-weight: 700; width: 1em; text-align: center; }
.realm-panel__cultivation { width: min(560px, 90%); margin: 0 auto; }
.realm-panel__cultivation-bar { --bar-track: var(--sys-bg-0, var(--ink-950)); border: 1px solid var(--sys-line-soft, var(--ink-line)); }
/* Fit-refactor dot 3 - grid node canh gioi auto-fit theo CARD: 9 cot khi
   rong, tu xuong 5/3 cot khi hep (bo dead zone 901-957px cua media query
   viewport cu). Node khien tron giu nguyen shape qua flex min-width. */
.realm-panel__nodes { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(108px, 100%), 1fr)); gap: 8px; position: relative; }
.realm-node { position: relative; min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; color: var(--text-muted); background: var(--ink-800); border: 1px solid var(--ink-line); border-radius: 50% 50% 12px 12px; }
.realm-node:not(:last-child)::after { content: ''; position: absolute; left: 100%; top: 48%; width: 9px; height: 2px; background: var(--ink-line); }
.realm-node.is-complete { border-color: var(--jade); color: var(--jade); }
.realm-node.is-current { border-color: var(--chrome-300); color: var(--chrome-100); box-shadow: var(--shadow-glow-chrome); }
.realm-node.is-locked { filter: grayscale(1); opacity: .48; }
.realm-node__index { font: 700 var(--text-lg) var(--font-display); }
.realm-node small { font-size: var(--text-xs); }
.realm-panel__passives { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.realm-panel__passives article { display: flex; flex-direction: column; gap: 3px; padding: 10px; background: var(--ink-800); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); }
/* Ten passive truoc day khong co co chu rieng - bang het description,
   khong phan biet duoc tieu de/noi dung (2026-08-30 frontend-design pass). */
.realm-panel__passives article strong { font-size: var(--text-md); color: var(--text-primary); }
.realm-panel__passives article span { color: var(--text-muted); font-size: var(--text-sm); }
/* P7-M7 - body chapter subviews side by side on wide cards, stacked
   on narrow (same container-query convention as the realm nodes). */
.realm-panel__body { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr)); gap: 16px; }
.realm-panel__body-col { display: flex; flex-direction: column; gap: 8px; }
.realm-panel__body-col .eyebrow { margin: 0; }
@keyframes realm-breathe { 50% { transform: scale(1.08); opacity: .65; } }
/* UI-006 (Task 4) - reduced motion: aura dung yen. */
@media (prefers-reduced-motion: reduce) { .realm-panel__aura { animation: none; } }
@container overlay-panel (max-width: 900px) { .realm-node::after { display: none; } }
</style>
