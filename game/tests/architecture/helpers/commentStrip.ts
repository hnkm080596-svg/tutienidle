import * as ts from 'typescript'

// Shared comment stripper for the audio architecture guards. Uses the
// real TypeScript parser for comment extraction so strings, template
// literals with `${}` interpolation, regex literals, and escapes are all
// tokenized correctly - a hand-rolled char scanner cannot (it desyncs on
// `'-'` inside `${}` and lets '<!--'/'-->' string literals pair up to
// delete real code). For .vue files only the <script> blocks are
// analyzed: template HTML comments and markup never reach the guards'
// regexes, and emit()/cue() calls in this codebase live in <script>.
export function uncommented(fileText: string, fileName = 'file.ts'): string {
  const text = scriptOf(fileName, fileText)
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const ranges: ts.CommentRange[] = []
  const collect = (pos: number, end: number): void => {
    for (const r of ts.getLeadingCommentRanges(text, pos) ?? []) ranges.push(r)
    for (const r of ts.getTrailingCommentRanges(text, end) ?? []) ranges.push(r)
  }
  const visit = (node: ts.Node): void => {
    collect(node.pos, node.end)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  ranges.sort((a, b) => a.pos - b.pos)
  let out = ''
  let pos = 0
  for (const r of ranges) {
    if (r.pos > pos) out += text.slice(pos, r.pos)
    pos = Math.max(pos, r.end)
  }
  return out + text.slice(pos)
}

function scriptOf(fileName: string, text: string): string {
  if (!fileName.endsWith('.vue')) return text
  const blocks: string[] = []
  for (const m of text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) blocks.push(m[1]!)
  return blocks.join('\n')
}
