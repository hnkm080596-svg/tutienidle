<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BreakthroughGrowthSnapshot, RealmFoundationTotals } from '@/core/realm/RealmFoundationGrowth'
import { formatNumber } from '@/core/format/NumberFormatter'

defineProps<{
  snapshot: BreakthroughGrowthSnapshot | null
}>()

const emit = defineEmits<{
  close: []
  openAttributes: []
}>()

const { t } = useI18n()

const STAT_LABEL_KEYS: Record<keyof RealmFoundationTotals, string> = {
  maxHp: 'panels.realm.growthModal.stats.maxHp',
  might: 'panels.realm.growthModal.stats.might',
  defense: 'panels.realm.growthModal.stats.defense',
  hpRegenPerTurn: 'panels.realm.growthModal.stats.hpRegenPerTurn',
  speed: 'panels.realm.growthModal.stats.speed',
  cultivationPercent: 'panels.realm.growthModal.stats.cultivationPercent',
  productionSpeedMultiplier: 'panels.realm.growthModal.stats.productionSpeedMultiplier',
  affixDeltaPercent: 'panels.realm.growthModal.stats.affixDeltaPercent',
  realmPassivePercent: 'panels.realm.growthModal.stats.realmPassivePercent',
}

const PERCENT_KEYS = new Set<keyof RealmFoundationTotals>([
  'cultivationPercent',
  'productionSpeedMultiplier',
  'affixDeltaPercent',
  'realmPassivePercent',
])

function formatStatVal(stat: keyof RealmFoundationTotals, val: number): string {
  if (PERCENT_KEYS.has(stat)) {
    const pct = val * 100
    return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
  }
  return Number.isInteger(val) ? formatNumber(val) : val.toFixed(1)
}
</script>

<template>
  <div
    v-if="snapshot"
    class="bg-modal-backdrop"
    role="dialog"
    aria-modal="true"
    :aria-label="t('panels.realm.growthModal.title')"
    data-testid="breakthrough-growth-modal"
    @click.self="emit('close')"
  >
    <div class="bg-modal">
      <header class="bg-modal__header">
        <span class="bg-modal__eyebrow">
          {{ snapshot.isMajorRealm ? t('panels.realm.growthModal.eyebrowMajor') : t('panels.realm.growthModal.eyebrowMinor') }}
        </span>
        <h2 class="bg-modal__title">{{ t('panels.realm.growthModal.title') }}</h2>
        <div class="bg-modal__transition">
          <span class="bg-modal__realm-from">
            {{ snapshot.fromRealmName }} · {{ t('panels.realm.growthModal.floor', { level: snapshot.fromLevel }) }}
          </span>
          <span class="bg-modal__arrow" aria-hidden="true">⟶</span>
          <strong class="bg-modal__realm-to">
            {{ snapshot.toRealmName }} · {{ t('panels.realm.growthModal.floor', { level: snapshot.toLevel }) }}
          </strong>
        </div>
      </header>

      <section class="bg-modal__section">
        <h3 class="bg-modal__section-title">{{ t('panels.realm.growthModal.foundationHeading') }}</h3>
        <ul class="bg-modal__stat-list">
          <li v-for="row in snapshot.statRows" :key="row.stat" class="bg-modal__stat-row">
            <span class="bg-modal__stat-name">{{ t(STAT_LABEL_KEYS[row.stat]) }}</span>
            <span class="bg-modal__stat-values">
              <span class="bg-modal__stat-before">{{ formatStatVal(row.stat, row.before) }}</span>
              <span class="bg-modal__stat-sep" aria-hidden="true">→</span>
              <strong class="bg-modal__stat-after">{{ formatStatVal(row.stat, row.after) }}</strong>
              <em class="bg-modal__stat-delta">(+{{ formatStatVal(row.stat, row.delta) }})</em>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="snapshot.attributePointsGained > 0" class="bg-modal__reward">
        <div class="bg-modal__reward-copy">
          <strong>{{ t('panels.realm.growthModal.freePointGain', { count: snapshot.attributePointsGained }) }}</strong>
          <small>{{ t('panels.realm.growthModal.freePointTotal', { total: snapshot.totalAttributePoints }) }}</small>
        </div>
        <button type="button" class="bg-modal__btn bg-modal__btn--secondary" @click="emit('openAttributes')">
          {{ t('panels.realm.growthModal.allocateCta') }}
        </button>
      </section>

      <footer class="bg-modal__footer">
        <button type="button" class="bg-modal__btn bg-modal__btn--primary" @click="emit('close')">
          {{ t('panels.realm.growthModal.continueCta') }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.bg-modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 45;
  display: grid;
  place-items: center;
  background: rgba(10, 9, 7, 0.72);
  backdrop-filter: blur(2px);
  animation: bg-fade-in 180ms ease-out;
}

.bg-modal {
  width: min(460px, 92vw);
  padding: 24px 28px 22px;
  border: 2px solid #c9a761;
  outline: 1px solid rgba(235, 208, 148, 0.35);
  outline-offset: -6px;
  background:
    radial-gradient(circle at 50% 0%, rgba(214, 168, 82, 0.22), transparent 65%),
    linear-gradient(180deg, #231d14 0%, #17140e 100%);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.78), 0 0 28px rgba(201, 167, 97, 0.28);
  color: #f1e6c5;
  font-family: var(--font-display, Georgia, serif);
}

.bg-modal__header {
  text-align: center;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(201, 167, 97, 0.35);
}

.bg-modal__eyebrow {
  display: inline-block;
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d6a852;
  margin-bottom: 4px;
}

.bg-modal__title {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 700;
  color: #ffe7ad;
  text-shadow: 0 2px 10px rgba(214, 168, 82, 0.45);
}

.bg-modal__transition {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 15px;
}

.bg-modal__realm-from {
  color: #b9ab8b;
}

.bg-modal__arrow {
  color: #d6a852;
  font-weight: 700;
}

.bg-modal__realm-to {
  color: #ffe9ae;
  font-weight: 700;
}

.bg-modal__section {
  margin-top: 14px;
}

.bg-modal__section-title {
  margin: 0 0 8px;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #cbb582;
}

.bg-modal__stat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 7px;
}

.bg-modal__stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background: rgba(255, 244, 214, 0.04);
  border: 1px solid rgba(201, 167, 97, 0.22);
}

.bg-modal__stat-name {
  font-size: 14px;
  color: #e6d6b0;
}

.bg-modal__stat-values {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.bg-modal__stat-before {
  color: #a89c80;
}

.bg-modal__stat-sep {
  color: #c9a761;
}

.bg-modal__stat-after {
  color: #fff2cc;
  font-weight: 700;
}

.bg-modal__stat-delta {
  font-style: normal;
  font-weight: 700;
  color: #7ee2a8;
}

.bg-modal__reward {
  margin-top: 14px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: rgba(214, 168, 82, 0.12);
  border: 1px solid rgba(214, 168, 82, 0.42);
}

.bg-modal__reward-copy {
  display: grid;
  gap: 2px;
}

.bg-modal__reward-copy strong {
  font-size: 14px;
  color: #ffe6a3;
}

.bg-modal__reward-copy small {
  font-size: 12px;
  color: #c7b894;
}

.bg-modal__footer {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}

.bg-modal__btn {
  cursor: pointer;
  font-family: inherit;
  border: 1px solid #c9a761;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 700;
  transition: filter 150ms ease, transform 120ms ease;
}

.bg-modal__btn:hover {
  filter: brightness(1.12);
}

.bg-modal__btn--primary {
  min-width: 170px;
  background: linear-gradient(180deg, #f3d287 0%, #c89b43 100%);
  color: #231707;
}

.bg-modal__btn--secondary {
  padding: 6px 12px;
  font-size: 13px;
  background: rgba(42, 34, 21, 0.9);
  color: #f3d999;
}

@keyframes bg-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
