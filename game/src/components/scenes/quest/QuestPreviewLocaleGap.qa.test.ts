// QA R3 seam repro (blind wave 3) - FINDING R3-QUEST-I1 (LOW, cosmetic-latent).
//
// Seam: QuestFidelityDetail.vue:41 renders
// `QuestSectionPlaque :text="t('questPreview.progress')"` whenever the
// selected quest carries `progressText`. The key is translated in the
// ui-preview bundle (src/ui-preview/remainingMessages.ts -> the VI label)
// but was never added to the PRODUCTION catalogs - src/locales/en.json
// and src/locales/vi.json questPreview blocks hold only
// all/once/active/ready/claimed/empty/objectives/claim/follow.
//
// The detail component is the slot-default inside QuestFidelityScene:
// production always supplies the #detail slot today, so the plaque is
// latent - but it is production code and the remainingPreview contract
// test's fallback contract; any surface that mounts the scene without
// a detail slot renders the RAW KEY 'questPreview.progress' as visible
// text (vue-i18n falls back to the key name). Every other
// questPreview.* key the same file reads is in the catalog; progress
// is the lone hole.
//
// Repro: the production catalog must cover every literal the scene's
// production files dereference. Deterministic - pure catalog check.

import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import vi from '@/locales/vi.json'

type Dict = Record<string, unknown>
const questPreviewEn = (en as Dict).questPreview as Dict
const questPreviewVi = (vi as Dict).questPreview as Dict

describe('R3-QUEST-I1 - questPreview keys used by production components exist in catalogs', () => {
  const required = ['progress'] as const
  for (const key of required) {
    it(`en.json has questPreview.${key}`, () => {
      expect(questPreviewEn[key]).toBeTypeOf('string')
    })
    it(`vi.json has questPreview.${key}`, () => {
      expect(questPreviewVi[key]).toBeTypeOf('string')
    })
  }
})
