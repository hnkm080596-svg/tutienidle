// @vitest-environment jsdom
//
// Bang 9.5 #5 (2026-09-07) -- TurnCombatSkillBar hien thi ten skill that
// (TurnSkillDisplayMeta) thay nhan role co dinh; fallback nhan role khi
// id khong co trong map.
//
// BETA FE-CONTRACT sec.3 -- the rail renders the betaCombatRolesFor
// read-model: basic + special for every beta player; the ultimate role
// is permanently scope-hidden and never reaches the DOM. The ngo_dao
// emblem is a separate betaCombatSurfacesFor verdict.
//
// Mount theo pattern project (createApp + h, KHONG @vue/test-utils --
// chua cai, xem CombatExitConfirmModal.test.ts). Mock composable bang
// vi.mock (hoisted factory).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { i18n } from '@/i18n'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import { createDefaultPlayer } from '@/core/player/Player'
import type { PlayerData } from '@/core/player/Player'
import {
  betaCombatRolesFor,
  betaCombatSurfacesFor,
} from '@/core/betaScopeSkillDomain'

const mocks = vi.hoisted(() => ({
  slotList: [] as TurnSkillPresentationEntry[],
  playerState: undefined as unknown as PlayerData,
  chooseSlot: vi.fn(),
  setBattleManualMode: vi.fn(),
  setCombatInputMode: vi.fn(),
}))

vi.mock('@/composables/useTurnCombatManual', () => ({
  useTurnCombatManual: () => ({
    isAwaitingChoice: { value: true },
    isBattleFighting: { value: true },
    slotList: { value: mocks.slotList },
    chooseSlot: mocks.chooseSlot,
    // Kiem Tu Reimagined -- no dynamicBasic provider in this fixture:
    // the orb picker stays hidden and the role row renders. The
    // __v_isRef tag is required: template v-if/v-for unrefs these,
    // a bare {value: x} object is truthy and would render a phantom
    // orb button (merged phap_tu_an emblem test caught this).
    dynamicBasicOptions: { value: [], __v_isRef: true },
    hasDynamicBasic: { value: false, __v_isRef: true },
    chooseDynamicBasic: vi.fn(),
  }),
}))

// Canonical-model seam - delegate to the REAL domain functions so the
// rail/emblem assertions pin real verdicts, not a reimplemented gate.
// hasSkill: true models the post-ritual invariant (the ngo_dao kit
// assertion makes the dao passive always learned on that way).
vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    catalogOps: { getSkillTemplate: () => undefined },
    setBattleManualMode: mocks.setBattleManualMode,
    progressionOps: {
      getSkillLevel: () => 1,
      getSkillCoreMaxLevel: () => 10,
      betaCombatRolesFor: (player: PlayerData) =>
        betaCombatRolesFor(player, { hasSkill: () => true }),
      betaCombatSurfacesFor: (player: PlayerData) =>
        betaCombatSurfacesFor(player, { hasSkill: () => true }),
    },
  }),
  useStateVersion: () => ({ stateVersion: { value: 0 } }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    combatInputMode: 'auto',
    setCombatInputMode: mocks.setCombatInputMode,
  }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    get $state() {
      return mocks.playerState
    },
  }),
}))

import TurnCombatSkillBar from './TurnCombatSkillBar.vue'
import { unlockAllFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// This suite exercises machinery the production feature table gates
// (hidden lineage / companion / workforce / sword-body ways) - it rides
// the full catalog like the pre-lock suite default did.
unlockAllFeaturesForTests()

function mortalPlayer(): PlayerData {
  return createDefaultPlayer()
}

function qiPlayer(way: 'spell_pathway' | 'hidden_spell_pathway'): PlayerData {
  return {
    ...createDefaultPlayer(),
    realmId: 'qi_refining',
    cultivationPath: 'spell',
    cultivationWay: way,
    mortalBasicSkillId: undefined,
  }
}

afterEach(() => {
  mocks.slotList = []
  mocks.playerState = undefined as unknown as PlayerData
})

function entry(overrides: Partial<TurnSkillPresentationEntry> = {}): TurnSkillPresentationEntry {
  return {
    skillId: 'fixture_basic',
    cooldownRemaining: 0,
    cooldownTotal: 0,
    resourceCost: 0,
    state: 'ready',
    ...overrides,
  }
}

function mountBar(card = false): HTMLElement {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(TurnCombatSkillBar, { card }) })

  // The bar speaks i18n now (skillBar.* keys) -- mount needs the plugin,
  // same pattern as CombatExitConfirmModal.test.ts.
  app.use(i18n)
  app.mount(container)

  return container
}

describe('TurnCombatSkillBar — display label (9.5 #5)', () => {
  it('lights the automatic basic and locks unavailable card slots without manual-click eligibility dimming', async () => {
    mocks.playerState = mortalPlayer()
    mocks.slotList = [entry({ skillId: 'tram', state: 'not_your_turn' }), entry({ skillId: '', state: 'locked' }), entry({ skillId: '', state: 'empty' })]
    const container = mountBar(true)
    await nextTick()
    expect(container.querySelector('.is-auto-active .slot-view--filled')).not.toBeNull()
    expect(container.querySelector('.combat-skill-slot__orbit')).not.toBeNull()
    expect(container.querySelectorAll('.slot-view__veil-glyph')).toHaveLength(2)
    appCleanup(container)
  })
  it('slot mang skillName → hiển thị tên thật thay nhãn role', async () => {
    mocks.playerState = mortalPlayer()
    mocks.slotList = [
      entry({ skillId: 'tram', skillName: 'Huy Kiếm', skillDescription: 'Một chiêu thức cơ bản.' }),
      entry(),
      entry(),
    ]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Huy Kiếm')
    // Special fallback nhan role; ultimate khong bao gio render.
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).not.toContain('Tuyệt Kỹ')

    appCleanup(container)
  })

  it('không có skillName nào → giữ nguyên 2 nhãn role (basic + special)', async () => {
    mocks.playerState = mortalPlayer()
    mocks.slotList = [entry(), entry(), entry()]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Thường')
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).not.toContain('Tuyệt Kỹ')

    appCleanup(container)
  })
})

// Phap Tu Reimagined (Task 16) -- the ngo_dao emblem is a
// betaCombatSurfacesFor verdict, not a role button (spec S3.3): it
// renders only while 'an-ultimate-emblem' is 'available'.
describe('TurnCombatSkillBar — ngo_dao passive emblem', () => {
  it('hidden way → emblem ngo_dao_hon_don renders, KHÔNG phải button', async () => {
    mocks.playerState = qiPlayer('hidden_spell_pathway')
    mocks.slotList = [
      entry({ skillId: 'van_phap_tuy_tam', skillName: 'Vạn Pháp Tùy Tâm' }),
      entry({ skillId: 'da_phap_lien_tuyen', skillName: 'Đa Pháp Liên Tuyến' }),
      entry(),
    ]

    const container = mountBar()
    await nextTick()

    // Emblem present with the passive name + tag.
    expect(container.textContent).toContain('Ngộ Đạo Hỗn Độn')
    expect(container.textContent).toContain('Bị Động')
    expect(container.textContent).not.toContain('Tuyệt Kỹ')

    // Exactly 2 buttons (basic + special) -- the emblem is a div.
    const buttons = container.querySelectorAll('button.turn-combat-skill-bar__slot-button')

    expect(buttons).toHaveLength(2)

    appCleanup(container)
  })

  it('path thường → 2 role buttons, no emblem, no ultimate slot', async () => {
    mocks.playerState = qiPlayer('spell_pathway')
    mocks.slotList = [entry(), entry(), entry()]

    const container = mountBar()
    await nextTick()

    expect(container.querySelectorAll('button.turn-combat-skill-bar__slot-button')).toHaveLength(2)
    expect(container.querySelector('.turn-combat-skill-bar__emblem')).toBeNull()
    expect(container.textContent).not.toContain('Tuyệt Kỹ')

    appCleanup(container)
  })
})

function appCleanup(container: HTMLElement): void {
  container.remove()
}

it('card layout includes three circular roles while keeping the hidden ultimate disabled', async () => {
  mocks.playerState = mortalPlayer()
  mocks.slotList = [entry({ state: 'ready' }), entry({ state: 'ready' }), entry({ state: 'ready' })]
  const container = mountBar(true)
  await nextTick()
  const buttons = container.querySelectorAll<HTMLButtonElement>('button.turn-combat-skill-bar__slot-button')
  expect(buttons).toHaveLength(3)
  expect(buttons[2]!.getAttribute('aria-disabled')).toBe('true')
  expect(buttons[2]!.disabled).toBe(false)
  expect(buttons[2]!.getAttribute('aria-label')).not.toContain('Tuyệt Kỹ')
  expect(container.textContent).not.toContain('Tuyệt Kỹ')
  expect(container.querySelector('[aria-label*="Tuyệt Kỹ"]')).toBeNull()
  expect(container.querySelectorAll('.turn-combat-skill-bar__orb-frame')).toHaveLength(0)
  appCleanup(container)
})
