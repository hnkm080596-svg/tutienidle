<script setup lang="ts">
// Centered realm card riding the milestone carousel: shows the floor the
// player centered under it. The current floor carries live cultivation
// progress and, only while their gate is open, up to two actions - "Dot
// Pha" while a minor floor advance can land, and the realm ritual at
// floor CORE_REALM_LEVEL+ once canTriggerBreakthrough passes (sword-path
// Quan Khi re-entry or the shared breakthrough ceremony). Reached floors
// render their earned state, locked floors render dimmed - no action rows.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import GameActionButton from '@/components/common/GameActionButton.vue'
import EquipmentEnergyTube from '@/components/common/art/EquipmentEnergyTube.vue'
import { CORE_REALM_LEVEL } from '@/core/realm/realmSystem'
import type { RealmUiModel } from './realmUi'

const props = defineProps<{ model: RealmUiModel; selected: number }>()
const emit = defineEmits<{ advance: []; breakthrough: []; quanKhi: [] }>()
const { t } = useI18n()

const meditation = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/realm/meditation-v1.png')
const fill = computed(() => Number.isFinite(props.model.progress) ? Math.min(100, Math.max(0, props.model.progress)) : 0)

const isCurrent = computed(() => props.selected === props.model.currentFloor)
const isLocked = computed(() => props.selected > props.model.currentFloor)
const statusLabel = computed(() => isLocked.value ? t('panels.realm.nodes.locked') : t('panels.realm.nodes.unlocked'))
const ritualVisible = computed(() => props.model.currentFloor >= CORE_REALM_LEVEL && (props.model.ctaVisible ?? props.model.ctaEnabled))
const ritualReady = computed(() => ritualVisible.value && props.model.ctaEnabled)
const ritualAction = computed(() => props.model.ritualAction ?? 'breakthrough')

function onRitual() {
  if (!ritualReady.value) return
  if (ritualAction.value === 'quanKhi') emit('quanKhi')
  else emit('breakthrough')
}
</script>
<template>
  <section class="realm-active-card" :class="{ 'realm-locked-view': isLocked }" :aria-label="model.name">
    <h2>{{ model.name }}</h2>
    <p class="realm-floor-line">{{ t('realm.floorCount', { floor: selected, total: CORE_REALM_LEVEL }) }}</p>
    <div class="realm-meditation-wrap"><img class="realm-meditation" :src="meditation" alt="" /></div>
    <template v-if="isCurrent">
      <div class="realm-row">
        <span>{{ t('realm.cultivation') }}</span>
        <span>{{ model.cultivation }}</span>
      </div>
      <EquipmentEnergyTube :fill="fill" color="#edc672" />
      <div class="realm-row realm-rate">
        <span>{{ model.rate }}</span>
      </div>
      <p v-if="ritualVisible && !ritualReady && model.ctaLockReason" class="realm-ritual-lock">{{ model.ctaLockReason }}</p>
      <div class="realm-actions">
        <GameActionButton gold class="realm-upgrade" :class="{ 'btn-hidden': !ritualVisible }" :disabled="!ritualReady" :title="!ritualReady ? model.ctaLockReason : undefined" data-testid="realm-ritual" @click="onRitual">{{ model.ctaLabel }}</GameActionButton>
        <GameActionButton gold class="realm-upgrade" :class="{ 'btn-hidden': !model.canAdvanceFloor }" :disabled="!model.canAdvanceFloor" data-testid="realm-upgrade" @click="emit('advance')">{{ t('realm.advance') }}</GameActionButton>
      </div>
    </template>
    <p v-else class="realm-status-line">{{ statusLabel }}</p>
  </section>
</template>
<style scoped>
/* Anchored inside the track at the selected milestone's own slot
   (--focus-x): the circle morphs into this card in place and the card
   rides the rail during the slide instead of floating over the track. */
.realm-active-card { position:absolute; left:var(--focus-x, 50%); top:-136px; transform:translateX(-50%); width:270px; height:368px; padding:9px 12px; background:#f4e7ce; border:18px solid transparent; border-image:url('/assets/ui/tien-hiep-2026-10/realm/active-card-frame-v1.svg') 24 / 18px stretch; box-shadow:0 2px 5px #53351630; display:flex; flex-direction:column; gap:4px; z-index:2; clip-path:inset(-10px); animation:realm-morph 600ms cubic-bezier(0.25,0.7,0.2,1); pointer-events:none; }
/* The card frame overlaps ~20px of each neighbor milestone's hit area;
   let border/padding clicks fall through to the milestone beneath. */
.realm-active-card > * { pointer-events:auto; position:relative; z-index:1; }
.realm-active-card > .realm-meditation-wrap { z-index:0; pointer-events:none; }
/* inset() interpolates smoothly (unlike circle() -> inset() which snaps at
   50%): a rounded blob at the milestone's spot grows into the full card. */
@keyframes realm-morph {
  from { clip-path:inset(38% 42% round 56px); opacity:0.35; }
  to { clip-path:inset(-10px round 0); opacity:1; }
}
@media (prefers-reduced-motion: reduce) {
  .realm-active-card { animation:none; }
}
/* Dark ink + stacked paper halo keeps text legible over the meditation
   backdrop: a tight 2px edge ring plus a wide 10px glow, both paper. */
.realm-active-card h2 { font-size:26px; text-align:center; margin:0; font-weight:800; color:#241708; text-shadow:0 0 2px #f4e7ce, 0 0 4px #f4e7ce, 0 0 10px #f4e7ce, 0 1px 0 #f4e7ce; }
.realm-floor-line { text-align:center; margin:0; font-size:17px; font-weight:700; color:#241708; text-shadow:0 0 2px #f4e7ce, 0 0 4px #f4e7ce, 0 0 10px #f4e7ce, 0 1px 0 #f4e7ce; }
.realm-meditation-wrap { position:absolute; inset:-11px; overflow:hidden; }
.realm-meditation { width:100%; height:100%; object-fit:cover; opacity:0.6; }
.realm-row { display:flex; justify-content:space-between; font-size:13px; font-weight:700; color:#241708; text-shadow:0 0 2px #f4e7ce, 0 0 4px #f4e7ce, 0 0 8px #f4e7ce, 0 1px 0 #f4e7ce; }
.realm-rate { font-size:12px; margin-top:2px; justify-content:center; }
.realm-ritual-lock { margin:2px 0 0; text-align:center; font-size:11.5px; font-weight:700; color:#7a2e22; text-shadow:0 0 2px #f4e7ce, 0 0 6px #f4e7ce; }
.realm-actions { display:grid; grid-template-columns:1fr; gap:2px; flex:none; margin-top:auto; }
.realm-actions .realm-upgrade.game-action-button { font-size:15px; margin-top:0; width:100%; aspect-ratio:auto; height:50px; }
/* Gate unmet: the button is invisible but keeps its slot so the card
   layout stays fixed whether or not the action exists (owner ruling). */
.realm-actions .realm-upgrade.btn-hidden { visibility:hidden; }
.realm-actions :deep(.realm-upgrade)::before { background-size:cover; }
.realm-status-line { text-align:center; font-size:14px; font-weight:700; color:#241708; margin:4px 0; text-shadow:0 0 2px #f4e7ce, 0 0 4px #f4e7ce, 0 0 10px #f4e7ce, 0 1px 0 #f4e7ce; }
.realm-locked-view .realm-meditation { filter:grayscale(0.8); opacity:0.55; }
</style>
