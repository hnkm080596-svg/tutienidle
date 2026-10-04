// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { createApp, h } from 'vue'
import { createI18n } from 'vue-i18n'
import TribulationFidelityQuestion from './TribulationFidelityQuestion.vue'
import { tribulationMessages } from '@/ui-preview/tribulationMessages'

it('requests the authored answer identity without deciding the tribulation outcome', () => {
  const answers = Object.freeze([{ id:'stay', label:'Stay' }, { id:'return', label:'Return' }])
  const requests: string[] = []
  const container = document.createElement('div')
  const app = createApp({ render:()=>h(TribulationFidelityQuestion,{ question:'Choose',answers,selected:'stay',seconds:'01:28',percent:73,notice:'',onAnswer:(id:string)=>requests.push(id) }) })
  app.use(createI18n({ legacy:false,locale:'vi',messages:tribulationMessages })).mount(container)
  try {
    const buttons = container.querySelectorAll('button')
    buttons[1]!.click()
    expect(requests).toEqual(['return'])
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('false')
    expect(answers[0]?.id).toBe('stay')
  } finally { app.unmount() }
})
