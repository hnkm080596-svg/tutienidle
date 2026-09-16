// Route-witness guard — the test that would have caught the
// "Renderer readiness timed out" boot regression (error route, 2026-09-16).
//
// Root cause that prompted this file: App.vue's entry-stage if-chain had
// `<SaveIncompatibleScreen v-else-if="saveIssue.status" />` sitting BEFORE
// `<RouteMount v-else-if="entryStage === 'error'" route="error">` in the same
// sibling chain. With an incompatible/corrupted save, `entryStage === 'error'`
// and `saveIssue.status` were both true, so the SaveIncompatibleScreen branch
// matched first — and the RouteMount('error') witness never mounted.
// CompositeRenderer.prepare() waits on markRouteMounted('error') for the
// readiness contract, so the transition sat until the prepareReady deadline
// and the error card read "Renderer readiness timed out" - forever, because
// retry re-entered the identical state. Worse, the SaveIncompatibleScreen
// (the only UI offering export/reset recovery) rendered BEHIND the closed
// curtain, invisible.
//
// The invariant this guards (docs/spec + coordinator contract):
//   For every presentation route R, the Vue subtree representing R mounts
//   through exactly one RouteMount witness. A UI VARIANT of a route (error +
//   incompatible save vs error + generic boot error) is not a different
//   route identity - variants nest INSIDE the route's RouteMount, never as
//   sibling branches that can shadow the witness.
//
// Same static-guard philosophy as App.wiring.test.ts: parse the real App.vue
// template with @vue/compiler-sfc + @vue/compiler-dom and assert structure.
// It does not prove the transition works (the live browser run does that) -
// it proves a route branch cannot lose its mount witness to a shadowing
// sibling again.

// @ts-expect-error project omits Node ambient types by design (pattern: App.wiring.test.ts)
import { readFileSync } from 'node:fs'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { parse as parseTemplate, type ElementNode, type Node } from '@vue/compiler-dom'
import { describe, expect, it } from 'vitest'

const APP_VUE_PATH = fileURLToPath(new URL('./App.vue', import.meta.url))

interface Branch {
  tag: string
  /** 'if' | 'else-if' | 'else' — 'else' marks the chain's catch-all. */
  kind: 'if' | 'else-if' | 'else'
  /** Raw condition expression for if/else-if branches (e.g. "entryStage === 'auth'"). */
  condition?: string
  /** The element's `route` attribute/prop value when statically bound, e.g. 'error'. */
  routeProp?: string
}

function readTemplateAst(): Node[] {
  const raw = readFileSync(APP_VUE_PATH, 'utf-8')
  const { descriptor } = parseSFC(raw, { filename: APP_VUE_PATH })

  if (!descriptor.template) {
    throw new Error('App.vue has no <template> block - this guard assumes it exists.')
  }

  return parseTemplate(descriptor.template.content).children
}

function directiveOf(el: ElementNode, name: string): string | undefined {
  const prop = el.props.find(
    (p): p is Extract<typeof p, { type: 7 }> => p.type === 7 && p.name === name,
  )
  return prop?.exp?.type === 4 ? prop.exp.content : undefined
}

function staticRouteProp(el: ElementNode): string | undefined {
  for (const prop of el.props) {
    // Plain `route="error"` attribute.
    if (prop.type === 6 && prop.name === 'route') {
      return prop.value?.content
    }
    // `:route="'error'"` or v-bind shorthand.
    if (
      prop.type === 7 &&
      prop.name === 'bind' &&
      prop.arg?.type === 4 &&
      prop.arg.content === 'route' &&
      prop.exp?.type === 4
    ) {
      return prop.exp.content.replace(/^['"`]|['"`]$/g, '')
    }
  }
  return undefined
}

function elementChildren(nodes: Node[]): ElementNode[] {
  return nodes.filter((n): n is ElementNode => n.type === 1)
}

/**
 * Collect the root-level v-if/v-else-if/v-else sibling chains of App.vue's
 * template. A chain starts at an element carrying `v-if` and continues over
 * following siblings while they carry `v-else-if`/`v-else`.
 */
function collectIfChains(nodes: Node[]): Branch[][] {
  const elements = elementChildren(nodes)
  const chains: Branch[][] = []
  let current: Branch[] | null = null

  for (const el of elements) {
    const ifCond = directiveOf(el, 'if')
    const elseIfCond = directiveOf(el, 'else-if')
    const hasElse = el.props.some((p) => p.type === 7 && p.name === 'else')

    if (ifCond !== undefined) {
      current = [{ tag: el.tag, kind: 'if', condition: ifCond, routeProp: staticRouteProp(el) }]
      chains.push(current)
      continue
    }

    if (elseIfCond !== undefined && current) {
      current.push({ tag: el.tag, kind: 'else-if', condition: elseIfCond, routeProp: staticRouteProp(el) })
      continue
    }

    if (hasElse && current) {
      current.push({ tag: el.tag, kind: 'else', routeProp: staticRouteProp(el) })
      current = null
      continue
    }

    current = null
  }

  return chains
}

function isElement(node: Node): node is ElementNode {
  return node.type === 1
}

/** Find every element with the given tag anywhere in the subtree, with its ancestor tags. */
function findDescendants(
  nodes: Node[],
  tag: string,
  ancestors: ElementNode[] = [],
): Array<{ el: ElementNode; ancestors: ElementNode[] }> {
  const found: Array<{ el: ElementNode; ancestors: ElementNode[] }> = []

  for (const node of nodes) {
    if (!isElement(node)) continue
    if (node.tag === tag) {
      found.push({ el: node, ancestors })
    }
    found.push(...findDescendants(node.children, tag, [...ancestors, node]))
  }

  return found
}

/**
 * The entry-stage chain is the if-chain whose first branch guards on
 * `entryStage === 'intro'` (the boot LoadingScreen). It is the ONLY chain in
 * the app where coordinator routes map to mounted subtrees.
 */
function findEntryStageChain(chains: Branch[][]): Branch[] {
  const chain = chains.find(
    (c) => c[0]?.kind === 'if' && /entryStage\s*===\s*'intro'/.test(c[0].condition ?? ''),
  )

  if (!chain) {
    throw new Error(
      "Could not find the entry-stage if-chain (first branch: v-if=\"entryStage === 'intro'\"). " +
        'App.vue restructured - review whether this guard still covers the route-witness invariant.',
    )
  }

  return chain
}

describe('App.vue route-witness invariant — every renderRoute has exactly one RouteMount witness', () => {
  const ast = readTemplateAst()
  const entryStageChain = findEntryStageChain(collectIfChains(ast))

  it('every branch in the entry-stage chain is a RouteMount (or the trailing catch-all)', () => {
    for (const branch of entryStageChain) {
      // The terminal `v-else` catch-all (ErrorBoundary wrapping the game
      // branch) is allowed to be a non-RouteMount element - it is not a
      // route, it is the fallback for the game stage.
      const isCatchAll = branch.kind === 'else'

      expect(
        branch.tag === 'RouteMount' || isCatchAll,
        `Entry-stage branch <${branch.tag}> (condition: ${branch.condition ?? 'v-else'}) ` +
          'renders route content WITHOUT a RouteMount witness. Any sibling branch placed ' +
          'before a RouteMount in this chain can shadow the witness - the coordinator then ' +
          'waits forever for markRouteMounted() and the transition dies as ' +
          '"Renderer readiness timed out". Route UI variants (e.g. an incompatible-save ' +
          'screen) must nest INSIDE the route\'s <RouteMount>, never sit as siblings.',
      ).toBe(true)
    }
  })

  it('every entryStage-conditioned RouteMount declares the coordinator route it witnesses', () => {
    // entryStage is the boot facade's vocabulary, not the coordinator's:
    // 'intro' stands in for route 'boot'; the game stage covers home/combat/
    // tribulation via GameRoot's own RouteMount. Only these stage branches
    // exist in this chain.
    const stageToRoute: Record<string, string> = {
      intro: 'boot',
      auth: 'auth',
      character: 'character',
      error: 'error',
    }

    for (const branch of entryStageChain) {
      if (branch.tag !== 'RouteMount' || !branch.condition) continue

      const stageMatch = /entryStage\s*===\s*'([a-z]+)'/.exec(branch.condition)
      const stage = stageMatch?.[1]
      if (!stage) continue

      const expectedRoute = stageToRoute[stage]
      if (!expectedRoute) continue

      expect(
        branch.routeProp,
        `<RouteMount> branch guarded by "${branch.condition}" does not declare route="${expectedRoute}". ` +
          'A mismatched witness reports the wrong route readiness.',
      ).toBe(expectedRoute)
    }
  })

  it('SaveIncompatibleScreen is nested inside the error RouteMount witness', () => {
    const occurrences = findDescendants(ast, 'SaveIncompatibleScreen')

    expect(
      occurrences.length,
      'SaveIncompatibleScreen must exist in App.vue (the save-issue gate UI).',
    ).toBeGreaterThan(0)

    for (const { ancestors } of occurrences) {
      const enclosingWitness = [...ancestors].reverse().find(
        (a: ElementNode) => a.tag === 'RouteMount',
      )

      expect(
        enclosingWitness && staticRouteProp(enclosingWitness) === 'error',
        'SaveIncompatibleScreen must render INSIDE <RouteMount route="error"> - it is a ' +
          'content VARIANT of the error route, not a route of its own. As a chain sibling ' +
          'it can match before the error RouteMount branch and silently remove the mount ' +
          'witness, hanging every incompatible/corrupted-save boot on ' +
          '"Renderer readiness timed out" with no way to reach the export/reset UI.',
      ).toBe(true)
    }
  })
})
