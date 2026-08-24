import { describe, expect, it } from 'vitest'
import { useBootFlow } from './useBootFlow'

describe('useBootFlow', () => {
  it('moves through the online bootstrap stages explicitly', () => {
    const flow = useBootFlow()
    expect(flow.stage.value).toBe('intro')
    flow.showAuth(); expect(flow.stage.value).toBe('auth')
    flow.startSaveLoad(); expect(flow.stage.value).toBe('loading_save')
    flow.requireCharacter(); expect(flow.stage.value).toBe('character')
    flow.startInitializing(); expect(flow.stage.value).toBe('initializing')
    flow.enterGame(); expect(flow.stage.value).toBe('game')
  })
})
