// Migration gate 2.5D (2026-08-24) - feature flag chon renderer chien
// truong:
// - 'perspective': renderer 2.5D moi (mat phang nghieng, foot anchor,
//   depth sort, VFX theo space - xem BattleGridProjection.ts).
// - 'flat'       : renderer top-down vuong CU giu nguyen tung pixel
//   (cellSize dong deu, letterbox) de rollback tuc thi neu gate chua dat.
//
// Flag doc/ghi localStorage, KHONG dung gameplay: core van lam viec thuan
// row/column qua BattleGrid - chi lop PRESENTATION doi cach chieu len man
// hinh. Doi mode co hieu luc o lan create() ke tiep cua CombatScene
// (doi scene Home <-> Combat la du, khong can reload app).
export type BattlefieldRenderMode = 'flat' | 'perspective'

const STORAGE_KEY = 'tutienidle.battlefieldRenderMode'

// Mac dinh bat renderer moi; 'flat' chi con la loi tho hiem khi gate
// (screenshot parity / hover cell / AOE footprint / depth on dinh / e2e)
// bao loi.
const DEFAULT_MODE: BattlefieldRenderMode = 'perspective'

function isRenderMode(value: unknown): value is BattlefieldRenderMode {
  return value === 'flat' || value === 'perspective'
}

export function getBattlefieldRenderMode(): BattlefieldRenderMode {
  try {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_MODE
    }

    const raw = localStorage.getItem(STORAGE_KEY)

    return isRenderMode(raw) ? raw : DEFAULT_MODE
  } catch {
    // localStorage co the bi chan (privacy mode/electron profile) - roi
    // ve default thay vi lam vo boot flow.
    return DEFAULT_MODE
  }
}

export function setBattlefieldRenderMode(mode: BattlefieldRenderMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode)
    }
  } catch {
    // No-op - flag la tien ich QA/dev, khong dang de vo game vi storage loi.
  }
}
