<script setup lang="ts">
// Scene 05 passives region (spec: 1116/452/416/170, list family,
// list-row chrome, scrollfade overflow). Ref merges "Thuoc Tinh Tang
// Hien Tai" stat grid + "Thien Phu Canh Gioi" talent card into the
// canonical realm passive rows (audit 05: CORRECTED -> real
// realmStatPassiveRows, never invented +/- figures).
import type { RealmStatPassiveRow } from '@/composables/useRealmStatPassives'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import RealmSectionTitle from './RealmSectionTitle.vue'

defineProps<{
  rows: readonly RealmStatPassiveRow[]
  realmName: string
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="rows.length" class="realm-passives" data-hk-region="passives">
    <RealmSectionTitle :title="t('panels.realm.sections.passives', { realm: realmName })" />
    <div class="realm-panel__passives">
      <article v-for="row in rows" :key="row.id" class="realm-passive-row">
        <InkNineSlice chrome-id="list-row" layer="surface" />
        <div class="realm-passive-row__head">
          <strong>{{ row.name }}</strong>
          <span v-for="line in row.effectLines" :key="line" class="realm-passive-row__effect">{{ line }}</span>
        </div>
        <span class="realm-passive-row__desc">{{ row.description }}</span>
      </article>
    </div>
  </div>
</template>

<style scoped>
/* Rail-bounded: the passives region yields its extra height to the
   siblings (spec region h170 with internal scrollfade) so the
   breakthrough CTA never gets pushed out of the 610px rail (D-M5). */
.realm-passives {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}
.realm-panel__passives { flex: 1 1 auto; }
.realm-panel__passives {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(to bottom, transparent 0, #000 10px, #000 calc(100% - 10px), transparent 100%);
}
.realm-panel__passives::-webkit-scrollbar { display: none; }
.realm-passive-row {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
}
.realm-passive-row__head {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.realm-passive-row__head strong {
  font-size: var(--text-sm);
  color: var(--hk-text-primary, #ede6d6);
}
.realm-passive-row__effect {
  color: var(--hk-jade, #3fa68b);
  font-size: var(--text-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.realm-passive-row__desc {
  position: relative;
  z-index: 3;
  color: var(--hk-text-secondary, #b8ae97);
  font-size: var(--text-xs);
}
</style>
