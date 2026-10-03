// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, type App } from 'vue'
import InkWashBackdrop from './InkWashBackdrop.vue'
import authSource from '@/components/onboarding/AuthEntryScreen.vue?raw'
import onboardingStageSource from '@/components/onboarding/OnboardingStage.vue?raw'
import loginVistaSource from '@/components/scenes/login/LoginSceneVista.vue?raw'
import modeTabsSource from '@/components/scenes/login/AuthModeTabs.vue?raw'
import creationSource from '@/components/onboarding/CharacterCreationScreen.vue?raw'
import creationShellSource from '@/components/scenes/creation/CreationScrollShell.vue?raw'
import talentCardSource from '@/components/scenes/creation/TalentCard.vue?raw'
import creationTileSource from '@/components/scenes/creation/CreationChoiceTile.vue?raw'
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
    // Scene 01: OnboardingStage owns the shared backdrop; AuthEntryScreen
    // mounts the login scroll card inside it.
    expect(authSource).toContain('LoginScrollCard')
    expect(onboardingStageSource).toContain('LoginSceneVista')
    expect(loginVistaSource).toContain('HuyenKimParallaxStack')
    expect(loginVistaSource).toContain('stack="auth-creation"')
    // Scene 02: CharacterCreationScreen composes region components inside
    // the SAME shared vista - the auth-creation parallax stack serves both
    // screens (the scroll exchanges inside one persistent backdrop).
    expect(creationSource).toContain('CreationSceneLayout')
    expect(onboardingStageSource).not.toContain('CreationVista')
    expect(victorySource).toContain('<InkWashBackdrop :left-mountain="false" bottom-mist seal="large"')
    expect(defeatSource).toContain('<InkWashBackdrop left-mountain bottom-mist')
  })

  it('keeps onboarding controls legible on the ivory scroll', () => {
    // Scene 01 uses an inline jade banner; keep the ivory-on-jade
    // contrast contract without requiring the superseded chrome asset.
    expect(modeTabsSource).toMatch(/\.auth-tabs__tab\.active \{[^}]*color: var\(--hk-ivory/)
    // Huyen Kim S01/S02 (2026-10-02): the card is the surface-xl-scroll
    // chrome - paper-text tokens carry the legibility contract now.
    // Scene 02 scaffold: the chrome lives in CreationScrollShell.
    expect(creationSource).toContain('CreationScrollShell')
    expect(creationShellSource).toContain('data-hk-region="creation-card"')
    expect(creationShellSource).toContain('creation-scroll__art')
    // BETA-CREATION - name+talent draft only: the selected talent card
    // is the legibility affordance now (TalentCard delegates the chrome to
    // CreationChoiceTile; the selected tile carries the gold ceremony rim).
    expect(talentCardSource).toContain('CreationChoiceTile')
    expect(creationTileSource).toMatch(
      /\.creation-choice-tile\.selected \{[^}]*border: 2px solid #ab7934/,
    )
  })
})
