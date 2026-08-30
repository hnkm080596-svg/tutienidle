# Pháp Tu Đạo Sắc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thực thi spec 2026-08-30-phap-tu-dao-sac — chốt đạo Thuần/Đa Pháp vĩnh viễn ở Trúc Cơ, 5 chuỗi combo thần thoại Sơn Hải Kinh với hệ Thế + Ultimate, Đa Pháp sinh/khắc kề nhau, bảng reaction hoàn chỉnh 10 cặp, thiên phú Pháp Lực Thân Hòa, bỏ Phong/Lôi toàn hệ.

**Architecture:** Mở rộng pattern sẵn có — NodeSystem (node Lập Đạo + refund qua `devResetBranch`), CombatEntity pool thế (pattern `currentKiemThe`), UltimateSystem (pattern TTKT/KKTM), scheduler chain trong BattleSystem, ElementReaction data-driven + buff registry. Không dependency mới, không hệ thống engine mới.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Pinia, Phaser (chỉ dùng现有 stack).

**Spec:** `game/docs/superpowers/specs/2026-08-30-phap-tu-dao-sac-design.md` (worktree `.agent-worktrees/phap-tu-dao-sac`)

## Global Constraints

- Chạy từ `game/`: `npm.cmd run test`, `npm.cmd run type-check`, `npm.cmd run build`.
- KHÔNG dùng `any` trừ khi thực sự cần.
- KHÔNG thêm dependency mới.
- Dev phase — không save migration; bump `CURRENT_SAVE_VERSION` (54 → 55) + comment block theo convention.
- Số liệu spec là khởi điểm playtest, không phải chốt cứng — kế thừa convention "số liệu minh hoạ" hiện có.
- Tên id mới dùng snake_case tiếng Việt không dấu (pattern `hoa_cau_thuat`, `ngung_lo`).
- Mọi file test mới đặt cạnh file source cùng thư mục (pattern `.test.ts` colocate).
- Comment tiếng Việt, giải thích "tại sao" liên quan spec/plan (pattern codebase).

---

### Task 1: Bỏ ElementType wind/lightning + stats + affixes

**Files:**
- Modify: `game/src/core/element/ElementType.ts`
- Modify: `game/src/core/stats/StatBlock.ts:118,122`
- Modify: `game/src/core/stats/StatLabels.ts:80-81`
- Modify: `game/src/core/stats/StatCalculator.ts:88-89`
- Modify: `game/src/core/element/ElementLabels.ts:30`
- Modify: `game/src/core/enemy/EnemyStatInput.ts:180-186,234-235`
- Modify: `game/src/data/equipment/affixes.ts:119-120`
- Test: `game/src/core/element/ElementType.test.ts` (create)

**Interfaces:**
- Produces: `ElementType = 'wood' | 'fire' | 'earth' | 'metal' | 'water'` (5 giá trị — mọi task sau import type này); `ELEMENT_ORDER: ElementType[]` 5 phần tử.

- [ ] **Step 1: Viết test failing — ElementType chỉ còn 5 hành**

```typescript
// game/src/core/element/ElementType.test.ts
import { describe, expect, it } from 'vitest'
import { ELEMENT_ORDER } from './ElementLabels'

// Spec 2026-08-30-phap-tu-dao-sac §5 — bỏ Phong/Lôi toàn hệ: ElementType
// còn đúng 5 hành Ngũ Hành, ELEMENT_ORDER không còn 'wind'/'lightning'.
describe('ElementType sau khi bỏ Phong/Lôi', () => {
  it('ELEMENT_ORDER đúng 5 hành Ngũ Hành, không wind/lightning', () => {
    expect(ELEMENT_ORDER).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })

  it('type-level: wind/lightning không còn là ElementType hợp lệ', async () => {
    // @ts-expect-error — 'wind' đã bị xoá khỏi union, gán này phải sai
    const invalid: (typeof ELEMENT_ORDER)[number] = 'wind'
    expect(invalid).toBe('wind')
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npm.cmd run test -- --run src/core/element/ElementType.test.ts`
Expected: FAIL — `toEqual` nhận 7 phần tử, `@ts-expect-error` không có error (type vẫn còn 'wind').

- [ ] **Step 3: Sửa ElementType.ts**

```typescript
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §5) — Phong/Lôi đã
// BỎ toàn hệ (0 skill/0 node/0 reaction từng tồn tại, mọi consumer là
// stat chết). ElementType chỉ còn 5 hành Ngũ Hành — vòng sinh/khắc hoàn
// chỉnh của redesign. Không mở lại.
export type ElementType =
  | 'wood'
  | 'fire'
  | 'earth'
  | 'metal'
  | 'water'
```

- [ ] **Step 4: Sửa các consumer — xoá wind/lightning**

Sửa lần lượt (mỗi file: xoá dòng liệt kê + comment ghi nguồn spec §5):
1. `StatBlock.ts` — xoá `windPower: 0` / `windResistance: 0` / `windPenetration: 0` / `lightningPower: 0` / `lightningResistance: 0` / `lightningPenetration: 0` khỏi createBaseStats (tìm các field tương ứng quanh dòng 118,122).
2. `StatLabels.ts:80-81` — xoá 2 dòng label 'Phong Lực'/'Lôi Lực' + kháng/xuyên.
3. `StatCalculator.ts:88-89` — xoá 2 entry tag 'wind'/'lightning' khỏi element-stat map.
4. `ElementLabels.ts` — `ELEMENT_ORDER` còn `['wood', 'fire', 'earth', 'metal', 'water']`.
5. `EnemyStatInput.ts:180-186,234-235` — xoá case wind/lightning của power/penetration/resistance.
6. `affixes.ts:119-120` — xoá 2 affix group Phong/Lôi.

Sau mỗi file xong, grep để tìm tàn dư còn lại:

Run: `npx.cmd vitest --run src/core/element/ElementType.test.ts` rồi `Get-ChildItem -Recurse -Include *.ts,*.vue src | Select-String "windPower|lightningPower|'wind'|'lightning'"`
Expected: chỉ còn match trong comment hoặc file ElementType test.

- [ ] **Step 5: Chạy full test + type-check, fix compile error ăn theo**

Run: `npm.cmd run type-check` — sửa mọi error TS tham chiếu wind/lightning (thường là switch case hoặc stat access) bằng cách XOÁ case/field, không phải thêm fallback.

Run: `npm.cmd run test`
Expected: PASS — trừ test affix/nhóm cũ có fixture wind/lightning → cập nhật fixture (xoá entry).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(phap-tu): bo Phong/Loi khoi ElementType + stats + affixes (spec §5)"
```

---

### Task 2: Xoá ailment te_dien + reaction Lôi Viêm + dọn comment

**Files:**
- Modify: `game/src/core/ailment/AilmentTypes.ts:33`
- Modify: `game/src/data/ailment/ailments.ts:52-60`
- Modify: `game/src/core/element/ElementReaction.ts` (xoá entry `te_dien` của `bong`, dọn comment)
- Modify: `game/src/core/element/ReactionManager.phanPhac.test.ts` (fixture te_dien → te_cong)
- Modify: `game/src/core/element/ReactionManager.test.ts:224-229` (nếu có fixture te_dien)
- Modify: `game/src/core/battle/BattleSystem.ts` (nếu import/switch te_dien)

**Interfaces:**
- Produces: `AilmentId` không còn `'te_dien'`; bảng reaction không còn Lôi Viêm — 8 cặp sống chuẩn cho Task 9.

- [ ] **Step 1: Grep mọi tham chiếu te_dien**

Run: `Get-ChildItem -Recurse -Include *.ts src | Select-String "te_dien"` — liệt kê đầy đủ mọi file trước khi sửa (đối chiếu với list Files trên; bổ sung file nếu grep ra thêm).

- [ ] **Step 2: Xoá te_dien khỏi AilmentTypes.ts + ailments.ts**

`AilmentTypes.ts` — xoá dòng `| 'te_dien'` + comment. `ailments.ts` — xoá cả template Tê Điện (id te_dien, khoảng dòng 52-60).

- [ ] **Step 3: Xoá reaction Lôi Viêm + dọn comment ElementReaction.ts**

Trong `ELEMENT_REACTIONS.bong` xoá entry:
```typescript
te_dien: { name: 'Lôi Viêm', baseDamage: 70, powerScalingRatio: 0.5 },
```
Xoá/cập nhật các comment block nhắc Đông Lôi/Thủy Lôi/Độc Phong/Mù/Lôi Huyết — thay bằng ghi chú ngắn:
```typescript
// Phong/Lôi đã bỏ toàn hệ (spec 2026-08-30-phap-tu-dao-sac §5) — các
// cặp reaction cho hệ đó (Đông Lôi/Thủy Lôi/Độc Phong/Mù/Lôi Huyết)
// không bao giờ mở lại; ailment te_dien (Tê Điện, mồ côi từ đợt Kim
// cũ) xoá sạch cùng đợt.
```

- [ ] **Step 4: Rework fixture phanPhac test sang cặp sống**

`ReactionManager.phanPhac.test.ts` — thay mọi `getTemplate('te_dien')` bằng `getTemplate('te_cong')` và kỳ vọng 'Lôi Viêm' → 'Bốc Hơi' (cặp bong+te_cong, baseDamage 60; kiểm tra tên/expect khớp reaction definition hiện có). `ReactionManager.test.ts` tương tự nếu fixture có te_dien. Chạy test đảm bảo mechanic phanPhac vẫn được phủ:

Run: `npx.cmd vitest --run src/core/element/ReactionManager.phanPhac.test.ts src/core/element/ReactionManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `npm.cmd run type-check`, `npm.cmd run test`
Expected: PASS (sửa các test cũ khác còn tham chiếu te_dien — xoá block test đó vì cơ chế đã không tồn tại).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(phap-tu): xoá ailment te_dien (mo coi) + reaction Loi Viem chet (spec §5)"
```

---

### Task 3: relation metadata + 2 reaction mới Ngưng Lộ / Khai Sơn + 2 buff

**Files:**
- Modify: `game/src/core/element/ElementReaction.ts` (thêm field `relation` + 2 entry mới)
- Modify: `game/src/data/buff/buffs.ts` (thêm buff `ngung_lo`, `khai_son`)
- Test: `game/src/core/element/ElementReaction.relation.test.ts` (create)

**Interfaces:**
- Produces: `ElementReactionDefinition.relation?: 'sinh' | 'khac'`; bảng reaction có 10 cặp đủ sinh/khắc (5+5); buff id `ngung_lo` (+5 manaRegenPerSecond, 6s, refresh), `khai_son` (+8% armorPercent/stack, max 3 stack, 6s).

- [ ] **Step 1: Viết test failing — bảng 10 cặp + relation + định nghĩa reaction mới**

```typescript
// game/src/core/element/ElementReaction.relation.test.ts
import { describe, expect, it } from 'vitest'
import { ELEMENT_REACTIONS } from './ElementReaction'

// Spec 2026-08-30-phap-tu-dao-sac §4 — bảng reaction hoàn chỉnh 10 cặp
// (5 sinh + 5 khắc), mỗi cặp đúng 1 reaction, relation metadata cho UI
// ngôi sao + logic Chế Khắc.
const EXPECTED_PAIRS: Array<[string, string, string, 'sinh' | 'khac']> = [
  ['trung_doc', 'bong', 'Độc Viêm', 'sinh'],
  ['thach_hoa', 'bong', 'Dung Nham', 'sinh'],
  ['te_cong', 'trung_doc', 'Độc Thủy', 'sinh'],
  ['chay_mau', 'te_cong', 'Ngưng Lộ', 'sinh'],
  ['thach_hoa', 'chay_mau', 'Khai Sơn', 'sinh'],
  ['bong', 'te_cong', 'Bốc Hơi', 'khac'],
  ['chay_mau', 'bong', 'Thiêu Huyết', 'khac'],
  ['chay_mau', 'trung_doc', 'Huyết Độc', 'khac'],
  ['thach_hoa', 'trung_doc', 'Độc Thế', 'khac'],
  ['thach_hoa', 'te_cong', 'Trói Chân', 'khac'],
]

describe('Bảng reaction 10 cặp hoàn chỉnh (spec §4)', () => {
  it.each(EXPECTED_PAIRS)('%s + %s = %s (%s)', (a, b, name, relation) => {
    const def = ELEMENT_REACTIONS[a as keyof typeof ELEMENT_REACTIONS]?.[b as 'bong']
    expect(def?.name).toBe(name)
    expect(def?.relation).toBe(relation)
  })

  it('Ngưng Lộ: buff nguồn ngung_lo +5 manaRegen, baseDamage 40', () => {
    const def = ELEMENT_REACTIONS.chay_mau?.te_cong
    expect(def?.baseDamage).toBe(40)
    expect(def?.powerScalingRatio).toBe(0.5)
    expect(def?.appliesBuffId).toBe('ngung_lo')
  })

  it('Khai Sơn: buff nguồn khai_son +8% armor/stack max 3, baseDamage 50', () => {
    const def = ELEMENT_REACTIONS.thach_hoa?.chay_mau
    expect(def?.baseDamage).toBe(50)
    expect(def?.appliesBuffId).toBe('khai_son')
  })

  it('tổng đúng 10 cặp — không thừa không thiếu', () => {
    let count = 0
    for (const key of Object.keys(ELEMENT_REACTIONS)) {
      count += Object.keys((ELEMENT_REACTIONS as Record<string, object>)[key]!).length
    }
    expect(count).toBe(10)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/element/ElementReaction.relation.test.ts`
Expected: FAIL — relation undefined, Ngưng Lộ/Khai Sơn chưa tồn tại, tổng cặp = 8.

- [ ] **Step 3: Thêm field relation + 2 entry + 2 buff**

`ElementReaction.ts` — thêm vào interface:
```typescript
  // Spec 2026-08-30-phap-tu-dao-sac §4 — quan hệ sinh/khắc của cặp vế
  // (theo vòng Ngũ Hành) cho UI ngôi sao 5 cánh + logic khuếch đại
  // Chế Khắc của Đa Pháp tra bảng.
  relation?: 'sinh' | 'khac'
```
Trong `chay_mau` thêm:
```typescript
    // Kim+Thủy — "Ngưng Lộ" (sinh — lưỡi thép lạnh ngưng sương, máu
    // trên kim loại thành dòng suối tinh khiết tiếp Pháp Lực cho
    // nguồn): baseDamage nhẹ nhất bảng vì sinh không giết; buff
    // nguồn +5 mana regen (nuôi đúng thanh tài nguyên Pháp Lực Thân
    // Hòa). Số liệu khởi điểm playtest (spec §11).
    te_cong: {
      name: 'Ngưng Lộ',
      baseDamage: 40,
      powerScalingRatio: 0.5,
      relation: 'sinh',
      appliesBuffId: 'ngung_lo',
    },
```
Trong `thach_hoa` thêm:
```typescript
    // Thổ+Kim — "Khai Sơn" (sinh — núi bật gốc hé lộ mỏ kim loại):
    // buff nguồn +8% armor/tầng (mirror doc_the), max 3, 6s. Pháo đài
    // cho combo kề Thổ→Kim của build sinh (spec §4 card 2).
    chay_mau: {
      name: 'Khai Sơn',
      baseDamage: 50,
      powerScalingRatio: 0.5,
      relation: 'sinh',
      appliesBuffId: 'khai_son',
    },
```
Thêm `relation: 'khac'` vào 5 entry khắc còn lại (bong.te_cong Bốc Hơi, chay_mau.bong Thiêu Huyết, chay_mau.trung_doc Huyết Độc, thach_hoa.trung_doc Độc Thế, thach_hoa.te_cong Trói Chân) + `relation: 'sinh'` cho 3 entry sinh cũ (bong.trung_doc Độc Viêm, thach_hoa.bong Dung Nham, te_cong.trung_doc Độc Thủy).

`buffs.ts` — thêm 2 buff (đặt cạnh doc_the, pattern modifiers):
```typescript
  // Spec 2026-08-30-phap-tu-dao-sac §4 — 2 buff nguồn của 2 reaction
  // sinh mới (Ngưng Lộ/Khai Sơn). Pattern doc_the: stack + refresh.
  {
    id: 'ngung_lo',
    name: 'Ngưng Lộ',
    description: 'Sương ngưng trên thép hóa dòng suối tinh khiết — hồi Pháp Lực nhanh hơn.',
    category: 'buff',
    stacks: 1,
    maxStacks: 1,
    stackMode: 'refresh',
    duration: 6,
    modifiers: [
      {
        id: 'ngung_lo_mana_regen',
        sourceId: 'ngung_lo',
        sourceType: 'buff',
        stat: 'manaRegenPerSecond',
        flat: 5,
      },
    ],
  },
  {
    id: 'khai_son',
    name: 'Khai Sơn',
    description: 'Mỏ kim loại lộ ra từ núi bật gốc — thân thể cứng như quặng.',
    category: 'buff',
    stacks: 1,
    maxStacks: 3,
    stackMode: 'stack',
    duration: 6,
    modifiers: [
      {
        id: 'khai_son_armor',
        sourceId: 'khai_son',
        sourceType: 'buff',
        stat: 'armorPercent',
        percent: 0.08,
      },
    ],
  },
```
(Kiểm tra `armorPercent` là stat key hợp lệ trong StatModifier union — nếu tên khác (vd `armorPercent` không có) thì tra `StatBlock`/`StatLabels` tìm key % armor đúng và dùng key đó; sửa cả fixture test.)

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest --run src/core/element/ElementReaction.relation.test.ts src/core/element/ReactionManager.test.ts`
Expected: PASS (10 cặp, relation đúng, buff resolve qua BuffRegistry — ReactionManager đã có sẵn đường appliesBuffId).

- [ ] **Step 5: Full verification + commit**

Run: `npm.cmd run type-check && npm.cmd run test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(phap-tu): relation metadata + reaction Nhung Lo/Khai Son + 2 buff (spec §4)"
```

---

### Task 4: Bảng quan hệ sinh/khắc + helper adjacency

**Files:**
- Create: `game/src/core/element/WuxingRelations.ts`
- Test: `game/src/core/element/WuxingRelations.test.ts`

**Interfaces:**
- Produces:
  - `type WuxingRelation = 'sinh' | 'khac' | 'none'`
  - `function wuxingRelation(from: ElementType, to: ElementType): WuxingRelation`
  - `function isSinhCycle(loadout: ElementType[]): boolean` — kiểm chuỗi loadout có phải vòng sinh khép kín
  - `const SINH_CYCLE: readonly ElementType[]` = `['wood', 'fire', 'earth', 'metal', 'water']` (Mộc→Hỏa→Thổ→Kim→Thủy→Mộc)

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/element/WuxingRelations.test.ts
import { describe, expect, it } from 'vitest'
import { isSinhCycle, wuxingRelation, SINH_CYCLE } from './WuxingRelations'

// Spec 2026-08-30-phap-tu-dao-sac §3.4 — bảng quan hệ ngũ hành: sinh
// Mộc→Hỏa→Thổ→Kim→Thủy→Mộc; khắc Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim,
// Kim⇄Mộc. Adjacency: 2 slot kề nhau trong loadout.
describe('wuxingRelation', () => {
  it('sinh đúng chiều vòng ngoài', () => {
    expect(wuxingRelation('wood', 'fire')).toBe('sinh')
    expect(wuxingRelation('fire', 'earth')).toBe('sinh')
    expect(wuxingRelation('earth', 'metal')).toBe('sinh')
    expect(wuxingRelation('metal', 'water')).toBe('sinh')
    expect(wuxingRelation('water', 'wood')).toBe('sinh')
  })

  it('khắc đối xứng 5 cặp chéo', () => {
    expect(wuxingRelation('wood', 'earth')).toBe('khac')
    expect(wuxingRelation('earth', 'wood')).toBe('khac')
    expect(wuxingRelation('earth', 'water')).toBe('khac')
    expect(wuxingRelation('water', 'fire')).toBe('khac')
    expect(wuxingRelation('fire', 'metal')).toBe('khac')
    expect(wuxingRelation('metal', 'wood')).toBe('khac')
  })

  it('cùng hành hoặc không quan hệ → none', () => {
    expect(wuxingRelation('fire', 'fire')).toBe('none')
    expect(wuxingRelation('wood', 'metal')).toBe('none')
    // wood sinh fire, nhưng fire KHÔNG sinh wood (đơn hướng)
    expect(wuxingRelation('fire', 'wood')).toBe('none')
  })
})

describe('isSinhCycle (Luân Chuyển — spec §3.2)', () => {
  it('đủ 5 slot đúng thứ tự vòng sinh → true (về skill đầu)', () => {
    expect(isSinhCycle(['wood', 'fire', 'earth', 'metal', 'water'])).toBe(true)
  })

  it('đảo thứ tự sai vòng sinh → false', () => {
    expect(isSinhCycle(['wood', 'earth', 'fire', 'metal', 'water'])).toBe(false)
  })

  it('chưa đủ 5 slot → false', () => {
    expect(isSinhCycle(['wood', 'fire'])).toBe(false)
  })
})

describe('SINH_CYCLE', () => {
  it('đúng thứ tự vòng sinh', () => {
    expect(SINH_CYCLE).toEqual(['wood', 'fire', 'earth', 'metal', 'water'])
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/element/WuxingRelations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Viết implementation**

```typescript
// game/src/core/element/WuxingRelations.ts
import type { ElementType } from './ElementType'

// Spec 2026-08-30-phap-tu-dao-sac §3.4 — bảng quan hệ sinh/khắc ngũ
// hành, nguồn sự thật DUY NHẤT cho: (1) Luân Chuyển/Chế Khắc adjacency
// của Đa Pháp, (2) relation metadata reaction (§4), (3) UI ngôi sao 5
// cánh (cạnh ngoài = sinh, đường chéo = khắc). 5 hành = vòng khép
// kín: đỉnh cuối sinh về đỉnh đầu.

export type WuxingRelation = 'sinh' | 'khac' | 'none'

// Mộc→Hỏa→Thổ→Kim→Thủy→(về Mộc)
export const SINH_CYCLE: readonly ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']

// Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim, Kim⇄Mộc (i+2 mod 5 — cùng
// vòng SINH_CYCLE, đỉnh cách nhau 1 đỉnh)
const KHAC_PAIRS: ReadonlyArray<readonly [ElementType, ElementType]> = [
  ['wood', 'earth'],
  ['earth', 'water'],
  ['water', 'fire'],
  ['fire', 'metal'],
  ['metal', 'wood'],
]

export function wuxingRelation(from: ElementType, to: ElementType): WuxingRelation {
  if (from === to) {
    return 'none'
  }

  if (SINH_CYCLE[(SINH_CYCLE.indexOf(from) + 1) % SINH_CYCLE.length] === to) {
    return 'sinh'
  }

  return KHAC_PAIRS.some(([a, b]) => (a === from && b === to) || (a === to && b === from))
    ? 'khac'
    : 'none'
}

/** Loadout là vòng sinh khép kín khi đúng 5 slot và mỗi slot sinh
 * slot kế (slot cuối sinh về slot đầu) — điều kiện tầng Luân Chuyển
 * (spec §3.2). */
export function isSinhCycle(loadout: ElementType[]): boolean {
  if (loadout.length !== SINH_CYCLE.length) {
    return false
  }

  for (let i = 0; i < loadout.length; i++) {
    const next = loadout[(i + 1) % loadout.length]!
    if (wuxingRelation(loadout[i]!, next) !== 'sinh') {
      return false
    }
  }

  return true
}
```

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest --run src/core/element/WuxingRelations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): WuxingRelations — bang sinh/khac + isSinhCycle (spec §3.4)"
```

---

### Task 5: Slot gate theo realm (bảng 1/2/3/4/5)

**Files:**
- Modify: `game/src/core/skill/SkillLoadoutSlots.ts`
- Test: `game/src/core/skill/SkillLoadoutSlots.test.ts` (create nếu chưa có, nếu có rồi thì thêm describe)

**Interfaces:**
- Produces: `getSkillLoadoutSlotCount(realmId)` theo bảng mới: mortal 1, qi_refining/foundation_establishment 2, golden_core/nascent_soul 3, soul_transformation/void_refinement/body_integration/mahayana 4, tribulation+ 5. `KIEM_TRAN_SLOT_INDEX = 4` giữ nguyên.

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/skill/SkillLoadoutSlots.test.ts (thêm vào file có sẵn hoặc create)
import { describe, expect, it } from 'vitest'
import { getSkillLoadoutSlotCount } from './SkillLoadoutSlots'

// Spec 2026-08-30-phap-tu-dao-sac §6 — slot mở theo realm gate bảng:
// Phàm Nhân 1, Luyện Khí/Trúc Cơ 2, Kim Đan/Nguyên Anh 3, Hóa Thần
// trở đi 4, Độ Kiếp 5 (chuỗi A→B→C→D→E đủ).
describe('getSkillLoadoutSlotCount (spec §6)', () => {
  it('Phàm Nhân 1', () => {
    expect(getSkillLoadoutSlotCount('mortal')).toBe(1)
  })

  it('Luyện Khí + Trúc Cơ 2', () => {
    expect(getSkillLoadoutSlotCount('qi_refining')).toBe(2)
    expect(getSkillLoadoutSlotCount('foundation_establishment')).toBe(2)
  })

  it('Kim Đan + Nguyên Anh 3', () => {
    expect(getSkillLoadoutSlotCount('golden_core')).toBe(3)
    expect(getSkillLoadoutSlotCount('nascent_soul')).toBe(3)
  })

  it('Hóa Thần → Đại Thừa 4', () => {
    expect(getSkillLoadoutSlotCount('soul_transformation')).toBe(4)
    expect(getSkillLoadoutSlotCount('void_refinement')).toBe(4)
    expect(getSkillLoadoutSlotCount('body_integration')).toBe(4)
    expect(getSkillLoadoutSlotCount('mahayana')).toBe(4)
  })

  it('Độ Kiếp 5 + realmId lạ → 1', () => {
    expect(getSkillLoadoutSlotCount('tribulation')).toBe(5)
    expect(getSkillLoadoutSlotCount('unknown_realm')).toBe(1)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/skill/SkillLoadoutSlots.test.ts`
Expected: FAIL — công thức cũ (base 2 + mỗi 2 realm +1) cho Luyện Khí 2 nhưng Trúc Cơ 2... (kiểm tra từng giá trị; giá trị nào trùng thì test đó pass lặng — đảm bảo ít nhất golden_core FAIL vì công thức cũ cho 2).

- [ ] **Step 3: Sửa getSkillLoadoutSlotCount**

```typescript
// game/src/core/skill/SkillLoadoutSlots.ts — thay hàm hiện tại:
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §6) — slot mở theo
// BẢNG realm gate (thay công thức +1 mỗi 2 realm cũ): Phàm Nhân 1,
// Luyện Khí/Trúc Cơ 2 (A+B), Kim Đan/Nguyên Anh 3 (+C), Hóa Thần
// → Đại Thừa 4 (+D), Độ Kiếp 5 (+E). Mỗi mốc mở đúng 1 link chuỗi
// mới — nội dung hiện dừng ở Trúc Cơ nên thực tế chỉ A+B chơi được.
const REALM_SLOT_TABLE: Record<string, number> = {
  mortal: 1,
  qi_refining: 2,
  foundation_establishment: 2,
  golden_core: 3,
  nascent_soul: 3,
  soul_transformation: 4,
  void_refinement: 4,
  body_integration: 4,
  mahayana: 4,
  tribulation: 5,
}

export function getSkillLoadoutSlotCount(realmId: string): number {
  // realmId không hợp lệ → 1 slot (giữ hành vi an toàn cũ cho
  // scheduler — Trảm của Phàm Nhân luôn có slot 0).
  return REALM_SLOT_TABLE[realmId] ?? 1
}
```
Giữ nguyên comment + `KIEM_TRAN_SLOT_INDEX` + `MAX_SKILL_LOADOUT_SLOTS` (5). Xoá import `getRealmIndex` nếu không còn dùng trong file.

- [ ] **Step 4: Chạy test verify pass + regression**

Run: `npx.cmd vitest --run src/core/skill/ src/composables/useCombatSkillPresentation.test.ts 2>$null; npm.cmd run type-check`
Expected: PASS. Có thể có test regression kỳ vọng slot cũ (vd test kỳ vọng Luyện Khí 2 → vẫn pass; test kỳ vọng Trúc Cơ 3 nếu có → sửa theo bảng mới).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): slot gate theo bang realm 1/2/3/4/5 (spec §6)"
```

---

### Task 6: Thế engine — pool + gain + reset-on-ult

**Files:**
- Modify: `game/src/core/combat/CombatEntity.ts` (thêm field `currentThe`)
- Modify: `game/src/core/combat/CombatTypes.ts` (thêm MAX_THE)
- Create: `game/src/core/battle/TheResourceSystem.ts`
- Test: `game/src/core/battle/TheResourceSystem.test.ts`

**Interfaces:**
- Produces:
  - `CombatEntity.currentThe?: number` (optional — precedent `currentKiemThe`, đọc qua `?? 0`)
  - `const MAX_THE = 100`
  - `const THE_GAIN_PER_LINK = 10` / `const THE_GAIN_PER_FINISHER = 20`
  - `function gainTheOnChainLink(player: CombatEntity, isFinisher: boolean): void`
  - `function consumeTheForUlt(player: CombatEntity): boolean` (đầy 100 mới bắn, reset về 0)

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/battle/TheResourceSystem.test.ts
import { describe, expect, it } from 'vitest'
import { consumeTheForUlt, gainTheOnChainLink, MAX_THE } from './TheResourceSystem'
import type { CombatEntity } from '../combat/CombatEntity'

function playerWith(the?: number): CombatEntity {
  return { id: 'player', type: 'player', currentThe: the } as CombatEntity
}

// Spec 2026-08-30-phap-tu-dao-sac §2.3 — Thế Thuần hệ: pool 0-100,
// +10/link (+20 E), tích xuyên kill trong phiên, chỉ reset khi bắn
// ult (đầy 100). Không decay theo thời gian.
describe('Thế hệ thống (spec §2.3)', () => {
  it('+10 mỗi link thường, +20 finisher E', () => {
    const player = playerWith(0)
    gainTheOnChainLink(player, false)
    expect(player.currentThe).toBe(10)
    gainTheOnChainLink(player, true)
    expect(player.currentThe).toBe(30)
  })

  it('cap MAX_THE 100', () => {
    const player = playerWith(95)
    gainTheOnChainLink(player, true)
    expect(player.currentThe).toBe(MAX_THE)
    expect(MAX_THE).toBe(100)
  })

  it('consumeTheForUlt: đầy mới bắn, reset về 0', () => {
    const notFull = playerWith(99)
    expect(consumeTheForUlt(notFull)).toBe(false)
    expect(notFull.currentThe).toBe(99)

    const full = playerWith(100)
    expect(consumeTheForUlt(full)).toBe(true)
    expect(full.currentThe).toBe(0)
  })

  it('undefined coi như 0', () => {
    const player = playerWith(undefined)
    gainTheOnChainLink(player, false)
    expect(player.currentThe).toBe(10)
  })
})
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/battle/TheResourceSystem.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Viết implementation**

CombatEntity.ts — thêm field (đặt cạnh currentKiemThe, cùng comment precedent):
```typescript
  // Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.3) — Thế
  // THUẦN HỆ Pháp Tu sau Lập Đạo, pool 0-MAX_THE (CombatTypes.ts),
  // tích +10 mỗi link chuỗi (+20 finisher E), XUYÊN KILL trong phiên
  // farm (không decay), reset về 0 khi bắn Ultimate. Optional — cùng
  // precedent currentKiemThe: chỉ Kiếm Tu/Pháp Tu chốt đạo mới có ý
  // nghĩa, mọi fixture khác đọc qua `?? 0`.
  currentThe?: number
```
CombatTypes.ts — thêm:
```typescript
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.3) — Thế Thuần
// hệ Pháp Tu: pool 0-100 tích xuyên kill, đầy thì bắn được Ultimate
// nhánh (reset về 0). +10/link, +20 finisher E — khởi điểm playtest.
export const MAX_THE = 100
export const THE_GAIN_PER_LINK = 10
export const THE_GAIN_PER_FINISHER = 20
```
TheResourceSystem.ts:
```typescript
// game/src/core/battle/TheResourceSystem.ts
import type { CombatEntity } from '../combat/CombatEntity'
import { MAX_THE, THE_GAIN_PER_FINISHER, THE_GAIN_PER_LINK } from '../combat/CombatTypes'

// Thế Thuần hệ Pháp Tu (spec 2026-08-30-phap-tu-dao-sac §2.3) — runtime
// thuần của pool CHIẾN ĐẤU, pattern KiemTuResourceSystem (KHÔNG đụng
// CombatSystem pipeline). Mọi hàm đọc field optional qua `?? 0`.

/** +10 mỗi link chuỗi cast hoàn tất (+20 với finisher E), cap MAX_THE. */
export function gainTheOnChainLink(player: CombatEntity, isFinisher: boolean): void {
  player.currentThe = Math.min(
    MAX_THE,
    (player.currentThe ?? 0) + (isFinisher ? THE_GAIN_PER_FINISHER : THE_GAIN_PER_LINK),
  )
}

/** Ult mở khi Thế đầy (100); bắn xong reset về 0 (spec §2.3). */
export function consumeTheForUlt(player: CombatEntity): boolean {
  if ((player.currentThe ?? 0) < MAX_THE) {
    return false
  }

  player.currentThe = 0
  return true
}
```

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest --run src/core/battle/TheResourceSystem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): The engine — pool 0-100, gain link/finisher, reset on ult (spec §2.3)"
```

---

### Task 7: Chain state engine — gate + reset-on-kill

**Files:**
- Create: `game/src/core/battle/ChainStateSystem.ts`
- Test: `game/src/core/battle/ChainStateSystem.test.ts`

**Interfaces:**
- Produces:
  - `interface ChainDefinition { skillIds: readonly string[] }` (A→B→C→D→E theo thứ tự)
  - `interface ChainRuntimeState { nextIndex: number }`
  - `function initChainState(): ChainRuntimeState` — `{ nextIndex: 0 }`
  - `function canCastChainSkill(chain: ChainDefinition, state: ChainRuntimeState, skillId: string, loadoutSize: number): boolean` — cho phép cast skill[i] nếu i === nextIndex; skill NGOÀI chuỗi (không thuộc skillIds) luôn được cast tự do
  - `function advanceChain(chain: ChainDefinition, state: ChainRuntimeState, skillId: string): void` — cast hoàn tất skill[i] → nextIndex = i+1 (E quay về 0)
  - `function resetChainOnKill(state: ChainRuntimeState): void` — nextIndex = 0

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/battle/ChainStateSystem.test.ts
import { describe, expect, it } from 'vitest'
import {
  advanceChain,
  canCastChainSkill,
  initChainState,
  resetChainOnKill,
  type ChainDefinition,
} from './ChainStateSystem'

// Spec 2026-08-30-phap-tu-dao-sac §2.1/§7 — chuỗi combo Thuần hệ:
// cast A mới mở B, B mới mở C...; quái chết → reset về A; skill ngoài
// chuỗi (Phàm Nhân/reaction setup) cast tự do. Loadout nhỏ hơn chuỗi
// (2/5 slot Luyện Khí) → chỉ đầu chuỗi khả dụng.
const CHAIN: ChainDefinition = { skillIds: ['chain_a', 'chain_b', 'chain_c', 'chain_d', 'chain_e'] }

describe('ChainStateSystem (spec §2.1/§7)', () => {
  it('ban đầu chỉ cast được A', () => {
    const state = initChainState()
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(false)
    expect(canCastChainSkill(CHAIN, state, 'chain_e', 5)).toBe(false)
  })

  it('cast A xong mới mở B,依次 đến E rồi quay về A', () => {
    const state = initChainState()
    advanceChain(CHAIN, state, 'chain_a')
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 5)).toBe(true)
    advanceChain(CHAIN, state, 'chain_b')
    advanceChain(CHAIN, state, 'chain_c')
    advanceChain(CHAIN, state, 'chain_d')
    expect(canCastChainSkill(CHAIN, state, 'chain_e', 5)).toBe(true)
    advanceChain(CHAIN, state, 'chain_e')
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
  })

  it('quái chết → reset về A', () => {
    const state = initChainState()
    advanceChain(CHAIN, state, 'chain_a')
    advanceChain(CHAIN, state, 'chain_b')
    resetChainOnKill(state)
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
    expect(canCastChainSkill(CHAIN, state, 'chain_c', 5)).toBe(false)
  })

  it('loadout 2 slot → chỉ A+B khả dụng (C/D/E khóa realm, spec §6)', () => {
    const state = initChainState()
    advanceChain(CHAIN, state, 'chain_a')
    expect(canCastChainSkill(CHAIN, state, 'chain_b', 2)).toBe(true)
    advanceChain(CHAIN, state, 'chain_b')
    // C nằm ngoài loadout 2 slot — canCast false dù nextIndex trỏ C
    expect(canCastChainSkill(CHAIN, state, 'chain_c', 2)).toBe(false)
  })

  it('skill ngoài chuỗi cast tự do, không advance', () => {
    const state = initChainState()
    expect(canCastChainSkill(CHAIN, state, 'tram', 5)).toBe(true)
    advanceChain(CHAIN, state, 'tram')
    expect(canCastChainSkill(CHAIN, state, 'chain_a', 5)).toBe(true)
  })

  it('advanceChain với skillId sai vị trí → no-op', () => {
    const state = initChainState()
    advanceChain(CHAIN, state, 'chain_c')
    expect(canCastCastable(state)).toBe('chain_a')
  })
})

function canCastCastable(state: { nextIndex: number }): string {
  return CHAIN.skillIds[state.nextIndex] ?? CHAIN.skillIds[0]!
}
```

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/battle/ChainStateSystem.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Viết implementation**

```typescript
// game/src/core/battle/ChainStateSystem.ts

// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.1/§7) — chuỗi
// combo Thuần hệ: cast A mới mở B → C → D → E, E quay về A. Quái
// chết → reset về A (scaling tự nhiên: quái thường chết nhanh =
// chuỗi ngắn, boss trụ lâu = chuỗi đầy). Pure functions — state giữ
// trên Battle/BattleSystem, engine không đụng scheduler.

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
 * chuỗi (Phàm Nhân/reaction setup) tự do. loadoutSize khóa phần chuỗi
 * vượt slot mở theo realm (spec §6 — C/D/E là data chờ). */
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
 * hoặc ngoài chuỗi → no-op. E (index cuối) quay về 0. */
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

/** Quái chết → chuỗi reset về A (spec §2.1). */
export function resetChainOnKill(state: ChainRuntimeState): void {
  state.nextIndex = 0
}
```
(Sửa helper `canCastCastable` trong test nếu đặt trước describe gây hoisting issue — di chuyển vào trong hoặc đổi tên cho rõ.)

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest --run src/core/battle/ChainStateSystem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): ChainStateSystem — gate A→B→C→D→E + reset-on-kill (spec §2.1/§7)"
```

---

### Task 8: Wire chain vào BattleSystem scheduler

**Files:**
- Modify: `game/src/core/battle/BattleSystem.ts` (updatePlayerSkills + castSkill/finishCast + enemy death)
- Test: `game/src/core/battle/BattleSystem.chain.test.ts` (create)

**Interfaces:**
- Consumes: Task 6 `gainTheOnChainLink`, Task 7 `initChainState/canCastChainSkill/advanceChain/resetChainOnKill`, Task 5 `getSkillLoadoutSlotCount`.
- Produces: BattleSystem tự động áp chain gate khi player là Pháp Tu đã chốt Thuần (đọc `phapTuDao.kind === 'thuan'` từ player data — injected qua BattleSystem constructor context hoặc read qua GameManager; chọn đường inject `chainDefinition?: ChainDefinition` + state internal để BattleSystem thuần test được).

- [ ] **Step 1: Viết test failing — BattleSystem áp chain**

Fixture pattern: copy setup harness từ `BattleSystem.batKiem.test.ts`/`BattleSystem.hoaThe.test.ts` (GameManager + BattleSystem thật, createDefaultPlayer, learnSkill 2 skill chuỗi test, equip slot 0/1). Test cases:

```typescript
// game/src/core/battle/BattleSystem.chain.test.ts — outline các it():
// 1. 'chưa cast A thì B không thể auto-cast (scheduler bỏ qua B)' —
//    equip chain_a slot 0, chain_b slot 1; chạy update đủ lâu; assert
//    event cast chỉ thấy chain_a (đọc qua eventBus spy hoặc
//    skillCastCounts).
// 2. 'cast A xong → B được cast → Thế +10+10' — sau chain_a cast,
//    chain_b cast theo; player.currentThe = 20.
// 3. 'target chết giữa chuỗi → reset: B khóa lại, A cast lại được' —
//    dùng enemy HP thấp 1 hit chết; sau kill, assert cast kế là A.
// 4. 'skill ngoài chuỗi không bị gate' — equip thêm 1 skill không
//    thuộc chainDefinition; assert vẫn cast tự do.
```
(Chi tiết fixture theo đúng pattern test BattleSystem hiện có — đọc `BattleSystem.batKiem.test.ts` làm mẫu trước khi viết.)

- [ ] **Step 2: Chạy test verify fail**

Run: `npx.cmd vitest --run src/core/battle/BattleSystem.chain.test.ts`
Expected: FAIL — BattleSystem chưa có chain gate (B cast ngay không cần A).

- [ ] **Step 3: Implement wire**

BattleSystem.ts:
1. Constructor thêm field `private chain?: { definition: ChainDefinition; state: ChainRuntimeState }` — set qua hàm public `setChainDefinition(definition: ChainDefinition | undefined)` (GameManager gọi lúc start battle khi player Thuần).
2. `start()`: `this.chain = definition ? { definition, state: initChainState() } : undefined` — đặt cạnh `initKiemTuBattleResources` call site; KHÔNG reset Thế giữa trận liên tục (thế xuyên kill), chỉ reset khi start battle MỚI nếu spec yêu cầu — theo spec §2.3 thế tích xuyên kill trong phiên: giữ nguyên currentThe qua start() chỉ khi là cùng session farm (thực hiện: không chạm currentThe ở start).
3. `updatePlayerSkills()` — trong vòng duyệt loadout, sau check `canUseInSlot`, thêm:
```typescript
      if (
        this.chain &&
        !canCastChainSkill(
          this.chain.definition,
          this.chain.state,
          skill.id,
          loadoutEntries.length,
        )
      ) {
        continue
      }
```
4. `finishPlayerCastTransaction` (hoặc nơi cast hoàn tất — castSkill resolve cho instant): gọi `advanceChain(this.chain.definition, this.chain.state, skillId)` + `gainTheOnChainLink(source, isFinisher)` với `isFinisher = skillId === definition.skillIds[definition.skillIds.length - 1]` — chỉ khi `this.chain` tồn tại.
5. Enemy death: tìm nơi enemy bị remove/`alive = false` (grep `alive = false` trong BattleSystem/StageWaveSystem — vitals event `killed: true`) → gọi `resetChainOnKill(this.chain.state)`. Nếu death xử lý ở StageWaveSystem/GameManager, đăng ký listener `entity_vitals_changed` lọc `killed && entityId !== player.id` ở start().

- [ ] **Step 4: Chạy test verify pass**

Run: `npx.cmd vitest --run src/core/battle/BattleSystem.chain.test.ts`
Expected: PASS 4 cases.

- [ ] **Step 5: Regression + commit**

Run: `npm.cmd run test`
Expected: PASS toàn bộ (chain gate chỉ active khi setChainDefinition được gọi — mọi test cũ không set → hành vi cũ).

```bash
git add -A
git commit -m "feat(phap-tu): wire chain gate + the gain + reset-on-kill vao BattleSystem (spec §7)"
```

---

### Task 9: 5 bộ skill data chuỗi thần thoại (A giữ root cũ, B–E mới)

**Files:**
- Modify: `game/src/data/skill/Skills.ts` (thêm 4 skill × 5 hành = 20 entry mới: B/C/D/E mỗi hành; A là root hiện có — hoa_cau_thuat/thuy_tien_thuat/moc_?/kim_?/tho_? kiểm tra id thật qua grep)
- Test: `game/src/data/skill/Skills.chain.test.ts` (create)

**Interfaces:**
- Consumes: ailment engine hiện có (bong/te_cong/trung_doc/chay_mau/thach_hoa/troi_chan), manaScalingRatio, attributeScaling pattern.
- Produces: 20 skill mới id format `chuc_dung_b/c/d/e`, `thien_ngo_b/c/d/e`, `cau_mang_b/c/d/e`, `nhuc_thu_b/c/d/e`, `hau_tho_b/c/d/e` + hằng số export `CHAIN_SKILL_IDS: Record<ElementType, readonly string[]>` cho Task 10/11 (phía data, đặt trong Skills.ts hoặc file data riêng).

- [ ] **Step 1: Grep id root 5 hành hiện có**

Run: `Get-ChildItem -Recurse -Include Skills.ts src/data/skill | Select-String "hoa_cau|thuy_tien|moc_|kim_|tho_"` — xác định id root thật của từng hành (A) trước khi viết test.

- [ ] **Step 2: Viết test failing — data validation 20 skill**

```typescript
// game/src/data/skill/Skills.chain.test.ts
import { describe, expect, it } from 'vitest'
import { CHAIN_SKILL_IDS, SKILLS } from './Skills'
import { ELEMENT_ORDER } from '../../core/element/ElementLabels'

// Spec 2026-08-30-phap-tu-dao-sac §2.2 — 5 chuỗi thần SHK, mỗi hành
// root A (hiện có) + 4 skill mới B/C/D/E. Data validation pattern
// test data hiện có: id duy nhất, type active, có effects, realm gate
// qua node unlock (KHÔNG qua skill data).
describe('Data 5 chuỗi thần thoại (spec §2.2)', () => {
  it('CHAIN_SKILL_IDS đủ 5 hành × 5 slot, A là root hiện có', () => {
    expect(Object.keys(CHAIN_SKILL_IDS).sort()).toEqual([...ELEMENT_ORDER].sort())
    for (const element of ELEMENT_ORDER) {
      const chain = CHAIN_SKILL_IDS[element]
      expect(chain).toHaveLength(5)
      expect(SKILLS.find(s => s.id === chain[0])?.type).toBe('active')
      // A là skill đã tồn tại trước redesign (grep xác nhận ở Step 1)
      for (const skillId of chain.slice(1)) {
        expect(SKILLS.find(s => s.id === skillId)).toBeDefined()
      }
    }
  })

  it('20 skill mới B–E: id duy nhất, active, có effects', () => {
    const allIds = new Set(SKILLS.map(s => s.id))
    expect(allIds.size).toBe(SKILLS.length)
    for (const element of ELEMENT_ORDER) {
      for (const skillId of CHAIN_SKILL_IDS[element].slice(1)) {
        const skill = SKILLS.find(s => s.id === skillId)
        expect(skill?.type).toBe('active')
        expect(skill?.effects.length).toBeGreaterThan(0)
      }
    }
  })
})
```

- [ ] **Step 3: Chạy test verify fail**

Run: `npx.cmd vitest --run src/data/skill/Skills.chain.test.ts`
Expected: FAIL — CHAIN_SKILL_IDS chưa export.

- [ ] **Step 4: Thêm 20 skill data + CHAIN_SKILL_IDS**

Mỗi skill theo template skill hiện có (copy shape `hoa_cau_thuat`: id/name/description/type/level/maxLevel/cooldown/remainingCooldown/castTime/execution/target/effects/unlocked/equipped). Dấu ấn cơ chế mỗi hành theo spec §2.2 (Hỏa chồng Thiêu Đốt → D kích nổ → E nuke lan; Thủy kiềm chế/hồi; Mộc nhiễm độc/lan; Kim châm/vụn thép/cộng hưởng/đè; Thổ phòng tuyến/cột đỡ/lũy). Số liệu damage/cooldown khởi điểm:
- B: cast ~1s, cd ~3s, damage ratio 1.0, ailments theo dấu ấn
- C: cast ~1.2s, cd ~5s, damage ratio 1.2 + hiệu ứng đặc trưng (lan/hồi/trói)
- D: cast ~1.4s, cd ~8s, ratio 1.5 + khuếch đại (kích nổ Thiêu Đốt / cộng hưởng Xuất Huyết...)
- E: cast ~2s, cd ~12s, ratio 2.5 + đòn lớn theo bảng §2.2
- Kích nổ Thiêu Đốt (D Hỏa): effect damage bonus theo `ailmentId bong active` — nếu engine chưa có effect type "detonate ailment", dùng pattern Detonate hiện có (grep `Detonate` trong SkillEffect — đã có damagePerStack); KHÔNG tạo effect type mới.
- Element của skill khớp hành (components element fire/wood/earth/metal/water).
- Mỗi entry comment chốt: `// Pháp Tu Đạo Sắc (spec 2026-08-30 §2.2) — chuỗi <Thần> link <B..E>`.
Export cuối file:
```typescript
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.2) — ánh xạ
// chuỗi 5 skill theo hành cho ChainDefinition (BattleSystem) + node
// unlock (PhapTuNodes). A là root hiện có của hành.
export const CHAIN_SKILL_IDS: Record<ElementType, readonly string[]> = {
  fire: ['hoa_cau_thuat', 'chuc_dung_b', 'chuc_dung_c', 'chuc_dung_d', 'chuc_dung_e'],
  water: ['thuy_tien_thuat', 'thien_ngo_b', 'thien_ngo_c', 'thien_ngo_d', 'thien_ngo_e'],
  wood: ['<root_moc>', 'cau_mang_b', 'cau_mang_c', 'cau_mang_d', 'cau_mang_e'],
  metal: ['<root_kim>', 'nhuc_thu_b', 'nhuc_thu_c', 'nhuc_thu_d', 'nhuc_thu_e'],
  earth: ['<root_tho>', 'hau_tho_b', 'hau_tho_c', 'hau_tho_d', 'hau_tho_e'],
}
```

- [ ] **Step 5: Chạy test verify pass + type-check**

Run: `npx.cmd vitest --run src/data/skill/Skills.chain.test.ts && npm.cmd run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): data 20 skill chuoi 5 than SHK + CHAIN_SKILL_IDS (spec §2.2)"
```

---

### Task 10: 5 Ultimate theo Thế (Tất Phương/Bát Thủ/Kiến Mộc/Kim Phạt/Thành Lũy)

**Files:**
- Modify: `game/src/data/skill/Skills.ts` (thêm 5 ult — KHÔNG loadout slot)
- Modify: `game/src/core/battle/UltimateSystem.ts` (thêm nhánh Pháp Tu)
- Test: `game/src/core/battle/UltimateSystem.phapTu.test.ts` (create)

**Interfaces:**
- Consumes: Task 6 `consumeTheForUlt`, pattern `autoUltimateDecision`/`canUseUltimate` hiện có.
- Produces: `PHAP_TU_ULTIMATE_IDS: Record<ElementType, string>` = `{ fire: 'tat_phuong', water: 'bat_thu', wood: 'kien_moc', metal: 'kim_phat', earth: 'thanh_luy' }`; `canUsePhapTuUltimate(battle)` + `autoPhapTuUltimateDecision(battle, dao)` trả element hoặc null.

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/battle/UltimateSystem.phapTu.test.ts
import { describe, expect, it } from 'vitest'
import {
  autoPhapTuUltimateDecision,
  canUsePhapTuUltimate,
  PHAP_TU_ULTIMATE_IDS,
} from './UltimateSystem'

// Spec 2026-08-30-phap-tu-dao-sac §2.4 — ult Thuần hệ mở khi Thế đầy
// 100, nút manual + auto (AI bắn khi boss/Độ Kiếp trong trận), KHÔNG
// chiếm loadout slot. Pattern TTKT/KKTM.
describe('Pháp Tu ult theo Thế (spec §2.4)', () => {
  it('PHAP_TU_ULTIMATE_IDS đủ 5 hành đúng id', () => {
    expect(PHAP_TU_ULTIMATE_IDS).toEqual({
      fire: 'tat_phuong',
      water: 'bat_thu',
      wood: 'kien_moc',
      metal: 'kim_phat',
      earth: 'thanh_luy',
    })
  })

  it('Thế < 100 → không bắn được; = 100 → được + reset 0', () => {
    // fixture battle + player currentThe — theo pattern UltimateSystem.test.ts
    // hiện có (makeEntity/makeBattle helper)
  })

  it('auto: chỉ đề xuất khi boss active + Thế đầy', () => {
    // battle có boss → element; không boss → null; boss nhưng Thế 50 → null
  })
})
```
(Điền thân test theo helper `makeEntity`/`makeBattle` có sẵn trong `UltimateSystem.test.ts` — đọc file đó trước.)

- [ ] **Step 2: Chạy verify fail**

Run: `npx.cmd vitest --run src/core/battle/UltimateSystem.phapTu.test.ts`
Expected: FAIL — export chưa tồn tại.

- [ ] **Step 3: Implement trong UltimateSystem.ts**

```typescript
// Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §2.4) — 5 ult
// Thuần hệ theo Thế đầy 100, pattern TTKT/KKTM: nút manual riêng
// (CombatControlBar) + toggle auto mặc định ON (AI bắn khi boss/Độ
// Kiếp active). KHÔNG chiếm loadout slot.
export const PHAP_TU_ULTIMATE_IDS = {
  fire: 'tat_phuong',
  water: 'bat_thu',
  wood: 'kien_moc',
  metal: 'kim_phat',
  earth: 'thanh_luy',
} as const

export function canUsePhapTuUltimate(battle: Battle, element: ElementType): boolean {
  return (battle.player.currentThe ?? 0) >= MAX_THE
}

export function autoPhapTuUltimateDecision(
  battle: Battle,
  element: ElementType,
): ElementType | null {
  if (battle.state !== 'fighting' || !battle.player.alive) {
    return null
  }
  return battleHasBoss(battle) && canUsePhapTuUltimate(battle, element) ? element : null
}
```
+ entry 5 ult trong Skills.ts (unlocked qua node major Trúc Cơ mỗi nhánh — Task 11; execution kind tương tự TTKT instant, effect theo bảng §2.4: Tất Phương nuke AoE + zone cháy (reuse spawnsLavaZone/zone pattern), Bát Thủ 8 đợt AoE (effect multi-hit hoặc 1 đòn lớn + purge — dùng effect có sẵn, khởi điểm 1 đòn AoE lớn), Kiến Mộc AoE + root troi_chan, Kim Phạt đơn mục tiêu cực lớn, Thành Lũy AoE + armor buff self).

- [ ] **Step 4: Verify pass + regression**

Run: `npx.cmd vitest --run src/core/battle/UltimateSystem.phapTu.test.ts src/core/battle/UltimateSystem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): 5 ult theo The — Tat Phuong/Bat Thu/Kien Moc/Kim Phat/Thanh Luy (spec §2.4)"
```

---

### Task 11: PhapTuNodes — node Lập Đạo + 6 nhánh mới + unlock chuỗi/ult

**Files:**
- Modify: `game/src/data/progression/PhapTuNodes.ts` (restructure lớn theo spec §1.2)
- Test: `game/src/data/progression/PhapTuNodes.dao.test.ts` (create)

**Interfaces:**
- Consumes: Task 9 `CHAIN_SKILL_IDS`, Task 10 `PHAP_TU_ULTIMATE_IDS` (import qua data — hoặc hard-code id với comment đối chiếu).
- Produces:
  - Node `phap_tu_lap_dao` (major, realm gate foundation_establishment, effect `unlocksDaoChoice: true` — hoặc theo pattern unlocksSkillIds; chốt: node này là "cổng" — mua = mở 2 node con `phap_tu_lap_dao_thuan_<element>` × 5 + `phap_tu_lap_dao_da_phap`, mỗi node con excludesNode các node con khác)
  - 5 nhánh Thuần mới (branchTag `thuan_fire`...): node chuỗi unlock B/C/D/E (mỗi node unlocksSkillIds 1 skill, prereq node cha trước đó — C cần B, D cần C...), node ult (major, unlocksSkillIds ult id), node chuyên sâu Thế (~4 node/hành: gain/decay không cần — Thế không decay; thay bằng: +trần, +gain, hiệu ứng khi đầy, node biến thể C/D), giữ root/power/cadence/mechanic hiện có của hành.
  - 1 nhánh Đa Pháp (branchTag `da_phap`): node reaction 7 (elementApplicationPercent/powerScalingRatio/waterReactionExtension/keepsAilment tăng...), node sinh-khắc 6 (nurture %, chế khắc %, Đồng Sinh, Liên Khắc), đều prereq `phap_tu_lap_dao_da_phap`.
  - Group Thân Hòa (branchTag `than_hoa`, mở cho cả 2 đạo): 6 node pháp lực (manaScalingBonus/manaShieldBonus/theo-%-Pháp Lực...).

- [ ] **Step 1: Viết test failing — data validation**

```typescript
// game/src/data/progression/PhapTuNodes.dao.test.ts
import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { CHAIN_SKILL_IDS } from '../skill/Skills'

// Spec 2026-08-30-phap-tu-dao-sac §1.2 — cây sau redesign: node Lập Đạo
// + 5 nhánh Thuần + 1 nhánh Đa Pháp + group Thân Hòa dùng chung.
describe('PhapTuNodes Đạo Sắc (spec §1.2)', () => {
  it('có node Lập Đạo major gate Trúc Cơ + 6 node con loại trừ nhau', () => {
    const daoNode = PHAP_TU_NODES.find(n => n.id === 'phap_tu_lap_dao')
    expect(daoNode?.type).toBe('major')
    expect(daoNode?.prerequisites?.some(p => p.kind === 'realm' && p.realmId === 'foundation_establishment')).toBe(true)
    const children = PHAP_TU_NODES.filter(n =>
      n.prerequisites?.some(p => p.kind === 'node' && p.nodeId === 'phap_tu_lap_dao'),
    )
    // 5 Thuần + 1 Đa Pháp
    expect(children.filter(n => n.id.startsWith('phap_tu_lap_dao_thuan'))).toHaveLength(5)
    expect(children.some(n => n.id === 'phap_tu_lap_dao_da_phap')).toBe(true)
    // mỗi node con excludes các node con khác (chọn 1 đạo duy nhất)
    for (const child of children) {
      const excludes = child.prerequisites?.filter(p => p.kind === 'excludesNode') ?? []
      expect(excludes.length).toBe(children.length - 1)
    }
  })

  it('mỗi nhánh Thuần có node unlock B/C/D/E đúng chuỗi + node ult', () => {
    for (const [element, chain] of Object.entries(CHAIN_SKILL_IDS)) {
      const tag = `thuan_${element}`
      const branchNodes = PHAP_TU_NODES.filter(n => n.branchTag === tag)
      for (const skillId of chain.slice(1)) {
        const unlocker = branchNodes.find(n => n.effect.unlocksSkillIds?.includes(skillId))
        expect(unlocker, `thiếu node unlock ${skillId}`).toBeDefined()
      }
      const ultId = ({ fire: 'tat_phuong', water: 'bat_thu', wood: 'kien_moc', metal: 'kim_phat', earth: 'thanh_luy' } as const)[element as 'fire']
      expect(branchNodes.some(n => n.effect.unlocksSkillIds?.includes(ultId))).toBe(true)
    }
  })

  it('nhánh Đa Pháp: node sinh/khắc prereq đúng, group Thân Hòa tách riêng', () => {
    const daPhap = PHAP_TU_NODES.filter(n => n.branchTag === 'da_phap')
    expect(daPhap.length).toBeGreaterThanOrEqual(13) // 7 reaction + 6 sinh-khắc
    const thanHoa = PHAP_TU_NODES.filter(n => n.branchTag === 'than_hoa')
    expect(thanHoa.length).toBe(6)
  })

  it('nhánh Thuần chỉ mở khi đã chốt Thuần hành đó (prereq node con)', () => {
    const fireNodes = PHAP_TU_NODES.filter(n => n.branchTag === 'thuan_fire')
    for (const node of fireNodes) {
      expect(node.prerequisites?.some(p =>
        p.kind === 'node' && p.nodeId === 'phap_tu_lap_dao_thuan_fire',
      )).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Chạy verify fail**

Run: `npx.cmd vitest --run src/data/progression/PhapTuNodes.dao.test.ts`
Expected: FAIL — node mới chưa tồn tại.

- [ ] **Step 3: Restructure PhapTuNodes.ts**

Giữ `buildBranch` + 5 branch hiện có (root/power/cadence/mechanic) làm phần Luyện Khí thử. XOÁ 2 keystone Thuần/Reaction cũ + specialization của chúng (spec §1.2 — "keystone Thuần/Reaction cũ BỎ"). Thêm:
1. Node `phap_tu_lap_dao` (major, role 'dao', insightCost 1, prereq FOUNDATION).
2. 6 node con (major, role 'dao-choice', insightCost 2, prereq: node phap_tu_lap_dao + FOUNDATION + excludes 5 node kia; id: `phap_tu_lap_dao_thuan_fire/wood/earth/metal/water`, `phap_tu_lap_dao_da_phap`; effect: unlocksSkillIds = [] + đánh dấu qua field effect mới nếu cần phân nhánh — chốt đơn giản: Thuần unlock skill B đầu tiên, Đa Pháp không unlock).
3. 5 nhánh `thuan_<element>`: mỗi nhánh dùng hàm build mới `buildThuanBranch(element)` — node unlock B/C/D/E tuần tự (minor, prereq: lap_dao_thuan_element + node unlock trước đó, unlocksSkillIds 1 skill), node ult (major, prereq unlock E, unlocksSkillIds ult), 4 node Thế chuyên sâu (gain +5/trần +20/hiệu ứng đầy/1 biến thể C or D — khai theo stat mới qua SkillModifier).
4. Nhánh `da_phap`: 13 node theo Interface trên (stat: elementApplicationPercent, reactionEffectPercent, waterReactionExtensionSeconds, nurturePercent/cheKhacPercent qua stat mới — định nghĩa stat key mới trong SkillRuntimeStats nếu chưa có, cùng pattern 19 field Thế hiện tại).
5. Group `than_hoa`: 6 node (manaScalingRatio bonus qua skillModifier multi-skill — pattern aggregateNodeSkillModifiers hiện có; manaShieldPercent qua StatModifier thường).

- [ ] **Step 4: Chạy verify pass + regression node tests**

Run: `npx.cmd vitest --run src/data/progression/ src/core/progression/`
Expected: FAIL một số test PhapTuNodes cũ tham chiếu keystone đã xoá → sửa test đó theo data mới (giữ test phần Luyện Khí vẫn pass).

- [ ] **Step 5: Full + commit**

Run: `npm.cmd run type-check && npm.cmd run test`
Expected: PASS.

```bash
git add -A
git commit -m "feat(phap-tu): PhapTuNodes — Lap Dao + 5 nhanh Thuan + Da Phap + Than Hoa (spec §1.2)"
```

---

### Task 12: PlayerData.phapTuDao + insight refund + GameManager chốt đạo

**Files:**
- Modify: `game/src/core/player/Player.ts` (field `phapTuDao`)
- Modify: `game/src/core/game/GameManager.ts` (hàm `choosePhapTuDao(player, choice)`)
- Modify: `game/src/services/save/SaveSystem.ts` + `saveVersion.ts` (v54→55 + comment block)
- Test: `game/src/core/game/GameManager.phapTuDao.test.ts` (create)

**Interfaces:**
- Consumes: Task 11 node ids, NodeSystem `devResetBranch` pattern (hoặc hàm refund riêng tính từ nodeLevels).
- Produces:
  - `interface PhapTuDao { kind: 'thuan'; element: ElementType } | { kind: 'da_phap' }` (export từ Player.ts)
  - `PlayerData.phapTuDao?: PhapTuDao`
  - `GameManager.choosePhapTuDao(player, choice: PhapTuDao): boolean` — gate: đã là phap_tu + foundation_establishment + chưa chốt; mua node con tương ứng;refund toàn bộ insight các nhánh bị bỏ; unequip skill các hành bị khóa.

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/game/GameManager.phapTuDao.test.ts — outline (fixture
// theo GameManager.phapTuFirePath.test.ts hiện có):
// 1. 'chưa tới Trúc Cơ → false, không đổi gì'
// 2. 'chọn Thuần Hỏa: phapTuDao ghi, node thuan_fire mua, insight các
//     hành khác HOÀN ĐỦ (so sánh tổng trước/sau), skill thuy_tien_thuat
//     unequip + khóa, node thuy root level về 0'
// 3. 'chọn Đa Pháp: phapTuDao ghi, node chuỗi 5 nhánh Thuần không mua
//     được (canPurchaseNode false do prereq lap_dao_thuan chưa có)'
// 4. 'đã chốt rồi → false lần 2 (vĩnh viễn)'
// 5. 'refunded insight đủ mua node đầu nhánh đã chọn'
```

- [ ] **Step 2: Chạy verify fail**

Run: `npx.cmd vitest --run src/core/game/GameManager.phapTuDao.test.ts`
Expected: FAIL — choosePhapTuDao chưa tồn tại.

- [ ] **Step 3: Implement**

Player.ts:
```typescript
/** Pháp Tu Đạo Sắc (spec 2026-08-30-phap-tu-dao-sac §9) — đạo đã chốt
 * ở Trúc Cơ, VĨNH VIÊN (không đổi — tiền lệ kiemTuRoute). undefined =
 * chưa chốt (đang Luyện Khí thử). */
export type PhapTuDao =
  | { kind: 'thuan'; element: ElementType }
  | { kind: 'da_phap' }
```
+ field `phapTuDao?: PhapTuDao` trong PlayerData + default undefined trong createDefaultPlayer.

GameManager.ts — hàm mới `choosePhapTuDao`:
1. Gate: `player.cultivationPath === 'phap_tu' && player.realmId === 'foundation_establishment' && !player.phapTuDao`.
2. Mua node con tương ứng qua `purchaseNode` (id map từ choice).
3. Nếu Thuần element X: với mỗi element ≠ X — `devResetBranch(player, nodeRegistry, branchTag hành đó)` (root/power/cadence/mechanic cũ) + refund node chuỗi nếu có; unequip skill root các hành kia + các skill B–E nếu trang bị (SkillSystem.unequip); KHÔNG unlearn (Phàm Nhân save khác vẫn cần — đúng tiền lệ tram).
4. Nếu Đa Pháp: KHÔNG refund gì (root 5 hành là lõi đa pháp), chỉ khóa nhánh Thuần (đã tự khóa qua prereq).
5. Ghi `player.phapTuDao = choice`. Trả true.

SaveSystem.ts — bump `CURRENT_SAVE_VERSION = 55`, comment block theo convention precedent v54 (tham khảo block comment tại SaveSystem.ts:90-132): ghi `phapTuDao` + stat mới + skill mới + node mới.

- [ ] **Step 4: Chạy verify pass**

Run: `npx.cmd vitest --run src/core/game/GameManager.phapTuDao.test.ts`
Expected: PASS 5 cases.

- [ ] **Step 5: Full + commit**

Run: `npm.cmd run type-check && npm.cmd run test`
Expected: PASS (save shape validation test có thể cần cập nhật cho v55).

```bash
git add -A
git commit -m "feat(phap-tu): phapTuDao + insight refund + GameManager.chon dao vinh vien (spec §9)"
```

---

### Task 13: Pháp Lực Thân Hòa — talent + rename MP label

**Files:**
- Modify: `game/src/core/player/CultivationPathKit.ts` (statModifiers phap_tu)
- Modify: `game/src/data/technique/Techniques.ts` (mpLabel 'Pháp Lực' cho 2 tâm pháp Pháp Tu)
- Modify: `game/src/core/game/GameManager.ts` (chooseCultivationPath phap_tu — nâng manaScalingRatio/manaShieldPercent)
- Test: `game/src/core/game/GameManager.phapLucThanHoa.test.ts` (create)

**Interfaces:**
- Produces: Pháp Tu chọn path → baseStats manaShieldPercent 0.25→0.30 (kit statModifiers); mọi skill Pháp Tu manaScalingRatio × 1.5 (áp qua multiplier khi learnSkill qua path — chốt kỹ thuật: field technique `mpLabel: 'Pháp Lực'` + hàm `applyPhapLucThanHoa(skill)` trong SkillSystem hoặc GameManager set `skill.manaScalingRatio *= 1.5` lúc learn qua node Pháp Tu; hướng đơn giản: hàm helper `manaScalingRatioForPhapTu(base)` gọi trong 1 chỗ tổng hợp — quyết định lúc implement theo chỗ manaScalingRatio được đọc; hướng ưu tiên: sửa tại consumer (ElementDamageCalculator/CombatSystem nơi đọc manaScalingRatio) nhân 1.5 khi source là phap_tu — CÀNG TẬP TRUNG 1 ĐIỂM càng tốt).

- [ ] **Step 1: Viết test failing**

```typescript
// game/src/core/game/GameManager.phapLucThanHoa.test.ts — outline:
// 1. 'chọn path phap_tu → manaShieldPercent base 0.30 (kit)', 
// 2. 'skill Pháp Tu damage scale Pháp Lực ×1.5 khi phap_tu (so sánh
//     damage cùng fixture non-phap_tu)', — dùng pipeline
//     CombatSystem.resolveAttack hoặc ElementDamageCalculator trực tiếp
// 3. 'mpLabel technique Pháp Tu = "Pháp Lực" (UI rename)'
```

- [ ] **Step 2: Verify fail** → Run test → FAIL.

- [ ] **Step 3: Implement** theo Interface chốt kỹ thuật ở trên (ưu tiên 1 điểm tổng hợp central; grep `manaScalingRatio` consumers để chọn chỗ — đã thấy ở CombatSystem damage pipeline).

- [ ] **Step 4: Verify pass + full + commit**

Run: `npm.cmd run type-check && npm.cmd run test`

```bash
git add -A
git commit -m "feat(phap-tu): Phap Luc Than Hoa — MP rename + x1.5 scaling + 0.30 shield (spec §3.5)"
```

---

### Task 14: Sinh/Khắc adjacency engine (Luân Chuyển + Chế Khắc)

**Files:**
- Create: `game/src/core/battle/AdjacencySystem.ts`
- Test: `game/src/core/battle/AdjacencySystem.test.ts`

**Interfaces:**
- Consumes: Task 4 `wuxingRelation`/`isSinhCycle`.
- Produces:
  - `interface AdjacencyContext { loadout: readonly { skillId: string; element: ElementType }[]; player: CombatEntity }`
  - `const NURTURE_COOLDOWN_REDUCTION = 0.10` / `const CHE_KHAC_DAMAGE_BONUS = 0.25` / `const CHE_KHAC_REACTION_EFFECT_BONUS = 0.15` / `const LUAN_CHUYEN_CAST_SPEED_PER_STACK = 0.03` / `const LUAN_CHUYEN_MAX_STACKS = 10`
  - `function relationForPair(loadout, slotIndex): WuxingRelation` — quan hệ skill[i] → skill[i+1]
  - `function applyNurture(loadout, slotIndex, skillSystem)` — giảm cd 10% skill trước khi skill sau sinh nó cast xong
  - `function cheKhacDamagePercent(loadout, slotIndex): number` — +25% nếu skill[i+1] khắc kề
  - `function trackLuanChuyen(loadout, castHistory: ElementType[], player): void` — đầy vòng sinh → +1 tầng buff (áp qua BuffSystem id `luan_chuyen` — buff mới max 10 stack, +3% castSpeedPercent/tầng)

- [ ] **Step 1: Viết test failing** — test đủ: nurture giảm cd đúng cặp sinh, +25% dmg đúng cặp khắc, +15% reactionEffect cho cặp khắc, Luân Chuyển +1 tầng khi hoàn tất vòng 5 skill sinh, trần 10, adjacency đúng slot kề (slot 0→1, 1→2... 4→0 wrap theo loadout strip).

- [ ] **Step 2: Verify fail** → Run → FAIL.

- [ ] **Step 3: Implement** — pure functions + 1 buff `luan_chuyen` thêm vào buffs.ts (pattern khai_son). Chế Khắc áp damage qua StatModifier tạm trong lúc cast (hoặc skillModifier runtime — theo pattern stat existing `elementDamagePercent`-style; chốt: tính `% bonus` trả về, consumer là BattleSystem castSkill nhân vào damage payload).

- [ ] **Step 4: Verify pass** → Run → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): adjacency Sinh/Khac engine — Luan Chuyen + Che Khac (spec §3.2-3.4)"
```

---

### Task 15: Wire adjacency + chain + ult vào battle flow (GameManager glue)

**Files:**
- Modify: `game/src/core/game/GameManager.ts` (start battle: setChainDefinition + phapTuDao glue)
- Modify: `game/src/core/battle/BattleSystem.ts` (consumer cheKhacDamagePercent + nurture + luan_chuyen tracking)
- Test: `game/src/core/game/GameManager.phapTuDao.integration.test.ts` (create)

**Interfaces:**
- Consumes: Tasks 8/10/12/14.
- Produces: integration test end-to-end: player Thuần Hỏa chốt đạo → battle → chuỗi gate + Thế + ult; player Đa Pháp → adjacency active, chain KHÔNG active.

- [ ] **Step 1: Viết integration test failing** (fixture theo `cultivationRitualFlow.integration.test.ts` pattern):
1. Thuần Hỏa: advance lên Trúc Cơ qua breakthrough, choosePhapTuDao thuan fire, start battle → assert setChainDefinition fire; cast A rồi B cast được, C không; kill enemy → reset; Thế đầy → autoPhapTuUltimateDecision trả 'fire' khi boss.
2. Đa Pháp: choosePhapTuDao da_phap → chain undefined; loadout 2 skill khắc kề → cast skill sau +25% damage (assert qua damage số trước/sau).

- [ ] **Step 2: Verify fail** → Run → FAIL.

- [ ] **Step 3: Implement glue** — GameManager.startBattle (hoặc chỗ battle được tạo — grep `new BattleSystem`): đọc `player.phapTuDao`; kind thuan → `battleSystem.setChainDefinition({ skillIds: CHAIN_SKILL_IDS[element] })`; BattleSystem castSkill gọi cheKhac/nurture/luan_chuyen theo Đa Pháp; auto-ult tick gọi autoPhapTuUltimateDecision + execute ult skill qua path resolve hiện có (pattern TTKT — grep `autoUltimateDecision` call site).

- [ ] **Step 4: Verify pass + full + commit**

Run: `npm.cmd run type-check && npm.cmd run test`

```bash
git add -A
git commit -m "feat(phap-tu): glue dao sac vao battle flow — integration Thuần/Đa Pháp (spec §7)"
```

---

### Task 16: UI — SkillPathPanel ngôi sao 5 cánh + chốt đạo + bar Pháp Lực/Thế + nút ult

**Files:**
- Modify: `game/src/components/game/skill/SkillPathPanel.vue` (hoặc file panel node tree Pháp Tu — grep `SkillPathPanel` xác định)
- Modify: `game/src/components/game/combat/CombatStatusBar.vue` (bar 3 Thế + rename Pháp Lực)
- Modify: `game/src/components/game/combat/CombatControlBar.vue` (nút ult Pháp Tu — pattern nút TTKT)
- Modify: `game/src/composables/useCombatSkillPresentation.ts` (nếu cần expose Thế/ult)
- Test: test component hiện có pattern (nếu panel có test) + type-check là gate chính (UI task nhẹ test theo pattern repo — tối thiểu data composable test)

**Interfaces:**
- Consumes: Tasks 10-15 (PHAP_TU_ULTIMATE_IDS, phapTuDao, currentThe, node data).
- Produces: UI hoàn chỉnh theo spec §8 — mô tả visual: sao 5 cánh bố trí node (đỉnh Đông Mộc trên, đi chiều kim đồng hồ Nam Hỏa, Tây Kim, Bắc Thủy; Thổ tâm), chốt đạo modal confirm vĩnh viễn, bar 2 label Pháp Lực, bar 3 Thế + nút ult manual/auto toggle.

- [ ] **Step 1: Đọc file UI hiện tại** (SkillPathPanel + CombatStatusBar + CombatControlBar + các composable liên quan) — xác định đúng cấu trúc slot/props trước khi sửa.

- [ ] **Step 2: Implement UI theo spec §8** — increment theo từng panel: (a) SkillPathPanel ngôi sao layout + node hiển thị theo branchTag mới + modal chốt đạo khi mua node lap_dao con (confirm 1 lần vĩnh viễn — pattern confirm đã có ở setArtifactPath panel); (b) CombatStatusBar bar 3 currentThe cho phap_tu thuan + badge Luân Chuyển cho da_phap + mpLabel Pháp Lực; (c) CombatControlBar nút ult (hiện khi phapTuDao thuan + node ult mua).

- [ ] **Step 3: Verify** — Run: `npm.cmd run type-check && npm.cmd run test && npm.cmd run build` (build bắt UI template error). Manual smoke: `npm.cmd run dev` mở game kiểm tra từng màn (nếu executor có môi trường).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(phap-tu): UI dao sac — ngoi sao 5 canh + chot dao + bar The/Phap Luc + nut ult (spec §8)"
```

---

### Task 17: Docs sync + roadmap update

**Files:**
- Modify: `game/docs/game-guide.md` (section Pháp Tu — ghi lại chuỗi/đạo/Thế/sinh-khắc/reaction 10 cặp)
- Modify: `game/docs/roadmap.md` (thêm dòng kết quả thực thi 2026-08-30 Pháp Tu Đạo Sắc)
- Modify: `game/docs/roadmap.md` liên quan + `game/docs/item-design-reference.md` nếu nhắc Phong/Lôi/reaction Lôi Viêm

**Interfaces:** none — task thuần docs.

- [ ] **Step 1: Grep docs nhắc Phong/Lôi/Lôi Viêm/te_dien** — liệt kê mọi chỗ cần sửa.

- [ ] **Step 2: Update docs** — game-guide section Pháp Tu viết theo spec mới; roadmap thêm 1 dòng kết quả; item-design-reference dọn reference stat Phong/Lôi.

- [ ] **Step 3: Verify + commit**

Run: `npm.cmd run test` (đảm bảo không test nào đọc docs)

```bash
git add -A
git commit -m "docs: sync phap-tu dao sac + roadmap 2026-08-30"
```

---

## Self-Review Checklist (đã chạy khi viết plan)

1. **Spec coverage:** §0 bảng 11 chốt → Task 12 (chốt vĩnh viễn + refund), §1.2 → 11, §2 → 6/7/8/9/10, §3 → 4/13/14/15, §4 → 3, §5 → 1/2, §6 → 5, §7 → 7/8/15, §8 → 16, §9 → 12, §10 → mọi task test, §11 chờ sau — OK.
2. **Placeholder scan:** các outline test (Task 8/12/13 body) có hướng dẫn fixture cụ thể (file mẫu để copy) — chấp nhận được vì pattern repo yêu cầu đọc fixture hiện có; KHÔNG có "TBD/implement later" trần trụi.
3. **Type consistency:** `CHAIN_SKILL_IDS` (Task 9→10/11), `PHAP_TU_ULTIMATE_IDS` (10→11/16), `PhapTuDao` (12→15/16), `wuxingRelation` (4→14), chain helpers (7→8/15), The helpers (6→10/15) — tên khớp xuyên suốt.
