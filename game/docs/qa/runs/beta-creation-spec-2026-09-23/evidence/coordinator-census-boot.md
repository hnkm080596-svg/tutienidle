# Coordinator census: boot seam duplication @44abadfb
```
src/App.vue:548:    onNewCharacter: () => {
src/App.vue:621:async function onCharacterCreated(payload: CharacterCreationPayload) {
src/App.vue:700:      @complete="onCharacterCreated"
src/composables/useAppLifecycle.test.ts:284:    // onRestoreOk/onNewCharacter side effects, onError.
src/composables/useAppLifecycle.test.ts:691:  // onNewCharacter grant applied (buildings/materials/activePlayer were
src/composables/useAppLifecycle.test.ts:696:  // callback mirrors the same public seams App.vue's onNewCharacter
src/composables/useAppLifecycle.test.ts:702:    // Faithful seam mirror of App.vue's onNewCharacter: non-idempotent
src/composables/useAppLifecycle.test.ts:733:      onNewCharacter: grantStarterContent,
src/composables/useAppLifecycle.test.ts:748:      onNewCharacter: grantStarterContent,
src/composables/useAppLifecycle.test.ts:784:  // Mission B external audit (Medium): onNewCharacter runs OUTSIDE the
src/composables/useAppLifecycle.test.ts:791:  it('onNewCharacter THROWS mid-grant -> boot fails visibly + retry hard-resets instead of re-granting', async () => {
src/composables/useAppLifecycle.test.ts:807:      onNewCharacter: grantStarterContent,
src/composables/useAppLifecycle.test.ts:823:      onNewCharacter: grantStarterContent,
src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts:32:import type { EarlyGameCreationProfile } from '../../game/EarlyGameBootstrap'
src/core/simulation/earlygame/EssenceSubstitutionEconomy.ts:48:const MEASUREMENT_PROFILE: EarlyGameCreationProfile = {
src/core/simulation/earlygame/PerfectionEconomy.ts:12:import type { EarlyGameCreationProfile } from '../../game/EarlyGameBootstrap'
src/core/simulation/earlygame/PerfectionEconomy.ts:32:const MEASUREMENT_PROFILE: EarlyGameCreationProfile = {
src/core/simulation/earlygame/EarlyGameSession.ts:32:  applyCreationProfile,
src/core/simulation/earlygame/EarlyGameSession.ts:33:  bootstrapEarlyGamePlayer,
src/core/simulation/earlygame/EarlyGameSession.ts:34:  type EarlyGameCreationProfile,
src/core/simulation/earlygame/EarlyGameSession.ts:71:  profile: EarlyGameCreationProfile
src/core/simulation/earlygame/EarlyGameSession.ts:244:    applyCreationProfile(this.player, options.profile)
src/core/simulation/earlygame/EarlyGameSession.ts:245:    bootstrapEarlyGamePlayer(this.gameManager, this.player)
src/composables/useAppLifecycle.ts:103:  onNewCharacter?: () => void
src/composables/useAppLifecycle.ts:250:      const { createNewCharacter, onRestoreOk, onNewCharacter } = options
src/composables/useAppLifecycle.ts:254:        // state and its first save failed - re-running onNewCharacter
src/composables/useAppLifecycle.ts:346:          await onNewCharacter?.()
src/core/game/EarlyGameBootstrap.ts:5://   applyCreationProfile   = CharacterCreationScreen payload -> PlayerData
src/core/game/EarlyGameBootstrap.ts:6://                            (App.vue::onCharacterCreated semantics)
src/core/game/EarlyGameBootstrap.ts:7://   bootstrapEarlyGamePlayer = fresh-character core setup
src/core/game/EarlyGameBootstrap.ts:8://                            (App.vue::onNewCharacter core subset)
src/core/game/EarlyGameBootstrap.ts:19:export interface EarlyGameCreationProfile {
src/core/game/EarlyGameBootstrap.ts:30:export function applyCreationProfile(
src/core/game/EarlyGameBootstrap.ts:32:  profile: EarlyGameCreationProfile,
src/core/game/EarlyGameBootstrap.ts:38:    [keyof EarlyGameCreationProfile['attributes'], number | undefined]
src/core/game/EarlyGameBootstrap.ts:44:export function bootstrapEarlyGamePlayer(
src/core/game/EarlyGameBootstrap.ts:48:  // New character: pre-learned skills (onNewCharacter core subset).
```
