<script setup lang="ts">
import { computed } from 'vue'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useBreakthrough } from '@/composables/useBreakthrough'
import { useTribulation } from '@/composables/useTribulation'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { getCurrentRealm, getNextRealm } from '@/core/realm/realmSystem'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { REALM_PASSIVE_NODES } from '@/data/realm/RealmPassiveNodes'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { breakthrough } = useBreakthrough()
const { triggerQuanKhi } = useTribulation()
const requirement = useBreakthroughRequirementStore()
const { realmStatPassiveRows } = useRealmStatPassives()

const currentTier = computed(() => getRealmTier(player.realmId))
const canChoosePath = computed(() => !player.cultivationPath && player.realmId === 'mortal' && player.realmLevel >= 12)
const canFoundation = computed(() => gameManager.canTriggerFoundationBreakthrough(player.$state))
const canRealm = computed(() => gameManager.canTriggerRealmBreakthrough(player.$state))
const nextRealmName = computed(() => getNextRealm(player.realmId)?.name ?? '')
const realmName = computed(() => getCurrentRealm(player.realmId).name)
const canMinorBreakthrough = computed(() =>
  player.realmLevel < getCurrentRealm(player.realmId).maxLevel &&
  player.cultivation >= player.cultivationRequired,
)
const majorBreakthroughLabel = computed(() => {
  if (player.realmId === 'mortal') return 'Quán Khí'
  if (player.realmId === 'qi_refining') return 'Trúc Cơ'
  return nextRealmName.value || 'Đại Cảnh Giới'
})
const canMajorBreakthrough = computed(() => {
  if (player.realmId === 'mortal') return canChoosePath.value
  if (player.realmId === 'qi_refining') return canFoundation.value
  return canRealm.value
})
const cultivationPercent = computed(() => player.cultivationRequired > 0
  ? Math.min(100, player.cultivation / player.cultivationRequired * 100)
  : 100)

function close() { ui.closeHomeOverlays() }
function majorBreakthrough() {
  if (!canMajorBreakthrough.value) return
  if (player.realmId === 'mortal') {
    triggerQuanKhi()
    return
  }
  requirement.open()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'realm'" title="Cảnh Giới" width="min(1120px, 94vw)" height="min(760px, 90vh)" @close="close">
    <div class="realm-panel">
      <div class="realm-panel__cultivator">
        <div class="realm-panel__aura" />
        <PlayerPortrait variant="cultivate" :height="150" animated />
        <strong>{{ player.name }}</strong>
        <span>{{ realmName }} · Tầng {{ player.realmLevel }}</span>
      </div>

      <div class="realm-panel__cultivation">
        <div class="realm-panel__cultivation-fill" :style="{ width: `${cultivationPercent}%` }" />
        <span>{{ Math.floor(player.cultivation) }} / {{ Math.floor(player.cultivationRequired) }} Tu Vi</span>
      </div>

      <div class="realm-panel__actions">
        <button type="button" :disabled="!canMinorBreakthrough" @click="breakthrough()">Đột phá</button>
        <button type="button" :disabled="!canMajorBreakthrough" @click="majorBreakthrough">{{ majorBreakthroughLabel }}</button>
        <label><input type="checkbox" :checked="ui.isAutoBreakthrough" @change="ui.toggleAutoBreakthrough()"> Tự động đột phá</label>
      </div>

      <div class="realm-panel__nodes" aria-label="Tiến trình chín cảnh giới">
        <div
          v-for="(node, index) in REALM_PASSIVE_NODES"
          :key="node.realmId"
          class="realm-node"
          :class="{ 'is-current': currentTier === node.unlockTier, 'is-complete': currentTier >= node.unlockTier, 'is-locked': node.comingSoon }"
        >
          <span class="realm-node__index">{{ index + 1 }}</span>
          <strong>{{ node.label }}</strong>
          <small v-if="node.comingSoon">Sắp ra mắt</small>
          <small v-else>{{ currentTier >= node.unlockTier ? 'Đã lĩnh ngộ' : 'Chưa mở' }}</small>
        </div>
      </div>

      <div v-if="realmStatPassiveRows.length" class="realm-panel__passives">
        <article v-for="row in realmStatPassiveRows" :key="row.id">
          <strong>{{ row.name }}</strong><span>{{ row.description }}</span>
        </article>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.realm-panel { min-height: 100%; display: flex; flex-direction: column; gap: 18px; padding: 20px; }
.realm-panel__cultivator { position: relative; display: flex; flex-direction: column; align-items: center; color: var(--text-secondary); }
.realm-panel__cultivator strong { color: var(--gold-500); font-family: var(--font-display); }
.realm-panel__aura { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, rgba(255,213,79,.25), transparent 68%); animation: realm-breathe 3s ease-in-out infinite; }
.realm-panel__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
.realm-panel__actions button { min-height: 38px; padding: 6px 16px; color: var(--gold-ink); font-weight: 700; background: var(--gold-500); border: 0; border-radius: var(--radius-sm); cursor: pointer; }
.realm-panel__actions button:disabled { opacity: .38; filter: grayscale(1); cursor: not-allowed; }
.realm-panel__actions label { color: var(--text-secondary); }
.realm-panel__cultivation { position: relative; width: min(560px, 90%); height: 24px; margin: 0 auto; overflow: hidden; background: var(--ink-950); border: 1px solid var(--ink-line); border-radius: 999px; }
.realm-panel__cultivation-fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, var(--jade), var(--gold-500)); }
.realm-panel__cultivation span { position: relative; z-index: 1; display: grid; height: 100%; place-items: center; color: var(--text-primary); font-size: var(--text-xs); }
.realm-panel__nodes { display: grid; grid-template-columns: repeat(9, minmax(82px, 1fr)); gap: 8px; position: relative; }
.realm-node { position: relative; min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; color: var(--text-muted); background: var(--ink-800); border: 1px solid var(--ink-line); border-radius: 50% 50% 12px 12px; }
.realm-node:not(:last-child)::after { content: ''; position: absolute; left: 100%; top: 48%; width: 9px; height: 2px; background: var(--ink-line); }
.realm-node.is-complete { border-color: var(--jade); color: var(--jade); }
.realm-node.is-current { border-color: var(--gold-500); color: var(--gold-500); box-shadow: var(--shadow-glow-gold); }
.realm-node.is-locked { filter: grayscale(1); opacity: .48; }
.realm-node__index { font: 700 1rem var(--font-display); }
.realm-node small { font-size: var(--text-xs); }
.realm-panel__passives { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.realm-panel__passives article { display: flex; flex-direction: column; gap: 3px; padding: 10px; background: var(--ink-800); border: 1px solid var(--ink-line-soft); border-radius: var(--radius-sm); }
.realm-panel__passives article span { color: var(--text-muted); font-size: var(--text-sm); }
@keyframes realm-breathe { 50% { transform: scale(1.08); opacity: .65; } }
@media (max-width: 900px) { .realm-panel__nodes { grid-template-columns: repeat(3, 1fr); } .realm-node::after { display: none; } }
</style>
