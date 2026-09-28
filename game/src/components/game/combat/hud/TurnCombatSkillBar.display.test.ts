// @vitest-environment jsdom
//
// Bang 9.5 #5 (2026-09-07) -- TurnCombatSkillBar hien thi ten skill that
// (TurnSkillDisplayMeta) thay nhan role co dinh; fallback nhan role khi
// id khong co trong map.
//
// Mount theo pattern project (createApp + h, KHONG @vue/test-utils --
// chua cai, xem CombatExitConfirmModal.test.ts). Mock composable bang
// vi.mock (hoisted factory).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { i18n } from '@/i18n'
import type { TurnSkillPresentationEntry } from '@/core/combat/CombatSkillPresentation'
import { hasPathCapability } from '@/core/player/CultivationPathSystem'
import type { CultivationPathId, CultivationWayId, PathCapability } from '@/core/player/CultivationPathKit'

const mocks = vi.hoisted(() => ({
  slotList: [] as TurnSkillPresentationEntry[],
  cultivationPath: undefined as string | undefined,
  cultivationWay: undefined as CultivationWayId | undefined,
  chooseSlot: vi.fn(),
  setBattleManualMode: vi.fn(),
  setCombatInputMode: vi.fn(),
  // P1 - assigned after imports below; delegates to the REAL capability
  // resolver so the emblem test pins real behavior, not a reimplemented
  // gate. hasSkill: true models the post-ritual invariant (the ngo_dao
  // kit assertion makes the dao passive always learned on that way).
  hasPathCapability: undefined as unknown as (capability: PathCapability) => boolean,
}))

vi.mock('@/composables/useTurnCombatManual', () => ({
  useTurnCombatManual: () => ({
    isAwaitingChoice: { value: true },
    isBattleFighting: { value: true },
    slotList: { value: mocks.slotList },
    chooseSlot: mocks.chooseSlot,
    // Kiem Tu Reimagined -- no dynamicBasic provider in this fixture:
    // the orb picker stays hidden and the 3-slot row renders. The
    // __v_isRef tag is required: template v-if/v-for unrefs these,
    // a bare {value: x} object is truthy and would render a phantom
    // orb button (merged phap_tu_an emblem test caught this).
    dynamicBasicOptions: { value: [], __v_isRef: true },
    hasDynamicBasic: { value: false, __v_isRef: true },
    chooseDynamicBasic: vi.fn(),
  }),
}))

vi.mock('@/composables/useGameState', () => ({
  useGameManager: () => ({
    setBattleManualMode: mocks.setBattleManualMode,
    hasPathCapability: (capability: PathCapability) => mocks.hasPathCapability(capability),
  }),
}))

vi.mock('@/stores/ui', () => ({
  useUiStore: () => ({
    combatInputMode: 'auto',
    setCombatInputMode: mocks.setCombatInputMode,
  }),
}))

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({
    get cultivationPath() {
      return mocks.cultivationPath
    },
    get cultivationWay() {
      return mocks.cultivationWay
    },
  }),
}))

import TurnCombatSkillBar from './TurnCombatSkillBar.vue'

// P1 - bind the facade after imports resolve (vi.mock factories run
// lazily; the field must be live before the first mount).
mocks.hasPathCapability = (capability) =>
  hasPathCapability(
    {
      cultivationPath: mocks.cultivationPath as CultivationPathId | undefined,
      cultivationWay: mocks.cultivationWay,
    },
    capability,
    { hasSkill: () => true },
  )

afterEach(() => {
  mocks.cultivationPath = undefined
  mocks.cultivationWay = undefined
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

function mountBar(): HTMLElement {
  const container = document.createElement('div')

  document.body.appendChild(container)

  const app = createApp({ render: () => h(TurnCombatSkillBar) })

  // The bar speaks i18n now (skillBar.* keys) -- mount needs the plugin,
  // same pattern as CombatExitConfirmModal.test.ts.
  app.use(i18n)
  app.mount(container)

  return container
}

describe('TurnCombatSkillBar — display label (9.5 #5)', () => {
  it('slot mang skillName → hiển thị tên thật thay nhãn role', async () => {
    mocks.slotList = [
      entry({ skillId: 'tram', skillName: 'Huy Kiếm', skillDescription: 'Một chiêu thức cơ bản.' }),
      entry(),
      entry(),
    ]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Huy Kiếm')
    // 2 slot con lai fallback nhan role.
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).toContain('Tuyệt Kỹ')

    appCleanup(container)
  })

  it('không có skillName nào → giữ nguyên 3 nhãn role', async () => {
    mocks.slotList = [entry(), entry(), entry()]

    const container = mountBar()
    await nextTick()

    expect(container.textContent).toContain('Thường')
    expect(container.textContent).toContain('Đặc Biệt')
    expect(container.textContent).toContain('Tuyệt Kỹ')

    appCleanup(container)
  })
})

// Phap Tu Reimagined (Task 16) -- the ngo_dao way owns NO active ultimate: the
// ult slot is the ngo_dao_hon_don dao passive, rendered as an emblem,
// never a button (spec S3.3).
describe('TurnCombatSkillBar — ngo_dao passive emblem', () => {
  it('ult slot là emblem ngo_dao_hon_don, KHÔNG phải button', async () => {
    mocks.cultivationPath = 'spell'
    mocks.cultivationWay = 'hidden_spell_pathway'
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

  it('path thường vẫn render nút ult bình thường', async () => {
    mocks.cultivationPath = 'spell'
    mocks.cultivationWay = 'spell_pathway'
    mocks.slotList = [entry(), entry(), entry()]

    const container = mountBar()
    await nextTick()

    expect(container.querySelectorAll('button.turn-combat-skill-bar__slot-button')).toHaveLength(3)
    expect(container.querySelector('.turn-combat-skill-bar__emblem')).toBeNull()

    appCleanup(container)
  })
})

function appCleanup(container: HTMLElement): void {
  container.remove()
}
