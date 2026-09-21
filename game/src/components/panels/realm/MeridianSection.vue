<script setup lang="ts">
// P7-M7 - read-only Bat Mach (meridian) list inside RealmPanel. The
// invest path is M13-PARKED (no Thong Mach Dan gateway), so rows are
// pure status display over the canonical chapter slice - no action.
//
// M-E (D2) - PAGED model: meridians group into per-realm pages. A page
// whose realm the player has not reached renders as locked-preview
// (gate label + every row locked, no 'next' affordance); an unlocked
// page keeps the opened/next/locked sequential semantics. The pace
// label only renders while the player is inside the page's own realm.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useStateVersion } from '@/composables/useGameState'
import { getBodyChapterProgress } from '@/core/realm/body/BodyProgressionSystem'
import {
  isMeridianPageUnlocked,
  listMeridianPages,
} from '@/core/realm/body/MeridianPages'
import { REALMS } from '@/data/realms/realm'
import { statLabel } from '@/core/stats/StatLabels'

const player = usePlayerStore()
const { stateVersion } = useStateVersion()
const { t } = useI18n()

// Static page structure - MERIDIANS is a catalog const; no reactivity
// needed for the grouping itself.
const pages = listMeridianPages()

const chapterProgress = computed(() => {
  stateVersion.value

  return getBodyChapterProgress(player.$state, 'meridian')
})

const pageViews = computed(() => {
  stateVersion.value

  const completed = chapterProgress.value.completed

  return pages.map((page) => {
    const unlocked = isMeridianPageUnlocked(player.$state, page.pageRealmId)
    const inPageRealm = player.$state.realmId === page.pageRealmId
    // find(), not getCurrentRealm() - the latter throws on an
    // unresolved id; a page label degrades to the raw id instead.
    const realmName = REALMS.find((realm) => realm.id === page.pageRealmId)?.name ?? page.pageRealmId

    const rows = page.meridians.map(({ meridian, flatIndex }) => {
      const status = !unlocked
        ? 'locked'
        : flatIndex < completed
          ? 'opened'
          : flatIndex === completed
            ? 'next'
            : 'locked'

      return {
        id: meridian.id,
        name: meridian.name,
        description: meridian.description,
        statLabels: meridian.stats.map(stat => statLabel(stat)).join(' / '),
        percentLabel: `${(meridian.percentAtFullTier * 100).toFixed(0)}%`,
        status,
        // Only the next row on an UNLOCKED page shows requirements -
        // later rows stay bare (sequential contract makes their gates
        // un-actionable), and a locked page suppresses the affordance.
        cost: unlocked && status === 'next' ? meridian.thongMachDanCost : null,
        requiredRealmLevel: unlocked && inPageRealm && status === 'next'
          ? meridian.requiredRealmLevel
          : null,
        requiresAux: unlocked && status === 'next' && meridian.requiresThienDiaChiKieu === true,
      }
    })

    return { pageRealmId: page.pageRealmId, realmName, unlocked, rows }
  })
})
</script>

<template>
  <section class="meridian-section" :aria-label="t('panels.realm.meridian.title')">
    <div class="meridian-section__summary">
      <span>{{ t('panels.realm.meridian.summary', { completed: chapterProgress.completed, total: chapterProgress.total }) }}</span>
    </div>

    <div
      v-for="page in pageViews"
      :key="page.pageRealmId"
      class="meridian-section__page"
      :class="{ 'meridian-section__page--locked': !page.unlocked }"
    >
      <div class="meridian-section__page-head">
        <span class="meridian-section__page-name">{{ page.realmName }}</span>
        <span v-if="!page.unlocked" class="meridian-section__page-lock">
          {{ t('panels.realm.meridian.pageLocked', { realm: page.realmName }) }}
        </span>
      </div>

      <div class="meridian-section__rows">
        <div
          v-for="row in page.rows"
          :key="row.id"
          class="meridian-section__row"
          :class="`meridian-section__row--${row.status}`"
        >
          <div class="meridian-section__row-head">
            <span class="meridian-section__row-name">{{ row.name }}</span>
            <span class="meridian-section__row-state">
              {{ row.status === 'opened' ? t('panels.realm.meridian.stateOpened') : row.status === 'next' ? t('panels.realm.meridian.stateNext') : t('panels.realm.meridian.stateLocked') }}
            </span>
          </div>

          <p class="meridian-section__row-desc">{{ row.description }}</p>
          <p class="meridian-section__row-stats">{{ row.statLabels }} +{{ row.percentLabel }}</p>

          <p v-if="row.status === 'next'" class="meridian-section__row-gate">
            {{ t('panels.realm.meridian.cost', { count: row.cost }) }}
            <template v-if="row.requiredRealmLevel !== null">
              · {{ t('panels.realm.meridian.realmGate', { realm: page.realmName, level: row.requiredRealmLevel }) }}
            </template>
            <template v-if="row.requiresAux">· {{ t('panels.realm.meridian.auxGate') }}</template>
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.meridian-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meridian-section__summary {
  display: flex;
  justify-content: space-between;
  font: 700 var(--text-lg) var(--font-display);
  color: var(--paper-text);
}

.meridian-section__page {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meridian-section__page-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.meridian-section__page-name {
  font-weight: 600;
  color: var(--chrome-300);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.meridian-section__page-lock {
  font-size: var(--text-xs);
  color: var(--crimson);
}

.meridian-section__page--locked .meridian-section__rows {
  opacity: 0.7;
}

.meridian-section__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meridian-section__row {
  padding: 8px 10px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  opacity: 0.55;
}

.meridian-section__row--opened {
  opacity: 1;
  border-color: var(--jade);
}

.meridian-section__row--next {
  opacity: 0.9;
  border-color: var(--chrome-300);
}

.meridian-section__row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.meridian-section__row-name {
  font-weight: 600;
  color: var(--chrome-100);
  font-size: var(--text-md);
}

.meridian-section__row-state {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.meridian-section__row--opened .meridian-section__row-state {
  color: var(--jade);
}

.meridian-section__row-desc {
  margin: 2px 0 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.meridian-section__row-stats {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.meridian-section__row-gate {
  margin: 4px 0 0;
  font-size: var(--text-sm);
  color: var(--crimson);
}
</style>
