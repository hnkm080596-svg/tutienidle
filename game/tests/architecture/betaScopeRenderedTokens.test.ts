/**
 * BETA scope rendered-token corpus guard (spec sec.9 / contract sec.C-I).
 *
 * A scope-hidden system must never reach the player's eyes: no button, no
 * label, no disabled teaser, no "coming soon" placeholder. The betaScope
 * read-models are covered by betaScopeSurface.test.ts; this guard covers
 * the complementary hole - a shipped .vue renderer that mentions a
 * forbidden surface without consulting any beta admission check.
 *
 * Method: scan every `src/**` +.vue file, strip comments, and search for
 * tokens that only exist to render a scope-hidden system. Each hit file
 * must be:
 *   - gated      : the file itself calls a beta admission check
 *                  (an isBeta- / betaScope read-model / BETA_ const) or an
 *                  uncommittable-state check like isActivePath('sword');
 *   - host-gated : the file renders only inside a mount listed in
 *                  MOUNT_GATES, whose gate signature is asserted intact;
 *   - benign     : the token lives in data never producible for a beta
 *                  player (explicitly registered with a reason);
 *   - known-leak : a real, confirmed leak registered in KNOWN_LEAKS with
 *                  evidence (kept visible in the census, ratchet-style:
 *                  a fixed leak makes the suite fail stale).
 * Any other hit FAILS the suite: a new unaccounted scope-hidden token on
 * a shipped surface.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { BETA_FEATURES, type BetaFeatureName } from '@/core/betaScope'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'

// The global test setup unlocks every feature for pre-lock suites; the
// corpus must see the real flags (all scope-hidden).
lockBetaFeaturesForTests()

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url))

// ---------------------------------------------------------------------------
// Corpus

function listVueFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      listVueFiles(full, acc)
    } else if (entry.endsWith('.vue')) {
      acc.push(full)
    }
  }
  return acc
}

/** Strip the comment forms a .vue file can carry: //, block, and html. */
function stripComments(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

// ---------------------------------------------------------------------------
// Tokens that only exist to surface a scope-hidden system (spec sec.9 list:
// Sword, Body profession, Hidden paths, Ultimate, Companion, Formation,
// Artifact, Kim Dan, Daily quests, Manual workforce, Wash/Refine/Ore
// Decompose, coming-soon placeholders).
//
// Tokens are surface-ids or rendered labels, chosen so a bare word in an
// unrelated feature cannot collide ('refinement' is realm-body UI, not the
// equipment Refine tab - the quoted-id pattern catches the real tab).

const FORBIDDEN_TOKENS = [
  { id: 'ultimate', pattern: /\bultimate\b|Tuyệt Kỹ/ },
  { id: 'sword-way', pattern: /Kiếm Tu|sword_pathway|sword-dynamic-basic/ },
  { id: 'body-way', pattern: /Thể Tu|body_pathway|hidden_body_pathway/ },
  { id: 'hidden-path', pattern: /hidden_path|Ẩn Thế|Ứng Thế/ },
  {
    id: 'post-beta-realm',
    pattern:
      /Kim Đan|golden_core|Nguyên Anh|nascent_soul|Hóa Thần|soul_transformation|Luyện Hư|void_refinement|Đại Thừa|mahayana/,
  },
  { id: 'phap-bao', pattern: /phap_bao|Pháp Bảo/ },
  { id: 'formation', pattern: /formation_slot|tran_phap|Trận Pháp/ },
  { id: 'companion', pattern: /companion_roster|Đồng Hành|Companion\b/ },
  { id: 'worker-lodge', pattern: /worker_lodge|chi_hien_quan|Nhân Công/ },
  {
    id: 'equipment-forbidden-tab',
    pattern: /['"](wash|refine|decompose)['"]|ore_decompose/,
  },
  { id: 'daily-quest', pattern: /daily_quest|Nhiệm Vụ Ngày/ },
  { id: 'coming-soon', pattern: /coming_soon|comingSoon|Sắp Ra Mắt|isComingSoon/ },
] as const

// ---------------------------------------------------------------------------
// Admission markers: a file containing any of these consults the beta
// authority itself (or an equivalent uncommittable-state gate).

const GATE_MARKERS = [
  /\bisBeta[A-Z]\w*\(/,
  /\bbeta[A-Z]\w*\(/,
  /\bBETA_[A-Z_]+\b/,
  /from ['"]@\/core\/betaScope/,
  /\bisActivePath\(/,
  /\bscope-hidden\b|\bscope_hidden\b/,
  /\bisBeyondReleaseCeiling\b/,
]

// ---------------------------------------------------------------------------
// Host gates: files that can only mount inside a gated mount point. The
// signature must remain present in the gate file or every file it protects
// becomes an unaccounted hit.

interface MountGate {
  /** Gate file (relative to game/). */
  gateFile: string
  /** Substrings that must all still appear in the gate file. */
  signatures: readonly string[]
  /** Protected source files/globs (relative to game/src). */
  protected: readonly string[]
  reason: string
}

const MOUNT_GATES: MountGate[] = [
  {
    gateFile: 'src/components/layout/GameRoot.vue',
    signatures: ['isBetaStandalonePanel', "isBetaStandalonePanel(panel)"],
    protected: [
      'components/panels/ArtifactPanel.vue',
      'components/panels/artifact/',
      'components/panels/TranPhapPanel.vue',
      'components/panels/CompanionPanel.vue',
    ],
    reason:
      'mounted only under mountedStandalone.has(panel); mountedStandalone admits a panel only when isBetaStandalonePanel(panel) - artifact/tran_phap/companion are never admitted in beta',
  },
  {
    gateFile: 'src/stores/ui.ts',
    signatures: ['isBetaLeftPanelMode(mode)'],
    protected: [
      'components/panels/WorkerLodgePanel.vue',
      'components/panels/worker-lodge/',
      'components/layout/FunctionOverlayPanel.vue',
    ],
    reason:
      'the only leftPanelMode writers (setLeftPanelMode/toggleLeftPanelMode) reject any mode isBetaLeftPanelMode denies - worker_lodge mode can never activate, so its title/map entries and the panel never render',
  },
  {
    gateFile: 'src/components/scenes/equipment/EquipmentScene.vue',
    signatures: ['isBetaEquipmentTab(', 'visibleTabs'],
    protected: [
      'components/panels/equipment-hall/WashTab.vue',
      'components/panels/equipment-hall/RefineTab.vue',
      'components/panels/equipment-hall/DecomposeTab.vue',
    ],
    reason:
      'activeWorkspace can only become a tab listed in visibleTabs, which is TABS filtered by isBetaEquipmentTab - wash/refine/decompose tabs are unreachable',
  },
]

// ---------------------------------------------------------------------------
// Benign registrations: tokens that are present in code but bound to data a
// beta player can never produce. Each entry is per-file + per-token so a
// file gaining an unrelated hit still fails.

const BENIGN: ReadonlyArray<{ file: string; tokens: readonly string[]; reason: string }> = [
  {
    file: 'components/panels/bag-sections/MaterialBagSection.vue',
    tokens: ['post-beta-realm'],
    reason:
      'REALM_LABELS is a provenance tooltip lookup keyed by material.realmId - a label renders only for a material the player owns, and no post-ceiling material is obtainable in beta',
  },
  {
    file: 'components/scenes/realm/RealmAscentNode.vue',
    tokens: ['coming-soon'],
    reason:
      'the node renders props only; betaRealmLadderNodes() (betaScopeSurface) flattens comingSoon to false for every emitted node, so the comingSoon branch is unreachable - BetaJourney pins the guarantee',
  },
]

// ---------------------------------------------------------------------------
// Confirmed leaks (spec sec.9 violations found by this audit). The suite
// passes while the registry is exact; fixing a leak makes its entry stale
// and fails the suite until the entry is removed. Currently empty - the
// TurnCombatSkillBar ultimate slot and the SkillRoleStrip ultimate card
// were fixed by consuming betaCombatRolesFor directly.

const KNOWN_LEAKS: ReadonlyArray<{ file: string; tokens: readonly string[]; evidence: string }> = []

// Every scope-hidden BETA_FEATURES key must have a corpus token watching
// its surfaces. When a feature flips true its surface becomes legal and
// the token must be removed - this map makes the corpus track the flags
// instead of drifting.
type TokenId = (typeof FORBIDDEN_TOKENS)[number]['id']

const FEATURE_TOKEN_MAP: Record<BetaFeatureName, TokenId> = {
  hiddenContent: 'hidden-path',
  swordPath: 'sword-way',
  bodyPath: 'body-way',
  companion: 'companion',
  formation: 'formation',
  artifact: 'phap-bao',
  manualWorkforce: 'worker-lodge',
  equipmentWash: 'equipment-forbidden-tab',
  equipmentRefine: 'equipment-forbidden-tab',
  equipmentOreDecompose: 'equipment-forbidden-tab',
  dailyQuest: 'daily-quest',
}

// ---------------------------------------------------------------------------
// Scan + classify

interface HitFile {
  rel: string
  tokens: string[]
}

/** relative() returns OS separators; protected paths are POSIX-style. */
function toPosix(rel: string): string {
  return rel.replace(/\\/g, '/')
}

function scan(): HitFile[] {
  const files = [...listVueFiles(SRC_ROOT)]
  const hits: HitFile[] = []
  for (const file of files) {
    const rel = toPosix(relative(SRC_ROOT, file))
    const stripped = stripComments(readFileSync(file, 'utf8'))
    const tokens = FORBIDDEN_TOKENS.filter((tok) => tok.pattern.test(stripped)).map(
      (tok) => tok.id,
    )
    if (tokens.length > 0) {
      hits.push({ rel, tokens })
    }
  }
  return hits
}

function isGatedSelf(rel: string): boolean {
  const stripped = stripComments(readFileSync(join(SRC_ROOT, rel), 'utf8'))
  return GATE_MARKERS.some((marker) => marker.test(stripped))
}

function matchingGate(rel: string): MountGate | undefined {
  return MOUNT_GATES.find((gate) =>
    gate.protected.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p)),
  )
}

function gateIntact(gate: MountGate): boolean {
  const text = readFileSync(join(SRC_ROOT, '..', gate.gateFile), 'utf8')
  return gate.signatures.every((sig) => text.includes(sig))
}

describe('beta scope rendered-token corpus guard', () => {
  it('every forbidden-token hit on a shipped surface is gated, registered benign, or a known leak', () => {
    const hits = scan()
    const unaccounted: string[] = []
    const census: string[] = []

    for (const hit of hits) {
      const benign = BENIGN.find((b) => hit.rel === b.file)
      const benignTokens = new Set(benign?.tokens ?? [])
      const leak = KNOWN_LEAKS.find((l) => hit.rel === l.file)
      const leakTokens = new Set(leak?.tokens ?? [])
      const gate = matchingGate(hit.rel)
      const hostGated = gate !== undefined && gateIntact(gate)
      const gatedSelf = isGatedSelf(hit.rel)

      for (const token of hit.tokens) {
        if (leakTokens.has(token)) {
          census.push(`KNOWN LEAK   ${hit.rel} :: ${token}`)
          continue
        }
        if (benignTokens.has(token)) {
          census.push(`benign       ${hit.rel} :: ${token} (${benign!.reason})`)
          continue
        }
        if (hostGated) {
          census.push(`host-gated   ${hit.rel} :: ${token} (via ${gate!.gateFile})`)
          continue
        }
        if (gatedSelf) {
          census.push(`gated        ${hit.rel} :: ${token}`)
          continue
        }
        unaccounted.push(`${hit.rel} :: ${token}`)
      }
    }

    // Ratchet halves: a registered leak whose tokens vanished means the fix
    // landed (remove the entry); a registered benign whose tokens vanished
    // means the map changed (re-audit the entry).
    const stale: string[] = []
    for (const leak of KNOWN_LEAKS) {
      const fileHits = hits.find((h) => h.rel === leak.file)
      for (const token of leak.tokens) {
        if (!fileHits?.tokens.includes(token)) {
          stale.push(
            `stale KNOWN_LEAKS entry ${leak.file} :: ${token} - token no longer present; remove the entry (leak likely fixed)`,
          )
        }
      }
    }
    for (const benign of BENIGN) {
      const fileHits = hits.find((h) => h.rel === benign.file)
      for (const token of benign.tokens) {
        if (!fileHits?.tokens.includes(token)) {
          stale.push(
            `stale BENIGN entry ${benign.file} :: ${token} - token no longer present; re-audit`,
          )
        }
      }
    }
    // Gate files that lost their signature un-protect every file they guard.
    for (const gate of MOUNT_GATES) {
      if (!gateIntact(gate)) {
        stale.push(
          `mount gate ${gate.gateFile} lost signature(s) ${gate.signatures} - every protected file is now unaccounted`,
        )
      }
    }

    if (unaccounted.length > 0 || stale.length > 0) {
      console.log('--- token census ---')
      for (const line of census) console.log(line)
      console.log('--------------------')
    }
    expect(stale, 'stale registry entries').toEqual([])
    expect(
      unaccounted,
      `unaccounted scope-hidden tokens on shipped surfaces:\n${unaccounted.join('\n')}`,
    ).toEqual([])
  })

  it('the token corpus tracks the BETA_FEATURES flags exactly', () => {
    const tokenIds = new Set(FORBIDDEN_TOKENS.map((tok) => tok.id))
    for (const [feature, enabled] of Object.entries(BETA_FEATURES)) {
      const tokenId = FEATURE_TOKEN_MAP[feature as BetaFeatureName]
      expect(tokenId, `feature ${feature} has no mapped token`).toBeDefined()
      expect(
        tokenIds.has(tokenId),
        `feature ${feature} is ${enabled ? 'enabled - its surfaces are legal, remove token' : 'scope-hidden - add token'} "${tokenId}"`,
      ).toBe(!enabled)
    }
  })

  it('the leak registry is exact: no confirmed rendered-token leaks', () => {
    expect(KNOWN_LEAKS.map((l) => l.file).sort()).toEqual([])
  })
})
