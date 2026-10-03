// @vitest-environment jsdom
//
// Vong doi background mOi (yeu cau 2026-08-26):
// - Boot/tran DAU dung preset co dInh (peekThanhVanVariant - mac dInh
//   spring/morning, override QA cu the van khoa): MainScene.preload()
//   eager-load AAsNG preset A'A3 qua queueCombatAssets().
// - KHONG con rotate o create()/onBattleStart().
// - battle_end: chon variant KE TIEP khac hien tai -> thieu texture thi
//   queue load NGAY (dung luc overlay ket qua dang hien) -> chi swap sau
//   COMPLETE, giu nen cu trong luc tai (khong flash).
// - Tran mOi bat dau truOc khi load xong -> KHONG swap giua tran
//   (generation token vo hieu callback cu).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
import { CombatEntityVisualLifecycle } from './combat/combat-entity-visual-lifecycle'
import type { CombatScene } from './CombatScene'
import combatSceneSource from './CombatScene.ts?raw'
import { PLAYER_TEXTURE_KEY, queueCombatAssets } from '../support/CombatPreload'
import { peekThanhVanVariant, thanhVanLoadList } from '../support/ThanhVanArt'

function setOverride(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key)
  } else {
    window.localStorage.setItem(key, value)
  }
}

afterEach(() => {
  vi.restoreAllMocks()

  setOverride('dev.thanhvanSeason', null)

  setOverride('dev.thanhvanTime', null)
})

function chainableView() {
  const view = {
    setOrigin: () => view,

    setDepth: () => view,

    setDisplaySize: () => view,

    setPosition: () => view,

    setSize: () => view,
  }

  return view
}

/**
 * @param textureExists - true: moi texture co san (nhanh swap tuc thoi);
 *   Set: chi cac key trong Set ton tai (moi key khac deu thieu).
 */
function createPerspectiveScene(textureExists: true | Set<string>) {
  const scene = createTestScene('bare')

  const addedImages: string[] = []
  const destroyedHandles: Array<unknown> = []

  scene.renderMode = 'perspective'
  scene.inBattle = true
  // Object.create bo qua class field initializers - phai tu khoi tao
  // token generation de ++ hoat dong dung.
  scene.backdropGeneration = 0
  scene.thanhVanVariant = { season: 'spring', time: 'morning' }
  scene.canvasWidth = 1600
  scene.canvasHeight = 900
  scene.usingArtBackdrop = true
  scene.projection = undefined
  scene.gridGraphics = { clear: () => undefined }

  scene.backdrop = {
    redraw: () => undefined,

    destroy: () => {
      destroyedHandles.push(true)
    },
  }

  scene.textures = {
    exists: (key: string) =>
      textureExists === true ? true : textureExists.has(key),
  }

  scene.add = {
    image(_x: number, _y: number, key: string) {
      addedImages.push(key)

      return chainableView()
    },

    rectangle() {
      return chainableView()
    },
  }

  scene.load = {
    queued: [] as Array<{ key: string; url: string }>,

    completeHandlers: [] as Array<() => void>,

    image(key: string, url: string) {
      this.queued.push({ key, url })
    },

    once(_event: string, handler: () => void) {
      this.completeHandlers.push(handler)
    },

    start() {
      // Loader that ban COMPLETE bat dong bo - test tu quyet thoi diem
      // qua flushComplete() de mo phong "load xong truOc/sau tran mOi".
    },

    flushComplete() {
      for (const handler of [...this.completeHandlers]) {
        handler()
      }
    },
  }

  // Stubs toi thieu cho onBattleEnd/onBattleStart.
  scene.dotAccumulators = new Map()
  // Audit fix 2026-08-31 - onBattleStart gio con don status VFX icons.
  scene.statuses = new Map()
  scene.sprites = new Map()
  scene.spawnVfxHandles = new Map()
  // R14.4 (QA Task 9 follow-up): onBattleStart now clears the countdown
  // telegraph maps too - stub the minimum shape the method reads.
  scene.turnCountdownSpawnVfxHandles = new Map()
  scene.entityVisual = new CombatEntityVisualLifecycle(scene as unknown as CombatScene)
  scene._telegraph = { reset: () => {} }
  scene.dyingIds = new Set()
  scene.playerDying = false
  scene.playerSpawnHandle = undefined
  scene.sys = { isActive: () => true }
  scene.scene = {}

  return { scene, addedImages, destroyedHandles }
}

describe('CombatScene â€” vÃ²ng Ä‘á»i background (battle_end)', () => {
  it('boot preload ÄÃšNG preset peek (override QA khÃ³a Ä‘Æ°á»£c) â€” khÃ´ng queue variant khÃ¡c', () => {
    setOverride('dev.thanhvanSeason', 'winter')

    setOverride('dev.thanhvanTime', 'night')

    const queued: string[] = []

    const fakeScene = {
      textures: { exists: () => false },

      load: {
        image(key: string) {
          queued.push(key)
        },
        // Task 9 (2026-09-05) - queueCombatAssets gio CUNG load atlas
        // placeholder cho tung entity; stub no-op de khong throw.
        atlas() {},
      },
    } as never

    queueCombatAssets(fakeScene)

    const expected = thanhVanLoadList(peekThanhVanVariant()).map((entry) => entry.key)

    for (const key of expected) {
      expect(queued).toContain(key)
    }

    // Player/enemy/gourd/profile van duoc queue cung luot.
    expect(queued).toContain(PLAYER_TEXTURE_KEY)

    // Khong queue key tv-* nao ngoai preset peek.
    expect(queued.filter((key) => key.startsWith('tv-'))).toEqual(expected)
  })

  it('battle_end Ä‘á»§ texture â†’ swap NGAY sang variant khÃ¡c hiá»‡n táº¡i', () => {
    const { scene, addedImages, destroyedHandles } = createPerspectiveScene(true)

    scene.onBattleEnd()

    expect(scene.inBattle).toBe(false)

    // Variant mOi KHAC variant cu (selectNext tranh trung tung chieu).
    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    // Backdrop cA(c) ba"< hua"*, aoGBPnh ca"seca variant Ma"sI gao-n A'a"sec 7 key.
    expect(destroyedHandles).toHaveLength(1)

    expect(addedImages).toHaveLength(7)

    const newKeys = thanhVanLoadList(scene.thanhVanVariant).map((entry) => entry.key)

    expect(addedImages).toEqual(newKeys)

    // Cache phien cap nhat theo variant vua swap - lan vao combat ke
    // preload dung bo dang hien thI.
    expect(peekThanhVanVariant()).toEqual(scene.thanhVanVariant)

    expect(scene.usingArtBackdrop).toBe(true)
  })

  it('battle_end thiáº¿u texture â†’ queue load, CHá»ˆ swap sau COMPLETE', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    // 7 key ca"seca variant kao? A'AEdega"GBPc queue aEUR" na"n cA(c) GIa"(R) NGUYASN trong lAoc taoGBPi.
    expect(scene.load.queued).toHaveLength(7)

    expect(addedImages).toHaveLength(0)

    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    // Load xong khi CHUA co tran mOi -> swap nguyen khoi, khong flash.
    scene.load.flushComplete()

    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(7)
  })

  it('tráº­n má»›i báº¯t Ä‘áº§u TRÆ¯á»šC khi load xong â†’ KHÃ”NG swap giá»¯a tráº­n', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    expect(scene.load.queued).toHaveLength(7)

    // Auto-refight bat dau tran ke khi tai chua xong.
    scene.onBattleStart()

    expect(scene.inBattle).toBe(true)

    scene.load.flushComplete()

    // Callback cu bI generation token vo hieu - nen giu nguyen.
    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(0)

    // battle_end KE TIEP chon lai variant va swap binh thuong.
    scene.onBattleEnd()

    scene.load.flushComplete()

    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(7)
  })

  it('flat mode: battle_end khÃ´ng Ä‘á»¥ng loader/backdrop', () => {
    const { scene } = createPerspectiveScene(new Set())

    scene.renderMode = 'flat'

    scene.onBattleEnd()

    expect(scene.load.queued).toHaveLength(0)

    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })
  })

  it('create() vÃ  onBattleStart() KHÃ”NG cÃ²n rotate background', () => {
    // Khoa bang source assertion - diem rotate cu phai bien mat han;
    // prepareThanhVanBackdropForNextBattle chi duoc goi tu onBattleEnd.
    expect(combatSceneSource).not.toContain('refreshThanhVanBackdropForBattle')

    expect(combatSceneSource).toContain('prepareThanhVanBackdropForNextBattle')

    const callSites = [
      ...combatSceneSource.matchAll(
        /this\.(prepareThanhVanBackdropForNextBattle|refreshThanhVanBackdropForBattle)\(\)/g,
      ),
    ].map((match) => match[1])

    expect(callSites).toEqual(['prepareThanhVanBackdropForNextBattle'])
  })
})
