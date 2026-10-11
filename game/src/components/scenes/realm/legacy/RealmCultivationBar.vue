<script setup lang="ts">
// Scene 05 cultivation-bar region (spec: 1116/334/416/110, hud family,
// entity-bar). Ref: "Tu Luyen Tien Do" label + filled bar + percent,
// then two stat chips (rate + ETA) side by side.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Bar from '@/components/common/primitives/Bar.vue'
import RealmSectionTitle from './RealmSectionTitle.vue'

const props = defineProps<{
  cultivation: number
  required: number
  /** Preformatted "+{rate} {unit}/giay" text (real readout). */
  rateText: string
  /** Preformatted ETA duration, '' when rate is zero. */
  etaText: string
}>()

const { t } = useI18n()

const percent = computed(() =>
  props.required > 0 ? Math.min(100, Math.floor((props.cultivation / props.required) * 100)) : 0,
)
</script>

<template>
  <div class="realm-cultivation" data-hk-region="cultivation-bar">
    <div class="realm-cultivation__head">
      <RealmSectionTitle :title="t('panels.realm.sections.progress')" />
      <span class="realm-cultivation__pct">{{ percent }}%</span>
    </div>
    <Bar
      :value="cultivation"
      :max="required"
      :height="16"
      pill
      variant="system"
      class="realm-cultivation__bar"
    />
    <span class="realm-cultivation__value">{{ Math.floor(cultivation) }} / {{ Math.floor(required) }} {{ t('panels.realm.cultivationUnit') }}</span>
    <div v-if="rateText" class="realm-cultivation__meta">
      <div class="realm-meta-chip">
        <i class="realm-meta-chip__icon realm-meta-chip__icon--flame art-needed" data-art-id="realm-icon-flame" aria-hidden="true" />
        <div class="realm-meta-chip__text">
          <small>{{ t('panels.realm.meta.rateLabel') }}</small>
          <span class="realm-panel__cultivation-meta">{{ rateText }}</span>
        </div>
      </div>
      <div v-if="etaText" class="realm-meta-chip">
        <i class="realm-meta-chip__icon realm-meta-chip__icon--hourglass art-needed" data-art-id="realm-icon-hourglass" aria-hidden="true" />
        <div class="realm-meta-chip__text">
          <small>{{ t('panels.realm.meta.etaLabel') }}</small>
          <span>{{ etaText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.realm-cultivation { display: flex; flex-direction: column; gap: 5px; }
.realm-cultivation__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.realm-cultivation__pct {
  color: var(--hk-jade, #3fa68b);
  font: 700 var(--text-xs) var(--font-display, serif);
  font-variant-numeric: tabular-nums;
}
.realm-cultivation__bar {
  --bar-track: var(--sys-bg-0, var(--ink-950));
  border: 1px solid var(--sys-line-soft, var(--ink-line));
}
.realm-cultivation__value {
  color: var(--hk-text-primary, #ede6d6);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.realm-cultivation__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.realm-meta-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 5px 8px;
  background: var(--hk-surface-raised, #131b17);
  border: 1px solid var(--hk-border-muted, #2a352f);
  border-radius: var(--hk-radius-md, 6px);
}
.realm-meta-chip__icon { flex: 0 0 auto; width: 15px; height: 15px; position: relative; }
.realm-meta-chip__icon--flame {
  background: radial-gradient(circle at 50% 70%, #e8c35a, transparent 62%);
  clip-path: polygon(50% 0, 78% 34%, 92% 66%, 80% 92%, 50% 100%, 20% 92%, 8% 66%, 22% 34%);
}
.realm-meta-chip__icon--hourglass {
  background: var(--hk-gold-muted, #7a6234);
  clip-path: polygon(15% 0, 85% 0, 85% 22%, 58% 50%, 85% 78%, 85% 100%, 15% 100%, 15% 78%, 42% 50%, 15% 22%);
}
.realm-meta-chip__text { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.realm-meta-chip__text small { color: var(--hk-text-muted, #7a7260); font-size: var(--text-xs); }
.realm-meta-chip__text span {
  color: var(--hk-text-primary, #ede6d6);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
