// Internal Fixed-Point QA Protocol - run state, manifest identity, CAS journal, lease, messaging.
// Sole ledger writer: the coordinator (this process, while holding the lease).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const SCHEMA_VERSION = 2;
export const SCHEMA_VERSION_V1 = 1;
export const TERMINAL_FINDING_STATUSES = new Set(["CLOSED", "REJECTED_WITH_PROOF", "DUPLICATE_LINKED", "HUMAN_EXCEPTION"]);
export const EXECUTED_KINDS = new Set(["EXECUTED_RUNTIME", "EXECUTED_INTEGRATION", "EXECUTED_PROPERTY", "EXECUTED_MUTATION", "EXECUTED_UNIT_STRUCTURAL"]);
export const ACTIONABLE_CLASSES = new Set(["REAL_DEFECT", "SPEC_DEFECT", "TEST_DEFECT", "COVERAGE_GAP", "DOCUMENTATION_DEFECT"]);
// Platform hard cap on concurrent agents (coordinator + workers) — mechanism-level
// ceiling, not request-configurable (agent-instructions.md §G).
export const HARD_CAPACITY_LIMIT = 5;

// Every ledger collection that carries a unique `id` — mirrors the namespaces
// MC1 dedupes over (validate.mjs). Kept in state.mjs so both the record write
// path and schedule admission enforce the same uniqueness boundary: an id
// colliding across namespaces commits schema-clean yet bricks decide forever,
// with no delete/rename recovery path (F-PU31-02).
export const ID_COLLECTIONS = [
  "invariants", "census", "findings", "evidence", "coverage", "attacks",
  "reviews", "cycles", "mutations", "corpus", "lessons", "messages",
  "consumptions", "briefs", "assignments",
];

export function ledgerIdTaken(ledger, id, exceptColl, { skipRequestIds = false } = {}) {
  if (!id) return false;
  if (ledger.run.id === id) return true;
  for (const coll of ID_COLLECTIONS) {
    if (coll === exceptColl) continue;
    if (ledger[coll]?.some((r) => r.id === id)) return true;
  }
  return !skipRequestIds && ledger.messages.some((m) => m.requestId === id);
}
// Message direction binding: ASSIGN/REPAIR_ASSIGN establish the party pair
// (coordinator -> worker). Worker replies must come from the assign recipient.
export const MSG_FROM_COORDINATOR = new Set(["ASSIGN", "REPAIR_ASSIGN", "INVALIDATE", "CANCEL", "RESUME"]);
export const MSG_FROM_WORKER = new Set(["ACK", "NEED_CONTEXT", "SEALED_RESULT", "REPAIR_RESULT", "FINDING", "BLOCKED", "STALE_RESULT"]);
export const MSG_PENDING_CREATORS = new Set(["ASSIGN", "REPAIR_ASSIGN"]);
export const MSG_TERMINAL = new Set(["SEALED_RESULT", "STALE_RESULT", "CANCEL"]);

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function objectHash(obj) {
  return sha256hex(Buffer.from(canonicalize(obj), "utf8"));
}

export function fileHashHex(filePath) {
  return sha256hex(fs.readFileSync(filePath));
}

export function hashFileSet(rootDir, relPaths) {
  const entries = relPaths.map((p) => {
    const abs = path.join(rootDir, p);
    if (!fs.existsSync(abs)) throw new Error(`identity input missing: ${p}`);
    return { path: p, hash: fileHashHex(abs) };
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return objectHash(entries);
}

const DEFAULT_EXCLUDE_DIRS = new Set([".git", "node_modules", "dist", "dist-ssr", "coverage", ".agent-worktrees"]);
const DEFAULT_EXCLUDE_PREFIXES = [
  "docs/qa/runs/",            // evidence mailboxes are not product identity
  "docs/qa/learning/history/", // append-only lesson journal is not product identity
];

export function isExcluded(rel, extraExclude = []) {
  const top = rel.split("/")[0];
  if (DEFAULT_EXCLUDE_DIRS.has(top)) return true;
  for (const p of DEFAULT_EXCLUDE_PREFIXES.concat(extraExclude)) {
    if (rel === p.replace(/\/$/, "") || rel.startsWith(p)) return true;
  }
  return false;
}

function walk(dir, root, out, extraExclude) {
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (isExcluded(rel, extraExclude)) continue;
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      const target = fs.readlinkSync(abs);
      const resolved = path.resolve(dir, target);
      if (!resolved.startsWith(path.resolve(root))) {
        throw new Error(`symlink escapes checkout: ${rel}`);
      }
      out.push({ path: rel, kind: "symlink", mode: st.mode, hash: sha256hex(Buffer.from(target, "utf8")) });
    } else if (st.isDirectory()) {
      walk(abs, root, out, extraExclude);
    } else if (st.isFile()) {
      out.push({ path: rel, kind: "file", mode: st.mode, hash: fileHashHex(abs) });
    }
  }
}

export function buildManifest(rootDir, { extraExclude = [] } = {}) {
  const entries = [];
  walk(rootDir, rootDir, entries, extraExclude);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = { version: 1, rootKind: "checkout", entries };
  manifest.productStateId = objectHash(entries);
  return manifest;
}

export function computeEnvironmentId(envFile) {
  return fileHashHex(envFile);
}

export function utcNow() {
  return new Date().toISOString();
}

export function runDir(qaRoot, runId) {
  // absolute path = explicit run dir (tests/tooling); otherwise runs/<id> under qaRoot.
  // A relative id may not escape the runs/ root.
  if (path.isAbsolute(runId)) return runId;
  if (!runId || /[/\\]/.test(runId) || runId.includes("..")) {
    throw new Error(`illegal run id (path escape): ${runId}`);
  }
  return path.join(qaRoot, "runs", runId);
}

export function newLedger(request) {
  const runId = request.runId;
  return {
    schemaVersion: SCHEMA_VERSION,
    run: {
      id: runId,
      createdAt: utcNow(),
      scope: "AGGREGATE_REPOSITORY",
      authorizedRepairs: request.authorizedRepairs ?? [],
      nonGoals: request.nonGoals ?? [],
      checkout: request.checkout ?? "",
      branch: request.branch ?? "",
      base: request.base ?? "",
      head: request.head ?? "",
      state: { productStateId: "", contractId: "", attackModelId: "", environmentId: "" },
      manifestPath: "manifest.json",
      environmentPath: request.environmentPath ?? "environment.json",
      learningPolicyId: request.learningPolicyId ?? objectHash(null),
      consumedLessonIds: request.consumedLessonIds ?? [],
      aggregateParents: request.aggregateParents ?? [],
      requiredDomains: request.requiredDomains ?? [],
      exclusions: request.exclusions ?? [],
      briefIds: request.briefIds ?? [],
      capacityLimit: request.capacityLimit ?? 5,
      requiredReadiness: request.requiredReadiness ?? true,
      phase: "INTAKE",
      cleanRoundA: null,
      cleanRoundB: null,
      finalEvidenceIds: [],
      outcome: null,
    },
    briefs: [],
    assignments: [],
    consumptions: [],
    invariants: [],
    census: [],
    findings: [],
    evidence: [],
    coverage: [],
    attacks: [],
    reviews: [],
    cycles: [],
    mutations: [],
    corpus: [],
    lessons: [],
    messages: [],
    events: [],
  };
}

export function ledgerPath(dir) {
  return path.join(dir, "ledger.json");
}

export function loadLedger(dir) {
  const p = ledgerPath(dir);
  if (!fs.existsSync(p)) throw new Error(`no ledger at ${p} — run \`qa:internal init\` first`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function saveLedgerAtomic(dir, ledger) {
  const p = ledgerPath(dir);
  const tmp = `${p}.tmp-${process.pid}`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, JSON.stringify(ledger, null, 2) + "\n");
    fs.fsyncSync(fd); // durability: flush before the atomic rename
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, p);
}

export function acquireLease(dir, leaseId) {
  const p = path.join(dir, "lease.json");
  const record = { leaseId, acquiredAt: utcNow(), pid: process.pid };
  try {
    fs.writeFileSync(p, JSON.stringify(record, null, 2), { flag: "wx" });
  } catch (e) {
    if (e.code === "EEXIST") {
      const held = JSON.parse(fs.readFileSync(p, "utf8"));
      throw new Error(`lease already held by ${held.leaseId} (acquired ${held.acquiredAt}) — a second coordinator cannot take ownership; recover by explicit lease removal + state revalidation`);
    }
    throw e;
  }
  return record;
}

export function checkLease(dir, leaseId) {
  const p = path.join(dir, "lease.json");
  if (!fs.existsSync(p)) throw new Error("no lease — init must acquire one first");
  const held = JSON.parse(fs.readFileSync(p, "utf8"));
  if (held.leaseId !== leaseId) {
    throw new Error(`lease held by ${held.leaseId}, not ${leaseId}`);
  }
  return held;
}

function eventPayloadPath(dir, seq) {
  return path.join("events", `${String(seq).padStart(4, "0")}.json`);
}

// Build the next hash-chained event: writes the payload file and pushes the
// event onto ledger.events, but does NOT touch journal.jsonl or ledger.json.
// Callers persist via commitLedger (CAS-checked save, then journal append).
export function buildEvent(dir, ledger, { kind, actor, state, payload }) {
  const seq = ledger.events.length + 1;
  const rel = eventPayloadPath(dir, seq);
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const payloadBytes = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
  fs.writeFileSync(abs, payloadBytes);
  const payloadHash = sha256hex(payloadBytes);
  const previousEventHash = seq === 1 ? null : ledger.events[ledger.events.length - 1].eventHash;
  const event = {
    seq,
    at: utcNow(),
    kind,
    actor,
    state: { ...state },
    previousEventHash,
    payloadPath: rel.split(path.sep).join("/"),
    payloadHash,
    eventHash: "",
  };
  const forHash = { ...event }; delete forHash.eventHash;
  event.eventHash = objectHash(forHash);
  ledger.events.push(event);
  return event;
}

export function writeJournalLine(dir, event) {
  fs.appendFileSync(path.join(dir, "journal.jsonl"), JSON.stringify(event) + "\n");
}

// The single commit path for ledger mutations: build the event (payload file),
// CAS-check the on-disk event count against the loaded baseline, save
// atomically, then append the journal line. Journal is derived from
// ledger.events — a crash leaves ledger-ahead-of-journal (reconstructible),
// never journal-ahead-of-ledger (unverifiable).
export function commitLedger(dir, ledger, spec) {
  const baseline = ledger.events.length;
  const event = buildEvent(dir, ledger, spec);
  const onDisk = fs.existsSync(ledgerPath(dir))
    ? JSON.parse(fs.readFileSync(ledgerPath(dir), "utf8")).events.length
    : 0;
  if (onDisk !== baseline) {
    throw new Error(`CAS reject: ledger on disk is at seq ${onDisk} but this process loaded ${baseline} — another writer committed; reload and reconcile`);
  }
  saveLedgerAtomic(dir, ledger);
  writeJournalLine(dir, event);
  return event;
}

export function appendEvent(dir, ledger, { kind, actor, state, payload, expectedSeq }) {
  const seq = ledger.events.length + 1;
  if (expectedSeq != null && expectedSeq !== seq) {
    throw new Error(`CAS reject: expected seq ${expectedSeq} but ledger is at ${seq} — another coordinator wrote; reload and reconcile`);
  }
  const event = buildEvent(dir, ledger, { kind, actor, state, payload });
  writeJournalLine(dir, event);
  return event;
}

export function recordMessage(ledger, msg) {
  const st = ledger.run.state;
  // Declared runId is verified, never silently rewritten (a foreign-run message
  // must be rejected, not absorbed).
  if (msg.runId !== ledger.run.id) {
    throw new Error(`message ${msg.id}: declared runId ${msg.runId} does not match run ${ledger.run.id}`);
  }
  if (!msg.state || typeof msg.state !== "object") {
    throw new Error(`message ${msg.id}: state tuple required — a message without state binding cannot be evaluated for staleness`);
  }
  const msgStale =
    msg.state.productStateId !== st.productStateId ||
    msg.state.contractId !== st.contractId ||
    msg.state.attackModelId !== st.attackModelId ||
    msg.state.environmentId !== st.environmentId;
  const existing = ledger.messages.find((m) => m.id === msg.id);
  if (existing) {
    if (existing.payloadHash !== msg.payloadHash) {
      throw new Error(`integrity error: message ${msg.id} delivered with different payloadHash`);
    }
    return { duplicate: true };
  }
  // A request is created only by ASSIGN/REPAIR_ASSIGN — the pending request.
  const prior = ledger.messages.filter((m) => m.requestId === msg.requestId);
  const opener = prior.find((m) => MSG_PENDING_CREATORS.has(m.kind));
  if (MSG_PENDING_CREATORS.has(msg.kind)) {
    if (opener) throw new Error(`request ${msg.requestId} already opened by ${opener.id} — use parentRequestId for linked work`);
  } else {
    if (!opener) {
      throw new Error(`message ${msg.id}: requestId ${msg.requestId} has no ASSIGN — traffic requires a pending request`);
    }
    // Direction binding: coordinator kinds come from the opener's sender,
    // worker kinds come from the opener's recipient.
    if (MSG_FROM_COORDINATOR.has(msg.kind)) {
      if (msg.sender !== opener.sender || msg.recipient !== opener.recipient) {
        throw new Error(`message ${msg.id}: coordinator-side kind ${msg.kind} must be ${opener.sender} -> ${opener.recipient}`);
      }
    } else if (MSG_FROM_WORKER.has(msg.kind)) {
      if (msg.sender !== opener.recipient || msg.recipient !== opener.sender) {
        throw new Error(`message ${msg.id}: worker-side kind ${msg.kind} must be ${opener.recipient} -> ${opener.sender}`);
      }
    } else {
      throw new Error(`message ${msg.id}: unknown kind ${msg.kind}`);
    }
  }
  // Terminal semantics: exactly one effective terminal per requestId. Stale
  // messages are recorded flagged and never establish or conflict a terminal —
  // a stale SEALED_RESULT cannot poison the request.
  const terminals = prior.filter((m) => MSG_TERMINAL.has(m.kind) && !m.stale);
  if (MSG_TERMINAL.has(msg.kind) && !msgStale) {
    const priorT = terminals[0];
    if (priorT) {
      if (priorT.kind === msg.kind && priorT.payloadHash === msg.payloadHash) {
        return { duplicate: true }; // identical terminal replay, idempotent regardless of message id
      }
      throw new Error(`conflicting terminal ${msg.kind} for request ${msg.requestId} — requires a new linked request (parentRequestId)`);
    }
  } else if (terminals.length && !msgStale) {
    throw new Error(`message ${msg.id}: request ${msg.requestId} is closed by terminal ${terminals[0].id} — new work requires a linked request`);
  }
  if (msgStale) msg.stale = true; // persisted — downstream can distinguish, audit can count
  ledger.messages.push(msg);
  return { duplicate: false, stale: !!msgStale };
}

export function invalidateForNewState(ledger, newState) {
  const stale = { evidence: 0, reviews: 0, cycles: 0, coverage: 0 };
  const isCurrent = (s) =>
    s.productStateId === newState.productStateId &&
    s.contractId === newState.contractId &&
    s.attackModelId === newState.attackModelId &&
    s.environmentId === newState.environmentId;
  for (const e of ledger.evidence) {
    if (!isCurrent(e.state)) { e.status = "STALE"; stale.evidence++; }
  }
  for (const r of ledger.reviews) {
    if (!isCurrent(r.state)) { r.status = "STALE"; stale.reviews++; }
  }
  for (const c of ledger.cycles) {
    if (!isCurrent(c.state)) { c.status = "STALE"; stale.cycles++; }
  }
  // Transitive: evidence depending on stale evidence is stale too.
  let changed = true;
  const evById = new Map(ledger.evidence.map((e) => [e.id, e]));
  while (changed) {
    changed = false;
    for (const e of ledger.evidence) {
      if (e.status === "STALE") continue;
      for (const dep of e.inputEvidenceIds) {
        const d = evById.get(dep);
        if (d && d.status === "STALE") { e.status = "STALE"; stale.evidence++; changed = true; break; }
      }
    }
  }
  // Coverage cells lose satisfied status when their evidence went stale.
  for (const c of ledger.coverage) {
    if (c.status === "SATISFIED" && c.evidenceIds.some((id) => evById.get(id)?.status === "STALE")) {
      c.status = "STALE"; stale.coverage++;
    }
  }
  ledger.run.cleanRoundA = null;
  ledger.run.cleanRoundB = null;
  return stale;
}
