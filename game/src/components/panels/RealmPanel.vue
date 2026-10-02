<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ImperialScrollScene from '@/components/common/ImperialScrollScene.vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { getRealmTier } from '@/core/realm/RealmTierMap'
import {
  betaNextRealmSurfaceFor,
  betaRealmLadderNodes,
} from '@/core/betaScopeSurface'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'
import RealmAscentMap from '@/components/scenes/realm/RealmAscentMap.vue'
import RealmDetailRail from '@/components/scenes/realm/RealmDetailRail.vue'
import RealmIdentityCard from '@/components/scenes/realm/RealmIdentityCard.vue'
import RealmCultivationBar from '@/components/scenes/realm/RealmCultivationBar.vue'
import RealmPassiveList from '@/components/scenes/realm/RealmPassiveList.vue'
import RealmActionBlock from '@/components/scenes/realm/RealmActionBlock.vue'

// 2026-08-28 - tieu canh gioi tu tang khi du tu vi (App.vue's tick(),
// khong con nut Dot pha hay checkbox). Panel chi con nut dai canh
// gioi (Quan Khi / Truc Co / Do Kiep) - tach dung 2 loai nghi le.
//
// Huyen Kim scene 05 (Thien Lo) scaffold: the panel is now a thin
// composition root over components/scenes/realm/* - one component per
// spec region (ascent-map, realm-card, cultivation-bar, passives,
// requirements, breakthrough-cta). All read-models unchanged.
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
const realm = computed(() => getCurrentRealm(player.realmId))
const realmName = computed(() => realm.value.name)
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
const rateText = computed(() =>
  cultivationRate.value > 0
    ? t('panels.realm.meta.rateValue', { rate: formatNumber(cultivationRate.value), unit: t('panels.realm.cultivationUnit') })
    : '',
)

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
const sealChar = computed(() => player.name.charAt(0))

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
      <RealmAscentMap
        :nodes="realmNodes"
        :current-tier="currentTier"
        :next-tier="nextTier"
        :path-progress="pathProgress"
        :seal-char="sealChar"
      />

      <RealmDetailRail>
        <RealmIdentityCard
          :realm-name="realmName"
          :realm-level="player.realmLevel"
          :max-level="realm.maxLevel"
          :player-name="player.name"
        />
        <RealmCultivationBar
          :cultivation="player.cultivation"
          :required="player.cultivationRequired"
          :rate-text="rateText"
          :eta-text="cultivationEta"
        />
        <RealmPassiveList :rows="realmStatPassiveRows" :realm-name="realmName" />
        <RealmActionBlock
          :requirements="requirements"
          :realm-name="realmName"
          :target-name="nextRealmName || realmName"
          :show-cta="Boolean(nextRealmSurface)"
          :can-breakthrough="canBreakthrough"
          :cta-label="majorBreakthroughLabel"
          @breakthrough="majorBreakthrough"
        />
      </RealmDetailRail>
    </div>
  </ImperialScrollScene>
</template>

<style scoped>
/* Scene 05 layout: ascent map dominant (vista + rung path) beside the
   detail rail (spec: ascent-map 812w vs rail 416w ~= 2:1). */
.realm-scene {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: 18px;
  padding: 6px 2px;
}

@container (max-width: 860px) {
  .realm-scene { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; overflow-y: auto; }
}
</style>
