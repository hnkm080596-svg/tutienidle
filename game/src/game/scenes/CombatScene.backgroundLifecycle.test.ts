// @vitest-environment jsdom
//
// Vòng đời background mới (yêu cầu 2026-08-26):
// - Boot/trận ĐẦU dùng preset cố định (peekThanhVanVariant — mặc định
//   spring/morning, override QA cụ thể vẫn khóa): MainScene.preload()
//   eager-load ĐÚNG preset đó qua queueCombatAssets().
// - KHÔNG còn rotate ở create()/onBattleStart().
// - battle_end: chọn variant KẾ TIẾP khác hiện tại → thiếu texture thì
//   queue load NGAY (đúng lúc overlay kết quả đang hiện) → chỉ swap sau
//   COMPLETE, giữ nền cũ trong lúc tải (không flash).
// - Trận mới bắt đầu trước khi load xong → KHÔNG swap giữa trận
//   (generation token vô hiệu callback cũ).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CombatScene } from './CombatScene'
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
 * @param textureExists — true: mọi texture có sẵn (nhánh swap tức thời);
 *   Set: chỉ các key trong Set tồn tại (mọi key khác đều thiếu).
 */
function createPerspectiveScene(textureExists: true | Set<string>) {
  const scene = Object.create(CombatScene.prototype) as any

  const addedImages: string[] = []
  const destroyedHandles: Array<unknown> = []

  scene.renderMode = 'perspective'
  scene.inBattle = true
  // Object.create bỏ qua class field initializers — phải tự khởi tạo
  // token generation để ++ hoạt động đúng.
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
      // Loader thật bắn COMPLETE bất đồng bộ — test tự quyết thời điểm
      // qua flushComplete() để mô phỏng "load xong trước/sau trận mới".
    },

    flushComplete() {
      for (const handler of [...this.completeHandlers]) {
        handler()
      }
    },
  }

  // Stubs tối thiểu cho onBattleEnd/onBattleStart.
  scene.dotAccumulators = new Map()
  // Audit fix 2026-08-31 — onBattleStart giờ còn dọn status VFX icons.
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

describe('CombatScene — vòng đời background (battle_end)', () => {
  it('boot preload ĐÚNG preset peek (override QA khóa được) — không queue variant khác', () => {
    setOverride('dev.thanhvanSeason', 'winter')

    setOverride('dev.thanhvanTime', 'night')

    const queued: string[] = []

    const fakeScene = {
      textures: { exists: () => false },

      load: {
        image(key: string) {
          queued.push(key)
        },
      },
    } as never

    queueCombatAssets(fakeScene)

    const expected = thanhVanLoadList(peekThanhVanVariant()).map((entry) => entry.key)

    for (const key of expected) {
      expect(queued).toContain(key)
    }

    // Player/enemy/gourd/profile vẫn được queue cùng lượt.
    expect(queued).toContain(PLAYER_TEXTURE_KEY)

    // Không queue key tv-* nào ngoài preset peek.
    expect(queued.filter((key) => key.startsWith('tv-'))).toEqual(expected)
  })

  it('battle_end đủ texture → swap NGAY sang variant khác hiện tại', () => {
    const { scene, addedImages, destroyedHandles } = createPerspectiveScene(true)

    scene.onBattleEnd()

    expect(scene.inBattle).toBe(false)

    // Variant mới KHÁC variant cũ (selectNext tránh trùng từng chiều).
    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    // Backdrop cũ bị huỷ, ảnh của variant MỚI gắn đủ 7 key.
    expect(destroyedHandles).toHaveLength(1)

    expect(addedImages).toHaveLength(7)

    const newKeys = thanhVanLoadList(scene.thanhVanVariant).map((entry) => entry.key)

    expect(addedImages).toEqual(newKeys)

    // Cache phiên cập nhật theo variant vừa swap — lần vào combat kế
    // preload đúng bộ đang hiển thị.
    expect(peekThanhVanVariant()).toEqual(scene.thanhVanVariant)

    expect(scene.usingArtBackdrop).toBe(true)
  })

  it('battle_end thiếu texture → queue load, CHỈ swap sau COMPLETE', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    // 7 key của variant kế được queue — nền cũ GIỮ NGUYÊN trong lúc tải.
    expect(scene.load.queued).toHaveLength(7)

    expect(addedImages).toHaveLength(0)

    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    // Load xong khi CHƯA có trận mới → swap nguyên khối, không flash.
    scene.load.flushComplete()

    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(7)
  })

  it('trận mới bắt đầu TRƯỚC khi load xong → KHÔNG swap giữa trận', () => {
    const { scene, addedImages } = createPerspectiveScene(new Set())

    scene.onBattleEnd()

    expect(scene.load.queued).toHaveLength(7)

    // Auto-refight bắt đầu trận kế khi tải chưa xong.
    scene.onBattleStart()

    expect(scene.inBattle).toBe(true)

    scene.load.flushComplete()

    // Callback cũ bị generation token vô hiệu — nền giữ nguyên.
    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(0)

    // battle_end KẾ TIẾP chọn lại variant và swap bình thường.
    scene.onBattleEnd()

    scene.load.flushComplete()

    expect(scene.thanhVanVariant).not.toEqual({ season: 'spring', time: 'morning' })

    expect(addedImages).toHaveLength(7)
  })

  it('flat mode: battle_end không đụng loader/backdrop', () => {
    const { scene } = createPerspectiveScene(new Set())

    scene.renderMode = 'flat'

    scene.onBattleEnd()

    expect(scene.load.queued).toHaveLength(0)

    expect(scene.thanhVanVariant).toEqual({ season: 'spring', time: 'morning' })
  })

  it('create() và onBattleStart() KHÔNG còn rotate background', () => {
    // Khóa bằng source assertion — điểm rotate cũ phải biến mất hẳn;
    // prepareThanhVanBackdropForNextBattle chỉ được gọi từ onBattleEnd.
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
