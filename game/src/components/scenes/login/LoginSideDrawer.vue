<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const props = defineProps<{ open: boolean; title: string; busy: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)
const titleId = useId()
const paperUrl = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/paper-grain-tile@2x.png')
function close() { if (!props.busy) emit('close') }
useDialogFocus(panel, computed(() => props.open), { onEscape: close })
</script>

<template>
  <Transition name="login-drawer">
    <div v-if="open" class="login-drawer-layer">
      <div class="login-drawer-scrim" @click="close" />
      <aside ref="panel" class="login-side-drawer" :style="{ '--entry-paper': `url('${paperUrl}')` }" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" data-testid="entry-drawer">
        <header class="login-side-drawer__header">
          <h2 :id="titleId">{{ title }}</h2>
          <PcPaperButton icon variant="secondary" data-testid="entry-drawer-close" :disabled="busy" :aria-label="t('panels.common.close')" @click="close">×</PcPaperButton>
        </header>
        <div class="login-side-drawer__content"><slot /></div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.login-drawer-layer { position: absolute; inset: 0; z-index: 10; }
.login-drawer-scrim { position: absolute; inset: 0; background: #30281933; }
.login-side-drawer { position: absolute; right: 18px; top: 18px; bottom: 18px; width: 490px; display: flex; flex-direction: column; padding: 30px; color: #30271b; background: #f5e9d0 var(--entry-paper) center / 240px; border: 1px solid #b39458; box-shadow: -18px 0 50px #48351b30, inset 0 0 0 5px #f7ecd8, inset 0 0 0 6px #b6986270; }
.login-side-drawer__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #b69862; padding-bottom: 12px; }
.login-side-drawer__header h2 { margin: 0; font: 600 32px var(--font-display, Georgia, serif); }
.login-side-drawer__header button { min-width: 44px; min-height: 44px; font-size: 28px; }
.login-side-drawer__content { min-height: 0; overflow-y: auto; flex: 1; padding-top: 14px; scrollbar-width: thin; container-type: inline-size; display: flex; flex-direction: column; gap: 14px; }
.login-drawer-enter-active, .login-drawer-leave-active { transition: opacity 320ms ease; }
.login-drawer-enter-active .login-side-drawer, .login-drawer-leave-active .login-side-drawer { transition: transform 320ms cubic-bezier(.22,.8,.3,1); }
.login-drawer-enter-from, .login-drawer-leave-to { opacity: 0; }
.login-drawer-enter-from .login-side-drawer, .login-drawer-leave-to .login-side-drawer { transform: translateX(calc(100% + 20px)); }
@media (prefers-reduced-motion: reduce) { .login-drawer-enter-active, .login-drawer-leave-active, .login-drawer-enter-active .login-side-drawer, .login-drawer-leave-active .login-side-drawer { transition: none; } }
</style>
