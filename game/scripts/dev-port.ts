// Per-checkout dev port (audit T7-62): a stable hash of the checkout root
// directory so parallel worktrees get distinct ports without bookkeeping,
// and strictPort can stay on. DEV_PORT env still overrides for pinning.
export function devPortForRoot(rootDir: string): number {
  let hash = 0
  for (const char of rootDir) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return 5300 + (Math.abs(hash) % 700)
}
