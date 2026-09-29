/**
 * Manifest completeness guard (sound-system W9 / OQ-C FULL coverage) -
 * every cue-id named by the spec's cue table or the audit inventory must
 * resolve to a real manifest row through `resolveAudioCue` (exact match
 * or qualifier strip). A cue that resolves to nothing means a listed
 * site can never be voiced - this test fails before the asset drop does.
 *
 * The manifest is pure data (the boundary guard pins that). This file
 * additionally imports cueForActionImpact to DERIVE the expected impact
 * rows - it pulls combatAudioBinding -> AudioManager -> tone into the
 * test process, which is safe under the node env (tone imports cleanly)
 * but couples this guard to tone's node-compat import.
 *
 * Parsing rules:
 *  - Only backtick cells whose first segment is a manifest domain are
 *    collected - prose like `this.sound` or `tutienidle.audio.v2` is not
 *    a cue.
 *  - `<placeholder>` qualifiers (`combat.cast.<skillId>`) name a family:
 *    after dropping the placeholder the id must resolve OR have at least
 *    one concrete row under it (prefix coverage - the spec expands every
 *    qualifier into a real row).
 *  - Documented spec merges (audit id folded into another cue) resolve
 *    through MERGE_MAP instead.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AUDIO_CUES, resolveAudioCue } from '@/core/audio/AudioCueManifest'
import { cueForActionImpact, cueForAttack } from '@/presentation/audio/combatAudioBinding'
import { ENEMY_RESKIN_MAP, MONSTER_ART } from '@/game/support/MonsterArt'
import {
  AUDIO_BUNDLE_PREFIXES,
  audioBundleIdsForCue,
  type AudioBundleId,
} from '@/presentation/assets/AssetBundleCatalog'
import { ROUTE_AUDIO_BUNDLES } from '@/presentation/audio/audioAssetWiring'
import { isTestFile } from './helpers/scanTs'

const SPEC_PATH = join(process.cwd(), 'docs/specs/sound-system-spec.md')
const AUDIT_PATH = join(process.cwd(), 'docs/design/sound-system-audit.md')

// Derived from the manifest, not hardcoded: the set filters PROSE
// backticks only. A spec-table row under a domain the manifest lacks is
// still collected and fails the resolve check loudly - a hardcoded list
// would silently drop that drift.
const DOMAINS = new Set(Object.keys(AUDIO_CUES).map((k) => k.split('.')[0]!))

const CUE_ID_RE = /^[a-z]+(\.[a-z_0-9]+)+$/

/** Audit ids the spec explicitly folds into another cue. */
const MERGE_MAP: Record<string, string> = {
  'stinger.victory': 'combat.victory',
  'stinger.defeat': 'combat.defeat',
}

/**
 * Pulls every dotted id inside a cue-domain backtick cell - spec tables
 * list bare ids and backticked ones; audit tables always backtick.
 */
function collectCueIds(markdown: string): string[] {
  const ids = new Set<string>()

  for (const match of markdown.matchAll(/`([a-z]+(?:\.[a-z_0-9<>\[\]]+)+)`/g)) {
    addId(match[1]!, true)
  }
  // Bare first-column ids in spec tables: `| ui.toast.loot | ui | ...`
  // A dotted id in table position IS a cue row - no domain filter, so a
  // row under a new domain resolves-or-fails visibly.
  for (const match of markdown.matchAll(/^\|\s*([a-z]+(?:\.[a-z_0-9<>]+)+)\s*\|/gm)) {
    addId(match[1]!, false)
  }

  function addId(raw: string, proseContext: boolean): void {
    let id = raw
    while (id.endsWith('>')) {
      id = id.slice(0, id.lastIndexOf('.'))
    }
    // A placeholder mid-path (`ui.toast.<kind>`) drops to its family.
    id = id.replace(/\.<[^.]+>/g, '')
    if (CUE_ID_RE.test(id) && (!proseContext || DOMAINS.has(id.split('.')[0]!))) ids.add(id)
  }

  return [...ids].sort()
}

function resolves(id: string): boolean {
  const target = MERGE_MAP[id] ?? id
  if (resolveAudioCue(target) !== undefined) return true
  // Prefix coverage: `ui.toast` family heads aren't rows themselves.
  return Object.keys(AUDIO_CUES).some((key) => key.startsWith(`${target}.`))
}

describe('audio manifest completeness', () => {
  it('every spec cue-table id resolves to a manifest row', () => {
    const ids = collectCueIds(readFileSync(SPEC_PATH, 'utf8'))
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => !resolves(id))).toEqual([])
  })

  it('every audit inventory cue-id resolves (exact, family, or spec merge)', () => {
    const ids = collectCueIds(readFileSync(AUDIT_PATH, 'utf8'))
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => !resolves(id))).toEqual([])
  })

  // AUDIO_BUNDLE_PREFIXES is a second enumeration of the manifest's
  // domain space: a new domain cue id that forgets a bundle row is
  // never fetched (and so never voiced) - pin the coverage.
  it('every manifest cue id is covered by at least one lazy audio bundle', () => {
    const uncovered = Object.keys(AUDIO_CUES).filter(
      (id) => audioBundleIdsForCue(id).length === 0,
    )
    expect(uncovered).toEqual([])
  })

  // ROUTE_AUDIO_BUNDLES is a THIRD enumeration: a bundle that exists but
  // no route requests is dead weight (and a prefix-table drift signal).
  it('every lazy audio bundle is requested by at least one route', () => {
    const routed = new Set(Object.values(ROUTE_AUDIO_BUNDLES).flat())
    const unrouted = (Object.keys(AUDIO_BUNDLE_PREFIXES) as AudioBundleId[])
      .filter((id) => !routed.has(id))
    expect(unrouted).toEqual([])
  })

  it('every manifest row id matches the cue-id convention', () => {
    const bad = Object.keys(AUDIO_CUES).filter((id) => !CUE_ID_RE.test(id))
    expect(bad).toEqual([])
  })

  // The catalog enumerations (CAST_SKILL_IDS / REACTION_IDS /
  // KIEM_COMBO_IDS) claim to mirror their data sources; that claim must
  // actually be pinned, or renamed/removed ids drift silently (OQ-C).
  it('manifest catalog enumerations match their data sources', () => {
    const keys = Object.keys(AUDIO_CUES)

    const kiemSrc = readFileSync(
      join(process.cwd(), 'src/data/skill/KiemPhoCombos.ts'),
      'utf8',
    )
    const realCombos = new Set(
      [...kiemSrc.matchAll(/\bcombo\(['"`]([^'"`]+)['"`]/g)].map((m) => m[1]),
    )
    expect(
      keys
        .filter((k) => k.startsWith('combat.kiem.combo.'))
        .map((k) => k.slice('combat.kiem.combo.'.length))
        .sort(),
    ).toEqual([...realCombos].sort())

    const reactionSrc = readFileSync(
      join(process.cwd(), 'src/data/reaction/ReactionDefinitions.ts'),
      'utf8',
    )
    const realReactions = new Set(
      [...reactionSrc.matchAll(/\b(?:sinh|khac)\(['"`]([^'"`]+)['"`]/g)].map(
        (m) => m[1],
      ),
    )
    expect(
      keys
        .filter((k) => k.startsWith('combat.reaction.'))
        .map((k) => k.slice('combat.reaction.'.length))
        .sort(),
    ).toEqual([...realReactions].sort())

    // Cast ids: every `id:` in the skill data files, plus the synthetic
    // 'basic_attack' fallback skillId the turn engine can emit.
    const skillIds = new Set<string>(['basic_attack'])
    const skillDir = join(process.cwd(), 'src/data/skill')
    for (const file of readdirSync(skillDir)) {
      if (!file.endsWith('.ts') || isTestFile(file)) continue
      for (const m of readFileSync(join(skillDir, file), 'utf8').matchAll(
        /\bid:\s*(['"`])([^'"`]+)\1/g,
      )) {
        skillIds.add(m[2]!)
      }
    }
    const castRows = keys
      .filter((k) => k.startsWith('combat.cast.'))
      .map((k) => k.slice('combat.cast.'.length))
    expect(castRows.filter((id) => !skillIds.has(id))).toEqual([])

    // combat.impact.* must cover exactly the CombatVfxPresetId members
    // that route to the impact family - derived from the binding's own
    // routing function so a new special-case (or a retargeted route)
    // cannot drift from a mirrored exclusion list.
    const combatActionSrc = readFileSync(
      join(process.cwd(), 'src/core/battle/CombatAction.ts'),
      'utf8',
    )
    const unionBody = combatActionSrc.match(
      /export type CombatVfxPresetId\s*=([\s\S]*?)\n\n/,
    )![1]!
    // Strip // comments first: prose apostrophes ("design's") shift the
    // quote parity and would silently corrupt the member list.
    const presets = new Set(
      [...unionBody.replace(/\/\/[^\n]*/g, '').matchAll(/['"`]([a-z_0-9]+)['"`]/g)].map(
        (m) => m[1]!,
      ),
    )
    // A preset landing on the bare 'combat.impact' anchor OR an element
    // fallback row has lost its dedicated impact row - both are silent
    // coverage holes. (combat.element.* is fully shadowed by expanded
    // rows today; a preset reaching it proves its impact row is gone.)
    const unrouted = [...presets].filter((p) => {
      const route = cueForActionImpact({ presetId: p })
      return (
        route === undefined ||
        route === 'combat.impact' ||
        route.startsWith('combat.element.')
      )
    })
    expect(unrouted).toEqual([])
    expect(
      keys
        .filter((k) => k.startsWith('combat.impact.'))
        .map((k) => k.slice('combat.impact.'.length))
        .sort(),
    ).toEqual(
      [...presets]
        .filter((p) => cueForActionImpact({ presetId: p }) === `combat.impact.${p}`)
        .sort(),
    )

    // F-BX-18: combat.enemy_attack.<slug> rows mirror MONSTER_ART's
    // attackSfxUrl declarations - the registry is the declaration
    // authority (cue qualifier = slug with '-' -> '_'). Pin the row set,
    // the src parity, the routing end-to-end, and that every declared
    // file actually ships under public/.
    const enemyAttackRows = keys
      .filter((k) => k.startsWith('combat.enemy_attack.'))
      .map((k) => k.slice('combat.enemy_attack.'.length))
      .sort()
    const declaredSlugs = Object.values(MONSTER_ART)
      .filter((v) => v.attackSfxUrl !== undefined)
      .map((v) => v.slug)
      .sort()
    expect(enemyAttackRows).toEqual(
      declaredSlugs.map((s) => s.replaceAll('-', '_')).sort(),
    )
    for (const v of Object.values(MONSTER_ART)) {
      if (!v.attackSfxUrl) continue
      const cueId = `combat.enemy_attack.${v.slug.replaceAll('-', '_')}`
      expect(AUDIO_CUES[cueId]?.src, cueId).toBe(v.attackSfxUrl)
      expect(
        existsSync(join(process.cwd(), 'public', v.attackSfxUrl)),
        `${cueId} -> ${v.attackSfxUrl}`,
      ).toBe(true)
      // End-to-end: a runtime id of a template that reskins to this
      // variant routes to its cue (longest-prefix match on
      // `<templateId>_<uuid>` ids, per resolveMonsterArtSlug).
      const templateId = Object.entries(ENEMY_RESKIN_MAP).find(
        ([, slug]) => slug === v.slug,
      )?.[0]
      expect(templateId, `no ENEMY_RESKIN_MAP route to ${v.slug}`).toBeDefined()
      expect(cueForAttack({ sourceId: `${templateId}_rt1` }), cueId).toBe(cueId)
    }

    // music.home.* mirrors THANH_VAN_TIMES.
    const bgSrc = readFileSync(
      join(process.cwd(), 'src/presentation/background/BackgroundVariant.ts'),
      'utf8',
    )
    const times = [
      ...bgSrc
        .match(/THANH_VAN_TIMES\s*=\s*\[([^\]]+)\]/)![1]!
        .matchAll(/['"`]([^'"`]+)['"`]/g),
    ].map((m) => m[1]!)
    expect(
      keys
        .filter((k) => k.startsWith('music.home.'))
        .map((k) => k.slice('music.home.'.length))
        .sort(),
    ).toEqual(times.sort())
  })
})
