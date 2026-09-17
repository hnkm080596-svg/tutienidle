/**
 * App-level overlay stacking order (A2: one rule, one owner).
 *
 * Every full-screen / app-scope overlay takes its z-index from this scale —
 * never a hardcoded literal. `.game-root` is positioned but creates no
 * stacking context, and Teleport-to-body overlays share the same root
 * context, so every entry here competes directly with every other.
 *
 * `curtain` is TOPMOST by contract: while the presentation curtain is
 * closed it must cover every other layer, which is why it sits above even
 * the save gate and the app error screen (the curtain renders its own
 * error shell for transition failures; a window of closed-curtain is
 * bounded by the coordinator's transition deadline).
 *
 * Intra-component z-indexes (small values inside one component's own
 * stacking context) do not belong here — this scale is only for elements
 * that compete in the app root stacking context.
 */
export const OVERLAY_LAYERS = {
  /** CombatPauseOverlay — deliberately below the curtain: a route transition always covers the pause prompt. */
  combatPause: 900,
  /** MainMenu — boot entry overlay, above LoadingScreen's plain DOM-order stacking. */
  mainMenu: 1000,
  /** ActionFeedbackLog — bottom-right action history. */
  feedback: 1200,
  /** ToastContainer — transient notifications. */
  toast: 1500,
  /** Full-screen panels (OverlayPanel default, ConfirmModal, RadialSkillSelector). */
  panel: 1800,
  /** Blocking modals above panels (OfflineSummaryModal, LoreCodexModal, TutorialOverlay). */
  modal: 1900,
  /** WorldAnnouncementOverlay — ambient/ephemeral banners; must never cover a blocking modal. */
  announcement: 1850,
  /** Tooltip — floating contextual info. */
  tooltip: 2200,
  /** ErrorScreen — app-level error surface. */
  appError: 3000,
  /** SaveIncompatibleScreen — boot save gate. */
  saveGate: 4000,
  /** PresentationTransitionOverlay curtain — TOPMOST, covers everything while closed. */
  curtain: 5000,
} as const
