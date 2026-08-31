# Tasks 4.1–4.3 Report

**Status:** DONE

**Commit SHA:** dd9aa40

**One-line test summary:** `npm run type-check` PASS, `npm run build` PASS, `npm run test` 1510/1510 PASS.

---

## Per-file findings

### `HomeResourceStrip.vue`
- **Hex found:** No hardcoded hex in CSS.
- **Replacements:** None needed.

### `DongFuCommandWheel.vue`
- **Hex found:** No hardcoded hex in CSS.
- **Replacements:** None needed.

### `DongFuBuildingSprite.vue`
- **Hex found:** No hardcoded hex in CSS.
- **Replacements:** None needed.

### `BuildingDetailPopover.vue`
- **Hex found:** Yes — 3 inline fallback hex values in `var(--token, #hex)` fallback syntax.
- **Replacements made (3):**
  | Line | Old                                        | New                             |
  |------|--------------------------------------------|---------------------------------|
  | 130  | `var(--paper-text, #211f1a)`                | `var(--paper-text)`             |
  | 158  | `var(--paper-text, #211f1a)`                | `var(--paper-text)`             |
  | 164  | `var(--paper-text-soft, #5e5a50)`           | `var(--paper-text-soft)`        |

---

## Unmapped colors
None. All hardcoded hexs mapped cleanly to existing `--paper-text` and `--paper-text-soft` tokens already defined in `theme.css`.

## Remaining limitations
None.
