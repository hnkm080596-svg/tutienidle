<script setup lang="ts">
// Scene 05 requirements region (spec: 1116/630/416/92, badge family,
// seal-chip). Ref draws material-cost chips; the real gates are the
// canonical breakthrough requirements (level / chapter-clear) rendered
// as met/unmet seal chips (matrix 2.7: met jade / unmet cinnabar).
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'

defineProps<{ rows: readonly { key: string; met: boolean; label: string }[] }>()

const { t } = useI18n()
</script>

<template>
  <ul v-if="rows.length" class="realm-requirements">
    <li
      v-for="row in rows"
      :key="row.key"
      class="realm-requirement"
      :class="{ 'realm-requirement--met': row.met }"
    >
      <InkNineSlice
        chrome-id="seal-chip"
        layer="surface"
        :tint-var="row.met ? '--hk-jade' : '--hk-cinnabar'"
      />
      <span
        class="realm-requirement__marker"
        :aria-label="row.met ? t('panels.realm.requirements.met') : t('panels.realm.requirements.unmet')"
      >{{ row.met ? '✓' : '✗' }}</span>
      <span class="realm-requirement__text">{{ row.label }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* Matrix 2.7: met jade / unmet cinnabar. seal-chip tintable sheet
   carries the state color; marker + label ride above the slice. */
.realm-requirements {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.realm-requirement {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-size: var(--text-sm);
  color: var(--hk-cinnabar, #b3452e);
}
.realm-requirement--met { color: var(--hk-jade, #3fa68b); }
.realm-requirement__marker {
  position: relative;
  z-index: 3;
  font-weight: 700;
  width: 1em;
  text-align: center;
}
.realm-requirement__text {
  position: relative;
  z-index: 3;
  color: var(--hk-text-primary, #ede6d6);
}
</style>
