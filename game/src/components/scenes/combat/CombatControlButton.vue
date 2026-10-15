<script setup lang="ts">
import { computed } from 'vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { playUiButtonClick } from '@/presentation/audio/buttonClickAudio'
const props = withDefaults(
  defineProps<{
    selected?: boolean
    disabled?: boolean
    skin?: 'control' | 'answer'
    sound?: boolean
    silent?: boolean
  }>(),
  { selected: false, disabled: false, skin: 'control', sound: true, silent: false },
)
const emit = defineEmits<{ click: [event: MouseEvent] }>()
const art = (state: string) => `url('${resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/${props.skin === 'answer' ? 'tribulation' : 'combat'}/${props.skin}-${state}-v1.png`)}')`
const style = computed(() => ({ '--combat-control-normal': art('normal'), '--combat-control-hover': art('hover'), '--combat-control-selected': art('selected'), '--combat-control-pressed': art('pressed') }))

function handleClick(event: MouseEvent) {
  playUiButtonClick({ sound: props.sound, silent: props.silent })
  emit('click', event)
}
</script>
<template><button type="button" class="combat-control-button" :class="{ 'is-selected': selected, 'combat-control-button--answer': skin === 'answer' }" :style="style" :disabled="disabled" @click="handleClick"><slot /></button></template>
<style scoped>
.combat-control-button { display: inline-flex; align-items: center; justify-content: center; width: 108px; height: 49px; padding: 8px 12px; border: 0; background: var(--combat-control-normal) center / 100% 100% no-repeat; color: #f3dfb5; font: 700 16px/1 var(--font-display, Georgia, serif); cursor: pointer; }
.combat-control-button.is-selected { background-image: var(--combat-control-selected); }
.combat-control-button:hover:enabled { background-image: var(--combat-control-hover); }
.combat-control-button:active:enabled { background-image: var(--combat-control-pressed); }
.combat-control-button:disabled { opacity: .45; cursor: default; }
.combat-control-button:focus-visible { outline: 2px solid #f3d58a; outline-offset: 2px; }
.combat-control-button { position: relative; isolation: isolate; background: none; }
.combat-control-button::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: var(--combat-control-normal) center / 100% 100% no-repeat; clip-path: polygon(12% 14%, 88% 14%, 95% 24%, 95% 76%, 88% 89%, 12% 89%, 4% 76%, 4% 24%); }
.combat-control-button.is-selected,.combat-control-button:hover:enabled,.combat-control-button:active:enabled { background-image: none; }
.combat-control-button.is-selected::before { background-image: var(--combat-control-selected); }
.combat-control-button:hover:enabled::before { background-image: var(--combat-control-hover); }
.combat-control-button:active:enabled::before { background-image: var(--combat-control-pressed); }
.combat-control-button--answer { width: 100%; height: 44px; color: #493012; font-size: 17px; }
.combat-control-button--answer::before { clip-path: polygon(4% 8%, 96% 8%, 100% 50%, 96% 93%, 4% 93%, 0 50%); }

.combat-control-button:not(.combat-control-button--answer)::before { filter: saturate(.48) brightness(.8); }
</style>

