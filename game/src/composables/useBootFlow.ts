import { readonly, ref } from 'vue'

export type BootStage = 'intro' | 'auth' | 'loading_save' | 'character' | 'initializing' | 'game' | 'error'

export function useBootFlow() {
  const stage = ref<BootStage>('intro')

  return {
    stage: readonly(stage),
    showAuth: () => { stage.value = 'auth' },
    startSaveLoad: () => { stage.value = 'loading_save' },
    requireCharacter: () => { stage.value = 'character' },
    startInitializing: () => { stage.value = 'initializing' },
    enterGame: () => { stage.value = 'game' },
    fail: () => { stage.value = 'error' },
  }
}
