<script setup lang="ts">
// Master-account dev panel (Minh 2026-10-07): rendered only for
// allowlisted loginIds (masterAccess). Sections: resource adders (every
// registered material + cultivation + duyenPhan), the cultivationPath
// switcher for testing (force-set bypasses the ritual's offer gates and
// one-shot lock - dev semantics, never the sim's), and the skill
// constellation design-mode toggle. Every mutation ends in bumpState()
// so HUD/bag surfaces repaint.
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BUMP_STATE_KEY, useGameManager } from '@/composables/useGameState'
import { useProgressionActions } from '@/composables/useProgressionActions'
import { usePlayerStore } from '@/stores/player'
import { setSkillDesignMode, skillDesignMode, useMasterAccess } from '@/services/master/masterAccess'
import {
  CULTIVATION_PATH_MODULES,
  type CultivationPathId,
  type CultivationWayId,
} from '@/core/player/CultivationPathKit'
import { REALMS } from '@/data/realms/realm'
import { isBeyondReleaseCeiling } from '@/core/realm/ReleasePolicy'
import { addCultivation } from '@/core/cultivation/CultivationSystem'
import {
  CORE_REALM_LEVEL,
  getRealmIndex,
  getRequiredCultivation,
} from '@/core/realm/realmSystem'
import { betaMaterialStackVisible, isBetaWay } from '@/core/betaScope'
import { CAST_LEVELING_THRESHOLDS } from '@/core/skill/CastLeveling'
import { TribulationOutcomeService } from '@/core/tribulation/TribulationOutcomeService'
import {
  getUpgradeableTalentIds,
  reconcileTalentEntitlement,
} from '@/core/talent/TalentEntitlement'
import { getRealmTier, PRODUCIBLE_REALM_TIER_LEAD } from '@/core/realm/RealmTierMap'
import {
  SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID,
} from '@/core/material/SpiritStoneMaterial'
import { createDefaultPlayer } from '@/core/player/Player'
import { CHARACTER_CREATION_TALENTS } from '@/data/talent/Talents'
import {
  applyCreationProfile,
  bootstrapEarlyGamePlayer,
} from '@/core/game/EarlyGameBootstrap'

const { t } = useI18n()
const { isMaster } = useMasterAccess()
const gameManager = useGameManager()
const player = usePlayerStore()
const { respecNodeTree } = useProgressionActions()
const bumpState = inject(BUMP_STATE_KEY, () => {})

const open = ref(false)
const amount = ref(1000)

// Rows offered = what the save boundary could actually mint: the
// write gate refuses permanently-suppressed mint sources, domain
// materials outside the release window, spirit stones/profession
// materials above the player's realm tier. Adding one of those would
// corrupt the save on the next autosave, so they stay unlisted.
const materials = computed(() => {
  const claimedTier = getRealmTier(player.realmId)
  return gameManager.materialRegistry.getAll().filter((m) => {
    if (!betaMaterialStackVisible(m, player.realmId)) return false
    const stoneTier =
      m.id === SPIRIT_STONE_THUONG_PHAM_MATERIAL_ID
        ? 7
        : m.id === SPIRIT_STONE_TRUNG_PHAM_MATERIAL_ID
          ? 4
          : 0
    if (stoneTier > 0 && claimedTier < stoneTier) return false
    const professionTier = m.profession?.realmId
    if (
      professionTier !== undefined &&
      getRealmTier(professionTier) > claimedTier + PRODUCIBLE_REALM_TIER_LEAD
    ) {
      return false
    }
    return true
  })
})
function materialAmount(id: string): number {
  return gameManager.materialBag.getAmount(id)
}
function addMaterial(id: string) {
  gameManager.materialBag.add(gameManager.materialRegistry.get(id), amount.value)
  bumpState()
}
function addPlayerField(field: 'cultivation' | 'duyenPhan' | 'skillInsight') {
  // cultivation goes through the real writer: it clamps at the tier's
  // getRequiredCultivation and banks the overflow, so a dev grant can
  // never trip the F-CULT-OVERCAP save refuse.
  if (field === 'cultivation') addCultivation(player.$state, amount.value)
  else if (field === 'skillInsight') {
    // A bare skillInsight write reads as a fabricated claim at the save
    // boundary (insight > totalSkillInsightGained is unproducible) - the
    // grant must bump the lifetime counter by the same delta, same as
    // phapTuLab.
    player.totalSkillInsightGained += amount.value
    player.skillInsight += amount.value
  } else player[field] += amount.value
  bumpState()
}

const pathId = ref<CultivationPathId>('spell')
const wayId = ref<CultivationWayId>('spell_pathway')
const pathOptions = computed(() =>
  (Object.keys(CULTIVATION_PATH_MODULES) as CultivationPathId[]).map((id) => ({
    id,
    name: CULTIVATION_PATH_MODULES[id].name,
  })),
)
// Only beta-offerable ways are listed - a non-beta way fails the
// ritual's admission gate, so offering it would invite a refused write.
const wayOptions = computed(() =>
  (Object.keys(CULTIVATION_PATH_MODULES[pathId.value].ways) as CultivationWayId[]).filter(
    isBetaWay,
  ),
)
function onPathChange() {
  wayId.value = wayOptions.value[0] ?? 'spell_pathway'
}
const lastResult = ref('')
// Only realms inside the beta release window AT OR ABOVE the current
// realm are offerable - a realmId beyond progressionCeilingRealmId is
// refused at the save boundary (unproducible claim), and DEMOTION IS
// IMPOSSIBLE: realm-earned receipts (talents, grantedRealmPassiveIds,
// realm-gated skills, attributePoints, highestFoundationAchieved,
// element-root nodeLevels, workerCycle realm pins) would turn into
// forged claims at the lower realm and the validator refuses the save.
// So the select offers promotion-or-same only; going back runs the
// reset path (wipe to fresh mortal) instead.
const realmOptions = computed(() =>
  REALMS.filter(
    (r) =>
      !isBeyondReleaseCeiling(r.id) &&
      getRealmIndex(r.id) >= getRealmIndex(player.realmId),
  ),
)
const realmId = ref<string>('qi_refining')
// Keep the select pinned to an offerable row when the player's realm
// moves (initiation/promotion through this panel or elsewhere).
watch(realmOptions, (options) => {
  if (!options.some((r) => r.id === realmId.value)) {
    realmId.value = options[0]?.id ?? 'mortal'
  }
}, { immediate: true })
function clampRealmCoherence() {
  const realm = REALMS.find((r) => r.id === player.realmId)
  if (realm !== undefined && player.realmLevel > realm.maxLevel) {
    player.realmLevel = realm.maxLevel
  }
  const required = getRequiredCultivation(player.realmId, player.realmLevel)
  if (player.cultivation > required) player.cultivation = required
}
function applyRealm() {
  const target = realmId.value
  const current = getRealmIndex(player.realmId)
  const wanted = getRealmIndex(target)
  if (wanted === current) return
  if (wanted > current) {
    // Realm promotion rides the real victory pipeline - it writes every
    // receipt the save boundary demands (realm write, unequip, realm
    // passives, way realm reward, highestFoundationAchieved, talent
    // entitlement). A raw realmId bump forges a realm claim missing its
    // own receipts and corrupts the save.
    if (player.cultivationPath === undefined) {
      lastResult.value = 'cần đạo lộ trước (nhập môn)'
      return
    }
    new TribulationOutcomeService().resolveVictory(player, gameManager, {
      targetRealmId: target,
      grade: 'human',
      breakthroughType: 'normal',
    })
    // The entitlement modal soft-blocks input until decided - auto-pick
    // the first legal offer, same as phapTuLab.
    if (player.pendingTalentEntitlement !== undefined) {
      const newOffer = player.pendingTalentEntitlement.offeredTalentIds[0]
      const upgrade = getUpgradeableTalentIds(player)[0]
      if (newOffer !== undefined) {
        gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
          kind: 'new',
          talentId: newOffer,
        })
      } else if (upgrade !== undefined) {
        gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
          kind: 'upgrade',
          talentId: upgrade,
        })
      } else {
        reconcileTalentEntitlement(player)
      }
    }
    lastResult.value = 'ok'
    bumpState()
    return
  }
  // Demotion is impossible (see realmOptions above): the select never
  // offers a lower realm, so this branch stays defensive only.
  lastResult.value = 'không thể hạ cảnh giới'
}
function applyPath() {
  // Initiation rides the real ritual op (same seam phapTuLab uses) -
  // it commits path + way + element + realm atomically, grants the way
  // kit and the canonical technique, and rolls back byte-equivalent on
  // any mid-commit failure. Requirements: mortal, uncommitted,
  // realmLevel >= CORE_REALM_LEVEL, linh_bao cast-level 3 (the offer
  // gate) - the lab seeds the same prerequisites.
  const state = player.$state
  if (state.realmId !== 'mortal' || state.cultivationPath !== undefined) {
    lastResult.value = 'cần reset đạo lộ trước'
    return
  }
  if (state.realmLevel < CORE_REALM_LEVEL) {
    state.realmLevel = CORE_REALM_LEVEL
  }
  const counts = (state.skillCastCounts ??= {})
  const gate = CAST_LEVELING_THRESHOLDS.linh_bao?.lv3 ?? 0
  counts.linh_bao = Math.max(counts.linh_bao ?? 0, gate)
  const result = gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', state)
  lastResult.value = result.ok ? 'ok' : result.reason
  realmId.value = state.realmId
  bumpState()
}
function resetPath() {
  // Un-initiation cannot work field-by-field: realm-earned receipts
  // become forged claims at mortal, so the wipe rebuilds the pre-ritual
  // state through the REAL creation/bootstrap seams - the same writes a
  // new character produces, which the save boundary accepts by
  // construction.
  // Realm-granted talent ids are unproducible at mortal (validator
  // F-A10-1) - only the creation-pool ids may ride the profile back in.
  const profile = {
    name: player.name,
    talentIds: player.selectedTalentIds.filter((id) =>
      CHARACTER_CREATION_TALENTS.some((talent) => talent.id === id),
    ),
  }
  // Full-key wipe, NOT $patch: Pinia's patch deep-merges, so stale
  // nested entries (nodeLevels, spellPath, realm receipts) would
  // survive and forge claims the save boundary refuses. This is the
  // same delete-then-assign wipe the store's own restore runs.
  const fresh = createDefaultPlayer()
  for (const key of Object.keys(player.$state)) {
    Reflect.deleteProperty(player.$state, key)
  }
  Object.assign(player.$state, fresh)
  applyCreationProfile(player.$state, profile)
  // The ritual refuses 'technique_occupied': the holder must be empty
  // before re-initiating (mortals canonically hold no technique).
  gameManager.techniqueManager.setActive(null)
  // Unlearn EVERYTHING, precursors included: learnSkill grants the
  // skill's core node, so keeping a learned precursor while the wipe
  // cleared its core entry would break the learned=>core contract.
  // bootstrap re-learns the three precursors fresh, exactly like a real
  // boot. skillCastCounts reset with the wipe (a fresh mortal has no
  // practice history); applyPath re-seeds the lv3 gate on re-initiation.
  for (const skill of gameManager.skillManager.getAll()) {
    gameManager.skillSystem.unlearn(skill.id)
  }
  // Does the 3-channel pick itself: precursors + mortalBasicSkillId +
  // each learned skill's core node.
  bootstrapEarlyGamePlayer(gameManager, player.$state)
  // In-flight worker cycles carry collectionRealmId pinned at the realm
  // they started under - kept cycles would mint realm claims a mortal
  // cannot produce. Sites stay; only the pinned lanes drop.
  gameManager.productionSystem.restoreStates(
    gameManager.productionSystem.getAllStates().map((s) => ({ ...s, workerCycles: [] })),
  )
  clampRealmCoherence()
  lastResult.value = 'ok'
  bumpState()
}

// Minh ruling (2026-10-07): respec lives in dev tools only - the panel
// footer button is master-gated and this action resets the whole tree
// from here too, refunding the Insight the same op computes.
function respecTree() {
  const refund = respecNodeTree()
  lastResult.value = refund === false ? 'refused' : `refund ${refund}`
}
</script>

<template>
  <button v-if="isMaster" class="dev-panel-open" type="button" @click="open = !open">
    {{ t('devPanel.open') }}
  </button>
  <aside v-if="isMaster && open" class="dev-panel" data-testid="dev-tools-panel">
    <h3 class="dev-panel__title">{{ t('devPanel.title') }}</h3>

    <section class="dev-panel__section">
      <h4>{{ t('devPanel.resources') }}</h4>
      <label class="dev-panel__amount">
        {{ t('devPanel.amount') }}
        <input v-model.number="amount" type="number" min="1" />
      </label>
      <div class="dev-panel__rows">
        <div class="dev-panel__row">
          <span>{{ t('devPanel.cultivation') }}</span>
          <b>{{ player.cultivation }}</b>
          <button type="button" @click="addPlayerField('cultivation')">{{ t('devPanel.add') }}</button>
        </div>
        <div class="dev-panel__row">
          <span>{{ t('devPanel.duyenPhan') }}</span>
          <b>{{ player.duyenPhan }}</b>
          <button type="button" @click="addPlayerField('duyenPhan')">{{ t('devPanel.add') }}</button>
        </div>
        <div class="dev-panel__row">
          <span>{{ t('devPanel.skillInsight') }}</span>
          <b>{{ player.skillInsight }}</b>
          <button type="button" @click="addPlayerField('skillInsight')">{{ t('devPanel.add') }}</button>
        </div>
        <div v-for="m in materials" :key="m.id" class="dev-panel__row">
          <span>{{ m.name }}</span>
          <b>{{ materialAmount(m.id) }}</b>
          <button type="button" @click="addMaterial(m.id)">{{ t('devPanel.add') }}</button>
        </div>
      </div>
    </section>

    <section class="dev-panel__section">
      <h4>{{ t('devPanel.path') }}</h4>
      <p class="dev-panel__current">
        {{ t('devPanel.pathCurrent') }}:
        <b>{{ player.cultivationPath ?? t('devPanel.pathUnset') }}{{ player.cultivationWay ? ` / ${player.cultivationWay}` : '' }}</b>
      </p>
      <label class="dev-panel__field">
        {{ t('devPanel.realm') }}
        <select v-model="realmId">
          <option v-for="r in realmOptions" :key="r.id" :value="r.id">{{ r.name }} ({{ r.id }})</option>
        </select>
      </label>
      <div class="dev-panel__actions">
        <button type="button" @click="applyRealm">{{ t('devPanel.applyRealm') }}</button>
      </div>
      <label class="dev-panel__field">
        {{ t('devPanel.path') }}
        <select v-model="pathId" @change="onPathChange">
          <option v-for="p in pathOptions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </label>
      <label class="dev-panel__field">
        {{ t('devPanel.way') }}
        <select v-model="wayId">
          <option v-for="w in wayOptions" :key="w" :value="w">{{ w }}</option>
        </select>
      </label>
      <div class="dev-panel__actions">
        <button type="button" @click="applyPath">{{ t('devPanel.apply') }}</button>
        <button type="button" @click="resetPath">{{ t('devPanel.reset') }}</button>
      </div>
      <p v-if="lastResult" class="dev-panel__result">{{ lastResult }}</p>
    </section>

    <section class="dev-panel__section">
      <h4>{{ t('devPanel.skill') }}</h4>
      <label class="dev-panel__toggle">
        <input
          :checked="skillDesignMode"
          type="checkbox"
          @change="setSkillDesignMode(($event.target as HTMLInputElement).checked)"
        />
        {{ t('devPanel.skillDesign') }}
      </label>
      <p class="dev-panel__hint">{{ t('devPanel.skillDesignHint') }}</p>
      <div class="dev-panel__actions">
        <button type="button" @click="respecTree">{{ t('devPanel.respecTree') }}</button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.dev-panel-open {
  position: fixed;
  right: 14px;
  bottom: 14px;
  z-index: 60;
  min-width: 48px;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid #c9a66a;
  background: linear-gradient(175deg, #2c2110, #1d150c);
  color: #ffdf8e;
  font-family: var(--font-display, Georgia, serif);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.dev-panel {
  position: fixed;
  right: 14px;
  bottom: 74px;
  z-index: 60;
  width: 340px;
  max-height: 70vh;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 14px 16px;
  border: 1px solid #8f7844;
  background: linear-gradient(175deg, #211a10f5, #141009f5);
  color: #e6d5ac;
  font-family: var(--font-display, Georgia, serif);
  font-size: 14px;
}
.dev-panel::-webkit-scrollbar { display: none; }
.dev-panel__title {
  margin: 0 0 8px;
  font-size: 17px;
  color: #ffdf8e;
  letter-spacing: 0.1em;
}
.dev-panel__section {
  padding: 10px 0;
  border-top: 1px solid #8f784455;
}
.dev-panel__section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #d4a94e;
}
.dev-panel__amount,
.dev-panel__field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #c4b088;
}
.dev-panel__amount input,
.dev-panel__field select {
  flex: 1;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid #8f7844;
  background: #1d150c;
  color: #e6d5ac;
  font: inherit;
}
.dev-panel__rows {
  display: grid;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  scrollbar-width: none;
}
.dev-panel__rows::-webkit-scrollbar { display: none; }
.dev-panel__row {
  display: grid;
  grid-template-columns: 1fr 60px auto;
  align-items: center;
  gap: 8px;
}
.dev-panel__row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dev-panel__row b { color: #d8c89e; text-align: right; font-weight: 400; }
.dev-panel__row button,
.dev-panel__actions button {
  padding: 3px 10px;
  border: 1px solid #8f7844;
  background: #1d150c;
  color: #d8c89e;
  font: inherit;
  cursor: pointer;
}
.dev-panel__row button:hover,
.dev-panel__actions button:hover {
  border-color: #c9a66a;
  color: #ffdf8e;
}
.dev-panel__current { margin: 0 0 8px; color: #c4b088; }
.dev-panel__current b { color: #ffdf8e; font-weight: 400; }
.dev-panel__actions { display: flex; gap: 8px; }
.dev-panel__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #e6d5ac;
}
.dev-panel__toggle input { accent-color: #d4a94e; }
.dev-panel__result {
  margin: 4px 0 0;
  font-size: 11px;
  color: #ffdf8e;
}
.dev-panel__hint { margin: 6px 0 0; font-size: 12px; color: #8f7844; }
</style>
