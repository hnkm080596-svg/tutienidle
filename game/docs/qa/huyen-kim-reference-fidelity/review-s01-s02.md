# Visual Review - S01 Login / S02 Creation (pilot)

Scale: ref 1672x941 -> runtime 1280x720. Ref: `docs/design/references/huyen-kim/scenes/01-login.jpg`, `02-character-creation.jpg`. Evidence: `evidence/before/01-login.png`, `02-character-creation.png` vs `evidence/after/` same names.

## S01 Login

| Axis | Finding | Verdict |
|---|---|---|
| Composition | Vista parallax holds left ~60%; scroll card right-anchored (x>=56% root asserted) | PASS |
| Chrome/material | `surface-xl-scroll` + `frame-xl-ceremony` real PNG (ivory paper, gold ornate frame, dark roller caps); inputs use `text-field` chrome; CTAs use `button-ceremonial`/ghost | PASS |
| Focal point | Card is the focal; vista reads as environment | PASS |
| Density | seal + eyebrow + title + tabs + 2 fields + divider + guest CTA; all inside paper safe-area (padding tuned to frame insets) | PASS w/ note: `auth.lead` line dropped (ref card has no flavor text) |
| Typography | plaque/kicker hierarchy; dark paper text on ivory | PASS |
| Interaction | tabs roving focus, resume-continue, upgrade link, guest confirm intact; `data-hk-scene/region` anchors added | PASS |
| Server status | moved out of the card to vista bottom-left corner (ambient info, ref card does not carry it) | PASS |

## S02 Character Creation

| Axis | Finding | Verdict |
|---|---|---|
| Composition | Right scroll card (~40%w) + left vista w/ cultivator focal | PASS |
| Chrome/material | Same scroll+frame chrome; `section-plaque` PNG bars (light text on dark plaque - fixed dark-on-dark bug) | PASS |
| Focal | Title plaque -> name field -> talent grid -> sticky CTA | PASS |
| Density | 9 offers now 3x3 compact dark cards (rarity color + name + 1-line desc + tag); duplicate kickers clipped visually; label span visually hidden (a11y kept) | PASS |
| CTA | `panel-actions` is sticky-bottom inside card safe area - CTA always reachable, never pushed off by content | PASS |
| Interaction | reroll/name-valid/one-talent/finish preserved; no random-name or starter-skill UI added | PASS |

## E2E proof

`tests/e2e/huyen-kim-reference-fidelity.spec.ts` - 3/3 green @1280x720:
- S01: card x >= 56% root, inside root, guest+primary inside card, real `surface-xl-scroll` border-image painted, zero console errors.
- S02: card x >= 52% root, 9 talent buttons in exactly 3 rows/3 cols, CTA inside viewport.
- S03 handoff smoke: creation -> home scene reachable.

## Residual niggles (accepted, logged)

- Talent names wrap mid-word at ~130px card width (Vietnamese diacritics look like clipping at small size; real wrap behavior OK).
- "Đã chọn 0 / 1" and "Reroll toàn bộ" sit within ~8px of the inner frame line - inside the safe area but tight.
- The bottom-center wheel FAB (global `DongFuCommandWheel` collapsed trigger) renders over the vista on both auth screens - pre-existing global chrome, not a login defect; revisiting visibility on auth screens is a Task-4 question.
