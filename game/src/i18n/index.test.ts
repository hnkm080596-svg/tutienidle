// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { i18n } from './index'

interface I18nGlobalShape {
  locale: { value: string }
  fallbackLocale: { value: string } | string
  availableLocales: string[]
  messages: { value: { vi: object; en: object } }
}

function globalState(): I18nGlobalShape {
  return i18n.global as unknown as I18nGlobalShape
}

describe('i18n', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('i18n instance exists', () => {
    expect(i18n).toBeDefined()
  })

  it('has vi and en locales', () => {
    const g = globalState()
    const msgs = g.messages.value
    expect(msgs.vi).toBeDefined()
    expect(msgs.en).toBeDefined()
  })

  it('defaults to vi locale', () => {
    const g = globalState()
    expect(g.locale.value).toBe('vi')
  })

  it('can switch locale to en', () => {
    const g = globalState()
    g.locale.value = 'en'
    expect(g.locale.value).toBe('en')
  })

  it('can switch locale back to vi', () => {
    const g = globalState()
    g.locale.value = 'en'
    g.locale.value = 'vi'
    expect(g.locale.value).toBe('vi')
  })

  it('has vi and en as available locales', () => {
    const g = globalState()
    expect(g.availableLocales).toContain('vi')
    expect(g.availableLocales).toContain('en')
  })

  it('fallback locale is en', () => {
    const g = globalState()
    const fallback = g.fallbackLocale
    const fallbackValue = typeof fallback === 'object' ? fallback.value : fallback
    expect(fallbackValue).toBe('en')
  })
})
