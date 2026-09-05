// @vitest-environment jsdom
//
// VÃ²ng Ä‘á»i background má»›i (yÃªu cáº§u 2026-08-26):
// - Boot/tráº­n Äáº¦U dÃ¹ng preset cá»‘ Ä‘á»‹nh (peekThanhVanVariant â€” máº·c Ä‘á»‹nh
//   spring/morning, override QA cá»¥ thá»ƒ váº«n khÃ³a): MainScene.preload()
//   eager-load ÄÃšNG preset Ä‘Ã³ qua queueCombatAssets().
// - KHÃ”NG cÃ²n rotate á»Ÿ create()/onBattleStart().
// - battle_end: chá»n variant Káº¾ TIáº¾P khÃ¡c hiá»‡n táº¡i â†’ thiáº¿u texture thÃ¬
//   queue load NGAY (Ä‘Ãºng lÃºc overlay káº¿t quáº£ Ä‘ang hiá»‡n) â†’ chá»‰ swap sau
//   COMPLETE, giá»¯ ná»n cÅ© trong lÃºc táº£i (khÃ´ng flash).
// - Tráº­n má»›i báº¯t Ä‘áº§u trÆ°á»›c khi load xong â†’ KHÃ”NG swap giá»¯a tráº­n
//   (generation token vÃ´ hiá»‡u callback cÅ©).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestScene } from './combat/combatTestHarness'
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
 * @param textureExists â€” true: má»i texture cÃ³ sáºµn (nhÃ¡nh swap tá»©c thá»i);
 *   Set: chá»‰ cÃ¡c key trong Set tá»“n táº¡i (má»i key khÃ¡c Ä‘á»u thiáº¿u).
 */
function createPerspectiveScene(textureExists: true | Set<string>) {
  const scene = createTestScene('bare')

  const addedImages: string[] = []
  const destroyedHandles: Array<unknown> = []

  scene.renderMode = 'perspective'
  scene.inBattle = true
  // Object.create bá» qua class field initializers â€” pháº£i tá»± khá»Ÿi táº¡o
  // token generation Ä‘á»ƒ ++ hoáº¡t Ä‘á»™ng Ä‘Ãºng.
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
      // Loader tháº­t báº¯n COMPLETE báº¥t Ä‘á»“ng bá»™ â€” test tá»± quyáº¿t thá»i Ä‘iá»ƒm
      // qua flushComplete() Ä‘á»ƒ mÃ´ phá»ng "load xong trÆ°á»›c/sau tráº­n má»›i".
    },

    flushComplete() {
      for (const handler of [...this.completeHandlers]) {
        handler()
      }
    },
  }

  // Stubs tá»‘i thiá»ƒu cho onBattleEnd/onBattleStart.
  scene.dotAccumulators = new Map()
  // Audit fix 2026-08-31 â€” onBattleStart giá» cÃ²n dá»n status VFX icons.
  scene.statuses = new Map()
  scene.sprites = new Map()
  scene.interpolations = new Map()
  scene.castBars = new Map()
  scene.spawnVfxHandles = new Map()
  scene.materializingIds = new Set()
  scene.dyingIds = new Set()
  scene.playerDying = false
  scene.playerMaterialized = true
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
        // Task 9 (2026-09-05) — queueCombatAssets giờ CŨNG load spritesheet
        // placeholder cho từng entity; stub no-op để không throw.
        spritesheet() {},
      },
    } as never

    queueCombatAssets(fakeScene)

    const expected = thanhVanLoadList(peekThanhVanVariant()).map((entry) => entry.key)

    for (const key of expected) {
      expect(queued).toContain(key)
    }

    // Player/enemy/gourd/profile váº«n Ä‘Æ°á»£c queue cÃ¹ng lÆ°á»£t.
    expect(queued).toContain(PLAYER_TEXTURE_KEY)

    // KhÃ´ng queue key tv-* nÃ o ngoÃ i preset peek.
    expect(queued.filter((key) => key.startsWith('tv-'))).toEqual(expected)
  })

  it('battle_end Ä‘á»§ texture â†’ swap NGAY sang variant khÃ¡c hiá»‡n táº¡i', () => {
    const { scene, addedImages, destroyedHandles } = createPerspectiveScene(true)

    scene.onBattleEnd()

    expect(scene.inBattle).toBe(false)

    // Variant má»›i KHÃC variant cÅ© (selectNext trÃ¡nh trÃ¹ng tá»«ng chiá»u).
    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    // Backdrop cÅ© bá»‹ huá»·, áº£nh cá»§a variant Má»šI gáº¯n Ä‘á»§ 7 key.
    expect(destroyedHandles).toHaveLength(1)

    expect(addedImages).toHaveLength(7)

    const newKeys = thanhVanLoadList(scene.thanhVanVariant).map((entry) => entry.key)

    expect(addedImages).toEqual(newKeys)

    // Cache phiÃªn cáº­p nháº­t theo variant vá»«a swap â€” láº§n vÃ o combat káº¿
    // preload Ä‘Ãºng bá»™ Ä‘ang hiá»ƒn thá»‹.
    expect(peekThanhVanVariant()).toEqual(scene.thanhVanVariant)

    expect(scene.usingArtBackdrop).toBe(true)
  })

  it('battle_end thiáº¿u texture â†’ queue load, CHá»ˆ swap sau COMPLETE', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    // 7 key cá»§a variant káº¿ Ä‘Æ°á»£c queue â€” ná»n cÅ© GIá»® NGUYÃŠN trong lÃºc táº£i.
    expect(scene.load.queued).toHaveLength(7)

    expect(addedImages).toHaveLength(0)

    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    // Load xong khi CHÆ¯A cÃ³ tráº­n má»›i â†’ swap nguyÃªn khá»‘i, khÃ´ng flash.
    scene.load.flushComplete()

    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(7)
  })

  it('tráº­n má»›i báº¯t Ä‘áº§u TRÆ¯á»šC khi load xong â†’ KHÃ”NG swap giá»¯a tráº­n', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    expect(scene.load.queued).toHaveLength(7)

    // Auto-refight báº¯t Ä‘áº§u tráº­n káº¿ khi táº£i chÆ°a xong.
    scene.onBattleStart()

    expect(scene.inBattle).toBe(true)

    scene.load.flushComplete()

    // Callback cÅ© bá»‹ generation token vÃ´ hiá»‡u â€” ná»n giá»¯ nguyÃªn.
    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(0)

    // battle_end Káº¾ TIáº¾P chá»n láº¡i variant vÃ  swap bÃ¬nh thÆ°á»ng.
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
    // KhÃ³a báº±ng source assertion â€” Ä‘iá»ƒm rotate cÅ© pháº£i biáº¿n máº¥t háº³n;
    // prepareThanhVanBackdropForNextBattle chá»‰ Ä‘Æ°á»£c gá»i tá»« onBattleEnd.
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
