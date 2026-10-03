<script setup lang="ts">
// Quan Khi (2026-08-20, Realm Passive & Pressure follow-up) -- tach
// path-choices ("Buoc Vao Phap Tu/Kiem Tu") ra khoi CharacterPanel.vue
// thanh overlay rieng, cung pattern SkillPathPanel.vue.
// Mo qua TribulationOutcomeService sau khi thang kiep Quan Khi
// (targetRealmId 'qi_refining'), hoac qua entry button tren
// CharacterPanel.vue cho Kiem Tu -- panel nay KHONG tu kiem tra lai
// dieu kien, chi tu dong ngay sau khi chon xong (component goi no
// da gate roi).
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'
import {
  CULTIVATION_PATH_MODULES,
  declaresElementAxis,
  type CultivationPathId,
  type PathWayDefinition,
  type CultivationWayId,
} from '@/core/player/CultivationPathKit'
import {
  getSwordScrollPreset,
  hasStaticPathCapability,
  isActivePath,
  listOfferableWays,
} from '@/core/player/CultivationPathSystem'
import { BETA_PLAYABLE_ELEMENTS, isBetaWay, isScopeHidden } from '@/core/betaScope'
import type { ElementType } from '@/core/element/ElementType'
import { ELEMENT_LABELS } from '@/core/element/ElementLabels'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import { useTurnBattleInfo } from '@/composables/useTurnBattleInfo'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM } from '@/data/skill/KiemPhoOrbs'
import type { OrbId } from '@/core/kiem-tu/KiemTuState'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { REALMS } from '@/data/realms/realm'
import { useAudioStore } from '@/stores/audio'

const { t, te } = useI18n()

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { isBattleInProgress } = useTurnBattleInfo()
const cooldownSeconds = computed(() => {
  stateVersion.value
  return gameManager.tribulationDirector.getCooldownSeconds()
})

// Phap Tu Reimagined (Task 16) -- the ritual offers exactly what the
// path authority lists: hidden_spell_pathway appears ONLY when linh_bao is already
// Lv3 at ritual time; hidden_body_pathway appears ONLY when huy_quyen is Lv3 (same
// isCultivationPathOffered predicate the ritual enforces inside
// applyPathChoice); no locked-card tease when ineligible (spec S11).
// Offerability is evaluated live per render -- eligibility is never
// stored.
const availableWays = computed(() => {
  stateVersion.value

  // M2 -- offers are (path, way) pairs from the authority. Ineligible
  // ways stay hidden (pre-framework omission behavior preserved); each
  // row carries the resolved way definition for display.
  // BETA SCOPE LOCK v2 (phase-2): the ritual's offer list is the beta
  // allow-list - a non-beta way can never ride this surface even when
  // the underlying offer authority is re-enabled.
  return listOfferableWays(player.$state)
    .filter((offer) => offer.eligible && isBetaWay(offer.wayId))
    .map((offer) => ({
      pathId: offer.pathId,
      wayId: offer.wayId,
      way: CULTIVATION_PATH_MODULES[offer.pathId].ways[offer.wayId],
    }))
    .filter(
      (entry): entry is { pathId: CultivationPathId; wayId: CultivationWayId; way: PathWayDefinition } =>
        entry.way !== undefined,
    )
})

// A sealed way's kit names -- resolved live from the way declaration
// (resolved skill kit + the way's initiation passives, P7-M2) so the card
// never drifts from authored content.
function sealedKitSkillNames(way: PathWayDefinition): string[] {
  const skillIds = [...(way.skillIds ?? []), ...(way.passiveSkillIds ?? [])]
  return skillIds.map(id => gameManager.skillManager.get(id)?.name ?? id)
}

// Ritual choice cards (ui-audit progression fix) -- a permanent path pick
// cannot be a row of identical buttons: each offered way carries an
// authored per-way description (locale key by way id) plus its initiation
// kit names so the player decides with information.
function wayDescription(wayId: CultivationWayId): string {
  const key = `panels.quanKhi.pathDescriptions.${wayId}`
  return te(key) ? t(key) : ''
}

function choiceKitLine(way: PathWayDefinition): string {
  const kit = sealedKitSkillNames(way)
  return kit.length > 0
    ? t('panels.quanKhi.sections.pathSelection.kit', { kit: kit.join(' · ') })
    : ''
}

// Thay window.confirm() native — modal xác nhận đồng bộ hoá qua state
// (giữ nguyên yêu cầu "lựa chọn KHÔNG thể đổi lại" bằng modal riêng
// thay vì browser confirm() mặc định).
const pendingChoice = ref<{ pathId: CultivationPathId; wayId: CultivationWayId } | null>(null)

const pendingWay = computed(() =>
  pendingChoice.value
    ? CULTIVATION_PATH_MODULES[pendingChoice.value.pathId].ways[pendingChoice.value.wayId]
    : undefined,
)

const pendingPathName = computed(() => pendingWay.value?.name ?? '')

// BETA SCOPE LOCK v2 (phase-2) - the Ngu Hanh ritual commits way +
// element in ONE atomic domain op, so its confirm step is the element
// pick rather than the generic modal. The commit feeds
// commitFiveElementInitiation() exactly once with the picked element.
// The element step is data-driven: any way declaring an element
// subpath axis gets it (today: spell_pathway) - no literal way ids.
const pendingWayHasElementAxis = computed(
  () => declaresElementAxis(pendingWay.value),
)
const elementChoices = [...BETA_PLAYABLE_ELEMENTS]
const initiationError = ref('')

function elementLabel(element: ElementType): string {
  return ELEMENT_LABELS[element]
}

function choosePath(pathId: CultivationPathId, wayId: CultivationWayId) {
  initiationError.value = ''
  pendingChoice.value = { pathId, wayId }
}

function cancelChoosePath() {
  initiationError.value = ''
  pendingChoice.value = null
}

function commitInitiation(element: ElementType) {
  // Capture the way name BEFORE clearing pendingChoice - pendingPathName
  // derives from it and would read '' by announcement time.
  const wayName = pendingPathName.value
  const realmIdBefore = player.realmId

  const result = gameManager.realmAdvanceOps.commitFiveElementInitiation(element, player.$state)

  if (!result.ok) {
    // Every preflight reason maps to a locale key; an unmapped future
    // reason falls back to the generic failure line.
    const key = `panels.quanKhi.initiationFailed.${result.reason}`
    initiationError.value = te(key) ? t(key) : t('panels.quanKhi.initiationFailed.commit_failed')
    useAudioStore().cue('ui.error')
    return
  }

  useAudioStore().cue('progress.path_choose')
  pendingChoice.value = null
  bumpState()

  if (realmIdBefore === 'mortal' && player.realmId !== 'mortal') {
    useWorldAnnouncementStore().show(
      t('panels.quanKhi.world.ceremonyTitle'),
      t('panels.quanKhi.world.ceremonyBody', { name: wayName }),
    )
  }

  close()
}

function confirmChoosePath() {
  const choice = pendingChoice.value

  pendingChoice.value = null

  if (!choice) {
    return
  }

  // W7: path commitment is a progression beat (the ConfirmModal's own
  // ui.confirm already fired on the button).
  useAudioStore().cue('progress.path_choose')

  const way = CULTIVATION_PATH_MODULES[choice.pathId].ways[choice.wayId]

  const realmIdBefore = player.realmId
  if (gameManager.realmAdvanceOps.chooseCultivationPath(choice.pathId, choice.wayId, player.$state)) {
    bumpState()

    // Nghi Lễ Nhập Môn — chọn path VỪA LÀ hành động đột phá Phàm Nhân
    // -> Luyện Khí (xem GameManager.chooseCultivationPath()), xứng đáng
    // 1 world announcement giống mọi lần đổi đại cảnh giới khác.
    if (realmIdBefore === 'mortal' && player.realmId !== 'mortal') {
      useWorldAnnouncementStore().show(
        t('panels.quanKhi.world.ceremonyTitle'),
        t('panels.quanKhi.world.ceremonyBody', { name: way?.name ?? choice.wayId }),
      )
    }

    close()
  }
}

function close() {
  ui.closeHomeOverlays()
}

// Kiem Tu specialization card below — shown only after the player has
// chosen the sword path (read-only display; the way was locked at
// the Initiation Ritual — there is no in-panel conversion).
const isSwordPath = computed(() => {
  stateVersion.value

  // P1 - the generic authority read resolves the committed pair through
  // the catalog: a way-less/corrupt sword save is NOT kiem (fail closed).
  // BETA SCOPE LOCK - a carried way_out_of_scope sword save keeps the
  // path flag, but every sword-way surface stays scope-hidden (no spec
  // card, no preset editor).
  return isActivePath(player, 'sword') && !isScopeHidden('swordPath')
})

// Cultivation Path Framework (M6/M9) — the sword/hidden way is canonical on
// PlayerData.cultivationWay. P1 - read through the declared capability:
// 'sword.sword_riding' only resolves for the ('sword','hidden_sword_pathway') pair.
const swordPathWay = computed(() => {
  stateVersion.value

  return hasStaticPathCapability(player, 'sword.sword_riding') ? 'hidden_sword_pathway' : 'sword_pathway'
})

const specNameDisplay = computed(() =>
  swordPathWay.value === 'hidden_sword_pathway'
    ? t('panels.quanKhi.specNames.nguKiemDao')
    : t('panels.quanKhi.specNames.kiemPho'),
)

// Kiem Tu Reimagined (spec §11) — out-of-combat Kiem Pho preset editor.
// Direct-op editing: every click goes through setKiemPhoPreset() so
// PlayerData stays the single source of truth — no draft copy to sync.
const orbPalette = Object.keys(KIEM_PHO_ORBS) as OrbId[]

const realmIndex = computed(() => {
  stateVersion.value

  return getRealmIndex(player.realmId)
})

const presetOrbs = computed<OrbId[]>(() => {
  stateVersion.value

  return [...(getSwordScrollPreset(player) ?? [])]
})

const presetBattleLocked = computed(() => {
  stateVersion.value

  return isBattleInProgress.value
})

function orbLabel(orbId: OrbId): string {
  return turnSkillDisplayMetaOf(orbId)?.name ?? orbId
}

function orbTooltip(orbId: OrbId): string {
  return turnSkillDisplayMetaOf(orbId)?.description ?? ''
}

function isOrbUnlocked(orbId: OrbId): boolean {
  return ORB_UNLOCK_REALM[orbId] <= realmIndex.value
}

function orbUnlockRealmName(orbId: OrbId): string {
  return REALMS[ORB_UNLOCK_REALM[orbId]]?.name ?? ''
}

function appendOrb(orbId: OrbId) {
  if (presetBattleLocked.value || !isOrbUnlocked(orbId) || presetOrbs.value.length >= 9) {
    return
  }

  if (gameManager.progressionOps.setKiemPhoPreset(player.$state, [...presetOrbs.value, orbId])) {
    bumpState()
  }
}

function removeOrbAt(index: number) {
  if (presetBattleLocked.value || presetOrbs.value.length <= 1) {
    return
  }

  const next = presetOrbs.value.filter((_, slotIndex) => slotIndex !== index)

  if (gameManager.progressionOps.setKiemPhoPreset(player.$state, next)) {
    bumpState()
  }
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'quan_khi'" :title="t('panels.quanKhi.title')" width="min(480px, 90vw)" @close="close">
    <div v-if="!player.cultivationPath" class="quan-khi-panel__card">
      <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.pathSelection.hint') }}</p>

      <!-- BETA SCOPE LOCK v2 (phase-2) - the spell way's element pick:
           one atomic commit, not a way pick + a later element choice. -->
      <div v-if="pendingChoice !== null && pendingWayHasElementAxis" class="quan-khi-panel__element-step">
        <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.elementPick.hint') }}</p>
        <div class="quan-khi-panel__element-grid">
          <GameButton
            v-for="element in elementChoices"
            :key="element"
            class="quan-khi-panel__element-btn"
            variant="danger"
            size="sm"
            :disabled="cooldownSeconds > 0"
            @click="commitInitiation(element)"
          >
            {{ elementLabel(element) }}
          </GameButton>
        </div>
        <p v-if="initiationError" class="quan-khi-panel__element-error">{{ initiationError }}</p>
        <GameButton variant="ghost" size="sm" @click="cancelChoosePath">
          {{ t('panels.quanKhi.sections.elementPick.back') }}
        </GameButton>
      </div>

      <div v-else class="quan-khi-panel__choices">
        <template v-for="kit in availableWays" :key="`${kit.pathId}/${kit.wayId}`">
          <!-- Sealed hidden-path card (Task 16, M9) -- renders for any
               way declaring sealedOffer (today: hidden_spell_pathway); names the
               way, carries the permanent warning, no node-tree entry
               point. -->
          <div v-if="kit.way.sealedOffer" class="quan-khi-panel__hidden-card">
            <p class="quan-khi-panel__hidden-title">{{ kit.way.name }}</p>
            <p class="quan-khi-panel__hidden-desc">
              {{ t('panels.quanKhi.sections.hiddenPath.description', { kit: sealedKitSkillNames(kit.way).join(' · ') }) }}
            </p>
            <p class="quan-khi-panel__hidden-warning">{{ t('panels.quanKhi.sections.hiddenPath.warning') }}</p>
            <GameButton
              class="quan-khi-panel__choice"
              variant="danger"
              size="sm"
              :disabled="cooldownSeconds > 0"
              @click="choosePath(kit.pathId, kit.wayId)"
            >
              {{ t('panels.quanKhi.actions.enterPath', { name: kit.way.name }) }}
            </GameButton>
          </div>

          <GameButton
            v-else
            class="quan-khi-panel__choice"
            variant="danger"
            size="sm"
            :disabled="cooldownSeconds > 0"
            @click="choosePath(kit.pathId, kit.wayId)"
          >
            <span class="quan-khi-panel__choice-body">
              <span class="quan-khi-panel__choice-name">{{ t('panels.quanKhi.actions.enterPath', { name: kit.way.name }) }}</span>
              <span v-if="wayDescription(kit.wayId)" class="quan-khi-panel__choice-desc">{{ wayDescription(kit.wayId) }}</span>
              <span v-if="choiceKitLine(kit.way)" class="quan-khi-panel__choice-kit">{{ choiceKitLine(kit.way) }}</span>
            </span>
          </GameButton>
        </template>
      </div>
    </div>

    <!-- Kiem Tu Reimagined (spec 2026-09-15) -- shows the active
         specialization (Kiem Pho / Ngu Kiem Dao) read from
         player.cultivationWay. -->
    <div v-if="isSwordPath" class="quan-khi-panel__card">
      <div class="quan-khi-panel__route-card">
        <p class="quan-khi-panel__hint">
          {{ t('panels.quanKhi.sections.kiemTuSpec.hintPrefix') }} <strong class="quan-khi-panel__route-name">{{ specNameDisplay }}</strong>{{ t('panels.quanKhi.sections.kiemTuSpec.hintSuffix') }}
        </p>
        <p class="quan-khi-panel__warning">
          {{ swordPathWay === 'hidden_sword_pathway'
            ? t('panels.quanKhi.sections.kiemTuSpec.nguDescription')
            : t('panels.quanKhi.sections.kiemTuSpec.hienDescription') }}
        </p>
      </div>
    </div>

    <!-- Kiem Pho preset editor -- sword_pathway only (hidden_sword_pathway never reads preset).
         Strip = current persisted sequence, palette = realm-unlocked
         orbs; both write through setKiemPhoPreset(). -->
    <div v-if="isSwordPath && swordPathWay === 'sword_pathway'" class="quan-khi-panel__card">
      <div class="quan-khi-panel__route-card">
        <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.kiemPhoPreset.title') }}</p>
        <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.kiemPhoPreset.hint') }}</p>
        <p v-if="presetBattleLocked" class="quan-khi-panel__warning">
          {{ t('panels.quanKhi.sections.kiemPhoPreset.battleLocked') }}
        </p>

        <div class="quan-khi-panel__preset-strip" role="listbox" :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.title')">
          <button
            v-for="(orbId, index) in presetOrbs"
            :key="`${index}-${orbId}`"
            type="button"
            class="quan-khi-panel__preset-slot"
            :disabled="presetBattleLocked || presetOrbs.length <= 1"
            :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.removeAria', { name: orbLabel(orbId) })"
            @click="removeOrbAt(index)"
          >
            {{ orbLabel(orbId) }}
          </button>
          <span
            v-for="empty in 9 - presetOrbs.length"
            :key="`empty-${empty}`"
            class="quan-khi-panel__preset-slot quan-khi-panel__preset-slot--empty"
          ></span>
        </div>

        <div class="quan-khi-panel__preset-palette">
          <button
            v-for="orbId in orbPalette"
            :key="orbId"
            type="button"
            class="quan-khi-panel__preset-orb"
            :class="{ 'is-locked': !isOrbUnlocked(orbId) }"
            :disabled="presetBattleLocked || !isOrbUnlocked(orbId) || presetOrbs.length >= 9"
            :title="isOrbUnlocked(orbId) ? orbTooltip(orbId) : t('panels.quanKhi.sections.kiemPhoPreset.lockedHint', { realm: orbUnlockRealmName(orbId) })"
            :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.appendAria', { name: orbLabel(orbId) })"
            @click="appendOrb(orbId)"
          >
            {{ orbLabel(orbId) }}
          </button>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="pendingChoice !== null && !pendingWayHasElementAxis"
      :title="t('panels.quanKhi.messages.confirmPathTitle')"
      :message="pendingWay?.sealedOffer
        ? t('panels.quanKhi.messages.confirmPathHiddenBody', { name: pendingPathName })
        : t('panels.quanKhi.messages.confirmPathBody', { name: pendingPathName })"
      danger
      @confirm="confirmChoosePath"
      @cancel="cancelChoosePath"
    />
  </OverlayPanel>
</template>

<style scoped>
.quan-khi-panel__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  font-family: var(--font-body);
  color: var(--paper-text);
}

/* Cau duy nhat truoc 1 quyet dinh vinh vien -- xung dang co chu lon hon
   text-sm mac dinh (2026-08-30 frontend-design pass). */
.quan-khi-panel__hint {
  margin: 0;
  font-size: var(--text-md);
  color: var(--paper-text-muted);
}

.quan-khi-panel__route-name {
  color: var(--chrome-100);
}

/* Khoi "duong da chot" -- card that thay vi van ban tran (2026-08-30). */
.quan-khi-panel__route-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--ink-800);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-md);
}

.quan-khi-panel__choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quan-khi-panel__choice {
  display: block;
  width: 100%;
  padding: 10px;
  /* Nghi thuc chon con duong vinh vien -- giu crimson gradient chu dich
     (signaling quyet dinh khong hoan tac), de len variant danger phang. */
  background: linear-gradient(180deg, var(--crimson), var(--ink-800));
  border: 1px solid var(--chrome-500);
  color: var(--text-primary);
}

/* Choice cards carry the way's description + initiation kit under the
   name -- stacked lines inside the GameButton label. */
.quan-khi-panel__choice-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.quan-khi-panel__choice-desc {
  font-size: var(--text-xs);
  font-weight: 400;
  line-height: 1.45;
  color: var(--text-secondary);
}

.quan-khi-panel__choice-kit {
  font-size: var(--text-2xs, 10px);
  font-weight: 400;
  color: var(--text-muted);
}

.quan-khi-panel__choice.is-selected {
  border-color: var(--jade);
  background: linear-gradient(180deg, var(--jade), var(--ink-800));
  box-shadow: 0 0 10px -3px var(--jade);
}

.quan-khi-panel__choice:disabled {
  opacity: 0.6;
}

/* Kiem Pho preset editor -- strip mirrors the HUD preset readout;
   palette buttons mirror the manual orb picker. */
.quan-khi-panel__preset-strip {
  display: flex;
  gap: 4px;
}

.quan-khi-panel__preset-slot {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: var(--text-xs);
  background: var(--ink-700);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
}

.quan-khi-panel__preset-slot--empty {
  border-style: dashed;
  opacity: 0.35;
  cursor: default;
}

.quan-khi-panel__preset-slot:disabled {
  cursor: default;
  opacity: 0.6;
}

.quan-khi-panel__preset-palette {
  display: flex;
  gap: 6px;
}

.quan-khi-panel__preset-orb {
  flex: 1;
  padding: 8px 4px;
  font-size: var(--text-sm);
  background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
}

.quan-khi-panel__preset-orb:not(:disabled):hover {
  border-color: var(--jade);
}

.quan-khi-panel__preset-orb.is-locked {
  opacity: 0.45;
}

.quan-khi-panel__preset-orb:disabled {
  cursor: default;
}

/* Doan giai thich that su -- truoc day nho HON dong hint phia tren no du
   la noi dung payoff chinh (2026-08-30 frontend-design pass). */
.quan-khi-panel__warning {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--gold-500);
}

/* BETA SCOPE LOCK v2 (phase-2) - element pick step of the atomic
   initiation. */
.quan-khi-panel__element-step {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quan-khi-panel__element-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.quan-khi-panel__element-btn {
  padding: 10px 4px;
  background: linear-gradient(180deg, var(--crimson), var(--ink-800));
  border: 1px solid var(--chrome-500);
  color: var(--text-primary);
}

.quan-khi-panel__element-error {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--crimson);
  text-align: center;
}

/* Sealed hidden-path card (Task 16) -- distinct frame so the ritual
   reads it as a road others cannot see, not a third equal option. */
.quan-khi-panel__hidden-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--ink-800);
  border: 1px solid var(--gold-700);
  border-radius: var(--radius-md);
}

.quan-khi-panel__hidden-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 700;
  color: var(--gold-700);
}

.quan-khi-panel__hidden-desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-secondary);
}

.quan-khi-panel__hidden-warning {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.4;
  color: var(--crimson);
}
</style>
