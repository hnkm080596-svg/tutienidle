// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import VictoryFidelityScene from './VictoryFidelityScene.vue'
import { victoryMessages } from '@/ui-preview/victoryMessages'

it('requests retry and continue without mutating or granting the displayed rewards', () => {
  const rewards = Object.freeze([{id:'sample',name:'Sample',amount:'3',tone:'#abc'}])
  const requests: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render:()=>h(VictoryFidelityScene,{model:{stage:'Sample stage',caption:'Sample caption',rewards,growth:[]},notice:'',onRetry:()=>requests.push('retry'),onContinue:()=>requests.push('continue')}) })
  app.use(createI18n({legacy:false,locale:'vi',messages:victoryMessages})).mount(container)
  try {
    container.querySelector<HTMLButtonElement>('.retry')!.click()
    container.querySelector<HTMLButtonElement>('.continue')!.click()
    expect(requests).toEqual(['retry','continue'])
    expect(rewards[0]?.amount).toBe('3')
    expect(container.querySelector('.victory-growth')?.textContent).toContain('Chưa có tăng trưởng')
  } finally { app.unmount() }
})
