<script setup lang="ts">
// Canh Gioi production adapter: mounts the approved realm-v2 fidelity
// surface (Thien Lo ascension map on paper over the Dong Fu vista) fed
// by the canonical read-models - getCurrentRealm floors, cultivation
// progress/rate/ETA, realm passives. Buttons carry the rules: "Dot Pha"
// renders only while a minor floor advance can land (cultivation full,
// floor < max) and commits it through breakthroughWithConsequences; the
// floor-12+ ritual keeps its owner - canTriggerBreakthrough gates it and
// the ceremony still opens through the breakthroughRequirement store.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'
import { playBreakthroughFx } from '@/components/fx/breakthroughFx'
import { getCurrentRealm } from '@/core/realm/realmSystem'
import { betaNextRealmSurfaceFor } from '@/core/betaScopeSurface'
import { isActivePath } from '@/core/player/CultivationPathSystem'
import { isScopeHidden } from '@/core/betaScope'
import { formatNumber } from '@/core/format/NumberFormatter'
import { formatDuration } from '@/core/format/formatDuration'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import RealmFidelityScene from './fidelity/RealmFidelityScene.vue'
import type { RealmUiModel } from './fidelity/realmUi'


const { t } = useI18n()
const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const requirement = useBreakthroughRequirementStore()
const { realmStatPassiveRows } = useRealmStatPassives()

const selected = ref(0)
const advancing = ref(false)
const displayedFloor = ref<number | null>(null)

const canBreakthrough = computed(() => gameManager.realmAdvanceOps.canTriggerBreakthrough(player.$state))
const nextRealmSurface = computed(() => betaNextRealmSurfaceFor(player.$state))
const nextRealmName = computed(() => nextRealmSurface.value?.nextRealmName ?? '')

const cultivationEta = computed(() => {
  const rate = player.cultivationPerSecond
  if (rate <= 0) return ''
  const remaining = Math.max(0, player.cultivationRequired - player.cultivation)
  return formatDuration(remaining / rate)
})

const model = computed<RealmUiModel>(() => {
  stateVersion.value
  const realm = getCurrentRealm(player.realmId)
  const rate = player.cultivationPerSecond
  const percent = Math.min(100, Math.max(0, Math.round(player.cultivationProgress * 100)))

  const majorLabel = player.realmId === 'mortal'
    ? t('panels.realm.labels.quanKhi')
    : player.realmId === 'qi_refining'
      ? t('panels.realm.labels.foundation')
      : (nextRealmName.value || t('panels.realm.labels.majorFallback'))

  return {
    name: realm.name,
    currentFloor: displayedFloor.value ?? player.realmLevel,
    maxFloor: realm.maxLevel,
    progress: percent,
    cultivation: `${formatNumber(player.cultivation)} / ${formatNumber(player.cultivationRequired)}`,
    rate: rate > 0
      ? (cultivationEta.value
          ? t('panels.realm.rateEta', { rate: formatNumber(rate), unit: t('panels.realm.cultivationUnit'), eta: cultivationEta.value })
          : t('panels.realm.meta.rateValue', { rate: formatNumber(rate), unit: t('panels.realm.cultivationUnit') }))
      : '',
    // 2026-10-11 ruling - auto floor-advance removed: a floor only
    // moves on the player's button press, so the "Dot Pha" button
    // renders exactly when the minor breakthrough could land
    // (cultivation capped at required, a floor still left below the
    // realm's max).
    canAdvanceFloor:
      !advancing.value &&
      player.realmLevel < realm.maxLevel &&
      player.cultivation >= player.cultivationRequired,
    passives: realmStatPassiveRows.value,
    nextRealmName: nextRealmName.value,
    ctaLabel: majorLabel,
    ctaEnabled: canBreakthrough.value,
    // R13 ruling (2026-10-06): the sword-path Quan Khi re-entry moved
    // out of Nhan Vat into Canh Gioi - same gate it carried there.
    // Ruling (2026-10-11): the merged ritual button re-opens the Quan
    // Khi panel when the sword re-entry applies, else rides the shared
    // breakthrough ceremony like the old single CTA did.
    ritualAction: isActivePath(player, 'sword') && !isScopeHidden('swordPath') ? 'quanKhi' : 'breakthrough',
  }
})

function onSelectFloor(floor: number) {
  selected.value = floor
}

// D2 ruling (2026-10-15, P17): commit the minor floor advance immediately
// via breakthroughWithConsequences so presentation failure or mid-FX
// unmount never drops the outcome; hold displayedFloor on the previous
// floor until playBreakthroughFx resolves at the qi-burst peak.
async function onAdvanceFloor() {
  if (!model.value.canAdvanceFloor || advancing.value) return
  const previousFloor = player.realmLevel
  displayedFloor.value = previousFloor
  selected.value = previousFloor
  const result = gameManager.realmAdvanceOps.breakthroughWithConsequences(player)
  if (result.kind === 'failure') {
    displayedFloor.value = null
    selected.value = player.realmLevel
    return
  }
  advancing.value = true
  try {
    await playBreakthroughFx()
  } catch {
    // Presentation failure must never roll back or block committed progression (P17).
  } finally {
    displayedFloor.value = null
    selected.value = player.realmLevel
    advancing.value = false
  }
}

function onBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}

function onQuanKhi() {
  ui.openStandalonePanel('quan_khi')
}

// After a breakthrough the surface stays mounted (the ceremony is a
// sibling overlay): the remembered floor must follow the NEW realm or
// the newly advanced floor, else the card keeps showing stale progress
// (a floor N of the new realm as "Chua mo", or the pre-breakthrough
// floor after "Dot Pha" landed). While displayedFloor is held during the
// minor FX inhale, wait for the FX peak finally-block to flip selected.
watch(
  () => [player.realmId, player.realmLevel] as const,
  () => {
    if (displayedFloor.value === null) {
      selected.value = player.realmLevel
    }
  },
)
</script>

<template>
  <SceneDesignCanvas overlay>
    <RealmFidelityScene
      :model="model"
      :selected="selected || model.currentFloor"
      @select-floor="onSelectFloor"
      @advance="onAdvanceFloor"
      @breakthrough="onBreakthrough"
      @quan-khi="onQuanKhi"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
