// Dead-reference contract (item-grade-quality-rework, Task 22) — sau khi
// xóa EquipmentQuality.ts (9 bậc tu vi cũ)/EquipmentRarity.ts (5 bậc
// affix-density cũ)/ItemGradeRefs.ts (shim compile tạm), không file nào
// trong src còn tham chiếu tên/đường dẫn cũ. CHỈ quét ký hiệu ĐẶC THÙ
// equipment cũ — KHÔNG cấm "ItemGrade"/"Phẩm" nói chung vì Pill/Talisman/
// Formation (ItemGrade.ts) vẫn dùng đúng, không thuộc phạm vi rework này.
// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: bundle-split.test.ts)
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join, extname } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { makeInstance } from './EquipmentInstance.fixture'

// Từ src/core/equipment/deadReferences.test.ts đi lên 2 cấp là chính
// thư mục src/.
const srcRoot = fileURLToPath(new URL('../../', import.meta.url))


function listSourceFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)

    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full))
      continue
    }

    const ext = extname(entry)
    if (ext === '.ts' || ext === '.vue') {
      out.push(full)
    }
  }

  return out
}

// Ký hiệu XUẤT (export) của EquipmentQuality.ts/EquipmentRarity.ts đã
// xóa hẳn trong task này — CHỈ liệt kê tên định danh ĐẶC THÙ, KHÔNG
// dùng substring chung chung như "forgePoints"/"forgePotential" (những
// field/comment đó vẫn tồn tại HỢP LỆ và KHÔNG LIÊN QUAN ở nơi khác —
// vd RefinementBalance.ts's forgeUses budget, hoặc fixture test dữ liệu
// save CŨ ở services/save/*.test.ts mô phỏng shape save trước khi
// migrate — cả 2 đều ngoài phạm vi rework này).
const DEAD_SYMBOLS = [
  'EQUIPMENT_QUALITY_MAX_FORGE_POINTS',
  'getMaxForgePoints',
  'EQUIPMENT_QUALITY_REALM_WEIGHTS',
  'EQUIPMENT_QUALITY_ORDER',
  'EQUIPMENT_QUALITY_LABELS',
  'EQUIPMENT_QUALITY_MAX_AFFIX_TIER',
  'EQUIPMENT_QUALITY_IMPLICIT_MULTIPLIER',
  'EQUIPMENT_QUALITY_UNLOCKED_POOLS',
  'EQUIPMENT_RARITY_LABELS',
  'EQUIPMENT_RARITY_ORDER',
  'EQUIPMENT_RARITY_DROP_WEIGHT',
  'EQUIPMENT_RARITY_AFFIX_SLOTS',
  'EQUIPMENT_RARITY_EXALTED_AFFIX_CHANCE',
]

// Đường dẫn 3 file đã xóa hẳn trong task này — không file nào được import
// TỪ đây nữa (specifier import, không phải chỉ nhắc tên trong comment).
const DEAD_IMPORT_SPECIFIERS = [
  './EquipmentQuality',
  '../EquipmentQuality',
  'equipment/EquipmentQuality',
  './EquipmentRarity',
  '../EquipmentRarity',
  'equipment/EquipmentRarity',
  './ItemGradeRefs',
  '../ItemGradeRefs',
  'equipment/ItemGradeRefs',
]

describe('dead equipment-model references (item-grade-quality-rework Task 22)', () => {
  const files = listSourceFiles(srcRoot)
    // Bản thân file test này liệt kê các ký hiệu chết trong mảng hằng số
    // ở trên — loại nó khỏi vòng quét để không tự bắt chính mình.
    .filter((file) => !file.endsWith(join('equipment', 'deadReferences.test.ts')))

  it('không còn file nào chứa ký hiệu equipment cũ (forgePoints/forgePotential/EquipmentQuality 9-bậc)', () => {
    const offenders: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')

      for (const symbol of DEAD_SYMBOLS) {
        if (content.includes(symbol)) {
          offenders.push(`${file}: "${symbol}"`)
        }
      }
    }

    expect(offenders, `còn tham chiếu ký hiệu cũ:\n${offenders.join('\n')}`).toEqual([])
  })

  it('không còn file nào import từ EquipmentQuality.ts/EquipmentRarity.ts/ItemGradeRefs.ts (đã xóa)', () => {
    const offenders: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')

      for (const specifier of DEAD_IMPORT_SPECIFIERS) {
        // Chỉ bắt specifier trong dấu nháy của import/export thật, tránh
        // false-positive từ comment nhắc tên file cũ (nhiều file cố ý giữ
        // comment lịch sử "xem EquipmentQuality.ts").
        const pattern = new RegExp(`from ['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)

        if (pattern.test(content)) {
          offenders.push(`${file}: import from "${specifier}"`)
        }
      }
    }

    expect(offenders, `còn import từ file đã xóa:\n${offenders.join('\n')}`).toEqual([])
  })

  it('EquipmentInstance fixture không còn key thừa realmId/rarity/forgePoints/forgePotential', () => {
    const instance = makeInstance()

    expect(instance).not.toHaveProperty('realmId')
    expect(instance).not.toHaveProperty('rarity')
    expect(instance).not.toHaveProperty('forgePoints')
    expect(instance).not.toHaveProperty('forgePotential')
  })
})
