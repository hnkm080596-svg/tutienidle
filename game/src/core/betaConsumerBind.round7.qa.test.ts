// CLEAN-ROUND 7 consumer-lens bind probes (qa-fixpoint) -
//
// Every persisted way/hidden/dormant claim reaching a live surface must
// route through a canonical betaScope* verdict or a gated resolver.
// This file pins CLOSED the seams a consumer sweep re-verified this
// round; each block names the live consumer the probe protects so a
// regression points straight at the leaking surface.
//
// The canonical all-false beta table is re-pinned by lockBeta*ForTests()
// - the global vitest setup starts every suite with the full catalog
// admitted.
import { describe, expect, it } from 'vitest'
import { lockBetaFeaturesForTests } from './game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from './game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from './game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

import { createDefaultPlayer, type PlayerData } from './player/Player'
import {
  hasPathCapability,
  hasStaticPathCapability,
} from './player/CultivationPathSystem'
import {
  attemptNghichChuTian,
  getNghichChuTianMechanic,
  isNghichChuTianEligible,
  isNghichChuTianRevealed,
} from './realm/hidden/NghichChuTian'
import { isAncientBeastTrialEligible } from './realm/hidden/AncientBeastTrial'
import { isBetaFeature, isScopeHidden, isBetaTalentId } from './betaScope'
import { isBetaBuildingSurface } from './betaScopeSurface'
import { isBreakthroughAcquisitionEnabled } from './realm/ReleasePolicy'
import { BREAKTHROUGH_TALENT_POOLS } from '../data/talent/BreakthroughTalentPools'
import {
  isLegalBreakthroughOffer,
  isTalentEntitlementActionable,
  resolveTalentEntitlement,
} from './talent/TalentEntitlement'
import { GameManager } from './game/GameManager'
import { COMPANION_PULL_TOKEN_ID } from './game/GameManagerCompanionOps'
import type { Material } from './material/Material'
import type { Quest } from './quest/Quest'
import { QuestRegistry } from './quest/QuestRegistry'
import { QuestManager } from './quest/QuestManager'
import { QuestSystem } from './quest/QuestSystem'
import { MaterialRegistry } from './material/MaterialRegistry'
import { MaterialBag } from './material/MaterialBag'
import { PillRegistry } from './pill/PillRegistry'
import { PillBag } from './pill/PillBag'
import { RewardSystem, type RewardReceiver } from './reward/RewardSystem'
import { materials as MATERIALS } from '../data/materials/materials'
import { ZHOU_TIAN_DAI_STEP } from '../data/realm/ZhouTian'

function carriedPlayer(): PlayerData {
  return createDefaultPlayer()
}

/** Stub Material with the production token id - pullCompanion reads the
 * bag stack, never the registry (same convention as
 * GameManagerCompanionOps.test.ts). */
const PULL_TOKEN: Material = {
  id: COMPANION_PULL_TOKEN_ID,
  name: 'Chiêu Hiền Lệnh',
  category: 'other',
  sourceType: 'boss',
}

// ---------------------------------------------------------------------------
// A. Way-capability root gate - resolvePathCapabilities fails closed on
// every out-of-scope way. This is the single gate the per-frame CombatScene
// readers poll (presentation/bridges/kiemBarBridge.ts + theBarBridge.ts ->
// hasStaticPathCapability) and the an-path ultimate emblem read in
// TurnCombatSkillBar.vue (gameManager.hasPathCapability). A dormant-way
// save must never mint a live bar/emblem.
// ---------------------------------------------------------------------------
describe('capability resolver - dormant carried way emits nothing', () => {
  it.each([
    ['sword_pathway', 'sword', 'sword.sword_scroll'],
    ['hidden_sword_pathway', 'sword', 'sword.sword_riding'],
    ['body_pathway', 'body', 'body.essence_economy'],
    ['hidden_body_pathway', 'body', 'body.essence_economy'],
  ] as const)('carried %s emits no %s', (way, path, capability) => {
    const player = carriedPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = path
    player.cultivationWay = way

    expect(hasStaticPathCapability(player, capability)).toBe(false)
  })

  it('carried hidden_spell_pathway emits no reaction_aura (the an-path emblem read)', () => {
    const player = carriedPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    expect(
      hasPathCapability(player, 'spell.reaction_aura', { hasSkill: () => true }),
    ).toBe(false)
    expect(hasStaticPathCapability(player, 'spell.essence_pool')).toBe(false)
  })

  it('spell_pathway stays live - the beta way still emits essence_pool', () => {
    const player = carriedPlayer()
    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    expect(hasStaticPathCapability(player, 'spell.essence_pool')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// B. Hidden-domain carried state stays inert. ZhouTianSection.vue /
// MeridianSection.vue / BodyRefinementSection.vue read hidden records
// through betaHiddenRealmRecordFor + isBetaFeature-gated reveal reads;
// the domain writers share canProgressHiddenBody (HiddenLineage.ts:136).
// A save carrying a live Nghich mechanic must not reveal, roll, or
// spend under the lock.
// ---------------------------------------------------------------------------
describe('hidden-domain carried records stay inert', () => {
  function carriedNghichSave(): PlayerData {
    const player = carriedPlayer()
    player.realmId = 'foundation_establishment'
    player.bodyProgression.zhou_tian.completed = ZHOU_TIAN_DAI_STEP
    player.hiddenPerfection.realms['foundation_establishment'] = {
      discovered: true,
      bodyCompleted: false,
      frozen: false,
      mechanic: {
        kind: 'nghich_chu_tian',
        completed: 5,
        pityByLevel: [0, 1, 2, 3, 4],
        active: true,
      },
    }
    return player
  }

  it('a discovered + active Nghich record never reveals (ZhouTianSection row)', () => {
    expect(isNghichChuTianRevealed(carriedNghichSave())).toBe(false)
  })

  it('attemptNghichChuTian on a carried live mechanic is ineligible and writes nothing', () => {
    const player = carriedNghichSave()
    const before = JSON.stringify(player.hiddenPerfection)

    const result = attemptNghichChuTian(player, new MaterialBag())

    expect(result.outcome).toBe('ineligible')
    expect(result.level).toBe(5)
    expect(getNghichChuTianMechanic(player)?.completed).toBe(5)
    expect(JSON.stringify(player.hiddenPerfection)).toBe(before)
  })

  it('isNghichChuTianEligible fails closed even at full eligibility inputs', () => {
    expect(isNghichChuTianEligible(carriedNghichSave())).toBe(false)
  })

  it('the ancient-beast-trial resolver cannot fire on a carried mortal lineage', () => {
    const player = carriedPlayer()
    player.realmId = 'mortal'
    player.hiddenPerfection.completedHiddenBodyRealmIds = []
    player.bodyProgression.body_refinement.completedTiers = 6

    expect(isAncientBeastTrialEligible(player)).toBe(false)
  })

  it('scope authority stays all-false in this suite (sanity)', () => {
    expect(isBetaFeature('hiddenContent')).toBe(false)
    expect(isBetaFeature('companion')).toBe(false)
    expect(isBetaFeature('artifact')).toBe(false)
    expect(isScopeHidden('manualWorkforce')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// C. Companion domain - a carried token + balance can never mint a pull.
// CompanionPanel / worker-lodge companion tabs are mount-gated; this pins
// the domain-side seam (ChieuMoTab -> pullCompanion) that a UI leak or a
// direct call would hit.
// ---------------------------------------------------------------------------
describe('companion pull seam - carried token never rolls', () => {
  it('pullCompanion is realm_locked under the closed domain and preserves the token', () => {
    const manager = new GameManager()
    const player = carriedPlayer()
    player.realmId = 'foundation_establishment'
    manager.setActivePlayer(player)
    manager.materialBag.add(PULL_TOKEN, 3)

    const result = manager.companionOps.pullCompanion()

    expect(result).toEqual({ ok: false, reason: 'realm_locked' })
    expect(manager.materialBag.getAmount(PULL_TOKEN.id)).toBe(3)
    expect(player.companions).toHaveLength(0)
    expect(player.duyenPhan).toBe(0)
    expect(player.companionPullsSinceRare).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// D. Scope-hidden building - a carried chi_hien_quan instance (the
// manualWorkforce building) is preserved but inert: no upgrade spend,
// no manual assignment write, no admitted popover/panel surface.
// ---------------------------------------------------------------------------
describe('carried chi_hien_quan instance is inert', () => {
  function managerWithCarriedQuan() {
    const manager = new GameManager()
    const player = carriedPlayer()
    manager.setActivePlayer(player)
    manager.buildingManager.add({
      instanceId: 'b1',
      buildingId: 'chi_hien_quan',
      level: 1,
      lastCollectedAt: 1_725_000_000_000,
    })
    return { manager, player }
  }

  it('upgradeBuilding refuses (no live material spend into a dormant record)', () => {
    const { manager } = managerWithCarriedQuan()
    expect(manager.buildingOps.upgradeBuilding('b1')).toBe(false)
    expect(manager.buildingManager.get('b1')?.level).toBe(1)
  })

  it('assignWorkers no-ops at both seams (ops + domain)', () => {
    const { manager } = managerWithCarriedQuan()
    manager.buildingOps.assignWorkers('thanh_van_go_s1', 2)
    expect(
      manager.productionSystem.setWorkerAssignment('thanh_van_go_s1', 2, 3),
    ).toBe(false)
  })

  it('the building id admits no surface (icon, standalone panel)', () => {
    expect(isBetaBuildingSurface('chi_hien_quan')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// E. Talent entitlement - the 'new' decision branch admits only offers
// from an enabled realm pool; the transitive beta closure is data-level:
// every enabled-pool member must be a beta talent id. TalentEntitlementModal
// offers entries straight from that read, so this is the seam's contract.
// ---------------------------------------------------------------------------
describe('talent entitlement - enabled pools stay inside the beta roster', () => {
  it('every talent offered by a release-enabled pool is a beta talent', () => {
    for (const [realmId, pool] of Object.entries(BREAKTHROUGH_TALENT_POOLS)) {
      if (!isBreakthroughAcquisitionEnabled(realmId)) {
        continue
      }
      for (const talent of pool) {
        expect(isBetaTalentId(talent.id), `${realmId}:${talent.id}`).toBe(true)
        expect(isLegalBreakthroughOffer(realmId, talent.id)).toBe(true)
      }
    }
  })

  it('a carried golden_core entitlement is inactionable and never resolves', () => {
    const goldenCorePool = BREAKTHROUGH_TALENT_POOLS['golden_core']
    expect(goldenCorePool).toBeDefined()
    expect(goldenCorePool!.length).toBeGreaterThan(0)
    for (const talent of goldenCorePool!) {
      expect(isBetaTalentId(talent.id), talent.id).toBe(false)
    }

    const player = carriedPlayer()
    player.realmId = 'golden_core'
    player.pendingTalentEntitlement = {
      realmId: 'golden_core',
      offeredTalentIds: goldenCorePool!.map((talent) => talent.id),
    }

    expect(isTalentEntitlementActionable(player)).toBe(false)
    expect(
      resolveTalentEntitlement(player, {
        kind: 'new',
        talentId: goldenCorePool![0]!.id,
      }),
    ).toBe(false)
    expect(player.selectedTalentIds).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// F. Quest surface - QuestSystem.getActiveQuests/canClaim/claim re-apply
// isBetaQuestEnabled on every read (QuestPanel.vue renders only that
// projection). Stale active progress on a scope-hidden quest never
// projects or claims even between reconcile runs.
// ---------------------------------------------------------------------------
describe('quest projection - scope-hidden residue never surfaces', () => {
  function questHarness() {
    const registry = new QuestRegistry()
    const manager = new QuestManager()
    const system = new QuestSystem()
    const materialRegistry = new MaterialRegistry()
    for (const material of MATERIALS) {
      materialRegistry.register(material)
    }
    return {
      registry,
      manager,
      system,
      bags: {
        materialRegistry,
        materialBag: new MaterialBag(),
        pillRegistry: new PillRegistry(),
        pillBag: new PillBag(),
      },
    }
  }

  const STALE_DAILY: Quest = {
    id: 'daily_probe_scope_hidden',
    name: 'Probe',
    description: '',
    cadence: 'daily',
    condition: { kind: 'kill', amount: 1 },
    reward: {},
  }

  it('stale daily progress never projects and never claims', () => {
    const { registry, manager, system, bags } = questHarness()
    registry.register(STALE_DAILY)
    manager.ensureActive(STALE_DAILY)
    manager.incrementProgress(STALE_DAILY.id, 1)
    const player = carriedPlayer()
    const rewardSystem = new RewardSystem()
    const receiver: RewardReceiver = {
      addSkillInsight() {},
      addCultivation() {},
      addSpiritStone() {},
    }

    expect(system.getActiveQuests(registry, manager, player)).toEqual([])
    expect(system.canClaim(registry, manager, bags, STALE_DAILY.id)).toBe(false)
    expect(
      system.claim(registry, manager, rewardSystem, receiver, bags, STALE_DAILY.id),
    ).toBe(false)
  })

  it('reconcile deactivates scope-hidden residue instead of re-projecting it', () => {
    const { registry, manager, system } = questHarness()
    registry.register(STALE_DAILY)
    manager.ensureActive(STALE_DAILY)

    system.reconcileActiveQuests(registry, manager, carriedPlayer())

    expect(manager.getProgress(STALE_DAILY.id)).toBeUndefined()
  })
})
