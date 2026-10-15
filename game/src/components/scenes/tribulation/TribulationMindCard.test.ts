// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, ref } from 'vue'
import { i18n } from '@/i18n'
import TribulationMindCard from './TribulationMindCard.vue'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
describe('tribulation question art and answer binding', () => {
  it('emits the current answer index and updates to the next question without retaining old choices', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const answers = ref(['West', 'South', 'East', 'North'])
    const chosen: number[] = []
    const app = createApp({ render: () => h(TribulationMindCard, { question: 'Direction?', answers: answers.value, secondsRemaining: 8, secondsLimit: 10, onAnswer: index => chosen.push(index) }) })
    app.use(i18n)
    app.mount(host)
    cleanups.push(() => { app.unmount(); host.remove() })
    expect(host.querySelector('.combat-art-surface__art')?.getAttribute('src')).toContain('/tribulation/question-panel-v1.png')
    const buttons = host.querySelectorAll<HTMLButtonElement>('.tribulation-ui__answer')
    expect(buttons).toHaveLength(4)
    buttons[2]!.click()
    expect(chosen).toEqual([2])
    answers.value = ['First', 'Second']
    await nextTick()
    expect(host.textContent).not.toContain('North')
    const updated = host.querySelectorAll<HTMLButtonElement>('.tribulation-ui__answer')
    expect(updated).toHaveLength(2)
    updated[1]!.click()
    expect(chosen).toEqual([2, 1])
  })
})
