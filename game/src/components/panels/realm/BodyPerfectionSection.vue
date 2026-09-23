<script setup lang="ts">
// M-F-BODY-PERFECTION (spec S6) - the hidden Body-perfection surface.
// The whole section renders NOTHING until the first authored
// perfection material is discovered (RealmPanel gates the col on
// isBodyPerfectionRevealed). Partial discovery reveals only the found
// ids - undiscovered requirements never leak names. Rows exist only
// for realms with >= 1 discovered material, in canonical realm order.
// The perfect button mirrors canPerfectBodyRealm's gates;
// realmAdvanceOps.perfectBodyRealm re-validates the whole transaction
// on click (validate -> consume -> mark -> stack -> rebuild).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import {
  canPerfectBodyRealm,
  getBodyPerfectionRealmProgress,
} from '@/core/realm/body/BodyPerfection'
import { REALMS } from '@/data/realms/realm'
import GameButton from '@/components/common/GameButton.vue'

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const { t } = useI18n()

const rows = computed(() => {
  // stateVersion re-reads the non-reactive bag/manager state on every
  // tick bump (same convention as MeridianSection).
  stateVersion.value

  return getBodyPerfectionRealmProgress(player.$state).map((progress) => {
    // find(), not getCurrentRealm() - a fixture/unknown realm label
    // degrades to the raw id instead of throwing.
    const realmName =
      REALMS.find((realm) => realm.id === progress.realmId)?.name ?? progress.realmId

    const materials = progress.discoveredMaterialIds.map((materialId) => ({
      id: materialId,
      name: gameManager.materialRegistry.has(materialId)
        ? gameManager.materialRegistry.get(materialId).name
        : materialId,
      owned: gameManager.materialBag.getAmount(materialId),
    }))

    return {
      realmId: progress.realmId,
      realmName,
      materials,
      perfected: progress.perfected,
      canPerfect: canPerfectBodyRealm(player.$state, progress.realmId, (materialId) =>
        gameManager.materialBag.getAmount(materialId),
      ),
    }
  })
})

function perfect(realmId: string): void {
  if (gameManager.realmAdvanceOps.perfectBodyRealm(player.$state, realmId)) {
    bumpState()
  }
}
</script>

<template>
  <section class="body-perfection-section" :aria-label="t('panels.realm.bodyPerfection.title')">
    <div class="body-perfection-section__rows">
      <div
        v-for="row in rows"
        :key="row.realmId"
        class="body-perfection-section__row"
        :class="{ 'body-perfection-section__row--perfected': row.perfected }"
      >
        <div class="body-perfection-section__row-head">
          <span class="body-perfection-section__row-name">{{ row.realmName }}</span>
          <span class="body-perfection-section__row-state">
            {{ row.perfected ? t('panels.realm.bodyPerfection.statePerfected') : t('panels.realm.bodyPerfection.statePending') }}
          </span>
        </div>

        <p class="body-perfection-section__row-materials">
          <span
            v-for="material in row.materials"
            :key="material.id"
            class="body-perfection-section__material"
          >
            {{ material.name }} · {{ t('panels.realm.bodyPerfection.owned', { count: material.owned }) }}
          </span>
        </p>

        <div v-if="!row.perfected" class="body-perfection-section__row-perfect">
          <GameButton
            size="sm"
            :disabled="!row.canPerfect"
            @click="perfect(row.realmId)"
          >
            {{ t('panels.realm.bodyPerfection.perfect') }}
          </GameButton>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.body-perfection-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.body-perfection-section__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.body-perfection-section__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--sys-line-soft, var(--ink-line-soft, rgba(120, 140, 160, 0.25)));
  border-radius: var(--radius-sm, 6px);
  background: var(--sys-bg-0, var(--ink-800, rgba(20, 28, 38, 0.6)));
}

.body-perfection-section__row--perfected {
  border-color: var(--sys-success, var(--jade, #6fbf73));
}

.body-perfection-section__row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.body-perfection-section__row-name {
  font-size: var(--text-md, 0.95rem);
  font-weight: 600;
  color: var(--sys-text, var(--text-primary, #e8ecf1));
}

.body-perfection-section__row-state {
  font-size: var(--text-xs, 0.75rem);
  color: var(--sys-text-dim, var(--text-muted, #8b96a5));
}

.body-perfection-section__row--perfected .body-perfection-section__row-state {
  color: var(--sys-success, var(--jade, #6fbf73));
}

.body-perfection-section__row-materials {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0;
  font-size: var(--text-sm, 0.85rem);
  color: var(--sys-text-dim, var(--text-muted, #8b96a5));
}

.body-perfection-section__row-perfect {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
