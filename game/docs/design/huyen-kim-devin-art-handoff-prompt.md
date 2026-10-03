# Devin Prompt - Implement Huyen Kim Stable Scene Art

You are implementing the approved Huyen Kim stable scene-art package in the TutienIdle frontend. Work in an isolated worktree and follow the repository `AGENTS.md`, the internal QA protocol, and all required protection gates. Do not commit, push, merge, or deploy without explicit user authorization.

## Required reading before edits

Read these files completely and treat them as contracts:

1. `docs/design/huyen-kim-frontend-art-handoff.md`
2. `docs/design/huyen-kim-ui-art-manifest.json`
3. `public/assets/ui/huyen-kim/_source/stable-scene-extension.json`
4. `public/assets/ui/huyen-kim/_source/stable-scene-extension-qa.json`
5. `docs/design/huyen-kim-scene-layout-spec.md`
6. `docs/design/huyen-kim-component-state-matrix.md`
7. `docs/design/frontend-contract.md`
8. `docs/design/huyen-kim-ui-implementation-map.md`
9. `docs/design/huyen-kim-ui-art-production-report.md`
10. The relevant current phases in `docs/roadmap.md` before touching progression, combat, save, inventory, production, or quest consumers.

Complete the architecture-worker G0/G1 intake before production edits. Audit the current checkout and real consumers; do not assume a historical plan describes current source.

## Objective

Integrate only the stable art delivered under `public/assets/ui/huyen-kim/` into the existing Vue/Phaser UI without changing gameplay rules or inventing missing content. Preserve the scene-first direction: calm environment-led Huyen Kim Son Thuy, with runtime information and interaction remaining dominant.

## Non-negotiable parallax requirement

Backgrounds are layered parallax art, not flattened images.

- Auth/creation: load `scene/auth/00-sky` through `05-foreground` in manifest order.
- Realm: load `scene/realm/00-sky` through `04-low-mist` in manifest order.
- Skill tree: load `scene/skill/00-sky` through `03-atmosphere` in manifest order.
- Use the exact per-layer canvas, depth, order, and `max_drift_px` in the extension contract.
- Do not crop/reframe layers independently.
- Near layers may drift more than far layers; interpolate movement smoothly.
- With `prefers-reduced-motion: reduce`, set every parallax offset to exactly zero.
- After cover-fitting each layer, provide at least `2 * max_drift_px.x` extra rendered width and `2 * max_drift_px.y` extra rendered height, center that overscan, and clamp translation to the contract maximum. `overflow: hidden` by itself is not sufficient.
- Never import `_source/generated/*-master.png` at runtime.
- Prove neutral, maximum-negative, and maximum-positive drift without seams. Use `preview/14-parallax-motion-qa.png` as the visual oracle.

## Runtime ownership boundary

The new art is substrate/chrome only. Runtime remains the only owner of:

- all text, i18n, labels, counts, progress, locks, reasons, selection, hover, and focus;
- realm's 18 rungs and breakthrough state;
- skill nodes, edges, topology, icons, levels, costs, and element tint;
- body meridian nodes, names, tiers, and investment state;
- technique illustration, grade, rank, materials, and upgrade outcome;
- exploration geography, routes, stages, boss marks, and chapter state;
- equipment items, sockets, rarity, stats, and operations;
- tribulation characters, questions, lightning/VFX, meters, phases, shake, and result;
- gameplay resolution and all mutations.

Presentation may render and acknowledge playback. It must never award resources, spend costs, advance progression, or decide gameplay outcomes.

## Explicit exclusions

Do not create, generate, paint, or silently substitute entity spritesheets, portraits, technique illustrations, skill icons, pills, materials, items, equipment/reward icons, realm emblems, quest/stage/boss/chapter art, painted Son Ha geography, or animated VFX. These are volatile content and intentionally absent.

If an excluded asset is needed, retain the existing data-driven placeholder and report the gap. Do not block the stable layout on speculative content art.

## Beta UI law

Consume the canonical GameManager read-models in `docs/design/frontend-contract.md`.

- Never derive scope/progression predicates from raw `PlayerData`.
- `scope-hidden` means absent: no DOM, no locked card, no teaser, no tooltip, no deep link.
- Preserve clickable gameplay actions where the current product contract requires click-time/core validation and player-facing Vietnamese failure reasons.
- Route all new UI text through i18n.

## Implementation shape

Prefer the smallest coherent implementation:

1. A typed stable-art registry generated or hand-authored from the manifest, with no duplicated path literals.
2. One reusable parallax presenter with ordered layers, bounded normalized pointer/camera input, resize-safe cover bleed, and reduced-motion handling.
3. Scene adapters/components that consume the registry without owning domain rules.
4. Independent integration of body, technique, map, equipment, tribulation, and SVG symbols.

Do not change public store/service APIs, folder architecture, dependencies, Phaser scene topology, or gameplay state ownership unless a verified current-source blocker makes it necessary. If so, stop and request an architecture decision.

## Required verification

Follow `AGENTS.md` exactly. At minimum:

- run the stable-art validator: `node public/assets/ui/huyen-kim/_source/generate-scene-extension.mjs --check`;
- run the P3 verification mode triggered by the actual diff;
- run OCR Delegation Mode on the exact worktree diff with 100% previewed-file accounting;
- run P13/P14 real-browser checks because this task changes UI, responsive layout, motion, z-order, and possibly Vue/Phaser presentation;
- test reduced motion, resize/crop, alpha stacking, console output, keyboard focus, and scope-hidden absence;
- run `tutienidle-adversarial-qa` after verification/OCR/runtime checks;
- perform at least three chronological sequential review passes over the resulting states, fixing and re-verifying confirmed findings as required.

Capture exact screenshots for scenes 01, 02, 05, 06, 07, 08, 10, 12, and 14 where reachable. When a scene is unreachable because its canonical read-model is scope-hidden or its progression fixture is unavailable, record that as an explicit evidence gap; do not bypass authority to force it visible.

## Completion report

Return:

- worktree path and branch;
- files changed grouped by registry/presenter/scene/test/doc;
- exact stable packages integrated and any intentionally deferred consumer;
- verification commands and results;
- browser screenshots and what each proves;
- OCR coverage and findings;
- adversarial QA verdict;
- chronological sequential review evidence;
- all remaining gaps, blockers, Low/Nit findings, and stop/replan decisions;
- confirmation that no excluded volatile art or scope-hidden UI was introduced.

Do not call the work complete from type-check or unit tests alone. The acceptance threshold is browser-backed, evidence-based integration with the parallax and authority contracts intact.
