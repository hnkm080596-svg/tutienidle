// Internal Fixed-Point QA Protocol - runner CLI.
// Usage: npm run qa:internal -- <command> [flags]
//   init      --request <file>          create runs/<runId>/ with request + lease + PHASE event
//   snapshot  --run <id>                build manifest, set state identity, invalidate stale
//   record    --run <id> --input <file> append ledger records (invariant/census/finding/evidence/...)
//   validate  --run <id> [--state]      schema + machine checks; exit 1 on any failure
//   decide    --run <id>                evaluate terminal predicate; write DECISION event + outcome
//   render    --run <id>                write runs/<id>/report.md
//   qualify                            run orchestrator attack suite + corpus checks; print verdict
//   prepare   --task <file> [--out f]   deterministic lesson routing + construction brief draft
//   preflight --brief <file>            brief readiness verdict (READY_TO_DECLARE | BLOCKED)
//   checkpoint --brief <f> --state <f>  brief revision on state drift
//   learn     --run <id> --input <file> lesson facet transition / policy publication
//   schedule  --run <id> --input <file> capacity admission (admit) / lifecycle release (observe)
//   migrate   --run <id>                v1 -> v2 ledger migration for a RESUMED run
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  newLedger, loadLedger, saveLedgerAtomic, acquireLease, checkLease, appendEvent,
  commitLedger, recordMessage, invalidateForNewState, buildManifest, hashFileSet,
  computeEnvironmentId, objectHash, runDir, SCHEMA_VERSION_V1,
  TERMINAL_FINDING_STATUSES, ledgerIdTaken,
} from "./state.mjs";
import {
  loadLessonsJsonl, routeLessons, draftBrief, preflightBrief, checkpointBrief,
  admitAssignment, observeAssignment, applyLearningAction, publishPolicy,
  loadActivePolicy, migrateLedgerV1toV2, ASSIGNMENT_ACTIVE, ASSIGNMENT_TERMINAL,
} from "./prevention.mjs";
import { validateLedger, validateStructure } from "./validate.mjs";
import { parseOrchestratorCounts, qualifyGaps } from "./qualify.mjs";
import { decide, renderReport } from "./decision.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const QA_ROOT = path.join(GAME_ROOT, "docs", "qa");

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) { args[k] = argv[++i]; }
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function resolveInRun(dir, rel) {
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(path.resolve(dir) + path.sep)) throw new Error(`path escapes run dir: ${rel}`);
  return abs;
}

function productRoot(request) {
  return path.isAbsolute(request.productRoot) ? request.productRoot : path.resolve(GAME_ROOT, request.productRoot ?? ".");
}

function cmdInit(args) {
  const reqPath = path.resolve(args.request);
  const request = readJson(reqPath);
  if (!request.runId) throw new Error("request.runId required");
  const dir = runDir(QA_ROOT, request.runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  fs.mkdirSync(path.join(dir, "reviews"), { recursive: true });
  fs.mkdirSync(path.join(dir, "events"), { recursive: true });
  const leaseId = args.lease ?? `coordinator-${process.pid}`;
  acquireLease(dir, leaseId);
  fs.copyFileSync(reqPath, path.join(dir, "request.json"));
  if (request.productRoot && !fs.existsSync(productRoot(request))) {
    throw new Error(`productRoot missing: ${request.productRoot}`);
  }
  const ledger = newLedger(request);
  const placeholder = { productStateId: objectHash("unsnapshotted"), contractId: objectHash("unsnapshotted"), attackModelId: objectHash("unsnapshotted"), environmentId: objectHash("unsnapshotted") };
  appendEvent(dir, ledger, { kind: "PHASE", actor: leaseId, state: placeholder, payload: { phase: "INTAKE", request } });
  saveLedgerAtomic(dir, ledger); // init: no baseline to CAS against
  console.log(`initialized run ${request.runId} at ${path.relative(GAME_ROOT, dir)} (lease ${leaseId})`);
}

function cmdSnapshot(args) {
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const request = readJson(path.join(dir, "request.json"));
  const root = productRoot(request);
  const manifest = buildManifest(root, { extraExclude: request.extraExclude ?? [] });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const contractId = hashFileSet(root, request.contractPaths ?? ["AGENTS.md", "docs/qa/protocol/README.md"]);
  const attackModelPath = resolveInRun(dir, request.attackModelPath ?? "attack-model.json");
  if (!fs.existsSync(attackModelPath)) {
    throw new Error(`attack model missing at ${path.relative(dir, attackModelPath)} — write the run's attack manifest first`);
  }
  const envPath = resolveInRun(dir, ledger.run.environmentPath);
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, JSON.stringify({
      tools: { node: process.version }, os: process.platform, profile: "unprofiled",
      note: "declare real environment profile; 'unprofiled' cannot satisfy a runtime-dependent cell",
    }, null, 2) + "\n");
  }
  const newState = {
    productStateId: manifest.productStateId,
    contractId,
    attackModelId: objectHash(JSON.parse(fs.readFileSync(attackModelPath, "utf8"))),
    environmentId: computeEnvironmentId(envPath),
  };
  const changed = !shallowStateEq(ledger.run.state, newState);
  let stale = null;
  if (changed && ledger.run.state.productStateId) {
    stale = invalidateForNewState(ledger, newState);
  }
  ledger.run.state = newState;
  ledger.run.phase = "SNAPSHOT";
  commitLedger(dir, ledger, { kind: "SNAPSHOT", actor: leaseId, state: newState, payload: { state: newState, invalidated: stale } });
  console.log(`state product=${newState.productStateId.slice(0, 12)} contract=${newState.contractId.slice(0, 12)} attack=${newState.attackModelId.slice(0, 12)} env=${newState.environmentId.slice(0, 12)}${stale ? ` invalidated ${JSON.stringify(stale)}` : ""}`);
}

function shallowStateEq(a, b) {
  return a.productStateId === b.productStateId && a.contractId === b.contractId && a.attackModelId === b.attackModelId && a.environmentId === b.environmentId;
}

function leaseFromDir(dir) {
  const p = path.join(dir, "lease.json");
  if (!fs.existsSync(p)) return `coordinator-${process.pid}`;
  return JSON.parse(fs.readFileSync(p, "utf8")).leaseId;
}

const RECORD_COLLECTION = {
  invariant: "invariants", census: "census", finding: "findings", evidence: "evidence",
  coverage: "coverage", attack: "attacks", review: "reviews", cycle: "cycles",
  mutation: "mutations", corpus: "corpus", lesson: "lessons", message: "messages",
  brief: "briefs", consumption: "consumptions",
  // "assignment" is deliberately absent: assignments are the reservation
  // authority and may only be created/mutated through `schedule` (admission +
  // lifecycle-verified release), never via the raw record path.
};

// Records in a terminal/immutable state cannot be replaced via `record` -
// sealing is the point; correction happens through new linked records.
function assertReplaceable(kind, existing) {
  if (!existing) return;
  if (kind === "finding" && TERMINAL_FINDING_STATUSES.has(existing.status)) {
    throw new Error(`finding ${existing.id} is terminal (${existing.status}) — immutable; record a new linked finding`);
  }
  if (kind === "review" && existing.status === "SEALED") {
    throw new Error(`review ${existing.id} is SEALED — immutable; a contaminated review needs a fresh reviewer`);
  }
}

const EVENT_KIND = {
  invariant: "PHASE", census: "PHASE", finding: "FINDING", evidence: "EVIDENCE",
  coverage: "EVIDENCE", attack: "EVIDENCE", review: "REVIEW_SEALED", cycle: "EVIDENCE",
  mutation: "EVIDENCE", corpus: "EVIDENCE", lesson: "EVIDENCE", message: "EVIDENCE",
  brief: "EVIDENCE", assignment: "SCHEDULE", consumption: "EVIDENCE",
};

function cmdRecord(args) {
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const input = readJson(path.resolve(args.input));
  const records = input.records ?? [input];
  const applied = [];
  const touched = []; // [collectionName, index] pairs written by this call
  for (const rec of records) {
    const kind = rec.kind;
    if (!RECORD_COLLECTION[kind]) throw new Error(`unknown record kind: ${kind}`);
    // {kind, body:{...}} or flat {kind, ...fields}; `kind` is the routing key, not a body field
    const body = rec.body && typeof rec.body === "object" ? rec.body : Object.fromEntries(Object.entries(rec).filter(([k]) => k !== "kind"));
    if (kind === "message") {
      // declared runId is verified inside recordMessage - never silently rewritten
      body.runId = body.runId ?? ledger.run.id;
      const res = recordMessage(ledger, body);
      if (!res.duplicate) {
        // New (non-replay) message: its id and requestId join the MC1
        // namespaces - collision with another namespace bricks decide.
        if (ledgerIdTaken(ledger, body.id, "messages")) throw new Error(`message ${body.id}: id already exists in another namespace`);
        if (ledgerIdTaken(ledger, body.requestId, null, { skipRequestIds: true })) throw new Error(`message ${body.id}: requestId collides with a record id`);
        touched.push(["messages", ledger.messages.length - 1]);
      }
      applied.push(`${kind}:${body.id}${res.duplicate ? " (duplicate, idempotent)" : res.stale ? " (STALE — does not advance phase)" : ""}`);
    } else {
      const coll = ledger[RECORD_COLLECTION[kind]];
      const idx = coll.findIndex((r) => r.id === body.id);
      if (idx >= 0) {
        assertReplaceable(kind, coll[idx]);
        coll[idx] = body;
        touched.push([RECORD_COLLECTION[kind], idx]);
        applied.push(`${kind}:${body.id} (updated)`);
      } else {
        if (ledgerIdTaken(ledger, body.id, RECORD_COLLECTION[kind])) {
          throw new Error(`record ${body.id}: id already exists in another namespace — refusing (would brick MC1 with no recovery path)`);
        }
        coll.push(body);
        touched.push([RECORD_COLLECTION[kind], coll.length - 1]);
        applied.push(`${kind}:${body.id}`);
      }
    }
  }
  if (applied.length) {
    // Write-path structural validation (F-PU31-01): a record that fails the
    // schema may not be committed - previously malformed records landed and
    // later became unreachable through assertReplaceable. Attribution is by
    // (collection, index) touched during this write - id-keyed attribution
    // would miss records pushed without an id, which then become permanently
    // uncorrectable and brick the decide gate. Pre-existing failures
    // elsewhere in the ledger do not block this write.
    const touchedSet = new Set(touched.map(([c, i]) => `${c}/${i}`));
    const structural = validateStructure(ledger);
    const fresh = structural.filter((fl) => {
      const m = /^\/(\w+)\/(\d+)/.exec(fl.recordId);
      return m && touchedSet.has(`${m[1]}/${m[2]}`);
    });
    if (fresh.length) {
      console.error("record rejected — schema-invalid (run `validate` for details):");
      fresh.forEach((fl) => console.error(`  ${fl.recordId}: ${fl.reason}`));
      process.exitCode = 1;
      return;
    }
    const kinds = new Set(records.map((r) => r.kind));
    commitLedger(dir, ledger, {
      kind: kinds.size === 1 ? EVENT_KIND[records[0].kind] ?? "EVIDENCE" : "EVIDENCE",
      actor: leaseId, state: ledger.run.state,
      payload: { applied },
    });
  } else {
    console.log("recorded 0: empty input — no event appended");
    return;
  }
  console.log(`recorded ${applied.length}: ${applied.join(", ")}`);
}

function cmdValidate(args) {
  const dir = runDir(QA_ROOT, args.run);
  const ledger = loadLedger(dir);
  const request = readJson(path.join(dir, "request.json"));
  const opts = { runDir: dir, scriptDir: SCRIPT_DIR };
  if (args.state) {
    opts.checkState = { manifestRoot: productRoot(request), extraExclude: request.extraExclude ?? [] };
  }
  const failures = validateLedger(ledger, opts);
  if (failures.length) {
    for (const fl of failures) console.log(`FAIL ${fl.check} ${fl.recordId}: ${fl.reason}`);
    console.log(`\n${failures.length} failure(s)`);
    process.exitCode = 1;
  } else {
    console.log("validate: clean (schema + machine checks)");
  }
}

// Integrity checks that must pass before an outcome may be written - coverage
// gaps (MC7) and open findings (MC12) are decision *inputs*, not integrity
// failures, so they stay out of this gate.
const DECIDE_INTEGRITY_CHECKS = new Set(["SCHEMA", "MC1", "MC2", "MC14"]);

function cmdDecide(args) {
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const failures = validateLedger(ledger, { runDir: dir, scriptDir: SCRIPT_DIR });
  const integrity = failures.filter((fl) => DECIDE_INTEGRITY_CHECKS.has(fl.check));
  if (integrity.length) {
    console.log("integrity failures — decide refused (run `validate` for the full list):");
    integrity.forEach((fl) => console.log(`  ${fl.check} ${fl.recordId}: ${fl.reason}`));
    process.exitCode = 1;
    return;
  }
  // No decision may be written while reservations are still live - final
  // synthesis happens after all workers ended (agent-instructions secG).
  const live = ledger.assignments.filter((a) => ASSIGNMENT_ACTIVE.has(a.status));
  if (live.length) {
    console.log(`decide refused: ${live.length} assignment(s) still hold live slots: ${live.map((a) => `${a.id}=${a.status}`).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const { outcome, clauses, detail } = decide(ledger);
  ledger.run.outcome = outcome;
  ledger.run.phase = "DECIDE";
  commitLedger(dir, ledger, { kind: "DECISION", actor: leaseId, state: ledger.run.state, payload: { outcome, detail, clauses } });
  console.log(`outcome: ${outcome}`);
  for (const c of clauses) console.log(`  ${c.ok ? "OK  " : "UNMET"} ${c.id}: ${c.reason}`);
  console.log(`detail: ${detail}`);
}

function cmdRender(args) {
  const dir = runDir(QA_ROOT, args.run);
  const ledger = loadLedger(dir);
  const failures = validateLedger(ledger, { runDir: dir, scriptDir: SCRIPT_DIR });
  const md = renderReport(ledger, failures);
  fs.writeFileSync(path.join(dir, "report.md"), md);
  console.log(`wrote ${path.relative(GAME_ROOT, path.join(dir, "report.md"))}`);
}

function cmdQualify() {
  // Orchestrator attack suite = node --test over scripts/qa/tests (QF-01..32).
  const testDir = path.join(SCRIPT_DIR, "tests");
  let out = "";
  let code = 0;
  try {
    // TAP reporter is required: the parser reads `# pass N`/`# fail N` counters,
    // which the default spec reporter (Node >=22) does not emit - a parse miss
    // would emit a vacuous QUALIFIED verdict (F-PU30-04 / QAI-08).
    out = execFileSync(process.execPath, ["--test", "--test-reporter", "tap", path.join(testDir, "*.test.mjs")], { cwd: GAME_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, QA_QUALIFY_RUN: "1" } });
  } catch (e) {
    code = e.status ?? 1;
    out = (e.stdout ?? "") + (e.stderr ?? "");
  }
  const { passed, failed } = parseOrchestratorCounts(out);
  console.log(out.split("\n").filter((l) => /^(ok|not ok|# )/.test(l.trim())).join("\n"));
  const corpusIdx = path.join(QA_ROOT, "corpus", "index.json");
  let corpusLine = "corpus/index.json missing";
  if (fs.existsSync(corpusIdx)) {
    const idx = readJson(corpusIdx);
    const counts = {};
    for (const c of idx.entries ?? idx.cases ?? []) counts[c.status ?? "PENDING"] = (counts[c.status ?? "PENDING"] ?? 0) + 1;
    corpusLine = `corpus cases: ${JSON.stringify(counts)}`;
  }
  console.log(`\n${corpusLine}`);
  const sentinelDir = path.join(QA_ROOT, "runs", "adoption-2026-09-23", "reviews");
  const sentinelOk = fs.existsSync(sentinelDir) && fs.readdirSync(sentinelDir).filter((f) => /^sentinel-reviewer-[ab]/.test(f)).length >= 2;
  const { gaps, failedCount } = qualifyGaps({ passed, failed, exitCode: code, sentinelOk });
  console.log(`orchestrator tests: ${passed} passed, ${failedCount} failed`);
  if (gaps.length === 0) {
    console.log("\nPROTOCOL_ADOPTION_QUALIFIED");
  } else {
    console.log(`\nINCOMPLETE: ${gaps.join("; ")}`);
  }
  process.exitCode = gaps.length ? 1 : 0;
}

function learningPaths() {
  const learn = path.join(QA_ROOT, "learning");
  return {
    history: path.join(learn, "history", "lessons.jsonl"),
    policyDir: path.join(learn, "policies"),
    activePolicy: path.join(learn, "active-policy.json"),
  };
}

function cmdPrepare(args) {
  // `qa:internal prepare --task <file>` -> routing record + brief draft.
  const task = readJson(path.resolve(args.task));
  if (!task.taskId) throw new Error("task.taskId required");
  const { history, activePolicy, policyDir } = learningPaths();
  const lessons = loadLessonsJsonl(history);
  const active = fs.existsSync(activePolicy) ? loadActivePolicy(activePolicy, policyDir) : null;
  const product = args["product-root"] ? path.resolve(args["product-root"]) : GAME_ROOT;
  const routing = routeLessons(task, lessons, { productRoot: product });
  const brief = draftBrief(task, routing, {
    policyHash: active?.policyHash ?? objectHash("no-policy"),
    planningBaseline: task.planningBaseline ?? { productStateId: "", contractId: "", attackModelId: "", environmentId: "" },
  });
  const out = { taskId: task.taskId, generatedAt: utcNowMarker(), policyHash: brief.policyHash, routing, brief };
  const outPath = args.out ? path.resolve(args.out) : null;
  if (outPath) { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n"); }
  console.log(JSON.stringify(out, null, 2));
}

function utcNowMarker() { return new Date().toISOString(); }

function cmdPreflight(args) {
  // `qa:internal preflight --brief <file>` -> readiness verdict + unmet list.
  // Accepts either a raw brief or the `prepare --out` wrapper {..., brief}.
  const raw = readJson(path.resolve(args.brief));
  const brief = raw.brief && typeof raw.brief === "object" ? raw.brief : raw;
  const { activePolicy, policyDir } = learningPaths();
  const active = fs.existsSync(activePolicy) ? loadActivePolicy(activePolicy, policyDir) : null;
  const product = args["product-root"] ? path.resolve(args["product-root"]) : GAME_ROOT;
  const res = preflightBrief(brief, { productRoot: product, activePolicyHash: active?.policyHash });
  console.log(JSON.stringify(res, null, 2));
  if (res.readiness === "BLOCKED") process.exitCode = 1;
}

function cmdCheckpoint(args) {
  // `qa:internal checkpoint --brief <file> --state <file>` -> new brief revision.
  const brief = readJson(path.resolve(args.brief));
  const observedState = readJson(path.resolve(args.state));
  const res = checkpointBrief(brief, { observedState, reason: args.reason ?? "checkpoint" });
  const outPath = args.out ? path.resolve(args.out) : path.resolve(args.brief);
  fs.writeFileSync(outPath, JSON.stringify(res.brief, null, 2) + "\n");
  console.log(JSON.stringify({ revision: res.brief.revision, invalidated: res.invalidated }, null, 2));
}

function cmdLearn(args) {
  // `qa:internal learn --run <id> --input <file>` -> lesson facet transition,
  // guarded qualification, atomic policy publication.
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const input = readJson(path.resolve(args.input));
  const lesson = ledger.lessons.find((l) => `${l.id}@${l.version}` === input.lessonRef || l.id === input.lessonRef);
  if (!lesson) throw new Error(`lesson not in run ledger: ${input.lessonRef}`);
  const res = applyLearningAction(lesson, input.action, { actor: input.actor ?? leaseId });
  if (!res.ok) throw new Error(`learning action rejected: ${res.reason}`);
  if (input.action.type === "publish") {
    const { policyDir, activePolicy } = learningPaths();
    const pub = publishPolicy(policyDir, activePolicy, input.policyPayload);
    if (!pub.ok) throw new Error(`publication rejected: ${pub.reason}`);
    lesson.guidance.policyRef = pub.policyHash;
    lesson.status = "PROMOTED";
    lesson.policyVersion = pub.policyHash;
    lesson.effectiveFromRun = ledger.run.id;
  }
  commitLedger(dir, ledger, { kind: "EVIDENCE", actor: leaseId, state: ledger.run.state, payload: { learning: input.lessonRef, action: input.action.type } });
  console.log(`learn ${input.lessonRef}: ${input.action.type} applied`);
}

function cmdSchedule(args) {
  // `qa:internal schedule --run <id> --input <file>` -> capacity admission or
  // lifecycle-verified release. Queue records never hold a slot.
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const input = readJson(path.resolve(args.input));
  let note;
  if (input.action === "admit") {
    const existing = ledger.assignments.find((a) => a.id === input.assignment?.id);
    if (existing && (ASSIGNMENT_ACTIVE.has(existing.status) || ASSIGNMENT_TERMINAL.has(existing.status))) {
      // Re-admission is only a path for waiting work (QUEUED/BLOCKED). An
      // active or finished record must never be demoted/replaced - its slot is
      // released only via observe with lifecycle proof.
      throw new Error(`assignment ${existing.id} is ${existing.status} — re-admission refused; waiting records only. Use observe for lifecycle`);
    }
    // Merge onto the ledger record (ledger is the truth): keep stored fields +
    // history, refresh the mutable admission inputs from the request.
    const candidate = existing
      ? { ...existing, ...Object.fromEntries(Object.entries(input.assignment).filter(([k]) => k !== "status" && k !== "history")), status: existing.status, history: [...existing.history] }
      : input.assignment;
    const { record, admitted } = admitAssignment(ledger, candidate, { externalOccupied: input.externalOccupied ?? 0, allowExisting: !!existing });
    const i = ledger.assignments.findIndex((a) => a.id === record.id);
    if (i >= 0) ledger.assignments[i] = record; else ledger.assignments.push(record);
    note = `admit ${record.id}: ${admitted ? "RESERVED" : record.status}`;
  } else if (input.action === "observe") {
    const a = observeAssignment(ledger, input.assignmentId, {
      observedStatus: input.observedStatus, evidence: input.evidence,
      observedRuntimeId: input.observedRuntimeId, resultRef: input.resultRef,
    });
    note = `observe ${a.id}: ${a.status}`;
  } else {
    throw new Error(`unknown schedule action: ${input.action}`);
  }
  commitLedger(dir, ledger, { kind: "SCHEDULE", actor: leaseId, state: ledger.run.state, payload: input });
  console.log(note);
}

function cmdMigrate(args) {
  // `qa:internal migrate --run <id>` -> explicit v1->v2 for a RESUMED run only.
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  if (ledger.schemaVersion !== SCHEMA_VERSION_V1) throw new Error(`migrate only applies to schemaVersion 1, got ${ledger.schemaVersion}`);
  const { ledger: migrated, notes } = migrateLedgerV1toV2(ledger);
  commitLedger(dir, migrated, { kind: "MIGRATION", actor: leaseId, state: migrated.run.state, payload: { from: 1, to: 2, notes } });
  console.log(`migrated run ${ledger.run.id} to schemaVersion 2 (${notes.length} initializations)`);
}

const [command, ...rest] = process.argv.slice(2);
const args = parse(rest);
try {
  switch (command) {
    case "init": cmdInit(args); break;
    case "snapshot": cmdSnapshot(args); break;
    case "record": cmdRecord(args); break;
    case "validate": cmdValidate(args); break;
    case "decide": cmdDecide(args); break;
    case "render": cmdRender(args); break;
    case "qualify": cmdQualify(); break;
    case "prepare": cmdPrepare(args); break;
    case "preflight": cmdPreflight(args); break;
    case "checkpoint": cmdCheckpoint(args); break;
    case "learn": cmdLearn(args); break;
    case "schedule": cmdSchedule(args); break;
    case "migrate": cmdMigrate(args); break;
    default:
      console.log("usage: cli.mjs init|snapshot|record|validate|decide|render|qualify");
      process.exitCode = 2;
  }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 1;
}
