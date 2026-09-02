<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { getCurrentRealm, getNextRealm } from '@/core/realm/realmSystem'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { REALM_PASSIVE_NODES } from '@/data/realm/RealmPassiveNodes'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'

// 2026-08-28 — tiểu cảnh giới tự tăng khi đủ tu vi (App.vue's tick(),
// không còn nút Đột phá hay checkbox). Panel chỉ còn nút đại cảnh
// giới (Quán Khí / Trúc Cơ / Độ Kiếp) — tách đúng 2 loại nghi lễ.
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n({ useScope: 'local' })
const requirement = useBreakthroughRequirementStore()
const { realmStatPassiveRows } = useRealmStatPassives()

const currentTier = computed(() => getRealmTier(player.realmId))
const canBreakthrough = computed(() => gameManager.canTriggerBreakthrough(player.$state))
const nextRealmName = computed(() => getNextRealm(player.realmId)?.name ?? '')
const realmName = computed(() => getCurrentRealm(player.realmId).name)
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
  <OverlayPanel :open="ui.standalonePanel === 'realm'" :title="t('panels.realm.title')" width="min(1120px, 94vw)" height="min(760px, 90vh)" @close="close">
    <div class="realm-panel">
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
          class="realm-panel__cultivation-bar"
        >
          <template #label><span class="realm-panel__cultivation-label">{{ Math.floor(player.cultivation) }} / {{ Math.floor(player.cultivationRequired) }} {{ t('panels.realm.cultivationUnit') }}</span></template>
        </Bar>
      </div>

      <div class="realm-panel__actions">
        <GameButton :disabled="!canBreakthrough" @click="majorBreakthrough">{{ majorBreakthroughLabel }}</GameButton>
      </div>

      <div class="realm-panel__nodes" :aria-label="t('panels.realm.nodes.aria')">
        <div
          v-for="(node, index) in REALM_PASSIVE_NODES"
          :key="node.realmId"
          class="realm-node"
          :class="{ 'is-current': currentTier === node.unlockTier, 'is-complete': currentTier >= node.unlockTier, 'is-locked': node.comingSoon }"
        >
          <span class="realm-node__index">{{ index + 1 }}</span>
          <strong>{{ node.label }}</strong>
          <small v-if="node.comingSoon">{{ t('panels.realm.nodes.comingSoon') }}</small>
          <small v-else>{{ currentTier >= node.unlockTier ? t('panels.realm.nodes.unlocked') : t('panels.realm.nodes.locked') }}</small>
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
.realm-panel__cultivator { position: relative; display: flex; flex-direction: column; align-items: center; color: var(--paper-text-soft); }
.realm-panel__cultivator strong { color: var(--paper-text); font-family: var(--font-display); }
/* Tên/cảnh giới không có cỡ chữ tường minh trước đây (2026-08-30
   frontend-design pass: dòng nhận diện quan trọng nhất panel lại nhỏ
   nhất) — nâng lên đúng cỡ CharacterPanel's identity block dùng. */
.realm-panel__name { font-size: var(--text-title); }
.realm-panel__realm-line { font-size: var(--text-body); font-weight: 600; color: var(--jade); }
.realm-panel__cultivation-label { font-size: var(--text-md); font-weight: 700; }
.realm-panel__aura { position: absolute; width: 190px; height: 190px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--chrome-500) 25%, transparent), transparent 68%); animation: realm-breathe 3s ease-in-out infinite; }
.realm-panel__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; }
.realm-panel__actions :deep(button:disabled) { opacity: .38; filter: grayscale(1); }
.realm-panel__actions label { color: var(--text-secondary); }
.realm-panel__cultivation { width: min(560px, 90%); margin: 0 auto; }
.realm-panel__cultivation-bar { --bar-track: var(--ink-950); border: 1px solid var(--ink-line); }
/* Fit-refactor đợt 3 — grid node cảnh giới auto-fit theo CARD: 9 cột khi
   rộng, tự xuống 5/3 cột khi hẹp (bỏ dead zone 901–957px của media query
   viewport cũ). Node khiên tròn giữ nguyên shape qua flex min-width. */
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
/* Tên passive trước đây không có cỡ chữ riêng — bằng hệt description,
   không phân biệt được tiêu đề/nội dung (2026-08-30 frontend-design pass). */
.realm-panel__passives article strong { font-size: var(--text-md); color: var(--text-primary); }
.realm-panel__passives article span { color: var(--text-muted); font-size: var(--text-sm); }
@keyframes realm-breathe { 50% { transform: scale(1.08); opacity: .65; } }
@container overlay-panel (max-width: 900px) { .realm-node::after { display: none; } }
</style>
