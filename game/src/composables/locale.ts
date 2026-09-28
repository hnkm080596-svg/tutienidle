import type { WritableComputedRef } from 'vue'
import { i18n } from '@/i18n'

// Language preference owner - same contract as uiScale.ts: load once at
// boot (initLocale before mount, no flash), save through ONE writer so the
// stored value and live composer never diverge. `locale` stays the shared
// computed ref from the i18n composer - components read it via useI18n().
export const LOCALE_OPTIONS = ['vi', 'en'] as const
export type AppLocale = (typeof LOCALE_OPTIONS)[number]

const STORAGE_KEY = 'tien-hiep-idle-locale'
export const DEFAULT_LOCALE: AppLocale = 'vi'

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALE_OPTIONS as readonly string[]).includes(value)
}

export function loadLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function applyLocale(locale: AppLocale) {
  // i18n.global.locale is typed as the plain union here (vue-i18n option
  // composition); the composition-mode composer exposes a writable ref.
  ;(i18n.global.locale as unknown as WritableComputedRef<AppLocale>).value = locale
}

export function saveLocale(locale: AppLocale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Storage denied (private mode etc.) - still apply for this session.
  }
  applyLocale(locale)
}

export function initLocale() {
  applyLocale(loadLocale())
}
