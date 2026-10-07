<script setup lang="ts">
// Canh Gioi production adapter: mounts the approved realm-v2 fidelity
// surface (Thien Lo ascension map on paper over the Dong Fu vista) fed
// by the canonical read-models - getCurrentRealm floors, cultivation
// progress/rate/ETA, BreakthroughGate requirement rows, realm passives.
// The CTA keeps its owner: realmAdvanceOps.canTriggerBreakthrough gates
// the button and the ceremony still opens through the
// breakthroughRequirement store - nothing here advances the realm.
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useRealmStatPassives } from '@/composables/useRealmStatPassives'
import { getCurrentRealm, CORE_REALM_LEVEL } from '@/core/realm/realmSystem'
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
const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | undefined
function flashNotice(text: string) {
  notice.value = text
  if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { noticeTimer = undefined; notice.value = '' }, 3200)
}
onBeforeUnmount(() => { if (noticeTimer !== undefined) clearTimeout(noticeTimer) })

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
    currentFloor: player.realmLevel,
    maxFloor: realm.maxLevel,
    progress: percent,
    progressLabel: `${percent}%`,
    cultivation: `${formatNumber(player.cultivation)} / ${formatNumber(player.cultivationRequired)}`,
    rate: rate > 0
      ? (cultivationEta.value
          ? t('panels.realm.rateEta', { rate: formatNumber(rate), unit: t('panels.realm.cultivationUnit'), eta: cultivationEta.value })
          : t('panels.realm.meta.rateValue', { rate: formatNumber(rate), unit: t('panels.realm.cultivationUnit') }))
      : '',
    requirements: gameManager.realmAdvanceOps.getBreakthroughRequirements(player.$state).map((row) => ({
      id: row.key,
      met: row.met,
      label: row.key === 'level'
        ? t('panels.realm.requirements.level', { realm: realm.name, level: CORE_REALM_LEVEL })
        : t('panels.realm.requirements.chapterClear'),
    })),
    passives: realmStatPassiveRows.value,
    nextRealmName: nextRealmName.value,
    ctaLabel: majorLabel,
    ctaVisible: Boolean(nextRealmSurface.value),
    ctaEnabled: canBreakthrough.value,
    // R13 ruling (2026-10-06): the sword-path Quan Khi re-entry moved
    // out of Nhan Vat into Canh Gioi - same gate it carried there.
    quanKhiEntry: isActivePath(player, 'sword') && !isScopeHidden('swordPath'),
  }
})

function onSelectFloor(floor: number) {
  selected.value = floor
  flashNotice(t('realm.viewing', { floor }))
}

function onBreakthrough() {
  if (!canBreakthrough.value) return
  requirement.open()
}

function onQuanKhi() {
  ui.openStandalonePanel('quan_khi')
}
</script>

<template>
  <SceneDesignCanvas overlay>
    <RealmFidelityScene
      :model="model"
      :selected="selected || model.currentFloor"
      :notice="notice"
     
      @select-floor="onSelectFloor"
      @breakthrough="onBreakthrough"
      @quan-khi="onQuanKhi"
      @back="ui.closeHomeOverlays()"
    />
  </SceneDesignCanvas>
</template>
