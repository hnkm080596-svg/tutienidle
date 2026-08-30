// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.1/§7) — chuỗi
// combo Thuần hệ: cast A mới mở B → C → D → E, E quay về A. Quái
// chết → reset về A (scaling tự nhiên: quái thường chết nhanh = chuỗi
// ngắn, boss trụ lâu = chuỗi đầy). Pure functions — state giữ trên
// BattleSystem, engine không đụng scheduler (wire ở BattleSystem).

export interface ChainDefinition {
  skillIds: readonly string[]
}

export interface ChainRuntimeState {
  nextIndex: number
}

export function initChainState(): ChainRuntimeState {
  return { nextIndex: 0 }
}

/** Skill thuộc chuỗi chỉ cast được khi ĐÚNG vị trí next; skill ngoài
 * chuỗi (Phàm Nhân chưa chốt đạo / reaction setup) tự do. loadoutSize
 * khóa phần chuỗi vượt slot mở theo realm (spec §6 — C/D/E là data
 * chờ, không thểEquip nên không thể cast kể cả khi nextIndex trỏ tới). */
export function canCastChainSkill(
  chain: ChainDefinition,
  state: ChainRuntimeState,
  skillId: string,
  loadoutSize: number,
): boolean {
  const index = chain.skillIds.indexOf(skillId)

  if (index === -1) {
    return true
  }

  return index === state.nextIndex && index < loadoutSize
}

/** Cast hoàn tất skill ĐÚNG vị trí next → advance; skill sai vị trí
 * hoặc ngoài chuỗi → no-op. E (index cuối) quay về 0 — vòng lặp mới. */
export function advanceChain(
  chain: ChainDefinition,
  state: ChainRuntimeState,
  skillId: string,
): void {
  const index = chain.skillIds.indexOf(skillId)

  if (index === -1 || index !== state.nextIndex) {
    return
  }

  state.nextIndex = (index + 1) % chain.skillIds.length
}

/** Quái chết → chuỗi reset về A (spec §2.1 — "quái chết cần cast combo
 * lại từ đầu"). */
export function resetChainOnKill(state: ChainRuntimeState): void {
  state.nextIndex = 0
}
