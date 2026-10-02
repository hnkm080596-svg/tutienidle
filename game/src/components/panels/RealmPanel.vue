<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { CORE_REALM_LEVEL, getCurrentRealm } from '@/core/realm/realmSystem'
import {
  betaNextRealmSurfaceFor,
  betaRealmLadderNodes,
} from '@/core/betaScopeSurface'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'

// 2026-08-28 - tieu canh gioi tu tang khi du tu vi (App.vue's tick(),
// khong con nut Dot pha hay checkbox). Panel chi con nut dai canh
// gioi (Quan Khi / Truc Co / Do Kiep) - tach dung 2 loai nghi le.
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n()
const requirement = useBreakthroughRequirementStore()
const { realmStatPassiveRows } = useRealmStatPassives()
const { stateVersion } = useStateVersion()

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
// BETA SCOPE LOCK v2 (Phase-6): the next-realm surface comes from the
// canonical read-model - null when the next realm is beyond the release
// ceiling (Truc Co -> Kim Dan), so no breakthrough CTA or ceiling teaser
// can render there.
const nextRealmSurface = computed(() => betaNextRealmSurfaceFor(player.$state))
const nextRealmName = computed(() => nextRealmSurface.value?.nextRealmName ?? '')
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
// BETA SCOPE LOCK v2 (Phase-6): the rail is the canonical filtered list
// - post-ceiling nodes (Kim Dan+) are scope-hidden, not shown as
// coming-soon teasers.
const realmNodes = betaRealmLadderNodes()

// Huyen Kim SS16 (Thien Lo) - the next unreached authored rung is the
// "available" milestone: gold trace + mist separation on the path.
const nextTier = computed(
  () => realmNodes.find(node => !node.comingSoon && node.unlockTier > currentTier.value)?.unlockTier ?? null,
)

const pathTopTier = realmNodes[realmNodes.length - 1]!.unlockTier
// The climbed share of the spine glows jade; the rest stays ink.
const pathProgress = computed(() =>
  Math.min(100, Math.max(0, (currentTier.value / pathTopTier) * 100)),
)
const majorBreakthroughLabel = computed(() => {
  if (player.realmId === 'mortal') return t('panels.realm.labels.quanKhi')
  if (player.realmId === 'qi_refining') return t('panels.realm.labels.foundation')
  return nextRealmName.value || t('panels.realm.labels.majorFallback')
})

// Body/Meridian/Zhou Tian moved to BodyPanel.vue (Huyen Kim scene 08) -
// Realm keeps only the Thien Lo ascent + breakthrough ceremony.
function close() { ui.closeHomeOverlays() }
function majorBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}
</script>

<template>
  <ImperialScrollScene
    scene="realm" :open="ui.standalonePanel === 'realm'" :title="t('panels.realm.title')" @close="close">
    <div class="realm-scene">
      <!-- Scene 05 spec: the Thien Lo ascent map is the dominant region;
           the parallax vista fills it, the 18-rung path rides above. -->
      <div class="realm-scene__ascent">
        <HuyenKimParallaxStack stack="realm-ascent" />
        <div
          class="realm-panel__nodes"
          :aria-label="t('panels.realm.nodes.aria')"
          :style="{ '--path-progress': `${pathProgress}%` }"
        >
          <div
            v-for="(node, index) in realmNodes"
            :key="`${node.realmId}-${index}`"
            class="realm-node"
            :class="{
              'is-current': currentTier === node.unlockTier,
              'is-complete': currentTier >= node.unlockTier,
              'is-locked': node.comingSoon,
              'is-next': node.unlockTier === nextTier,
              'is-future': !node.comingSoon && node.unlockTier > currentTier && node.unlockTier !== nextTier,
            }"
          >
            <span class="realm-node__rune" aria-hidden="true" />
            <span v-if="currentTier === node.unlockTier" class="realm-node__seal" aria-hidden="true">{{ player.name.charAt(0) }}</span>
            <span class="realm-node__index">{{ index }}</span>
            <strong>{{ node.label }}</strong>
            <small v-if="node.comingSoon">{{ t('panels.realm.nodes.comingSoon') }}</small>
            <small v-else-if="currentTier === node.unlockTier">{{ t('panels.realm.nodes.current') }}</small>
            <small v-else-if="currentTier > node.unlockTier">{{ t('panels.realm.nodes.unlocked') }}</small>
            <small v-else-if="node.unlockTier === nextTier">{{ t('panels.realm.nodes.next') }}</small>
            <small v-else>{{ t('panels.realm.nodes.locked') }}</small>
          </div>
        </div>
      </div>

      <!-- Right rail: cultivator card -> cultivation -> passives ->
           requirements -> breakthrough CTA (spec 05 rail stack). -->
      <aside class="realm-scene__rail">
        <div class="realm-panel__cultivator">
          <div class="realm-panel__aura" />
          <PlayerPortrait variant="cultivate" :height="130" animated />
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

        <div v-if="realmStatPassiveRows.length" class="realm-panel__passives">
          <article v-for="row in realmStatPassiveRows" :key="row.id">
            <strong>{{ row.name }}</strong><span>{{ row.description }}</span>
          </article>
        </div>

        <!-- Action block (spec v2 sec.3.2 pin kept): the dominant
             breakthrough CTA owns the requirements block. -->
        <div class="realm-panel__actions">
          <GameButton v-if="nextRealmSurface" :disabled="!canBreakthrough" @click="majorBreakthrough">{{ majorBreakthroughLabel }}</GameButton>

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
      </aside>
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Scene 05 layout: ascent map dominant (vista + rung path) beside the
   cultivator/requirements/CTA rail. */
.realm-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 18px;
  padding: 6px 2px;
}
.realm-scene__ascent {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border-radius: var(--hk-radius-md, 8px);
}
.realm-scene__ascent .hk-parallax-stack { z-index: 0; }
.realm-scene__rail { display: flex; flex-direction: column; gap: 12px; min-width: 0; overflow-y: auto; mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%); }

.realm-panel__cultivator { position: relative; display: flex; flex-direction: column; align-items: center; color: var(--paper-text-soft); }
.realm-panel__cultivator strong { color: var(--paper-text); font-family: var(--font-display); }
.realm-panel__nodes { z-index: 1; }
/* Ten/canh gioi khong co co chu tuong minh truoc day (2026-08-30
   frontend-design pass: dong nhan dien quan trong nhat panel lai nho
   nhat) - nang len dung co CharacterPanel's identity block dung. */
.realm-panel__name { font-size: var(--text-title); }
.realm-panel__realm-line { font-size: var(--text-body); font-weight: 600; color: var(--hk-jade, var(--jade)); }
.realm-panel__cultivation-label { font-size: var(--text-md); font-weight: 700; }
.realm-panel__cultivation-meta { margin-top: 5px; text-align: center; font-size: var(--text-xs); color: var(--paper-text-muted); font-variant-numeric: tabular-nums; }
.realm-panel__aura { position: absolute; width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle, var(--hk-glow-jade, color-mix(in srgb, var(--chrome-500) 25%, transparent)), transparent 68%); animation: realm-breathe 3s ease-in-out infinite; }
.realm-panel__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--hk-border-muted, var(--ink-line)); }
.realm-panel__actions :deep(button:disabled) { opacity: .38; filter: grayscale(1); }
.realm-panel__actions label { color: var(--text-secondary); }
/* M-QI-03 - normal Truc Co requirement lines (unmet muted / met jade). */
.realm-requirements { flex: 0 0 100%; display: flex; flex-direction: column; gap: 4px; align-items: center; margin: 0; padding: 0; list-style: none; }
.realm-requirement { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--text-muted); }
.realm-requirement--met { color: var(--hk-jade, var(--jade)); }
.realm-requirement__marker { font-weight: 700; width: 1em; text-align: center; }
/* FE-17 - release-ceiling explanation under the dead major-realm button. */
.realm-ceiling-note { flex: 0 0 100%; margin: 0; text-align: center; font-size: var(--text-sm); color: var(--text-muted); }
.realm-panel__cultivation { width: 100%; }
.realm-panel__cultivation-bar { --bar-track: var(--sys-bg-0, var(--ink-950)); border: 1px solid var(--sys-line-soft, var(--ink-line)); }

/* SS16 Thien Lo - vertical milestone path, mortal rung at the bottom.
   The center spine's climbed share is jade (--path-progress); rung
   cards alternate sides and connect to the spine by a short trace. */
.realm-panel__nodes { display: flex; flex-direction: column-reverse; gap: 10px; position: relative; height: 100%; padding: 14px 0 20px; overflow-y: auto; mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%); }
.realm-panel__nodes::before {
  content: '';
  position: absolute;
  top: 18px;
  bottom: 10px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: linear-gradient(
    to top,
    var(--hk-jade, #3fa68b) var(--path-progress, 0%),
    var(--hk-border-muted, #2a352f) var(--path-progress, 0%)
  );
}
/* Mist veil over the summit - the release-ceiling rungs fade into it. */
.realm-panel__nodes::after {
  content: '';
  position: absolute;
  left: 50%;
  top: -10px;
  width: 220px;
  height: 46px;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, color-mix(in srgb, var(--hk-text-secondary, #b8ae97) 15%, transparent), transparent 72%);
  filter: blur(5px);
  pointer-events: none;
}
.realm-node {
  position: relative;
  width: calc(50% - 30px);
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  text-align: left;
  color: var(--hk-text-secondary, #b8ae97);
  background: var(--hk-surface-raised, #131b17);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
}
.realm-node:nth-child(odd) { align-self: flex-start; }
.realm-node:nth-child(even) { align-self: flex-end; }
/* Rune dot on the spine + the short trace from the card edge. */
.realm-node__rune {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  transform: translateY(-50%);
  background: var(--hk-ink, #5b6266);
  box-shadow: 0 0 0 2px var(--hk-surface-base, #0b0f0d);
}
.realm-node:nth-child(odd) .realm-node__rune { right: -35px; }
.realm-node:nth-child(even) .realm-node__rune { left: -35px; }
.realm-node::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30px;
  height: 1px;
  background: var(--hk-border-muted, #2a352f);
}
.realm-node:nth-child(odd)::after { right: -30px; }
.realm-node:nth-child(even)::after { left: -30px; }

/* State semantics SS47/SS48 - complete: restrained jade; current: jade
   + player seal; next (available): gold trace; future/locked: ink. */
.realm-node.is-complete { border-color: var(--hk-jade-deep, #1f6b58); color: var(--hk-text-primary, #ede6d6); }
.realm-node.is-complete .realm-node__rune { background: var(--hk-jade, #3fa68b); }
.realm-node.is-complete::after { background: var(--hk-jade-deep, #1f6b58); }
.realm-node.is-current {
  border-color: var(--hk-jade, #3fa68b);
  box-shadow: 0 0 14px var(--hk-glow-jade, rgba(63, 166, 139, 0.35));
}
.realm-node.is-current .realm-node__rune { background: var(--hk-jade-soft, #67c4ab); box-shadow: 0 0 8px var(--hk-glow-jade, rgba(63, 166, 139, 0.35)), 0 0 0 2px var(--hk-surface-base, #0b0f0d); }
.realm-node.is-next { border-color: var(--hk-gold, #c99a4a); color: var(--hk-text-primary, #ede6d6); }
.realm-node.is-next .realm-node__rune { background: var(--hk-gold-bright, #e8c35a); box-shadow: 0 0 8px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)), 0 0 0 2px var(--hk-surface-base, #0b0f0d); }
.realm-node.is-next::after { background: var(--hk-gold-muted, #7a6234); }
.realm-node.is-future { opacity: 0.6; }
.realm-node.is-locked { filter: grayscale(0.7); opacity: 0.5; }

/* Player seal on the current rung (SS16 "player seal/avatar"). */
.realm-node__seal {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid var(--hk-border-ceremony, #e8c35a);
  border-radius: 3px;
  background: color-mix(in srgb, var(--hk-jade, #3fa68b) 24%, var(--hk-surface-base, #0b0f0d));
  color: var(--hk-jade-soft, #67c4ab);
  font: 700 var(--text-xs) var(--font-display);
}
.realm-node__index { font: 700 var(--text-md) var(--font-display); color: var(--hk-text-muted, #7a7260); }
.realm-node.is-complete .realm-node__index,
.realm-node.is-current .realm-node__index { color: var(--hk-jade, #3fa68b); }
.realm-node.is-next .realm-node__index { color: var(--hk-gold, #c99a4a); }
.realm-node strong { font-size: var(--text-sm); font-weight: 600; }
.realm-node small { font-size: var(--text-xs); color: var(--hk-text-muted, #7a7260); }
.realm-node.is-current small { color: var(--hk-jade-soft, #67c4ab); }
.realm-node.is-next small { color: var(--hk-gold, #c99a4a); }

.realm-panel__passives { display: flex; flex-direction: column; gap: 8px; }
.realm-panel__passives article { display: flex; flex-direction: column; gap: 3px; padding: 10px; background: var(--hk-surface-raised, var(--ink-800)); border: 1px solid var(--hk-border-muted, var(--ink-line-soft)); border-radius: var(--radius-sm); }
/* Ten passive truoc day khong co co chu rieng - bang het description,
   khong phan biet duoc tieu de/noi dung (2026-08-30 frontend-design pass). */
.realm-panel__passives article strong { font-size: var(--text-md); color: var(--hk-text-primary, var(--text-primary)); }
.realm-panel__passives article span { color: var(--hk-text-secondary, var(--text-muted)); font-size: var(--text-sm); }

@keyframes realm-breathe { 50% { transform: scale(1.08); opacity: .65; } }
/* UI-006 (Task 4) - reduced motion: aura dung yen. */
@media (prefers-reduced-motion: reduce) {
  .realm-panel__aura { animation: none; }
}
@container (max-width: 860px) {
  .realm-scene { grid-template-columns: 1fr; grid-template-rows: minmax(0,1fr) auto; overflow-y: auto; }
  .realm-scene__rail { overflow-y: visible; }
  .realm-panel__nodes { padding-left: 30px; }
  .realm-panel__nodes::before { left: 10px; }
  .realm-node { width: 100%; }
  .realm-node:nth-child(odd) .realm-node__rune,
  .realm-node:nth-child(even) .realm-node__rune { left: -25px; right: auto; }
  .realm-node:nth-child(odd)::after,
  .realm-node:nth-child(even)::after { left: -21px; right: auto; width: 21px; }
}
</style>
