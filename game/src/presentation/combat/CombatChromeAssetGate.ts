import { nextTick } from 'vue'
import { skillIconPath } from '@/data/skill/SkillIconManifest'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { CoordinatorSnapshot } from '@/presentation/PresentationContracts'

export interface CombatChromeSkillRef {
  readonly id: string
}

export interface CombatChromeActorView {
  readonly basic?: CombatChromeSkillRef | null
  readonly special?: { readonly skill?: CombatChromeSkillRef | null } | null
  readonly ultimate?: { readonly skill?: CombatChromeSkillRef | null } | null
}

export interface CombatChromeAssetGateTarget {
  registerFreezeLatchTruth(reason: 'ui-assets', isHeld: () => boolean): () => void
  freezeCombat(reason: 'ui-assets'): void
  resumeCombat(reason: 'ui-assets'): void
  getTurnBattle?(): { readonly players?: readonly CombatChromeActorView[] } | null
}

export interface CombatChromeSnapshotSource {
  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void
}

let activeTarget: CombatChromeAssetGateTarget | null = null
let currentRoot: HTMLElement | null = null
let assetsPending = false
let currentGeneration = 0

function collectRootAssetUrls(root: HTMLElement): Set<string> {
  const urls = new Set<string>()
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    if (node instanceof HTMLImageElement && node.src) {
      urls.add(node.src)
    }
    if (typeof getComputedStyle === 'function') {
      for (const pseudo of [null, '::before', '::after'] as const) {
        const bg = getComputedStyle(node, pseudo).backgroundImage ?? ''
        for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          if (match[1]) urls.add(match[1])
        }
      }
    }
  }
  return urls
}

function collectBattleSkillIconUrls(target: CombatChromeAssetGateTarget | null): string[] {
  const urls: string[] = []
  for (const actor of target?.getTurnBattle?.()?.players ?? []) {
    for (const skill of [actor.basic, actor.special?.skill, actor.ultimate?.skill]) {
      const icon = skill && skillIconPath(turnSkillDisplayMetaOf(skill.id)?.iconKey)
      if (icon) {
        urls.push(resolveAssetUrl(icon))
      }
    }
  }
  return urls
}

async function decodeImageUrl(url: string): Promise<void> {
  if (typeof Image === 'undefined') return
  const image = new Image()
  image.src = url
  if (typeof image.decode === 'function') {
    await image.decode()
  }
}

async function prepareCombatChromeAssets(generation: number): Promise<void> {
  await nextTick()
  const root = currentRoot
  if (!root || generation !== currentGeneration) return

  const urls = collectRootAssetUrls(root)
  for (const iconUrl of collectBattleSkillIconUrls(activeTarget)) {
    urls.add(iconUrl)
  }

  await Promise.allSettled([...urls].map((url) => decodeImageUrl(url)))
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready
  }

  if (generation === currentGeneration) {
    assetsPending = false
    activeTarget?.resumeCombat('ui-assets')
  }
}

function armCombatChromeGate(): void {
  if (!currentRoot) return
  const generation = ++currentGeneration
  assetsPending = true
  activeTarget?.freezeCombat('ui-assets')
  void prepareCombatChromeAssets(generation)
}

function releaseCombatChromeGate(): void {
  currentGeneration++
  assetsPending = false
  activeTarget?.resumeCombat('ui-assets')
}

/**
 * Registers the mounted combat overlay DOM root with the presentation-owned
 * `ui-assets` readiness gate. Returns an unmount cleanup callback.
 */
export function mountCombatChromeRoot(root: HTMLElement | null): () => void {
  currentRoot = root
  if (root) {
    armCombatChromeGate()
  }
  return () => {
    if (currentRoot === root) {
      currentRoot = null
      releaseCombatChromeGate()
    }
  }
}

/**
 * Binds the presentation coordinator and GameManager combat clock latch to the
 * combat chrome asset readiness gate. Owned by the presentation layer (wired in App.vue).
 */
export function bindCombatChromeAssetGate(
  coordinator: CombatChromeSnapshotSource,
  target: CombatChromeAssetGateTarget,
): () => void {
  activeTarget = target
  const unregisterLatch = target.registerFreezeLatchTruth('ui-assets', () => assetsPending)
  if (currentRoot && assetsPending) {
    target.freezeCombat('ui-assets')
  }

  let lastCombatSessionId: number | null = null
  const unsubscribe = coordinator.subscribe((snapshot) => {
    const candidateSession =
      snapshot.targetSession?.kind === 'combat'
        ? snapshot.targetSession
        : snapshot.currentSession?.kind === 'combat'
          ? snapshot.currentSession
          : null
    const sessionId = candidateSession?.sessionId ?? null
    const inCombat = snapshot.renderRoute === 'combat' || snapshot.currentRoute === 'combat'

    if (!inCombat) {
      lastCombatSessionId = null
      if (assetsPending) {
        releaseCombatChromeGate()
      }
      return
    }

    if (sessionId !== null && sessionId !== lastCombatSessionId) {
      lastCombatSessionId = sessionId
      if (currentRoot) {
        armCombatChromeGate()
      }
    }
  })

  return () => {
    unsubscribe()
    releaseCombatChromeGate()
    unregisterLatch()
    if (activeTarget === target) {
      activeTarget = null
    }
  }
}
