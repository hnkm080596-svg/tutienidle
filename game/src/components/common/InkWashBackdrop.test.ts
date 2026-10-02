// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, type App } from 'vue'
import InkWashBackdrop from './InkWashBackdrop.vue'
import authSource from '@/components/onboarding/AuthEntryScreen.vue?raw'
import loginVistaSource from '@/components/scenes/login/LoginSceneVista.vue?raw'
import modeTabsSource from '@/components/scenes/login/AuthModeTabs.vue?raw'
import creationSource from '@/components/onboarding/CharacterCreationScreen.vue?raw'
import creationVistaSource from '@/components/scenes/creation/CreationVista.vue?raw'
import creationShellSource from '@/components/scenes/creation/CreationScrollShell.vue?raw'
import talentCardSource from '@/components/scenes/creation/TalentCard.vue?raw'
// Scene 14: the victory ceremonial surface lives in the scene layer
// (scenes/victory/VictoryScene); the panel wrapper keeps the behavior.
import victorySource from '@/components/scenes/victory/VictoryScene.vue?raw'
import defeatSource from '@/components/game/combat/CombatDefeatPanel.vue?raw'

const mounted: Array<{ app: App; container: HTMLElement }> = []

function mountBackdrop(props: Record<string, unknown> = {}) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp({ render: () => h(InkWashBackdrop, props) })
  app.mount(container)
  mounted.push({ app, container })
  return container.querySelector<HTMLElement>('.ink-wash-backdrop')!
}

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    entry.app.unmount()
    entry.container.remove()
  }
})

describe('InkWashBackdrop', () => {
  it('renders inert default painting layers', () => {
    const root = mountBackdrop()
    const images = [...root.querySelectorAll('img')]

    expect(getComputedStyle(root).pointerEvents).toBe('none')
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/assets/ui/ink-wash/overlays/wash-corner-mountain-left.png',
      '/assets/ui/ink-wash/overlays/wash-bottom-mist.png',
    ])
    for (const image of images) {
      expect(image.getAttribute('alt')).toBe('')
      expect(image.getAttribute('aria-hidden')).toBe('true')
      expect(image.getAttribute('draggable')).toBe('false')
    }
  })

  it('selects exact optional mountain, bamboo, and seal assets', () => {
    const root = mountBackdrop({
      leftMountain: false,
      rightMountain: true,
      bottomMist: false,
      bamboo: true,
      seal: 'large',
    })

    expect([...root.querySelectorAll('img')].map((image) => image.getAttribute('src'))).toEqual([
      '/assets/ui/ink-wash/overlays/wash-corner-mountain-right.png',
      '/assets/ui/ink-wash/overlays/wash-bamboo-right.png',
      '/assets/ui/ink-wash/overlays/seal-cinnabar-large.png',
    ])
  })

  it('composes the approved painting bridges into the ceremonial flows', () => {
    // Onboarding (auth/creation) moved to the Huyen Kim parallax vista -
    // the ink-wash backdrop family now owns the combat result surfaces.
    // Scene 01 scaffold: AuthEntryScreen composes region components; the
    // parallax stack lives in LoginSceneVista.
    expect(authSource).toContain('LoginSceneVista')
    expect(loginVistaSource).toContain('HuyenKimParallaxStack')
    expect(loginVistaSource).toContain('stack="auth-creation"')
    // Scene 02 scaffold: CharacterCreationScreen composes region
    // components; the parallax stack lives in CreationVista.
    expect(creationSource).toContain('CreationVista')
    expect(creationVistaSource).toContain('HuyenKimParallaxStack')
    expect(creationVistaSource).toContain('stack="auth-creation"')
    expect(victorySource).toContain('<InkWashBackdrop :left-mountain="false" bottom-mist seal="large"')
    expect(defeatSource).toContain('<InkWashBackdrop left-mountain bottom-mist')
  })

  it('keeps onboarding controls legible on the ivory scroll', () => {
    // Scene 01 scaffold: the tab underline moved to the delivered
    // tintable tab-seal chrome (active = jade, label ivory).
    expect(modeTabsSource).toContain('chrome-id="tab-seal"')
    expect(modeTabsSource).toMatch(/\.auth-tabs__tab\.active \{[^}]*color: var\(--hk-ivory/)
    // Huyen Kim S01/S02 (2026-10-02): the card is the surface-xl-scroll
    // chrome - paper-text tokens carry the legibility contract now.
    // Scene 02 scaffold: the chrome lives in CreationScrollShell.
    expect(creationSource).toContain('CreationScrollShell')
    expect(creationShellSource).toContain('chrome-id="surface-xl-scroll"')
    // BETA-CREATION - name+talent draft only: the selected talent card
    // is the legibility affordance now (TalentCard region).
    expect(talentCardSource).toMatch(
      /\.talent-card\.selected \{[^}]*border-color: var\(--hk-border-ceremony/,
    )
  })
})
