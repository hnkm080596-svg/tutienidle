<script setup lang="ts">
// M-F-TALENT (ruling S15-18) - the mandatory breakthrough talent
// transaction's decision surface. One settled breakthrough originates
// one persisted entitlement (player.pendingTalentEntitlement); this
// blocking dialog offers the ONE UPGRADE/NEW decision and resolves it
// through GameManager.realmAdvanceOps (domain authority, A5/A7).
//
// Cancel-safe by construction: there is NO dismiss path - no close
// button, the scrim swallows its own clicks, Escape is a no-op. The
// persisted record is what re-presents the modal after a mid-decision
// reload; the tribulation drain (useTribulation's
// checkTribulationOutcomeAction) waits on the same record.
import { computed, ref, useId, watchEffect, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { type TalentDefinition } from '@/core/talent/Talent'
import {
  getTalentLevel,
  getUpgradeableTalentIds,
  isLegalBreakthroughOffer,
  reconcileTalentEntitlement,
  type TalentEntitlementDecision,
} from '@/core/talent/TalentEntitlement'
import { getTalentDefinition } from '@/data/talent/Talents'
import { buildTalentTooltip, talentIconUrl } from '@/composables/useTalentTooltip'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useAudioStore } from '@/stores/audio'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateDivider from '@/components/common/art/OrnateDivider.vue'
import GameCard from '@/components/common/GameCard.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const { t } = useI18n()

const entitlement = computed(() => player.pendingTalentEntitlement)
const open = computed(() => entitlement.value !== undefined)

// A record that rots while mounted (every offered card granted by a
// later path, realm pool release-suppressed, no legal upgrade left)
// holds an uncancellable dialog with nothing to decide - reconcile it
// away rather than lock the player. A valid record is untouched.
watchEffect(() => {
  reconcileTalentEntitlement(player)
})

// NEW branch: the 3 cards bound at origination (deduped, realm-pooled,
// no reroll - offeredTalentIds is the persisted draw, never re-rolled
// here). Rendered cards must still be live decisions: an id that is no
// longer a legal offer (foreign id, zero-weight member, retired def) or
// was granted by a later path is a dead card - never render a choice
// the resolver would reject.
const offeredTalents = computed<TalentDefinition[]>(() => {
  const record = entitlement.value

  if (record === undefined) {
    return []
  }

  return record.offeredTalentIds
    .filter(
      (id) =>
        isLegalBreakthroughOffer(record.realmId, id) &&
        !player.selectedTalentIds.includes(id),
    )
    .map((id) => getTalentDefinition(id))
    .filter((talent): talent is TalentDefinition => talent !== undefined)
})

// UPGRADE branch: owned talents with a legal next level (the filter
// already bounds level < maxLevel, so next = level + 1 is always legal).
const upgradeableTalents = computed<{ talent: TalentDefinition; level: number; nextLevel: number }[]>(() =>
  getUpgradeableTalentIds(player).map((id) => {
    const talent = getTalentDefinition(id)!
    const level = getTalentLevel(player, id)

    return { talent, level, nextLevel: level + 1 }
  }),
)

const dialogRef = ref<ComponentPublicInstance | null>(null)
const panelEl = () => (dialogRef.value?.$el as HTMLElement | undefined) ?? null
useDialogFocus(panelEl, open, {
  // No escape path - the decision is mandatory; the dialog stays until
  // ONE branch resolves (cancel-safe, reload-safe via the record).
  onEscape: () => {},
})

const titleId = useId()

function decide(decision: TalentEntitlementDecision): void {
  // Domain owns grant/legality; a rejected decision keeps the record
  // (and the dialog) - the UI never shows an illegal choice in the
  // authored pools, so a false return needs no surfacing.
  // W7: a decided entitlement is a progression pick.
  if (gameManager.realmAdvanceOps.resolveTalentEntitlement(player, decision)) {
    useAudioStore().cue('progress.talent_pick')
  }
}
</script>

<template>
  <div
    v-if="entitlement"
    class="talent-entitlement"
    :style="{ zIndex: OVERLAY_LAYERS.modal }"
    data-testid="talent-entitlement-modal"
  >
    <OrnateDialog
      ref="dialogRef"
      class="talent-entitlement__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :title="t('tribulation.entitlement.title')"
      :title-id="titleId"
      badge="info"
      :show-close="false"
      width="min(620px, 94vw)"
    >
      <p class="talent-entitlement__body">{{ t('tribulation.entitlement.body') }}</p>

      <OrnateDivider />

      <template v-if="offeredTalents.length > 0">
        <h4 class="talent-entitlement__heading">{{ t('tribulation.entitlement.newHeading') }}</h4>
        <div class="talent-grid">
          <GameCard
            v-for="talent in offeredTalents"
            :key="talent.id"
            as="button"
            type="button"
            class="talent-card"
            :class="`talent-tier-${talent.rarity}`"
            :data-rarity="talent.rarity"
            :data-testid="`entitlement-talent-${talent.id}`"
            :aria-label="talent.name"
            v-tooltip="buildTalentTooltip(talent, t)"
            @click="decide({ kind: 'new', talentId: talent.id })"
          >
            <img class="talent-card__icon" :src="talentIconUrl(talent)" :alt="talent.name" draggable="false" />
          </GameCard>
        </div>
      </template>

      <template v-if="upgradeableTalents.length > 0">
        <h4 class="talent-entitlement__heading">{{ t('tribulation.entitlement.upgradeHeading') }}</h4>
        <div class="upgrade-list">
          <GameCard
            v-for="row in upgradeableTalents"
            :key="row.talent.id"
            as="button"
            type="button"
            class="upgrade-card"
            :class="`talent-tier-${row.talent.rarity}`"
            :data-rarity="row.talent.rarity"
            :data-testid="`entitlement-upgrade-${row.talent.id}`"
            :aria-label="`${row.talent.name} (${t('tribulation.entitlement.levelArrow', { current: row.level, next: row.nextLevel })})`"
            v-tooltip="buildTalentTooltip(row.talent, t)"
            @click="decide({ kind: 'upgrade', talentId: row.talent.id })"
          >
            <img class="talent-card__icon" :src="talentIconUrl(row.talent)" :alt="row.talent.name" draggable="false" />
            <span class="upgrade-card__level">
              {{ t('tribulation.entitlement.levelArrow', { current: row.level, next: row.nextLevel }) }}
            </span>
          </GameCard>
        </div>
      </template>
    </OrnateDialog>
  </div>
</template>

<style scoped>
.talent-entitlement {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim, rgba(10, 9, 7, 0.75));
}

.talent-entitlement__panel {
  flex: none;
}

.talent-entitlement__panel :deep(.ornate-dialog__badge) {
  height: 13.5cqh;
  margin-top: 0.4%;
}

.talent-entitlement__panel :deep(.ornate-dialog__body) {
  padding-bottom: 4cqh;
}

.talent-entitlement__body {
  margin: 0 0 0.2cqh;
  font-family: var(--font-body);
  font-size: min(2.4cqh, 13.5px);
  line-height: 1.45;
  color: var(--paper-text-soft, #5e5a50);
  text-align: center;
}

.talent-entitlement__heading {
  margin: 0.8cqh 0 0.6cqh;
  font-family: var(--font-display);
  font-size: min(2.9cqh, 16px);
  font-weight: 700;
  color: #3a2c14;
  text-align: center;
}

.talent-grid,
.upgrade-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
}

/* 9-slice GameCard option tile: square icon-only button, details shown on hover via v-tooltip. */
.talent-card,
.upgrade-card {
  width: 92px;
  height: 92px;
  padding: 12px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.talent-card:hover,
.upgrade-card:hover,
.talent-card:focus-visible,
.upgrade-card:focus-visible {
  transform: translateY(-3px) scale(1.04);
  filter: brightness(1.15) drop-shadow(0 4px 10px rgba(219, 178, 96, 0.45));
}

.talent-card:focus-visible,
.upgrade-card:focus-visible {
  outline: 2px solid var(--hk-gold-bright, #e8b45a);
  outline-offset: 2px;
}

.talent-card__icon {
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.65));
  pointer-events: none;
}

.upgrade-card__level {
  position: absolute;
  right: 8px;
  bottom: 6px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(15, 22, 18, 0.88);
  border: 1px solid rgba(219, 178, 96, 0.65);
  color: #f3dfb5;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  pointer-events: none;
}
</style>
