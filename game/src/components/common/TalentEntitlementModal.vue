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
//
// M-UI-OVERHAUL: renders on SysModalBase. Escape/scrim stay dead because
// 'close' is never wired to a dismiss action - the record still owns
// the dialog lifetime.
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import SysModalBase from './system/SysModalBase.vue'
import { TALENT_RARITY_LABELS, type TalentDefinition } from '@/core/talent/Talent'
import {
  getTalentLevel,
  getUpgradeableTalentIds,
  isLegalBreakthroughOffer,
  reconcileTalentEntitlement,
  type TalentEntitlementDecision,
} from '@/core/talent/TalentEntitlement'
import { getTalentDefinition } from '@/data/talent/Talents'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
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

function decide(decision: TalentEntitlementDecision): void {
  // Domain owns grant/legality; a rejected decision keeps the record
  // (and the dialog) - the UI never shows an illegal choice in the
  // authored pools, so a false return needs no surfacing.
  gameManager.realmAdvanceOps.resolveTalentEntitlement(player, decision)
}
</script>

<template>
  <SysModalBase
    :open="open"
    :title="t('tribulation.entitlement.title')"
    width="min(560px, 94vw)"
    :layer="OVERLAY_LAYERS.modal"
    :close-on-scrim="false"
    card-class="talent-entitlement"
    data-testid="talent-entitlement-modal"
  >
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
  </SysModalBase>
</template>

<style scoped>
.talent-entitlement__body {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50));
  text-align: center;
}

.talent-entitlement__heading {
  margin: 10px 0 0;
  font: 600 var(--text-md) var(--sys-font-display, var(--font-display));
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--sys-text, inherit);
  text-align: center;
}

.talent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

/* Talent card grammar carried over to the sys readout: T4 widget card
   with hairline border, rarity tier keeps its --rank-color-* accent.
   Fallback hexes keep the cards legible without system-theme.css. */
.talent-card,
.upgrade-card {
  position: relative;
  padding: 12px;
  border: 1px solid var(--sys-line-soft, rgba(42, 41, 36, 0.42));
  border-radius: 0;
  background: var(--sys-bg-1, color-mix(in srgb, var(--sys-bg-0, var(--paper-50, #f5f0e4)) 88%, transparent));
  color: var(--sys-text, var(--paper-text, #211f1a));
  text-align: left;
  cursor: pointer;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition: border-color 0.15s, filter 0.15s;
}

.talent-card:hover,
.upgrade-card:hover {
  border-color: var(--sys-accent, var(--cinnabar, #b54432));
  filter: drop-shadow(0 0 8px color-mix(in srgb, var(--sys-accent, #b54432) 40%, transparent));
}

.talent-card:focus-visible,
.upgrade-card:focus-visible {
  outline: 2px solid var(--sys-focus, rgba(217, 212, 199, .65));
  outline-offset: 2px;
}

.talent-card__rarity {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.13em;
}

.talent-card h5,
.upgrade-card h5 {
  margin: 6px 0;
  font: 600 var(--text-md) var(--sys-font-display, var(--font-display));
}

.talent-card p,
.upgrade-card p {
  margin: 0 0 6px;
  color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50));
  font-size: var(--text-xs);
  line-height: 1.5;
}

.talent-card small {
  color: var(--sys-text-dim, var(--text-muted));
}

.upgrade-card__level {
  float: right;
  font: 600 var(--text-xs) var(--sys-font-display, var(--font-body));
  font-variant-numeric: tabular-nums;
  color: var(--sys-accent, var(--cinnabar, #b54432));
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
