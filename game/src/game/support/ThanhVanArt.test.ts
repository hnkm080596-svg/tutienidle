// @vitest-environment jsdom
//
// Vòng đời variant mới (yêu cầu 2026-08-26):
// - Boot: peekThanhVanVariant() trả PRESET CỐ ĐỊNH spring/morning
//   (trận đầu dùng ngay), KHÔNG random; override QA cụ thể vẫn khóa.
// - battle_end: selectNextThanhVanVariant() chọn variant KẾ TIẾP khác
//   variant hiện tại (mỗi chiều); override cụ thể khóa chiều đó.
// - commitThanhVanVariant() cập nhật cache phiên sau khi swap xong.
import { afterEach, describe, expect, it, vi } from 'vitest'

function setOverride(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key)
  } else {
    window.localStorage.setItem(key, value)
  }
}

// Cache variant là state module-level — nạp lại module cho mỗi test để
// mô phỏng đúng lúc "boot"/phiên trang mới.
async function loadModule() {
  vi.resetModules()

  return await import('./ThanhVanArt')
}

afterEach(() => {
  vi.restoreAllMocks()

  setOverride('dev.thanhvanSeason', null)

  setOverride('dev.thanhvanTime', null)
})

describe('ThanhVanArt — boot preset cố định', () => {
  it('DEFAULT_THANH_VAN_VARIANT là spring/morning', async () => {
    const { DEFAULT_THANH_VAN_VARIANT } = await loadModule()

    expect(DEFAULT_THANH_VAN_VARIANT).toEqual({ season: 'spring', time: 'morning' })
  })

  it('boot không override → peek trả preset mặc định (KHÔNG random), ổn định qua nhiều lần gọi', async () => {
    const { peekThanhVanVariant } = await loadModule()

    for (let i = 0; i < 5; i++) {
      expect(peekThanhVanVariant()).toEqual({ season: 'spring', time: 'morning' })
    }
  })

  it("override 'random'/giá trị lạ bị bỏ qua ở boot — vẫn dùng preset mặc định", async () => {
    setOverride('dev.thanhvanSeason', 'random')

    setOverride('dev.thanhvanTime', 'khong_hop_le')

    const { peekThanhVanVariant } = await loadModule()

    expect(peekThanhVanVariant()).toEqual({ season: 'spring', time: 'morning' })
  })

  it('override QA CỤ THỂ khóa variant boot (preview/QA vẫn dùng được)', async () => {
    setOverride('dev.thanhvanSeason', 'winter')

    setOverride('dev.thanhvanTime', 'night')

    const { peekThanhVanVariant } = await loadModule()

    expect(peekThanhVanVariant()).toEqual({ season: 'winter', time: 'night' })
  })
})

describe('ThanhVanArt — chọn variant trận kế tiếp (battle_end)', () => {
  it('không override → mỗi chiều random KHÁC giá trị đang hiển thị', async () => {
    const { selectNextThanhVanVariant } = await loadModule()

    const current = { season: 'spring' as const, time: 'noon' as const }

    // Mock phân bố: random luôn về index 0 của pool đã lọc — kết quả
    // phải xác định và khác current ở CẢ HAI chiều.
    vi.spyOn(Math, 'random').mockReturnValue(0)

    for (let i = 0; i < 8; i++) {
      const next = selectNextThanhVanVariant(current)

      expect(next.season).not.toBe(current.season)

      expect(next.time).not.toBe(current.time)
    }
  })

  it('roll thật (mock bỏ) vẫn hợp lệ union và luôn khác current', async () => {
    const { THANH_VAN_SEASONS, THANH_VAN_TIMES, selectNextThanhVanVariant } = await loadModule()

    const current = { season: 'autumn' as const, time: 'evening' as const }

    const seenSeasons = new Set<string>()

    for (let i = 0; i < 24; i++) {
      const next = selectNextThanhVanVariant(current)

      expect(THANH_VAN_SEASONS).toContain(next.season)

      expect(THANH_VAN_TIMES).toContain(next.time)

      expect(next.season).not.toBe(current.season)

      expect(next.time).not.toBe(current.time)

      seenSeasons.add(next.season)
    }

    // Pool 3 mùa còn lại — 24 lần gần như chắc chắn gặp >1 mùa.
    expect(seenSeasons.size).toBeGreaterThan(1)
  })

  it('override cụ thể khóa chiều tương ứng; chiều còn lại vẫn random khác current', async () => {
    setOverride('dev.thanhvanSeason', 'winter')

    const { selectNextThanhVanVariant } = await loadModule()

    const current = { season: 'spring' as const, time: 'morning' as const }

    for (let i = 0; i < 12; i++) {
      const next = selectNextThanhVanVariant(current)

      // Chiến khóa theo override cũ còn dính trong localStorage…
      expect(next.season).toBe('winter')

      // …nhưng chiều không khóa vẫn tránh giá trị hiện tại.
      expect(next.time).not.toBe(current.time)
    }
  })
})

describe('ThanhVanArt — cache phiên theo swap', () => {
  it('commitThanhVanVariant cập nhật cache — peek kế tiếp trả variant vừa commit', async () => {
    const { peekThanhVanVariant, commitThanhVanVariant } = await loadModule()

    expect(peekThanhVanVariant()).toEqual({ season: 'spring', time: 'morning' })

    commitThanhVanVariant({ season: 'summer', time: 'night' })

    expect(peekThanhVanVariant()).toEqual({ season: 'summer', time: 'night' })
  })

  it('commit không đè override QA cụ thể ở lần peek boot MỚI (module reload)', async () => {
    setOverride('dev.thanhvanSeason', 'winter')

    const mod = await loadModule()

    mod.commitThanhVanVariant({ season: 'summer', time: 'noon' })

    expect(mod.peekThanhVanVariant()).toEqual({ season: 'summer', time: 'noon' })

    // Phiên trang mới (reload module) — override khóa lại từ đầu.
    const fresh = await loadModule()

    expect(fresh.peekThanhVanVariant().season).toBe('winter')
  })
})
