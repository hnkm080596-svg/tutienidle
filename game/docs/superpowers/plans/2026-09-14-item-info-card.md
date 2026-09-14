# Unified Item Info Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One item-info contract — seal-stamped cells, single-color names, a hybrid dark-ink tooltip card with a static SlotView header, paired compare cards — applied to every surface that renders an item.

**Architecture:** `SlotView` owns the cell signal set (seal replaces Phẩm underlay, `static` presentation mode, container-query crowding rule). `useTooltip` payloads carry a `slotPreview` props-bag + `nameColorVar`/`nameTone`/`ownedCount`/`compareWith` instead of per-segment colors and `advancedSections`. A new `ItemCardBody.vue` owns the card skeleton; `Tooltip.vue` renders it once or as a compare pair. Builders stay the data owners; renderers stay dumb.

**Tech Stack:** Vue 3 `<script setup>` + TypeScript, Vitest, CSS container queries (`container-type: inline-size`, `cqw`), floating-ui (existing).

**Spec:** `docs/superpowers/specs/2026-09-14-item-info-card-design.md`

## Global Constraints

- P15: comments English ASCII only; Vietnamese only in i18n/data strings.
- P16: new UI strings via `useI18n()` + vi/en locale pairs (`src/locales/{vi,en}.json`).
- No `any`. No new dependencies. No gameplay/stat/save changes.
- Seal ordinals live in `ProfessionGrade.ts` (Phẩm ordering owner); name composition stays owned by `EquipmentNaming.ts`/`ItemGrade.ts`; delta math stays owned by `useEquipmentTooltip.ts` internals.
- Per-task verification (P3 quick): `npm run type-check` + `npx vitest run <scope>` from `game/`.
- Only `kind: 'material'` and `kind: 'pill'` have real builders today — talisman/formation kinds stay in the union but have no emitters to migrate.

---

### Task 1: Seal stamp + static mode in SlotView

**Files:**
- Modify: `src/core/profession/ProfessionGrade.ts` (after `PROFESSION_GRADE_NAMES`, ~line 64)
- Modify: `src/components/common/SlotView.vue`
- Test: `src/components/common/SlotView.test.ts` (rewrite the `rank 1-10` describe), `src/core/profession/ProfessionGrade.test.ts` (create if missing — check `ls src/core/profession/*.test.ts` first)

**Interfaces:**
- Produces:
  - `PROFESSION_GRADE_SEAL_ORDINALS: readonly string[]` — index `rank-1`, values `CỬU BÁT THẤT LỤC NGŨ TỨ TAM NHỊ NHẤT TIÊN`.
  - SlotView prop `static?: boolean` — presentation-only render (Task 5's tooltip header consumes it).
  - CSS hooks `.slot-view__seal`, `--seal-rim`, `.slot-view--static`, `@container (max-width: 47px)` crowding rule.
- Consumes: nothing from later tasks.

- [ ] **Step 1: Failing tests — seal map + seal render + static mode**

In `ProfessionGrade.test.ts` (new or existing file):

```ts
it('seal ordinals match PROFESSION_GRADE_NAMES order (Pham suffix stripped, uppercased)', () => {
  PROFESSION_GRADE_ORDER.forEach((grade, index) => {
    const expected = PROFESSION_GRADE_NAMES[grade].replace(' Phẩm', '').toUpperCase()
    expect(PROFESSION_GRADE_SEAL_ORDINALS[index]).toBe(expected)
  })
})
```

In `SlotView.test.ts` — replace the underlay assertions (`slot-view__grade-underlay`, `--slot-grade-color`) with:

```ts
it('Pham renders as a corner seal with the Vietnamese grade ordinal', () => {
  const wrapper = mount(SlotView, { props: { item: {}, label: 'Kiếm', equipmentQualityRank: 5 } })
  const seal = wrapper.find('.slot-view__seal')
  expect(seal.exists()).toBe(true)
  expect(seal.text()).toBe('NGŨ')
  expect(seal.attributes('aria-hidden')).toBe('true')
})

it('seal rim follows --rank-color-N of the Pham rank', () => {
  const wrapper = mount(SlotView, { props: { item: {}, label: 'Kiếm', equipmentQualityRank: 10 } })
  expect(wrapper.find('.slot-view__seal').text()).toBe('TIÊN')
  expect(wrapper.attributes('style')).toContain('--seal-rim: var(--rank-color-10)')
})

it('material scale-10 rank feeds the seal through rarityRank', () => {
  const wrapper = mount(SlotView, { props: { item: {}, label: 'Thảo', rarityRank: 3, rarityRankScale: 10 } })
  expect(wrapper.find('.slot-view__seal').text()).toBe('THẤT')
})

it('no rank anywhere => no seal; empty slot never seals', () => {
  expect(mount(SlotView, { props: { item: {}, label: 'X' } }).find('.slot-view__seal').exists()).toBe(false)
  expect(mount(SlotView, { props: { item: null, equipmentQualityRank: 5 } }).find('.slot-view__seal').exists()).toBe(false)
})

it('static mode: renders span role=img, no button, no tooltip emission, no click', () => {
  const wrapper = mount(SlotView, { props: { item: {}, label: 'Kiếm', static: true, tooltip: { title: 'x' } } })
  expect(wrapper.element.tagName).toBe('SPAN')
  expect(wrapper.attributes('role')).toBe('img')
  expect(wrapper.attributes('aria-label')).toBe('Kiếm')
  expect(useTooltip().content.value).toBeNull()
})
```

- [ ] **Step 2: Run tests — confirm FAIL**

Run: `npx vitest run src/components/common/SlotView.test.ts src/core/profession/`
Expected: FAIL (`.slot-view__seal` missing, `PROFESSION_GRADE_SEAL_ORDINALS` missing, `static` prop unknown).

- [ ] **Step 3: Implement**

`ProfessionGrade.ts`, after `PROFESSION_GRADE_NAMES`:

```ts
// Seal ordinals for the cell stamp (item-info-card spec 2026-09-14):
// the Vietnamese grade word only, "Pham" elided as the shared suffix.
// Index order matches PROFESSION_GRADE_ORDER — seal rank = index + 1.
export const PROFESSION_GRADE_SEAL_ORDINALS = [
  'CỬU', 'BÁT', 'THẤT', 'LỤC', 'NGŨ', 'TỨ', 'TAM', 'NHỊ', 'NHẤT', 'TIÊN',
] as const
```

`SlotView.vue` — props block, add:

```ts
  /** Presentation-only render (tooltip card header): root becomes a
   * span role=img, tooltip/click/hover suppressed. */
  static?: boolean
```

Replace `gradeUnderlayColor` computed with:

```ts
// Seal stamp (item-info-card spec 2026-09-14): the Pham axis renders as
// a corner seal carrying the Vietnamese grade ordinal — replaces the
// underlay wash. Same rank source as before: equipmentQualityRank
// (equipment/pills), or rarityRank when fed on the 10-step scale
// (materials). Chat stays on the rarity edge + aura.
const sealRank = computed(() => {
  const gradeRank = clampRank(props.equipmentQualityRank)
  if (gradeRank) return gradeRank
  if ((props.rarityRankScale ?? 5) === 10) return clampRank(props.rarityRank)
  return undefined
})
const sealOrdinal = computed(() => (sealRank.value ? PROFESSION_GRADE_SEAL_ORDINALS[sealRank.value - 1] : undefined))
const sealColor = computed(() => (sealRank.value ? `var(--rank-color-${sealRank.value})` : undefined))
```

Add import: `import { PROFESSION_GRADE_SEAL_ORDINALS } from '@/core/profession/ProfessionGrade'`

Template — root `<button>` becomes dynamic component:

```vue
<component
  :is="props.static ? 'span' : 'button'"
  :type="props.static ? undefined : 'button'"
  class="slot-view"
  :class="[ ...existing classes..., props.static ? 'slot-view--static' : '' ]"
  :style="{ '--seal-rim': sealColor, '--slot-rarity-color': rarityColor, '--fx-beam-color': qualityAuraTier > 0 ? rarityColor : undefined }"
  :role="props.static ? 'img' : undefined"
  :aria-disabled="props.static ? undefined : isBlocked ? 'true' : undefined"
  :aria-busy="props.static ? undefined : showProcessing ? 'true' : undefined"
  :aria-label="accessibleLabel ?? label"
  v-tooltip="props.static ? undefined : tooltipContent"
  @click="handleClick"
>
```

(`--slot-grade-color` removed from `:style`; `handleClick` gains `if (props.static) return` as first line.)

Replace the underlay element:

```vue
<!-- layer 1.5: Pham seal — crimson corner stamp, Vietnamese grade
     ordinal (replaces the underlay wash). -->
<span v-if="filled && sealOrdinal" class="slot-view__seal" aria-hidden="true">{{ sealOrdinal }}</span>
```

CSS — delete the `.slot-view__grade-underlay` block; add:

```css
/* container-type so the seal + crowding rule scale with the CELL edge
   (cqw), not the viewport. inline-size only — height stays free for
   aspect-ratio. */
.slot-view { container-type: inline-size; }

.slot-view__seal {
  position: absolute;
  top: 3%;
  left: 3%;
  z-index: 5;
  box-sizing: border-box;
  width: 36cqw;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: 1cqw;
  background: color-mix(in srgb, #7d2a24 88%, transparent);
  border: 1px solid var(--seal-rim, var(--rank-color-2));
  border-radius: 1px;
  color: #efe6d2;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 13cqw;
  line-height: 1;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

/* Crowding rule (spec §1): under ~48px cells the glance signals that
   duplicate the compare card pair disappear first. Seal + amount are
   the cell minimum — never hidden. */
@container (max-width: 47px) {
  .slot-view__comparison,
  .slot-view__marker {
    display: none;
  }
}

.slot-view--static {
  cursor: default;
}
.slot-view--static .slot-view__hover-frame,
.slot-view--static .fx-border-beam__fx {
  display: none;
}
.slot-view--static .slot-view__item-icon,
.slot-view--static .slot-view__monogram {
  transform: none;
}
```

- [ ] **Step 4: Verify**

Run: `npm run type-check && npx vitest run src/components/common/SlotView.test.ts src/core/profession/`
Expected: PASS. Fix any leftover references to `gradeUnderlayColor` / `.slot-view__grade-underlay`.

- [ ] **Step 5: Commit**

```bash
git add src/core/profession/ProfessionGrade.ts src/core/profession/ProfessionGrade.test.ts src/components/common/SlotView.vue src/components/common/SlotView.test.ts
git commit -m "feat(slot): Pham seal stamp + static presentation mode"
```

---

### Task 2: NameSegment loses color — structure only

**Files:**
- Modify: `src/core/item/NameSegment.ts`
- Modify: `src/core/equipment/EquipmentNaming.ts` (lines 24-36 — drop `colorVar`/`tone` from both segments, update header comment)
- Modify: `src/core/item/ItemGrade.ts` (`composeItemGradeNameSegments` — drop colors AND the now-unused `phamRank` param)
- Modify: `src/components/common/SlotView.vue` (caption render, ~line 269)
- Modify: `src/components/common/Tooltip.vue` (graded + equipment title segment loops → `{{ content.name }}` plain; remove `tooltip__title-segment--max-rank` usage there — ItemCardBody in Task 5 re-adds single-color titles)
- Modify: `src/components/common/ToastContainer.vue` (segment loop → plain text join — Task 7 re-adds the colored-name pattern)
- Modify: `src/components/panels/bag-sections/MaterialBagSection.vue` (`materialNameSegments` + `familyCell` badge segment — drop `colorVar`; `trailing` param type `{ text: string }`)
- Modify: `src/components/panels/bag-sections/EquipmentBagSection.vue:82` (`[{ text: instance.itemId }]` already fine), `src/components/panels/equipment-hall/useEquippedRows.ts:85` (same), `src/core/game/BattleLootSystem.ts:540` (drop `phamRank` arg), `:517,576,594,670` (`[{text}]` literals already fine)

**Interfaces:**
- Produces: `interface NameSegment { text: string }` — the ONLY shape, everywhere.
- Consumes: Task 1 nothing; later tasks rely on `name`/`nameColorVar` payloads added in Task 3 — this task intentionally leaves titles plain (compiled + tested intermediate state).

- [ ] **Step 1: Update the type + compose functions**

`NameSegment.ts`:

```ts
// Composed item name segments (item-info-card spec 2026-09-14): text
// structure ONLY — the single display color now lives on the tooltip /
// toast payload (nameColorVar/nameTone), not per segment. Used by
// SlotView's nameSegments prop (aria + opt-in caption), EquipmentNaming
// and ItemGrade compose functions.
export interface NameSegment {
  text: string
}
```

`EquipmentNaming.ts` — header comment rewritten (English): "Composed name '{Chat} - {Name}'. Structure owner only — display color is the payload's nameColorVar (spec 2026-09-14)." Return value drops `colorVar`/`tone`.

`ItemGrade.ts` — `composeItemGradeNameSegments(name: string, grade: ItemGrade): NameSegment[]` returns `[{ text: ITEM_GRADE_SHORT_LABELS[grade] }, { text: `- ${name}` }]`. Remove `phamRank` param.

- [ ] **Step 2: Fix render sites**

`SlotView.vue` caption (~line 266-271):

```vue
<span v-if="nameSegments && nameSegments.length > 0" class="slot-view__caption">
  <template v-for="(segment, index) in nameSegments" :key="index">
    <span v-if="index > 0" class="slot-view__caption-dot"> · </span>
    <span>{{ segment.text }}</span>
  </template>
</span>
```

Remove `.slot-view__caption [data-name-tone='tien']` CSS block.

`Tooltip.vue` — in the graded header (lines ~202-211) and equipment header (~236-244), replace the `nameSegments` loops:

```vue
<p class="tooltip__title">{{ gradedContent.name }}</p>
<!-- equipment branch: -->
<p class="tooltip__title">{{ content.name }}</p>
```

Remove `isMaxRankTone` import if now unused (it still feeds `isMaxQualityRank`/`isMaxPhamRank` — keep if referenced). `gradedTitleColor` computed + `tooltip__title-segment--max-rank` CSS may go — Task 5 redesigns these lines anyway; keep the file compiling.

`ToastContainer.vue` — loot name renders `{{ toast.loot.nameSegments.map(s => s.text).join(' ') }}` plainly for now (Task 7 replaces the payload with `name`/`nameColorVar`/`gradeLabel`); `lastNameText` keeps working (`{text}` still exists); remove `isMaxRankTone` import + `toast-item__segment--max-rank` CSS.

`MaterialBagSection.vue`:

```ts
function materialNameSegments(material: Material, trailing?: { text: string }) {
  const segments = [{ text: material.name }]
  return trailing ? [...segments, trailing] : segments
}
```

`familyCell`: `nameSegments: [{ text: baseLabel }, ...(badge ? [{ text: badge }] : [])]`.

`PillBagSection.vue` — `composeItemGradeNameSegments(...)` call at ~126/239 drops the third arg if present (check both sites; signature now 2 args).

`BattleLootSystem.ts:540` — drop the `phamRank` argument from the `composeItemGradeNameSegments` call.

- [ ] **Step 3: Verify**

Run: `npm run type-check && npx vitest run src/core/ src/components/common/ src/components/panels/`
Expected: PASS after updating tests that assert `colorVar`/`tone` on segments (grep `colorVar` in `src/**/*.test.ts` under `src/core/` + `src/components/`; `EquipmentNaming`/`ItemGrade`/material tests likely assert them).

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor(naming): NameSegment carries text only — color moves to payload"
```

---

### Task 3: Tooltip payload types — slotPreview, single-color name, ownedCount, compareWith, range/delta fields

**Files:**
- Modify: `src/components/common/SlotTypes.ts` (append `SlotPreviewProps`)
- Modify: `src/composables/useTooltip.ts`
- Modify: `src/core/notification/NotificationEvent.ts`
- Test: `src/composables/useTooltip.test.ts` (update payload-shape assertions)

**Interfaces:**
- Produces (consumed by Tasks 4-7):

```ts
// SlotTypes.ts — props snapshot a tooltip card's static SlotView header
// binds verbatim (item-info-card spec §3).
export interface SlotPreviewProps {
  icon?: string
  label?: string
  accessibleLabel?: string
  amount?: number
  equipmentQualityRank?: number
  rarityRank?: number
  rarityRankScale?: 5 | 10
  badges?: readonly SlotBadge[]
  state?: SlotPresentationState
  variant?: SlotVariant
}
```

```ts
// useTooltip.ts
export interface TooltipStatRow {
  label: string
  value: string
  detail?: string
  range?: string        // "[min–max]" rendered muted, inline after value
  delta?: string        // "▲ +2" compare marker after range
  deltaTone?: 'positive' | 'negative' | 'muted'
  tone?: 'default' | 'muted' | 'positive' | 'negative' | 'warning' | 'special'
  tier?: number
  colorVar?: string
}

export interface GradedItemTooltipContent {
  kind: 'material' | 'pill' | 'talisman' | 'formation'
  name: string             // FULL display name (composed "Chat - Name" where applicable)
  nameColorVar?: string    // single title color (spec §2)
  nameTone?: string        // 'tien' => rainbow title
  slotPreview?: SlotPreviewProps
  imagePath?: string       // fallback only
  gradeLabel?: string      // meta badge (kept)
  gradeKey?: string        // aura key (kept)
  gradeRank?: number       // aura + seal source for materials (kept)
  gradeLine?: string       // muted meta line (colorVar dropped)
  ownedCount?: number      // "So huu: N" renders ONLY when > 0
  description?: string
  sections: TooltipSection[]
}

export interface EquipmentTooltipContent {
  kind: 'equipment'
  name: string
  nameColorVar?: string
  nameTone?: string
  slotPreview?: SlotPreviewProps
  imagePath?: string
  slotLabel: string
  qualityKey: string
  gradeLine?: string
  description?: string
  sections: TooltipSection[]
  compareWith?: Omit<EquipmentTooltipContent, 'compareWith'>
}
```

Removed: `nameSegments` (both payloads), `gradeLineColorVar`, `ownedLabel`, `advancedSections`, `nameSegments` in equipment.

```ts
// NotificationEvent.ts — LootNotificationPresentation
export interface LootNotificationPresentation {
  icon?: string
  name: string            // composed display name, single color (spec §2)
  nameColorVar?: string
  nameTone?: string       // 'tien' => rainbow
  gradeLabel?: string     // muted "· Ngu Pham" suffix
  amountLabel?: string
  accentColorVar?: string
}
```

- [ ] **Step 1: Apply type edits** — `useTooltip.ts` imports `SlotPreviewProps` from `@/components/common/SlotTypes` (type-only, presentation-internal dependency).

- [ ] **Step 2: Verify — expect compile errors listing every emitter to fix**

Run: `npm run type-check`
Expected: FAILURES at emitters/renderers (`useEquipmentTooltip.ts`, bag sections, `Tooltip.vue`, `BattleLootSystem.ts`, `ToastContainer.vue`, hall tabs, tests). This error list IS the Task 4-7 work queue — capture it in the task notes (paste `tsc` output into the plan or a scratch file).

Do NOT fix emitters here — the type change is the contract; Tasks 4-7 implement it. This task ends RED-COMPILE by design; mark it as the plan's only non-green gate and proceed immediately to Task 4.

- [ ] **Step 3: Commit** (type-only change, compile expected broken until Task 4 — if the executing flow requires green commits, fold this task into Task 4's working set instead)

```bash
git commit -am "feat(tooltip): payload contract — slotPreview/nameColorVar/ownedCount/compareWith"
```

---

### Task 4: Builders emit the new contract

**Files:**
- Modify: `src/composables/useEquipmentTooltip.ts`
- Modify: `src/components/panels/bag-sections/MaterialBagSection.vue` (`buildTooltip` + `familyCell`/`entries` cells)
- Modify: `src/components/panels/bag-sections/PillBagSection.vue` (`buildTooltip` + cells)
- Modify: `src/components/panels/bag-sections/BagCell.ts` (add `accessibleLabel?: string`)
- Test: `src/composables/useEquipmentTooltip.test.ts` (rewrite)

**Interfaces:**
- Produces:

```ts
export interface EquipmentCompareContext {
  instance: EquipmentInstance
  template: Equipment
  slotState: EquipmentSlotState | null
  mainStatRangeQuote?: { min: number; max: number }
}
```

`buildEquipmentTooltip(instance, template, affixRegistry, slotState, zoneRegistry, compare?: EquipmentCompareContext, mainStatRangeQuote?)` — the `comparedInstance` param becomes `compare` (drives BOTH the delta rows AND `compareWith`).

- [ ] **Step 1: Failing tests** (`useEquipmentTooltip.test.ts`)

```ts
it('ranges render inline in sections — advancedSections is gone', () => {
  const content = buildEquipmentTooltip(instance, template, affixRegistry, null, zoneRegistry)
  const mainRow = content.sections[0].rows[0]
  expect(mainRow.range).toMatch(/^\[.+\u2013.+\]$/)
  expect('advancedSections' in content).toBe(false)
})

it('compare context emits compareWith (equipped card) + delta fields on rows', () => {
  const content = buildEquipmentTooltip(candidate, candidateTpl, affixRegistry, null, zoneRegistry, {
    instance: equipped, template: equippedTpl, slotState: null,
  })
  expect(content.compareWith?.name).toBe(composeEquipmentDisplayName(equipped, equippedTpl, zoneRegistry))
  expect(content.compareWith && 'compareWith' in content.compareWith).toBe(false)
  const deltaRow = content.sections.flatMap(s => s.rows).find(r => r.delta)
  expect(deltaRow?.delta).toMatch(/[▲▼]/)
  expect(deltaRow?.deltaTone).toMatch(/positive|negative/)
})

it('title payload: nameColorVar = --rank-color-(2*qualityRank-1), tien => rainbow tone', () => {
  const content = buildEquipmentTooltip(tienInstance, template, affixRegistry, null, zoneRegistry)
  expect(content.nameColorVar).toBe('--rank-color-9')
  expect(content.nameTone).toBe('tien')
})

it('slotPreview carries the cell signal set (seal rank + chat edge + aria with grade)', () => {
  const content = buildEquipmentTooltip(instance, template, affixRegistry, null, zoneRegistry)
  expect(content.slotPreview?.equipmentQualityRank).toBe(professionGradeRank(instance.grade))
  expect(content.slotPreview?.rarityRank).toBe(itemQualityRank(instance.quality))
  expect(content.slotPreview?.accessibleLabel).toContain(gradeLabel(instance.grade))
})
```

- [ ] **Step 2: Implement `useEquipmentTooltip.ts`**

Merge advanced rows into `sections` (kill `advancedSections` + the duplicated section scaffolding):

```ts
const sections: TooltipSection[] = [
  {
    label: 'Chỉ Số Chính',
    rows: [{
      label: statLabel(instance.mainStat.stat),
      value: `+${mainStatValue}`,
      range: effectiveMainRange,                    // existing computed "[min–max]" string
      ...deltaFields(instance.mainStat.stat),       // { delta, deltaTone } when compare present
    }],
  },
]
```

Replace `appendDelta` with:

```ts
function deltaFields(stat: string): { delta?: string; deltaTone?: 'positive' | 'negative' | 'muted' } {
  const delta = deltaByStat.get(stat)
  if (delta === undefined) return {}
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '•'
  return {
    delta: `${arrow} ${delta >= 0 ? '+' : ''}${formatStat(stat as EquipmentInstance['mainStat']['stat'], delta)}`,
    deltaTone: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'muted',
  }
}
```

(`stat` typing: the existing `deltaByStat` is `Map<string, number>` — the `as EquipmentInstance['mainStat']['stat']` cast keeps types honest without `any`, matching how the current code types `statLabel(typedStat)` on the missing-stats path.)

Affix rows gain `range: tier ? \`[${formatStat(affix.stat, tier.min)}–${formatStat(affix.stat, tier.max)}]\` : undefined` + `...deltaFields(affix.stat)`; keep `tier` + `tone: 'special'` for supreme. Missing-stat rows (equipped-only stats) keep `tone: 'muted'` + negative delta — they now live in the SAME affix section (no separate advanced list).

Return object — add/drop per Task 3 contract:

```ts
const displayName = composeEquipmentDisplayName(instance, template, zoneRegistry)
return {
  kind: 'equipment',
  name: displayName,
  nameColorVar: `--rank-color-${itemQualityRank(instance.quality) * 2 - 1}`,
  nameTone: instance.quality === 'tien' ? 'tien' : undefined,
  slotPreview: {
    icon: instance.icon ?? template.icon,
    label: displayName,
    accessibleLabel: `${displayName}, ${gradeLabel(instance.grade)}`,
    equipmentQualityRank: professionGradeRank(instance.grade),
    rarityRank: itemQualityRank(instance.quality),
  },
  imagePath: instance.icon ?? template.icon,
  slotLabel: EQUIPMENT_SLOT_LABELS[instance.slot],
  qualityKey: instance.quality,
  gradeLine: `Cảnh giới: ${gradeLabel(instance.grade)} (${realmLabel(instanceRealmId)})`,
  description: template.description,
  sections,
  compareWith:
    compare && compare.instance.instanceId !== instance.instanceId
      ? buildEquipmentTooltip(compare.instance, compare.template, affixRegistry, compare.slotState, zoneRegistry, undefined, compare.mainStatRangeQuote)
      : undefined,
}
```

Signature change ripples to callers — they now pass `compare` objects (Task 6).

- [ ] **Step 3: Material + Pill builders**

`MaterialBagSection.buildTooltip` — return adds:

```ts
name: material.name,
nameColorVar: rank !== undefined ? `--rank-color-${rank}` : undefined,
slotPreview: {
  icon: material.icon,
  label: material.name,
  accessibleLabel: realmText ? `${material.name}, ${realmText}` : material.name,
  rarityRank: rank,
  rarityRankScale: 10,
},
gradeRank: rank,
ownedCount: owned > 0 ? owned : undefined,   // spec: never renders "So huu: 0"
```

Drop `ownedLabel`, `nameSegments` from the tooltip payload (cell `nameSegments` stays — SlotView prop unchanged).

Cells: `BagCell` gains `accessibleLabel?: string`; emit `accessibleLabel` on material cells (`${name}, ${realmText}`) — wire `:accessible-label="cell?.accessibleLabel"` in the template alongside the other cell props.

`PillBagSection.buildTooltip` — same shape; pill name becomes the composed display name:

```ts
const displayName = composeItemGradeNameSegments(pill.name, pill.grade).map(s => s.text).join(' ')
const phamRank = pill.professionGrade !== undefined ? professionGradeRank(pill.professionGrade) : undefined
// name: displayName,
// nameColorVar: phamRank !== undefined ? `--rank-color-${phamRank}` : `--grade-${pill.grade}`,
// nameTone: pill.grade === 'tien' ? 'tien' : undefined,
// slotPreview: { icon: pill.icon, label: displayName, accessibleLabel: `${displayName}, ${gradeLabel(pill.professionGrade)}`,
//   equipmentQualityRank: phamRank, rarityRank: ITEM_GRADE_ORDER.indexOf(pill.grade) + 1 },
// ownedCount: owned > 0 ? owned : undefined,
```

(Check pill.professionGrade nullability against `Pill.ts` — if optional, gate `gradeLabel`/`accessibleLabel` on it.)

- [ ] **Step 4: Verify**

Run: `npm run type-check && npx vitest run src/composables/useEquipmentTooltip.test.ts src/components/panels/bag-sections/`
Expected: emitters compile except `Tooltip.vue`/`ToastContainer.vue`/hall-tab callers (Tasks 5-7). If blocking, stub-fix renderers minimally and finish them in their tasks.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(tooltip): builders emit slotPreview/nameColorVar/ownedCount/compareWith"
```

---

### Task 5: ItemCardBody + Tooltip pair rendering

**Files:**
- Create: `src/components/common/ItemCardBody.vue`
- Modify: `src/components/common/Tooltip.vue`
- Modify: `src/locales/vi.json`, `src/locales/en.json` (compare labels)
- Test: `src/components/common/ItemCardBody.test.ts` (new), `src/composables/useTooltip.test.ts` updates

**Interfaces:**
- Consumes: `slotPreview`, `nameColorVar`/`nameTone`, `ownedCount`, `compareWith`, `range`/`delta`/`deltaTone` (Tasks 3-4).
- Produces: `ItemCardBody` props `{ content: EquipmentTooltipContent | GradedItemTooltipContent; eyebrow?: string }`.

- [ ] **Step 1: Failing tests** (`ItemCardBody.test.ts`)

```ts
it('renders static SlotView header bound from slotPreview', () => {
  const wrapper = mount(ItemCardBody, { props: { content: equipmentContent } })
  const slot = wrapper.findComponent(SlotView)
  expect(slot.exists()).toBe(true)
  expect(slot.props('static')).toBe(true)
  expect(slot.props('equipmentQualityRank')).toBe(equipmentContent.slotPreview?.equipmentQualityRank)
})

it('title is a single color — no per-segment spans', () => {
  const wrapper = mount(ItemCardBody, { props: { content: equipmentContent } })
  const title = wrapper.find('.item-card__title')
  expect(title.attributes('style')).toContain(`color: var(${equipmentContent.nameColorVar})`)
  expect(title.element.children.length).toBe(0)
})

it('tien nameTone gets the rainbow class instead of a color', () => {
  const wrapper = mount(ItemCardBody, { props: { content: { ...equipmentContent, nameTone: 'tien' } } })
  expect(wrapper.find('.item-card__title--max-rank').exists()).toBe(true)
})

it('range + delta render inline muted/colored; tier chip T{n} shows', () => {
  const wrapper = mount(ItemCardBody, { props: { content: withAffixes } })
  expect(wrapper.find('.item-card__range').text()).toContain('–')
  expect(wrapper.find('.item-card__tier').text()).toBe('T3')
  expect(wrapper.find('.item-card__delta--positive').exists()).toBe(true)
})

it('ownedCount > 0 renders So huu badge; 0/undefined renders nothing', () => {
  expect(mount(ItemCardBody, { props: { content: { ...gradedContent, ownedCount: 4 } } }).text()).toContain('Sở hữu: 4')
  expect(mount(ItemCardBody, { props: { content: { ...gradedContent, ownedCount: 0 } } }).text()).not.toContain('Sở hữu')
})
```

- [ ] **Step 2: `ItemCardBody.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SlotView from './SlotView.vue'
import { isMaxRankTone } from '@/core/profession/slotRank'
import type { EquipmentTooltipContent, GradedItemTooltipContent } from '@/composables/useTooltip'

// Item card body (item-info-card spec §3) — ONE skeleton for equipment
// and graded kinds (material/pill/talisman/formation). Header binds the
// source cell's SlotView props verbatim in static mode so the card
// preview IS the slot (seal + Chat edge included).
const props = defineProps<{
  content: EquipmentTooltipContent | GradedItemTooltipContent
  eyebrow?: string
}>()

const { t } = useI18n()

const isEquipment = computed(() => props.content.kind === 'equipment')
const rainbowTitle = computed(() => isMaxRankTone(props.content.nameTone))
const titleStyle = computed(() =>
  !rainbowTitle.value && props.content.nameColorVar ? { color: `var(${props.content.nameColorVar})` } : undefined,
)
const ownedLabel = computed(() =>
  props.content.kind !== 'equipment' && (props.content.ownedCount ?? 0) > 0
    ? t('panels.bag.tooltip.owned', { count: props.content.ownedCount })
    : undefined,
)
const metaLine = computed(() => props.content.gradeLine)
</script>
```

Template — header (static slot or icon fallback), title, meta, badges; sections with eyebrow labels; affix `◆`/`T{tier}`/`range`/`delta`; description last (muted italic, per spec diagram):

```vue
<template>
  <div class="item-card">
    <p v-if="eyebrow" class="item-card__eyebrow">{{ eyebrow }}</p>
    <header class="item-card__header">
      <SlotView
        v-if="content.slotPreview"
        v-bind="content.slotPreview"
        :item="{}"
        :static="true"
        class="item-card__slot"
      />
      <div v-else class="item-card__icon-shell">
        <img v-if="content.imagePath" :src="content.imagePath" :alt="content.name" />
        <span v-else>{{ content.name.charAt(0) }}</span>
      </div>
      <div class="item-card__heading">
        <p class="item-card__title" :class="{ 'item-card__title--max-rank': rainbowTitle }" :style="titleStyle">{{ content.name }}</p>
        <p v-if="metaLine" class="item-card__meta">{{ metaLine }}</p>
        <div class="item-card__badges">
          <span v-if="isEquipment" class="item-card__badge">{{ (content as EquipmentTooltipContent).slotLabel }}</span>
          <span v-if="!isEquipment && (content as GradedItemTooltipContent).gradeLabel" class="item-card__badge">{{ (content as GradedItemTooltipContent).gradeLabel }}</span>
          <span v-if="ownedLabel" class="item-card__badge item-card__badge--muted">{{ ownedLabel }}</span>
        </div>
      </div>
    </header>

    <section v-for="section in content.sections" :key="section.label" class="item-card__section">
      <p class="item-card__section-label">{{ section.label }}</p>
      <div
        v-for="row in section.rows" :key="row.label"
        class="item-card__row"
        :class="[row.tone ? `item-card__row--${row.tone}` : '', row.tier ? `item-card__row--tier-${row.tier}` : '']"
        :aria-label="row.tier ? `${row.label}, bậc ${row.tier}: ${row.value}` : undefined"
      >
        <span class="item-card__row-label">
          <span v-if="row.tier" class="item-card__gem" aria-hidden="true">◆</span>{{ row.label }}
          <small v-if="row.tier" class="item-card__tier">T{{ row.tier }}</small>
        </span>
        <span class="item-card__row-value" :style="row.colorVar ? { color: `var(${row.colorVar})` } : undefined">
          {{ row.value }}
          <small v-if="row.range" class="item-card__range">{{ row.range }}</small>
          <small v-if="row.delta" class="item-card__delta" :class="`item-card__delta--${row.deltaTone ?? 'muted'}`">{{ row.delta }}</small>
        </span>
      </div>
    </section>

    <p v-if="content.description" class="item-card__description">{{ content.description }}</p>
  </div>
</template>
```

CSS (scoped): `.item-card__slot { width: 54px; flex: 0 0 54px; }`; eyebrow = `text-transform: uppercase; letter-spacing: .12em; color: var(--tooltip-accent)`; `.item-card__section-label` uppercase + `letter-spacing: .1em` + trailing `border-bottom` hairline; `.item-card__gem { color: var(--tooltip-accent); margin-right: 4px; font-size: .8em; }`; `.item-card__tier` muted; `.item-card__range { color: var(--paper-text-muted) }`; `.item-card__delta--positive { color: var(--jade) }`, `--negative { color: var(--crimson) }`; `.item-card__description` italic muted with `border-top: 1px dashed`. Tier colors reuse the existing `tooltip__section-row--tier-N` palette → re-map as `.item-card__row--tier-1 .item-card__tier { color: var(--affix-tier-1) }` … `--tier-5` uses `--rank-gradient-10` background-clip.

- [ ] **Step 3: `Tooltip.vue` rewire**

- Delete `isInspectModifierHeld` + keydown/keyup listeners + `visibleSections` (no more advanced mode).
- Keep technique header + shared section loop for `kind === 'technique'` only (technique unchanged per spec). Graded + equipment headers replaced by `ItemCardBody`.
- Pair rendering inside `.tooltip__content`:

```vue
<div v-if="content.kind === 'equipment' && content.compareWith" class="tooltip__pair">
  <div class="tooltip__card" role="group" :aria-label="t('panels.bag.tooltip.equipped')">
    <ItemCardBody :content="content.compareWith" :eyebrow="t('panels.bag.tooltip.equipped')" />
  </div>
  <div class="tooltip__card" role="group" :aria-label="t('panels.bag.tooltip.candidate')">
    <ItemCardBody :content="content" />
  </div>
</div>
<ItemCardBody v-else-if="gradedContent || content.kind === 'equipment'" :content="(gradedContent ?? content) as GradedItemTooltipContent | EquipmentTooltipContent" />
```

- `maxWidthForKind`: `equipment` with `compareWith` → 800 (two ~380 cards + gap); keep 380 single.
- `useI18n` added to Tooltip.vue script.
- `.tooltip__pair { display: flex; gap: 12px; }` `.tooltip__card { min-width: 0; }`
- Aura/`--tooltip-accent` computeds unchanged (still keyed on `qualityKey`/`gradeKey`/`gradeRank`).
- Remove now-dead CSS: `tooltip__title-segment--max-rank` only if unused elsewhere; `tooltip__icon-shell` styles stay for technique/fallback.

- [ ] **Step 4: i18n keys** — `src/locales/vi.json` under `panels.bag.tooltip`: `"equipped": "Đang Mặc"`, `"candidate": "Vật Phẩm"`; `en.json`: `"equipped": "Equipped"`, `"candidate": "Candidate"`.

- [ ] **Step 5: Verify**

Run: `npm run type-check && npx vitest run src/components/common/ src/composables/`
Expected: PASS (Tooltip/ItemCardBody tests green; remaining failures only in ToastContainer/hall-tab callers → Tasks 6-7).

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(tooltip): ItemCardBody + paired compare cards"
```

---

### Task 6: Equipment surfaces — compare context + accessibleLabel

**Files:**
- Modify: `src/components/panels/bag-sections/EquipmentBagSection.vue` (~lines 124-133)
- Modify: `src/components/panels/EquipmentPaperdoll.vue` (~line 121 builder call + accessibleLabel)
- Modify: `src/components/panels/equipment-hall/useEquippedRows.ts` (~line 90)
- Modify: `src/components/panels/equipment-hall/{EnhanceTab,WashTab,RefineTab,DissolveTab,DecomposeTab}.vue` — every `buildEquipmentTooltip` call site; pass `compare` where the tab shows UNEQUIPPED candidates for a slot that has an equipped item
- Test: `src/components/panels/` existing tests

- [ ] **Step 1: `EquipmentBagSection`** — the equipped counterpart:

```ts
const equippedComparison = gameManager.equipmentBag.getEquippedInSlot(instance.slot)
const equippedTemplate = equippedComparison
  ? gameManager.equipmentOps.getEquipmentTemplate(equippedComparison.itemId)
  : undefined

// in cell.tooltip:
tooltip: template
  ? buildEquipmentTooltip(
      instance, template, gameManager.affixRegistry,
      instance.equipped ? gameManager.equipmentOps.getSlotState(instance.slot) : null,
      gameManager.zoneRegistry,
      equippedComparison && equippedTemplate
        ? {
            instance: equippedComparison,
            template: equippedTemplate,
            slotState: gameManager.equipmentOps.getSlotState(equippedComparison.slot),
            mainStatRangeQuote: gameManager.equipmentSystem.quoteMainStatRange(equippedComparison, gameManager.equipmentRegistry),
          }
        : undefined,
      gameManager.equipmentSystem.quoteMainStatRange(instance, gameManager.equipmentRegistry),
    )
  : undefined,
accessibleLabel: `${displayName}, ${gradeLabel(instance.grade)}`,
```

(import `gradeLabel` from `@/core/presentation/labels`; `BagCell.accessibleLabel` from Task 4; bind `:accessible-label` in the SlotView template.)

- [ ] **Step 2: Hall tabs + paperdoll** — same migration at each `buildEquipmentTooltip` call (old positional `comparedInstance` arg → `compare` object or `undefined`). Paperdoll/equipped rows pass `undefined` (an equipped item has no "equipped counterpart" to compare against — it IS the counterpart). DissolveTab/hall pickers: candidates are unequipped — pass the slot's equipped instance as `compare` using the same object shape above.

- [ ] **Step 3: Verify**

Run: `npm run type-check && npx vitest run src/components/panels/`
Expected: PASS; bag tooltip tests may need compare-shape updates.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(tooltip): compare context wired through equipment surfaces"
```

---

### Task 7: Loot toast naming — `{name colored} · {grade muted}`

**Files:**
- Modify: `src/core/game/BattleLootSystem.ts` (~lines 472, 517, 540, 576, 594, 670 — every `nameSegments:` site)
- Modify: `src/components/common/ToastContainer.vue`
- Test: any `BattleLootSystem`/notification tests asserting `nameSegments` (grep `nameSegments` in `src/**/*.test.ts`)

- [ ] **Step 1: `BattleLootSystem.ts`** — replace `nameSegments` emissions:

```ts
// equipment loot (~line 472):
loot: {
  icon: instance.icon ?? template.icon,
  name: composeEquipmentDisplayName(instance, template, this.deps.zoneRegistry),
  nameColorVar: `--rank-color-${itemQualityRank(instance.quality) * 2 - 1}`,
  nameTone: instance.quality === 'tien' ? 'tien' : undefined,
  gradeLabel: gradeLabel(instance.grade),
  accentColorVar: /* keep existing */,
}

// material loot (~line 517):
loot: { icon, name: material.name, gradeLabel: materialGrade ? gradeLabel(materialGrade) : undefined,
        nameColorVar: materialRank ? `--rank-color-${materialRank}` : undefined }

// pill/graded loot (~line 540):
loot: { icon, name: composed display name, nameColorVar: phamRank ? `--rank-color-${phamRank}` : `--grade-${grade}`,
        nameTone: grade === 'tien' ? 'tien' : undefined, gradeLabel: pillProfessionGrade ? gradeLabel(...) : undefined }
```

('Tự Hóa Luyện' pseudo-loot at ~670 → `name: 'Tự Hóa Luyện'`; `message`-only loot at ~594 → `name: message`.)

- [ ] **Step 2: `ToastContainer.vue`** — name + muted grade suffix:

```vue
<span class="toast-item__name">
  <span :class="{ 'toast-item__segment--max-rank': isMaxRankTone(toast.loot.nameTone) }"
        :style="toast.loot.nameColorVar && !isMaxRankTone(toast.loot.nameTone) ? { color: `var(${toast.loot.nameColorVar})` } : undefined">{{ toast.loot.name }}</span>
  <span v-if="toast.loot.gradeLabel" class="toast-item__grade">· {{ toast.loot.gradeLabel }}</span>
</span>
```

`lastNameText` helper replaced by `toast.loot.name` in the dismiss aria-label. `.toast-item__grade { color: var(--paper-text-muted); font-weight: 400; }`. Keep `toast-item__segment--max-rank` CSS (now keyed on `nameTone`).

- [ ] **Step 3: Verify**

Run: `npm run type-check && npx vitest run src/core/game/ src/components/common/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(loot): single-color name + muted grade suffix in toasts"
```

---

### Task 8: Surface sweep, docs, cleanup, full verification

**Files:**
- Audit (fix only divergent cases): `src/components/panels/scripture/{LoreCodex,TechniqueCodex}.vue`, `src/components/panels/TranPhapPanel.vue`, `src/components/panels/loadout-sections/TechniqueSlotCard.vue`, `src/components/panels/skill-path/SkillLoadoutStrip.vue`, `src/components/game/combat/hud/*`, vendor surfaces if any (`grep -rln "vendor\|Vendor\|shop" src/components/`)
- Modify: `docs/ui-components.md` (slot seal + card contract + variants), `docs/systems/ui-and-i18n.md` if naming rules are documented there
- Delete: `public/_scratch-item-cards.html`, `public/_compare-cards.png` (scratch artifacts — spec §7)
- Test: full suite

- [ ] **Step 1: Grep sweep (spec §5c-5)** — confirm no surface composes item identity outside the owners:

```bash
grep -rn "colorVar.*rank-color\|colorVar.*grade-" src/components/ --include="*.vue" | grep -v "ItemCardBody\|Tooltip.vue"
grep -rn "nameSegments" src/ | grep -v "SlotView\|NameSegment\|EquipmentNaming\|ItemGrade\|useEquippedRows\|BagSection\|BagCell\|test"
```

Expected leftovers: only legitimate prop-passing (`:name-segments` into SlotView). Any component building its own colored-name strings → migrate to the payload fields.

- [ ] **Step 2: Codex/Trận/vendor check** — open `LoreCodex.vue`/`TechniqueCodex.vue`: confirm their SlotViews pass `equipmentQualityRank`/`rarityRank` + `tooltip` so seal + card appear. If a codex shows un-owned items, `ownedCount` stays undefined → no "Sở hữu" line (correct per spec). Formation/trận slots: verify they show seal if they carry ranks; if they're technique slots (unchanged kind), leave as-is per spec §8.

- [ ] **Step 3: Docs + cleanup** — update `docs/ui-components.md` (seal ordinals, static mode, crowding rule, card contract, compare pair); delete scratch html/png.

- [ ] **Step 4: Full verification (P3 full — shared primitives touched broadly)**

Run: `npm run type-check && npm run build && npx vitest run`
Expected: all green. Then P14 live check per spec §7 risks: `npm run dev`, hover equipment with/without equipped counterpart (pair vs single), a material (seal + owned), a pill, a small ~40px bag cell (crowding rule — seal+amount only), Tiên item (rainbow title). Screenshot + console check. Also run `tutienidle-adversarial-qa` (P4 quick) and `code-review` (P5) before declaring done.

- [ ] **Step 5: Commit**

```bash
git commit -am "docs(item-card): unified item info spec applied — sweep + cleanup"
```

---

## Self-review notes (done while writing)

- Spec coverage: §1 seal/crowding → Task 1; §2 naming → Tasks 2-4,7; §3 card + static header + owned rule → Tasks 3-5; §4 compare → Tasks 3-6; §5 surfaces → Task 6 + Task 8 sweep; §5b a11y → Tasks 1 (aria-hidden seal), 4 (accessibleLabel), 5 (role=group), 6 (cell labels); §5c sweep → Task 8.
- Type consistency: `SlotPreviewProps` (T1→T3 file, defined in T3), `nameColorVar`/`nameTone`/`ownedCount`/`compareWith`/`range`/`delta`/`deltaTone`/`accessibleLabel`/`EquipmentCompareContext` used identically across tasks.
- Task 3 intentionally ends red-compile (contract-first); if the executor requires every commit green, fold Tasks 3+4 into one working set — noted in Task 3 Step 3.
