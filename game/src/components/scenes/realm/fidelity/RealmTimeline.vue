<script setup lang="ts">
// Horizontal floor carousel for the Canh Gioi surface: every floor of the
// current realm is a milestone card on the golden rail; floors past the
// player's current floor render locked (grayscale). Clicking a card emits
// `select` - the track slides so that floor lands under the focus card.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { CORE_REALM_LEVEL } from '@/core/realm/realmSystem'

const props = defineProps<{ current: number; selected: number; max: number }>()
const emit = defineEmits<{ select: [floor: number] }>()
const { t } = useI18n()

const SPACING = 170

const visibleMax = computed(() => Math.min(props.max, Math.max(CORE_REALM_LEVEL, props.current)))

const floors = computed(() => {
  /* Focus card is 270px wide where a milestone is ~110: push milestones away
     from the selected slot so the card-circle gap matches circle-circle. */
  const widen = SPACING / 2
  const rows: Array<{ floor: number; left: number; locked: boolean; status: string }> = []
  for (let i = 1; i <= visibleMax.value; i += 1) {
    const shift = i < props.selected ? -widen : i > props.selected ? widen : 0
    rows.push({
      floor: i,
      left: (i - 1) * SPACING + shift,
      locked: i > props.current,
      status: i < props.current
        ? t('panels.realm.nodes.unlocked')
        : i === props.current
          ? t('panels.realm.nodes.current')
          : t('panels.realm.nodes.locked'),
    })
  }
  return rows
})

const trackX = computed(() => `calc(50% - ${(props.selected - 1) * SPACING}px)`)
const focusX = computed(() => `${(props.selected - 1) * SPACING}px`)
const landscape = (floor: number) => resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/realm/landscape-${((floor - 1) % 3) + 1}-v1.png`)
</script>
<template>
  <div
    class="realm-track"
    :style="{ transform: `translateX(${trackX})`, '--focus-x': focusX }"
    role="listbox"
    aria-orientation="horizontal"
    :aria-label="t('realm.title')"
  >
    <slot />
    <span class="realm-rail-pulse" :key="`pulse-${selected}`" aria-hidden="true"></span>
    <button
      v-for="row in floors"
      :key="row.floor"
      type="button"
      class="realm-milestone"
      :class="{ locked: row.locked, hidden: row.floor === selected }"
      :style="{ left: `${row.left}px` }"
      :aria-selected="row.floor === selected"
      role="option"
      @click="emit('select', row.floor)"
    >
      <img :src="landscape(row.floor)" alt="" />
      <b>{{ t('realm.floorLabel', { floor: row.floor }) }}</b>
      <span>{{ row.status }}</span>
    </button>
  </div>
</template>
<style scoped>
.realm-track { position:absolute; left:0; top:144px; width:100%; height:150px; transition:transform 700ms cubic-bezier(0.25,0.7,0.2,1); will-change:transform; }
.realm-track:before { content:''; position:absolute; left:-4000px; right:-4000px; top:48px; height:4px; background:linear-gradient(#d4b264,#79532d,#dfc689); }
/* One-shot glow burst where the selected circle becomes the card - sells
   the 'lands on the rail' beat after the slide settles. */
.realm-rail-pulse { position:absolute; left:var(--focus-x, 50%); top:50px; width:16px; height:16px; margin-left:-8px; margin-top:-8px; border-radius:50%; background:radial-gradient(circle,#fff3c9 0%,#e8c96f 45%,transparent 72%); box-shadow:0 0 22px 9px #f0d98aa8; opacity:0; pointer-events:none; animation:realm-rail-pop 900ms ease-out 450ms forwards; }
@keyframes realm-rail-pop {
  0% { opacity:0; transform:scale(.2); }
  35% { opacity:1; transform:scale(2.6); }
  100% { opacity:0; transform:scale(4.2); }
}
@media (prefers-reduced-motion: reduce) {
  .realm-rail-pulse { animation:none; }
}
.realm-milestone { position:absolute; width:110px; margin-left:-55px; display:flex; flex-direction:column; align-items:center; gap:4px; border:0; background:none; padding:0; font:inherit; color:inherit; cursor:pointer; transition:opacity 300ms, filter 500ms; }
.realm-milestone img { width:100px; height:100px; object-fit:contain; }
.realm-milestone b { font-size:18px; font-weight:500; }
.realm-milestone span { font-size:12px; background:#24241c; color:#ebd6a6; border:1px solid #a48142; padding:3px 13px; white-space:nowrap; }
.realm-milestone.locked img { filter:grayscale(1); opacity:0.7; }
.realm-milestone.hidden { opacity:0; pointer-events:none; visibility:hidden; }
@media (prefers-reduced-motion: reduce) {
  .realm-track, .realm-milestone { transition:none; }
}
</style>
