// Pure helpers for cmdQualify -- separated from the CLI main so tests can
// exercise the counted-oracle contract without spawning a nested node --test
// (a test run inside a test worker exits silently; see F-PU30-04).

// Parse TAP summary counters. Returns nulls when the expected reporter did
// not emit the counters -- callers must treat missing counters as a failure,
// never as a pass.
export function parseOrchestratorCounts(out) {
  const pass = /# pass (\d+)/.exec(out);
  const fail = /# fail (\d+)/.exec(out);
  return {
    passed: pass ? Number(pass[1]) : 0,
    // nonzero exit with no counters => reporter mismatch/crash => -1 (failing)
    failed: fail ? Number(fail[1]) : null,
  };
}

// Gap list for the qualification verdict. A counted verdict requires a
// positive denominator: zero observed tests or missing counters refuse the
// verdict (QAI-08 / L-022).
export function qualifyGaps({ passed, failed, exitCode, sentinelOk }) {
  const gaps = [];
  const failedCount = failed ?? (passed === 0 && exitCode !== 0 ? -1 : 0);
  if (failedCount !== 0) gaps.push(`orchestrator suite: ${failedCount} failing`);
  if (passed <= 0) gaps.push(`orchestrator suite: 0 tests observed (exit ${exitCode}) -- parser/reporter mismatch or empty suite; refusing vacuous verdict`);
  if (!sentinelOk) gaps.push("reviewer-isolation sentinel: <2 sealed isolated reviewer results recorded");
  return { gaps, failedCount };
}
