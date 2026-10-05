<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { realmMapAnchors } from './realmUi'
const props = defineProps<{ current: number; selected: number; max: number }>()
const emit = defineEmits<{ select: [floor: number] }>()
const { t } = useI18n()
const art = resolveAssetUrl('/assets/ui/huyen-kim/scene/realm-v2/ascension-path-six-landings-v2.png')
// The artwork paints the full 18-rung path; CORE realms (max 12) show
// only the lower rungs - the painted peaks above stay scenery.
const anchors = computed(() => realmMapAnchors.slice(0, Math.max(0, Math.min(props.max, realmMapAnchors.length))))
</script>
<template>
  <div class="realm-map">
    <div class="realm-floor-rail">
    <button v-for="(_, index) in anchors" :key="index" class="realm-marker" :class="{ major: (index + 1) % 3 === 0, reached: index + 1 <= current, current: index + 1 === current, selected: index + 1 === selected }" :aria-label="t('realm.floorLabel', { floor: index + 1 })" :aria-pressed="selected === index + 1" :aria-current="index + 1 === current ? 'step' : undefined" @click="emit('select', index + 1)">{{ index + 1 }}</button>
    </div>
    <div class="realm-map-path"><img class="realm-map-art" :src="art" alt=""></div>
  </div>
</template>
<style scoped>
.realm-map { position:absolute; left:401px; top:145px; width:475px; height:588px; }
.realm-map-art { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.realm-marker { position:absolute; transform:translate(-50%,-50%); width:23px; height:23px; padding:0; border:1px solid #c6ab6c; border-radius:50%; background:#645c48; color:#fff9df; font:15px Georgia,serif; cursor:pointer; box-shadow:0 1px 3px #34291d88; }
.realm-marker.major { width:34px; height:34px; font-size:21px; border:2px solid #e3c57e; }.realm-marker.reached { background:#8d641f; }.realm-marker.current { background:#14614e; box-shadow:0 0 0 4px #5fd3b64d,0 0 15px #43c9ab; }.realm-marker.selected { outline:2px solid #286a59; outline-offset:4px; }.realm-marker:hover { filter:brightness(1.3); }.realm-marker:focus-visible { outline:3px solid #183f36; outline-offset:4px; }
</style>
