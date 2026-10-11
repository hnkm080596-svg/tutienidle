<script setup lang="ts">
// Scene 05 rail action block: requirements region + breakthrough-cta
// region share `.realm-panel__actions` (spec v2 sec.3.2 pin kept - the
// requirement list lives INSIDE this block). Ref order: condition chips
// above the CTA.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RealmRequirementChips from './RealmRequirementChips.vue'
import RealmBreakthroughCta from './RealmBreakthroughCta.vue'
import RealmSectionTitle from './RealmSectionTitle.vue'
import { CORE_REALM_LEVEL } from '@/core/realm/realmSystem'

const props = defineProps<{
  /** Canonical gate rows (key = 'level' | 'chapterClear' | ...). */
  requirements: readonly { key: string; met: boolean }[]
  realmName: string
  /** Next-realm target name for the section title + CTA fallback. */
  targetName: string
  /** Beta ceiling reached - CTA + its heading hide entirely. */
  showCta: boolean
  canBreakthrough: boolean
  ctaLabel: string
}>()

const emit = defineEmits<{ breakthrough: [] }>()

const { t } = useI18n()

const rows = computed(() =>
  props.requirements.map(row => ({
    key: row.key,
    met: row.met,
    label:
      row.key === 'level'
        ? t('panels.realm.requirements.level', { realm: props.realmName, level: CORE_REALM_LEVEL })
        : t('panels.realm.requirements.chapterClear'),
  })),
)
</script>

<template>
  <div class="realm-panel__actions">
    <template v-if="requirements.length">
      <RealmSectionTitle
        :title="t('panels.realm.sections.requirements', { target: targetName })"
      />
      <RealmRequirementChips :rows="rows" />
    </template>
    <RealmBreakthroughCta
      v-if="showCta"
      :label="ctaLabel"
      :disabled="!canBreakthrough"
      @activate="emit('breakthrough')"
    />
  </div>
</template>

<style scoped>
.realm-panel__actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  padding-bottom: 4px;
  border-top: 1px solid var(--hk-border-muted, var(--ink-line));
}
.realm-panel__actions :deep(button:disabled) { opacity: 0.38; filter: grayscale(1); }
</style>
