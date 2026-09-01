import { pathToFileURL } from 'node:url'

const EXACT_PATH_RULES = [
  {
    path: 'game/src/core/artifact/ArtifactSystem.ts',
    domains: ['combat-and-tribulation'],
    consumers: [
      'artifact cooldown presentation and VFX',
      'battle action impact, ailments, buffs, and target state',
    ],
    reasons: [],
  },
  {
    path: 'game/src/core/stage/StageSystem.ts',
    domains: ['combat-and-tribulation', 'economy-and-progression'],
    consumers: [
      'StageWaveSystem enemy selection and eliteChance spawn handling',
      'battle enemy composition, loot eligibility, and progression flow',
    ],
    reasons: ['stage enemy selection bridges progression staging and combat spawns'],
  },
  {
    path: 'game/src/core/technique/TechniqueSystem.ts',
    domains: ['combat-and-tribulation', 'economy-and-progression'],
    consumers: [
      'GameManager technique learn/equip rewards and save-facing ownership',
      'player stat aggregation and combat loadout',
    ],
    reasons: ['technique ownership and equip state feed progression rewards and combat stats'],
  },
  {
    path: 'game/src/core/stats/StatCalculator.ts',
    domains: ['combat-and-tribulation', 'economy-and-progression', 'inventory-equipment'],
    consumers: [
      'buff, ailment, equipment, technique, pill, and formation modifiers',
      'player store derived stats and combat entity recomputation',
    ],
    reasons: ['shared stat pipeline feeds combat, progression, and equipment outcomes'],
  },
  {
    path: 'game/src/composables/useBreakthrough.ts',
    domains: [
      'combat-and-tribulation',
      'economy-and-progression',
      'pinia-phaser-sync',
      'save-and-cloud',
    ],
    consumers: [
      'GameManager syncRealmPassive/syncRealmStatPassive callers',
      'artifact awakening and technique equip rewards',
      'persisted realm, player artifact, technique, and announcement state',
    ],
    reasons: [
      'breakthrough composable mutates persisted realm, technique, artifact, and UI announcement state',
    ],
  },
]

const DOMAIN_RULES = [
  {
    domain: 'economy-and-progression',
    patterns: [
      /^game\/src\/core\/(economy|production|profession|reward|building|alchemy|pill|progression|quest|realm|cultivation)\//,
      /^game\/src\/data\/(alchemy|building|pill|progression|quest|realm|realms)\//,
      /^game\/src\/components\/panels\/(Vendor|Production|Alchemy|Pill|Quest|Realm|LuyenThe|SpiritSpring)/,
      /^game\/src\/core\/game\/(GameManager|BattleLootSystem)\.ts$/,
    ],
    consumers: ['save and offline progression', 'UI affordability and unlock state'],
  },
  {
    domain: 'time-and-offline',
    patterns: [
      /^game\/src\/core\/idle\//,
      /^game\/src\/core\/game\/GameManager\.ts$/,
      /^game\/src\/core\/player\/PersistentTimedEffect\.ts$/,
      /^game\/src\/composables\/(useAutoRetryCountdown|useCadenceSmoothing)\.ts$/,
    ],
    consumers: ['economy and progression accrual', 'save timestamps and recovery'],
  },
  {
    domain: 'save-and-cloud',
    patterns: [
      /^game\/src\/services\/(save|cloudSave|auth|character|supabase)\//,
      /^game\/src\/composables\/useBootFlow\.ts$/,
      /^game\/src\/stores\/(saveIssue|offlineSummary|uiFlagsPersistence)\.ts$/,
      /^game\/tests\/e2e\/(save-reload|boot-fresh)\.spec\.ts$/,
    ],
    consumers: ['boot and recovery UI', 'all persisted progression and inventory'],
  },
  {
    domain: 'pinia-phaser-sync',
    patterns: [
      /^game\/src\/stores\//,
      /^game\/src\/components\/game\//,
      /^game\/src\/game\/scenes\//,
      /^game\/src\/composables\/(useGameState|useStageActive|useCombatSceneActive)\.ts$/,
      /^game\/src\/core\/(events\/EventBus|game\/GameManager)\.ts$/,
    ],
    consumers: ['Vue panels and overlays', 'Phaser scenes and event lifecycle'],
  },
  {
    domain: 'combat-and-tribulation',
    patterns: [
      /^game\/src\/core\/(battle|combat|enemy|ailment|buff|tribulation|skill|talent|element)\//,
      /^game\/src\/data\/(enemy|skill|tribulation|buff|ailment|talent)\//,
      /^game\/src\/game\/scenes\/(CombatScene|TribulationScene)/,
      /^game\/src\/components\/game\/(combat|tribulation)\//,
      /^game\/src\/core\/game\/(GameManager|BattleLootSystem)\.ts$/,
    ],
    consumers: ['combat presentation and controls', 'loot, progression, and persistence after combat'],
  },
  {
    domain: 'inventory-equipment',
    patterns: [
      /^game\/src\/core\/(equipment|inventory|item|material)\//,
      /^game\/src\/data\/(equipment|materials)\//,
      /^game\/src\/components\/panels\/(Bag|Inventory|Equipment)/,
      /^game\/src\/composables\/useEquipment/,
    ],
    consumers: ['player stats and combat loadout', 'economy costs and persisted ownership'],
  },
  {
    domain: 'ui-input-lifecycle',
    patterns: [
      /^game\/src\/.*\.vue$/,
      /^game\/src\/assets\/theme\.css$/,
      /^game\/src\/(router|directives)\//,
      /^game\/src\/composables\/(uiScale|useTooltip|usePanelPagination|useBagPagination)\.ts$/,
      /^game\/tests\/e2e\/(ink-wash-ui|create-to-combat)\.spec\.ts$/,
    ],
    consumers: ['keyboard, pointer, focus, and overlay behavior', 'observable domain-state feedback'],
  },
]

const CRITICAL_DOMAINS = new Set([
  'save-and-cloud',
  'time-and-offline',
])

function normalizePath(value) {
  return value.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

export function mapChangedPaths(paths) {
  const normalizedPaths = [...new Set(paths.filter((path) => typeof path === 'string').map(normalizePath).filter(Boolean))]
  const domains = new Set()
  const oneHopConsumers = new Set()
  const mappedPaths = new Set()
  const advisoryReasons = new Set()

  for (const path of normalizedPaths) {
    const exactRule = EXACT_PATH_RULES.find((rule) => rule.path === path)

    if (exactRule) {
      mappedPaths.add(path)
      exactRule.domains.forEach((domain) => domains.add(domain))
      exactRule.consumers.forEach((consumer) => oneHopConsumers.add(consumer))
      exactRule.reasons.forEach((reason) => advisoryReasons.add(reason))
      continue
    }

    for (const rule of DOMAIN_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(path))) continue
      mappedPaths.add(path)
      domains.add(rule.domain)
      rule.consumers.forEach((consumer) => oneHopConsumers.add(consumer))
    }
  }

  const sortedDomains = [...domains].sort()
  const reasons = []
  for (const domain of sortedDomains.filter((domain) => CRITICAL_DOMAINS.has(domain))) {
    reasons.push(`critical state boundary: ${domain}`)
  }
  reasons.push(...[...advisoryReasons].sort())
  if (sortedDomains.length >= 2) reasons.push(`cross-system change: ${sortedDomains.length} domains`)

  return {
    domains: sortedDomains,
    oneHopConsumers: [...oneHopConsumers].sort(),
    deepAuditCandidate: reasons.length > 0,
    reasons,
    unmappedPaths: normalizedPaths.filter((path) => !mappedPaths.has(path)).sort(),
  }
}

function runCli(args) {
  if (args.length === 0) {
    console.error('Usage: node changed-risk-map.mjs <path> [<path> ...]')
    process.exitCode = 2
    return
  }
  console.log(JSON.stringify(mapChangedPaths(args), null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2))
}

