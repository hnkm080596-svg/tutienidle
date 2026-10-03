// Dead-reference contract (item-grade-quality-rework, Task 22) - sau khi
// xoa EquipmentQuality.ts (9 bac tu vi cu)/EquipmentRarity.ts (5 bac
// affix-density cu)/ItemGradeRefs.ts (shim compile tam), khong file nao
// trong src con tham chieu ten/duong dan cu. CHI quet ky hieu DAC THU
// equipment cu - KHONG cam "ItemGrade"/"Pham" noi chung vi Pill/Talisman/
// Formation (ItemGrade.ts) van dung dung, khong thuoc pham vi rework nay.
// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: bundle-split.test.ts)
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join, extname } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { makeInstance } from './EquipmentInstance.fixture'

// Tu src/core/equipment/deadReferences.test.ts di len 2 cap la chinh
// thu muc src/.
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

// Ky hieu XUAT (export) cua EquipmentQuality.ts/EquipmentRarity.ts da
// xoa han trong task nay - CHI liet ke ten dinh danh DAC THU, KHONG
// dung substring chung chung nhu "forgePoints"/"forgePotential" (nhung
// field/comment do van ton tai HOP LE va KHONG LIEN QUAN o noi khac -
// vd RefinementBalance.ts's forgeUses budget, hoac fixture test du lieu
// save CU o services/save/*.test.ts mo phong shape save truoc khi
// migrate - ca 2 deu ngoai pham vi rework nay).
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

// Duong dan 3 file da xoa han trong task nay - khong file nao duoc import
// TU day nua (specifier import, khong phai chi nhac ten trong comment).
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
    // Ban than file test nay liet ke cac ky hieu chet trong mang hang so
    // o tren - loai no khoi vong quet de khong tu bat chinh minh.
    .filter((file) => !file.endsWith(join('equipment', 'deadReferences.test.ts')))

  // Flaky-hygiene (2026-09-05): 2 test dau doc TOAN BO src/ qua fs - duoi full
  // suite chay parallel, I/O contention tung keo test toi 24s va vuong default
  // timeout 5s -> flake luan phien. Fix: (1) cache noi dung file 1 LAN dung
  // chung cho ca 2 test, (2) timeout rieng 60s cho cac test scan.
  const contentsByFile = new Map(files.map((file) => [file, readFileSync(file, 'utf-8')]))

  it('không còn file nào chứa ký hiệu equipment cũ (forgePoints/forgePotential/EquipmentQuality 9-bậc)', () => {
    const offenders: string[] = []

    for (const [file, content] of contentsByFile) {
      for (const symbol of DEAD_SYMBOLS) {
        if (content.includes(symbol)) {
          offenders.push(`${file}: "${symbol}"`)
        }
      }
    }

    expect(offenders, `còn tham chiếu ký hiệu cũ:\n${offenders.join('\n')}`).toEqual([])
  }, 60_000)

  it('không còn file nào import từ EquipmentQuality.ts/EquipmentRarity.ts/ItemGradeRefs.ts (đã xóa)', () => {
    const offenders: string[] = []

    for (const [file, content] of contentsByFile) {
      for (const specifier of DEAD_IMPORT_SPECIFIERS) {
        // Chi bat specifier trong dau nhay cua import/export that, tranh
        // false-positive tu comment nhac ten file cu (nhieu file co y giu
        // comment lich su "xem EquipmentQuality.ts").
        const pattern = new RegExp(`from ['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`)

        if (pattern.test(content)) {
          offenders.push(`${file}: import from "${specifier}"`)
        }
      }
    }

    expect(offenders, `còn import từ file đã xóa:\n${offenders.join('\n')}`).toEqual([])
  }, 60_000)

  it('EquipmentInstance fixture không còn key thừa realmId/rarity/forgePoints/forgePotential', () => {
    const instance = makeInstance()

    expect(instance).not.toHaveProperty('realmId')
    expect(instance).not.toHaveProperty('rarity')
    expect(instance).not.toHaveProperty('forgePoints')
    expect(instance).not.toHaveProperty('forgePotential')
  })
})
