<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import PlayerPortrait from '@/components/common/PlayerPortrait.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import Eyebrow from '@/components/common/primitives/Eyebrow.vue'
import GameButton from '@/components/common/GameButton.vue'
import BodyRefinementSection from '@/components/panels/realm/BodyRefinementSection.vue'
import MeridianSection from '@/components/panels/realm/MeridianSection.vue'
import ZhouTianSection from '@/components/panels/realm/ZhouTianSection.vue'
import BodyChapterNav, { type BodyChapterEntry } from '@/components/panels/realm/BodyChapterNav.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { CORE_REALM_LEVEL, getCurrentRealm, getNextRealm } from '@/core/realm/realmSystem'
import { isBeyondReleaseCeiling, progressionCeilingRealmId } from '@/core/realm/ReleasePolicy'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import type { RealmPassiveNode } from '@/data/realm/RealmPassiveNodes'
import { REALM_PASSIVE_NODES } from '@/data/realm/RealmPassiveNodes'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'
import type { BodyChapterId } from '@/core/realm/body/BodyChapter'
import { getBodyChapterProgress, isBodyChapterUnlocked } from '@/core/realm/body/BodyProgressionSystem'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

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
const nextRealmName = computed(() => getNextRealm(player.realmId)?.name ?? '')
// FE-17 - release-ceiling readout: at Truc Co the "Kim Dan" button is
// disabled by ReleasePolicy (authored but dormant), not by an unmet
// requirement, so the requirements list alone gives no explanation.
const nextRealmBeyondCeiling = computed(() => {
  const next = getNextRealm(player.realmId)
  return next != null && isBeyondReleaseCeiling(next.id)
})
const ceilingRealmName = computed(() => getCurrentRealm(progressionCeilingRealmId).name)
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

// ---- SS20 Dao The / Kinh Mach - chapter rail + silhouette + detail ----
const BODY_CHAPTER_LABEL_KEYS: Record<BodyChapterId, string> = {
  body_refinement: 'panels.realm.bodyRefinement.title',
  meridian: 'panels.realm.meridian.title',
  zhou_tian: 'panels.realm.zhouTian.title',
}
const BODY_CHAPTER_ORDER: readonly BodyChapterId[] = ['body_refinement', 'meridian', 'zhou_tian']

const bodyChapters = computed<BodyChapterEntry[]>(() => {
  stateVersion.value

  return BODY_CHAPTER_ORDER.map(id => {
    const progress = getBodyChapterProgress(player.$state, id)
    return {
      id,
      label: t(BODY_CHAPTER_LABEL_KEYS[id]),
      unlocked: isBodyChapterUnlocked(player.$state, id),
      completed: progress.completed,
      total: progress.total,
    }
  })
})

const selectedChapter = ref<BodyChapterId | null>(null)
// Default view = the first unlocked chapter still in progress.
const activeChapter = computed<BodyChapterId>(
  () =>
    selectedChapter.value
    ?? bodyChapters.value.find(chapter => chapter.unlocked && chapter.completed < chapter.total)?.id
    ?? bodyChapters.value.find(chapter => chapter.unlocked)?.id
    ?? 'body_refinement',
)

// Bound dynamically: a literal src="/assets/..." would be rewritten to a
// module import by the vite plugin, which breaks jsdom mounts.
const BODY_FIGURE_SRC = resolveAssetUrl('/assets/ui/stat-meridian-figure.png')

// SS20 upgrade feedback - a landed chapter invest flashes the body
// silhouette (the "localized body glow" beat); the row-level ignition
// flash lives inside each section.
const bodyIgniting = ref(false)
let igniteTimer: ReturnType<typeof setTimeout> | undefined

const bodyCompletedTotal = computed(() =>
  bodyChapters.value.reduce((sum, chapter) => sum + chapter.completed, 0),
)

watch(bodyCompletedTotal, (now, before) => {
  if (now <= before) {
    return
  }

  bodyIgniting.value = true
  clearTimeout(igniteTimer)
  igniteTimer = setTimeout(() => {
    bodyIgniting.value = false
  }, 1400)
})

onBeforeUnmount(() => clearTimeout(igniteTimer))

function close() { ui.closeHomeOverlays() }
function majorBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'realm'" :title="t('panels.realm.title')" width="min(1120px, 94vw)" height="min(760px, 90vh)" variant="system" @close="close">
    <div class="realm-panel paper-on-sys">
      <!-- Study Mode SS8.2 - hero subject (Thien Lo path) + info rail. -->
      <div class="realm-panel__study">
        <div class="realm-panel__hero">
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

        <aside class="realm-panel__rail">
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
        </aside>
      </div>

      <!-- Action rail (SS8.2) - the dominant breakthrough CTA keeps the
           requirements block inside it (spec v2 sec.3.2 pin). -->
      <div class="realm-panel__actions">
        <GameButton :disabled="!canBreakthrough" @click="majorBreakthrough">{{ majorBreakthroughLabel }}</GameButton>

        <p v-if="nextRealmBeyondCeiling" class="realm-ceiling-note">
          {{ t('panels.realm.ceilingNote', { realm: nextRealmName, ceiling: ceilingRealmName }) }}
        </p>

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

      <!-- SS20 Dao The / Kinh Mach - chapter rail left, silhouette
           center, active chapter (cost/requirement/gains) right. -->
      <div class="realm-panel__body">
        <Eyebrow>{{ t('panels.realm.body.title') }}</Eyebrow>

        <div class="realm-panel__body-grid">
          <BodyChapterNav
            :chapters="bodyChapters"
            :active-id="activeChapter"
            @select="id => { selectedChapter = id }"
          />

          <div class="realm-panel__silhouette" :class="{ 'is-igniting': bodyIgniting }">
            <img class="realm-panel__silhouette-figure" :src="BODY_FIGURE_SRC" alt="" aria-hidden="true" />
          </div>

          <div class="realm-panel__chapter">
            <BodyRefinementSection v-if="activeChapter === 'body_refinement'" />
            <MeridianSection v-else-if="activeChapter === 'meridian'" />
            <ZhouTianSection v-else />
          </div>
        </div>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.realm-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 18px; padding: 20px; overflow-y: auto; }
.realm-panel__cultivator { position: relative; display: flex; flex-direction: column; align-items: center; color: var(--paper-text-soft); }
.realm-panel__cultivator strong { color: var(--paper-text); font-family: var(--font-display); }

/* Study Mode SS8.2 - hero + information rail. */
.realm-panel__study { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 270px); gap: 18px; align-items: start; }
.realm-panel__hero { min-width: 0; }
.realm-panel__rail { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

/* Paper-to-sys remap moved to the .paper-on-sys utility in
   system-theme.css (single owner; applied on .realm-panel above). */
/* Ten/canh gioi khong co co chu tuong minh truoc day (2026-08-30
   frontend-design pass: dong nhan dien quan trong nhat panel lai nho
   nhat) - nang len dung co CharacterPanel's identity block dung. */
.realm-panel__name { font-size: var(--text-title); }
.realm-panel__realm-line { font-size: var(--text-body); font-weight: 600; color: var(--hk-jade, var(--jade)); }
.realm-panel__cultivation-label { font-size: var(--text-md); font-weight: 700; }
.realm-panel__cultivation-meta { margin-top: 5px; text-align: center; font-size: var(--text-xs); color: var(--paper-text-muted); font-variant-numeric: tabular-nums; }
.realm-panel__aura { position: absolute; width: 170px; height: 170px; border-radius: 50%; background: radial-gradient(circle, var(--hk-glow-jade, color-mix(in srgb, var(--chrome-500) 25%, transparent)), transparent 68%); animation: realm-breathe 3s ease-in-out infinite; }
.realm-panel__actions { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px; padding-top: 4px; border-top: 1px solid var(--hk-border-muted, var(--ink-line)); }
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
.realm-panel__nodes { display: flex; flex-direction: column-reverse; gap: 10px; position: relative; padding: 14px 0 6px; }
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

/* SS20 - chapter nav | silhouette | active chapter detail. */
.realm-panel__body { display: flex; flex-direction: column; gap: 8px; }
.realm-panel__body .eyebrow { margin: 0; }
.realm-panel__body-grid { display: grid; grid-template-columns: minmax(140px, 180px) minmax(140px, 200px) minmax(0, 1fr); gap: 16px; align-items: start; }
.realm-panel__silhouette {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 8px;
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 8px);
  background: var(--hk-surface-base, #0b0f0d);
}
.realm-panel__silhouette::before {
  content: '';
  position: absolute;
  inset: 8% 14%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--hk-glow-jade, rgba(63, 166, 139, 0.35)), transparent 72%);
  opacity: 0.35;
  pointer-events: none;
}
.realm-panel__silhouette-figure { position: relative; width: 100%; height: auto; max-width: 170px; }
/* Landed-invest flash: gold wash sweeps the silhouette, then settles. */
.realm-panel__silhouette.is-igniting { animation: realm-ignite-flash 1400ms var(--hk-ease-standard, ease) 1; }
.realm-panel__silhouette.is-igniting::before { opacity: 0.8; }
.realm-panel__chapter { min-width: 0; }

@keyframes realm-ignite-flash {
  0% { box-shadow: inset 0 0 0 0 var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  35% { box-shadow: inset 0 0 34px 6px var(--hk-glow-gold, rgba(232, 195, 90, 0.35)); }
  100% { box-shadow: inset 0 0 0 0 transparent; }
}

@keyframes realm-breathe { 50% { transform: scale(1.08); opacity: .65; } }
/* UI-006 (Task 4) - reduced motion: aura dung yen; ignite flash giu
   state class, khong sweep. */
@media (prefers-reduced-motion: reduce) {
  .realm-panel__aura { animation: none; }
  .realm-panel__silhouette.is-igniting { animation: none; }
}
@container overlay-panel (max-width: 860px) {
  .realm-panel__study { grid-template-columns: 1fr; }
  .realm-panel__body-grid { grid-template-columns: 1fr; }
  .realm-panel__nodes { padding-left: 30px; }
  .realm-panel__nodes::before { left: 10px; }
  .realm-node { width: 100%; }
  .realm-node:nth-child(odd) .realm-node__rune,
  .realm-node:nth-child(even) .realm-node__rune { left: -25px; right: auto; }
  .realm-node:nth-child(odd)::after,
  .realm-node:nth-child(even)::after { left: -21px; right: auto; width: 21px; }
}
</style>
