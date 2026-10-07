# Entry and home worker evidence

Assigned checkout: `E:/tutienidle/.agent-worktrees/hoa-cau-fireball-vfx`; branch `codex/tien-hiep-ui-redesign`. Existing uncommitted task edits preserved. No commit, push or merge performed.

## G0/G1 responsibility and evidence

The reconstruction task card in `REBUILD-EXECUTION.md` governs this slice. Component map: `AuthEntryScreen` owns the existing authentication state; `LoginOpening` owns the opening title and begin intent; existing auth children render credentials, notices and secondary intents; `CharacterCreationScreen` retains its service-owned name/talent flow; `DongFuHomeContent` composes the read-only home model and emits existing IDs; `DongFuHud`, `DongFuWheel` and `DongFuBoard` retain their display responsibilities. The new scene CSS changes only composition and appearance.

| Question | Evidence and decision |
|---|---|
| Q1 | Opening renders one begin action; begin reveals all existing auth functions and focuses the login tab. Home renders all admitted `model.actions` on a bottom rail. |
| Q2 | `AuthEntryScreen.authenticate/continueSaved` still call the existing auth service; creation still calls `CharacterCreationService`; `DongFuStage.onAction/activateSlot` retain all home rule validation. |
| Q3 | Added opening boolean is local presentation state reset on mount, never saved. Account, character, inventory and progression writes remain with their original owners. |
| Q4 | Production onboarding -> `AuthEntryScreen` -> existing auth children -> existing auth service. Production `DongFuStage` -> `DongFuHomeContent` -> emitted ID -> `onAction` -> original owner. |
| Q5 | Reused `GameButton`, existing auth form and creation sections, `PlayerPortrait`, home wheel, HUD and opportunity board. |
| Q6 | New imports point toward existing presentation primitives and asset URL resolution. No domain imports presentation and no new shared domain API. |
| Q7 | No timing, domain outcome, animation ACK or business-rule changes. Dynamic player art remains unchanged. |
| Q8 | Props/emits are preserved. Rail renders IDs/labels/icons directly from the actual admitted model; no invented sect/guild controls. |
| Q9 | Opening/rendering emits no authentication or gameplay command. Begin changes only local visibility; home actions run only on user input. |
| Q10 | Auth submitting/error/session-switch acknowledgement semantics and creation busy guards are unchanged. Focus moves after Vue's DOM update. |
| Q11 | Wheel remains available by existing player intent; preview starts closed. Existing auth/continue/guest/upgrade and creation starter-preview paths retained. |
| Q12 | Scope is entry/home presentation only. Browser, aggregate build/type checks and aggregate review remain coordinator obligations. |

## G2/G3 implementation and focused evidence

Changed files in the slice: `src/components/onboarding/AuthEntryScreen.vue`, `AuthEntryScreen.test.ts`, `CharacterCreationScreen.vue`; `src/components/scenes/login/LoginOpening.vue`, `LoginLogoBlock.vue`, `LoginSceneVista.vue`; `src/components/scenes/dong-fu/fidelity/DongFuHomeContent.vue`, `DongFuHomeContent.test.ts`, `DongFuFidelityScene.vue`, `dongFuUi.ts`; `src/assets/tien-hiep-entry.css`.

The opening uses the localized game title instead of a concept's sample title. The coordinator supplies `onboarding.auth.begin`. Auth/creation use generous paper regions with thin gold borders; the home composes real HUD/resources/buildings/opportunities/quest/actions around the warm landscape. Both backgrounds resolve `source/world-vista-warm-v1.png`, supplied by the coordinator. Bottom navigation remains scrollable when the admitted catalog exceeds available space.

Focused command from `game/`: `npx vitest run src/components/onboarding/AuthEntryScreen.test.ts src/components/scenes/dong-fu/fidelity/DongFuHomeContent.test.ts src/components/scenes/dong-fu/fidelity/DongFuWheel.test.ts src/components/onboarding/CharacterCreationScreen.test.ts`.

Observed result 2026-10-05 09:09 local: **4 test files / 17 tests passed**. New coverage checks explicit begin gating, revealed guest and ID functions, keyboard focus, complete model-derived navigation IDs and preserved host routing. Existing tests check building upgrades do not also open the building, wheel disabled/active behavior, and creation name/talent payload semantics.

## G4/G5 limitations for aggregate acceptance

This worker report certifies implementation and focused evidence only. No QA fixed-point or merge-ready claim is made. Aggregate type-check/build, OCR, browser screenshots/interactions at required PC sizes, adversarial QA and sequential resulting-state review remain pending with the coordinator. The source has an existing Tab shortcut in `DongFuStage.onKeydown` that can open the wheel; coordinator was notified because strict click-only admission requires changing the production stage outside this slice's ownership. Warm landscape asset delivery is coordinator-owned. No `any` introduced.
