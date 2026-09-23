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
import { computed, ref, useId, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from './primitives/InkNineSlice.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import {
  getTalentLevel,
  getUpgradeableTalentIds,
  reconcileTalentEntitlement,
  type TalentEntitlementDecision,
} from '@/core/talent/TalentEntitlement'
import { getTalentDefinition } from '@/data/talent/Talents'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

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
// here). Unknown ids (a pool def retired after the save) drop out like
// every consumer of the catalog.
const offeredTalents = computed<TalentDefinition[]>(() => {
  const ids = entitlement.value?.offeredTalentIds ?? []

  return ids
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

const panelRef = ref<HTMLElement | null>(null)
useDialogFocus(panelRef, open, {
  // No escape path - the decision is mandatory; the dialog stays until
  // ONE branch resolves (cancel-safe, reload-safe via the record).
  onEscape: () => {},
})

const titleId = useId()

function decide(decision: TalentEntitlementDecision): void {
  // Domain owns grant/legality; a rejected decision keeps the record
  // (and the dialog) - the UI never shows an illegal choice in the
  // authored pools, so a false return needs no surfacing.
  gameManager.realmAdvanceOps.resolveTalentEntitlement(player, decision)
}
</script>

<template>
  <div v-if="entitlement" class="talent-entitlement" :style="{ zIndex: OVERLAY_LAYERS.modal }" data-testid="talent-entitlement-modal">
    <section
      ref="panelRef"
      class="talent-entitlement__panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <InkNineSlice asset-id="surface-m-paper" layer="surface" />
      <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" :thickness="18" />

      <h3 :id="titleId" class="talent-entitlement__title">{{ t('tribulation.entitlement.title') }}</h3>
      <p class="talent-entitlement__body">{{ t('tribulation.entitlement.body') }}</p>

      <template v-if="offeredTalents.length > 0">
        <h4 class="talent-entitlement__heading">{{ t('tribulation.entitlement.newHeading') }}</h4>
        <div class="talent-grid">
          <button
            v-for="talent in offeredTalents"
            :key="talent.id"
            type="button"
            class="talent-card"
            :class="`talent-tier-${talent.rarity}`"
            :data-testid="`entitlement-talent-${talent.id}`"
            @click="decide({ kind: 'new', talentId: talent.id })"
          >
            <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[talent.rarity] }}</span>
            <h5>{{ talent.name }}</h5>
            <p>{{ talent.description }}</p>
            <small>{{ talent.tags[0] }}</small>
          </button>
        </div>
      </template>

      <template v-if="upgradeableTalents.length > 0">
        <h4 class="talent-entitlement__heading">{{ t('tribulation.entitlement.upgradeHeading') }}</h4>
        <div class="upgrade-list">
          <button
            v-for="row in upgradeableTalents"
            :key="row.talent.id"
            type="button"
            class="upgrade-card"
            :class="`talent-tier-${row.talent.rarity}`"
            :data-testid="`entitlement-upgrade-${row.talent.id}`"
            @click="decide({ kind: 'upgrade', talentId: row.talent.id })"
          >
            <span class="talent-card__rarity">{{ TALENT_RARITY_LABELS[row.talent.rarity] }}</span>
            <h5>{{ row.talent.name }}</h5>
            <span class="upgrade-card__level">{{ t('tribulation.entitlement.levelArrow', { current: row.level, next: row.nextLevel }) }}</span>
            <p>{{ row.talent.description }}</p>
          </button>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.talent-entitlement {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

/* M-tier InkNineSlice - same surface/frame pairing as OfflineSummaryModal;
   the dialog is wider to hold the 3-card grid but keeps the M frame band.
   surface-m-paper paints a dark surface, so the panel remaps the paper
   tokens to the surface ramp - the same override .ink-drawer applies for
   ink surfaces (theme.css). */
.talent-entitlement__panel {
  --paper-50: var(--surface-600);
  --paper-text: var(--surface-text);
  --paper-text-soft: var(--surface-text-soft);
  --paper-text-muted: var(--surface-text-muted);
  --paper-line: var(--surface-line);
  --paper-line-soft: var(--surface-line-soft);

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(560px, 94vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 44px 40px;
  color: var(--paper-text, #211f1a);
  font-family: var(--font-body);
}

.talent-entitlement__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.talent-entitlement__title {
  margin: 0 0 2px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  text-align: center;
}

.talent-entitlement__body {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--paper-text-soft, #5e5a50);
  text-align: center;
}

.talent-entitlement__heading {
  margin: 6px 0 0;
  font: 600 var(--text-md) var(--font-display);
  text-align: center;
}

.talent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Talent card styling mirrors the creation screen's .talent-card
   (talent-grid + talent-tier-* rarity accent) - same card grammar for
   the same pick-one interaction. */
.talent-card,
.upgrade-card {
  position: relative;
  padding: 12px;
  border: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  border-radius: 2px;
  background: color-mix(in srgb, var(--paper-50, #f5f0e4) 88%, transparent);
  color: var(--paper-text, #211f1a);
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.talent-card:hover,
.upgrade-card:hover {
  transform: translateY(-2px);
  border-color: var(--cinnabar, #b54432);
}

.talent-card__rarity {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.talent-card h5,
.upgrade-card h5 {
  margin: 6px 0;
  font: 600 var(--text-md) var(--font-display);
}

.talent-card p,
.upgrade-card p {
  margin: 0 0 6px;
  color: var(--paper-text-soft, #5e5a50);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.talent-card small {
  color: var(--text-muted);
}

.upgrade-card__level {
  float: right;
  font: 600 var(--text-xs) var(--font-body);
  color: var(--cinnabar, #b54432);
}

.upgrade-card {
  display: flex;
  flex-direction: column;
}

.talent-tier-pham .talent-card__rarity { color: var(--rank-color-1) }
.talent-tier-linh .talent-card__rarity { color: var(--rank-color-3) }
.talent-tier-dia .talent-card__rarity { color: var(--rank-color-5) }
.talent-tier-thien .talent-card__rarity { color: var(--rank-color-7) }
.talent-tier-di .talent-card__rarity { color: var(--rank-color-8) }
</style>
