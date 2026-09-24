// Internal Fixed-Point QA Protocol - runner CLI.
// Usage: npm run qa:internal -- <command> [flags]
//   init      --request <file>          create runs/<runId>/ with request + lease + PHASE event
//   snapshot  --run <id>                build manifest, set state identity, invalidate stale
//   record    --run <id> --input <file> append ledger records (invariant/census/finding/evidence/...)
//   validate  --run <id> [--state]      schema + machine checks; exit 1 on any failure
//   decide    --run <id>                evaluate terminal predicate; write DECISION event + outcome
//   render    --run <id>                write runs/<id>/report.md
//   qualify                            run orchestrator attack suite + corpus checks; print verdict
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  newLedger, loadLedger, saveLedgerAtomic, acquireLease, checkLease, appendEvent,
  recordMessage, invalidateForNewState, buildManifest, hashFileSet, computeEnvironmentId,
  objectHash, runDir, SCHEMA_VERSION_V1,
} from "./state.mjs";
import {
  loadLessonsJsonl, routeLessons, draftBrief, preflightBrief, checkpointBrief,
  admitAssignment, observeAssignment, applyLearningAction, publishPolicy,
  loadActivePolicy, migrateLedgerV1toV2,
} from "./prevention.mjs";
import { validateLedger, validateStructure } from "./validate.mjs";
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
  saveLedgerAtomic(dir, ledger);
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
  appendEvent(dir, ledger, { kind: "SNAPSHOT", actor: leaseId, state: newState, payload: { state: newState, invalidated: stale } });
  saveLedgerAtomic(dir, ledger);
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
  brief: "briefs", assignment: "assignments", consumption: "consumptions",
};

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
  for (const rec of records) {
    const kind = rec.kind;
    if (!RECORD_COLLECTION[kind]) throw new Error(`unknown record kind: ${kind}`);
    // {kind, body:{...}} or flat {kind, ...fields}; `kind` is the routing key, not a body field
    const body = rec.body && typeof rec.body === "object" ? rec.body : Object.fromEntries(Object.entries(rec).filter(([k]) => k !== "kind"));
    if (kind === "message") {
      body.runId = ledger.run.id;
      const res = recordMessage(ledger, body);
      applied.push(`${kind}:${body.id}${res.duplicate ? " (duplicate, idempotent)" : res.stale ? " (STALE — does not advance phase)" : ""}`);
    } else {
      const coll = ledger[RECORD_COLLECTION[kind]];
      const idx = coll.findIndex((r) => r.id === body.id);
      if (idx >= 0) {
        // replace-in-place allowed only for non-terminal pre-decision records; findings get explicit lifecycle
        coll[idx] = body;
        applied.push(`${kind}:${body.id} (updated)`);
      } else {
        coll.push(body);
        applied.push(`${kind}:${body.id}`);
      }
    }
  }
  appendEvent(dir, ledger, {
    kind: EVENT_KIND[records[0].kind] ?? "EVIDENCE",
    actor: leaseId, state: ledger.run.state,
    payload: { applied },
  });
  saveLedgerAtomic(dir, ledger);
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

function cmdDecide(args) {
  const dir = runDir(QA_ROOT, args.run);
  const leaseId = args.lease ?? leaseFromDir(dir);
  checkLease(dir, leaseId);
  const ledger = loadLedger(dir);
  const structural = validateStructure(ledger, SCRIPT_DIR);
  if (structural.length) {
    console.log("structural failures — decide refused:");
    structural.forEach((fl) => console.log(`  ${fl.recordId}: ${fl.reason}`));
    process.exitCode = 1;
    return;
  }
  const { outcome, clauses, detail } = decide(ledger);
  ledger.run.outcome = outcome;
  ledger.run.phase = "DECIDE";
  appendEvent(dir, ledger, { kind: "DECISION", actor: leaseId, state: ledger.run.state, payload: { outcome, detail, clauses } });
  saveLedgerAtomic(dir, ledger);
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
    out = execFileSync(process.execPath, ["--test", path.join(testDir, "*.test.mjs")], { cwd: GAME_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    code = e.status ?? 1;
    out = (e.stdout ?? "") + (e.stderr ?? "");
  }
  const pass = /# pass (\d+)/.exec(out);
  const fail = /# fail (\d+)/.exec(out);
  const passed = pass ? Number(pass[1]) : 0;
  const failed = fail ? Number(fail[1]) : passed === 0 && code !== 0 ? -1 : 0;
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
  console.log(`orchestrator tests: ${passed} passed, ${failed} failed`);
  const gaps = [];
  if (failed !== 0) gaps.push(`orchestrator suite: ${failed} failing`);
  const sentinelDir = path.join(QA_ROOT, "runs", "adoption-2026-09-23", "reviews");
  const sentinelOk = fs.existsSync(sentinelDir) && fs.readdirSync(sentinelDir).filter((f) => /^sentinel-reviewer-[ab]/.test(f)).length >= 2;
  if (!sentinelOk) gaps.push("reviewer-isolation sentinel: <2 sealed isolated reviewer results recorded");
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
  const brief = readJson(path.resolve(args.brief));
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
  appendEvent(dir, ledger, { kind: "EVIDENCE", actor: leaseId, state: ledger.run.state, payload: { learning: input.lessonRef, action: input.action.type } });
  saveLedgerAtomic(dir, ledger);
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
    const { record, admitted } = admitAssignment(ledger, input.assignment, { externalOccupied: input.externalOccupied ?? 0 });
    const i = ledger.assignments.findIndex((a) => a.id === record.id);
    if (i >= 0) ledger.assignments[i] = record; else ledger.assignments.push(record);
    note = `admit ${record.id}: ${admitted ? "RESERVED" : record.status}`;
  } else if (input.action === "observe") {
    const a = observeAssignment(ledger, input.assignmentId, { observedStatus: input.observedStatus, evidence: input.evidence });
    note = `observe ${a.id}: ${a.status}`;
  } else {
    throw new Error(`unknown schedule action: ${input.action}`);
  }
  appendEvent(dir, ledger, { kind: "SCHEDULE", actor: leaseId, state: ledger.run.state, payload: input });
  saveLedgerAtomic(dir, ledger);
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
  appendEvent(dir, migrated, { kind: "MIGRATION", actor: leaseId, state: migrated.run.state, payload: { from: 1, to: 2, notes } });
  saveLedgerAtomic(dir, migrated);
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
