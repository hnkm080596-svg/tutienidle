/**
 * Announcement descriptor returned by outcome services (R8.2 i18n
 * migration, P16). Domain services must stay framework-free — they cannot
 * call t() — so they return the semantic intent: which i18n keys to show
 * plus the data params (realm/foundation names). The Vue adapter resolves
 * the keys through i18n.global.t and hands plain strings to the
 * worldAnnouncement store (same pattern as QuanKhiPanel).
 *
 * Keys live under `announce.*` in src/locales/{vi,en}.json. Displayed
 * text is pinned byte-identical to the pre-migration strings by the
 * outcome-service parity tests.
 */
export interface OutcomeAnnouncement {
  /** i18n key for the announcement title. */
  readonly titleKey: string
  /** i18n key for the announcement body. */
  readonly bodyKey: string
  /** Named interpolation params for the title template. */
  readonly titleParams?: Record<string, string>
  /** Named interpolation params for the body template. */
  readonly bodyParams?: Record<string, string>
}
