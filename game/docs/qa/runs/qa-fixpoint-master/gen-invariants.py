#!/usr/bin/env python3
"""Generate invariant + census + coverage records for qa-fixpoint-master run."""
import json

REV = "46bb1482887596da18934f614fae6a375574c7b2"

def R(path, sym, basis="SOURCE", rev=REV):
    return {"path": path, "symbolOrSection": sym, "revision": rev, "basis": basis}

def C(sym):
    return R("docs/design/frontend-contract.md", sym, "MAINTAINED_CONTRACT")

def inv(id, stmt, domain, risk, owner_path, owner_sym, surfaces, taxonomy, sources,
        writers=None, readers=None, **kw):
    return {
        "kind": "invariant", "id": id, "statement": stmt, "domain": domain, "risk": risk,
        "sources": sources, "owner": R(owner_path, owner_sym),
        "legalWriters": writers or [owner_sym],
        "legalReaders": readers or ["*"],
        "projections": kw.get("projections", []), "caches": kw.get("caches", []),
        "validStates": kw.get("valid", ["committed consistent state"]),
        "forbiddenStates": kw.get("forbidden", ["partial commit", "dual truth"]),
        "preconditions": kw.get("pre", ["caller holds required authority"]),
        "postconditions": kw.get("post", ["invariant statement holds"]),
        "legalTransitions": kw.get("legalT", ["declared ops only"]),
        "illegalTransitions": kw.get("illegalT", ["bypass of owner authority"]),
        "failureBehavior": kw.get("failure", "fail closed; no partial effect"),
        "atomicity": kw.get("atomicity", "op-level atomicity"),
        "inverseBehavior": kw.get("inverse", "rollback restores prior state"),
        "persistence": kw.get("persistence", "state survives save/load as owner contract"),
        "migration": kw.get("migration", "schema-versioned restore"),
        "lifecycle": kw.get("lifecycle", "created via owner op, destroyed via owner op"),
        "runtimeConsequences": kw.get("runtime", ["visible behavior follows invariant"]),
        "uiConsequences": kw.get("ui", ["UI reflects invariant via read model"]),
        "oracles": kw.get("oracles", ["deterministic vitest assertions"]),
        "requiredEvidenceSurfaces": surfaces,
        "taxonomyIds": taxonomy,
        "status": "ACTIVE",
    }

INV = [
inv("I-CC-1", "Mortal creation commits exactly the contract start state: stats 1/1/1/1/1, declared name+talent+mortalBasicSkillId, realm Phàm Nhân, no scope-hidden fields present.", "creation-contract", "STANDARD",
    "src/services/character/CharacterCreationService.ts", "CharacterCreationService",
    ["DETERMINISTIC", "INDEPENDENT_REVIEW"], ["CONTRACT", "STATE", "PERSISTENCE"],
    [C("A-creation"), R("src/services/character/CharacterCreationService.ts", "create")],
    post=["player object exactly matches contract seed", "no hidden-progression keys"], runtime=["game boots into legal mortal state"]),

inv("I-IA-1", "commitFiveElementInitiation is atomic: on ANY failure code the player's spell/way/element/realm/root/skills/technique/level state restores byte-equivalent to the pre-commit snapshot; on success ALL five facets commit together.", "initiation-atomicity", "CRITICAL",
    "src/core/game/GameManagerRealmAdvanceOps.ts", "commitFiveElementInitiation",
    ["DETERMINISTIC", "PROPERTY", "MUTATION", "INDEPENDENT_REVIEW"], ["STATE", "TRANSITION", "ROBUSTNESS"],
    [C("B-initiation"), R("src/core/game/GameManagerRealmAdvanceOps.ts", "commitFiveElementInitiation")],
    atomicity="capturePlayerSnapshot -> validate -> commit all -> on any throw restorePlayerSnapshotInPlace + unlearn skills + restore technique",
    inverse="restorePlayerSnapshotInPlace returns byte-equal player state",
    post=["either all facets set or none", "no dangling skill unlocks", "no realm advance without element"], forbidden=["partial commit", "orphaned spell without way"]),

inv("I-IA-2", "Every initiation failure path returns one of the 15 declared failure codes; no silent or unclassified failure; callers observe a typed failure, never a thrown stack.", "initiation-atomicity", "STANDARD",
    "src/core/game/GameManagerRealmAdvanceOps.ts", "commitFiveElementInitiation",
    ["DETERMINISTIC", "STATIC_SEMANTIC", "INDEPENDENT_REVIEW"], ["CONTRACT", "ROBUSTNESS"],
    [R("src/core/game/GameManagerRealmAdvanceOps.ts", "INITIATION_FAILURE_CODES")],
    post=["return value is {ok:false, code} for every reject path"]),

inv("I-PA-1", "chooseCultivationPath refuses declaresElementAxis ways and non-beta ways with declared failure codes; only beta-legal ways settle.", "path-authority", "HIGH",
    "src/core/game/GameManagerRealmAdvanceOps.ts", "chooseCultivationPath",
    ["DETERMINISTIC", "INDEPENDENT_REVIEW", "MUTATION"], ["AUTHORITY", "CONTRACT", "TRANSITION"],
    [C("B-initiation"), R("src/core/game/GameManagerRealmAdvanceOps.ts", "chooseCultivationPath")],
    illegalT=["choose declaresElementAxis way", "choose non-beta way", "double path commit"]),

inv("I-SV-1", "Every beta surface resolves to exactly one verdict {available | progression-locked | scope-hidden} owned by betaScopeSurface; scope-hidden surfaces render nothing anywhere.", "scope-verdict", "CRITICAL",
    "src/core/betaScopeSurface.ts", "betaSurfaceVerdict",
    ["DETERMINISTIC", "INTEGRATION", "MUTATION", "INDEPENDENT_REVIEW"], ["AUTHORITY", "PRESENTATION", "CONTRACT"],
    [C("I-dormant"), R("src/core/betaScopeSurface.ts", "betaSurfaceVerdict")],
    readers=["all UI surfaces", "domain entry points"],
    post=["exactly one verdict per surface", "no surface unverdicted", "scope-hidden renders nothing"]),

inv("I-AS-1", "Scope-hidden content cannot enter visible play through any seam: direct domain API, save payload fields, event handlers, shop/loot tables, quest effects, notifications, tutorial, devtools/console paths.", "authority-seam", "HIGH",
    "src/core/betaScope.ts", "betaScope",
    ["DETERMINISTIC", "INTEGRATION", "MUTATION", "INDEPENDENT_REVIEW"], ["AUTHORITY", "CROSS_SYSTEM", "TOOLING_SECURITY"],
    [R("src/core/betaScope.ts", "BETA_FEATURES"), C("I-dormant")],
    illegalT=["hidden feature reachable via direct call", "hidden item in shop/loot", "quest effect granting hidden content", "devtools bypass"]),

inv("I-DS-1", "All BETA_FEATURES=false systems (hiddenContent, swordPath, bodyPath, companion, formation, artifact, manualWorkforce, equipmentWash, equipmentRefine, equipmentOreDecompose, dailyQuest) stay scope-hidden end-to-end and remain dormant across save/load cycles.", "dormant-systems", "HIGH",
    "src/core/betaScope.ts", "BETA_FEATURES",
    ["DETERMINISTIC", "PERSISTENCE", "INDEPENDENT_REVIEW"], ["AUTHORITY", "PERSISTENCE", "CROSS_SYSTEM"],
    [R("src/core/betaScope.ts", "BETA_FEATURES"), C("I-dormant")],
    runtime=["dormant systems never tick, never pay out, never notify"]),

inv("I-RM-1", "UI components consume read-model projections only; no component mutates PlayerData or reads internals that bypass the projection; read model is the only honest surface.", "read-model", "HIGH",
    "src/presentation/createGamePresentation.ts", "createGamePresentation",
    ["STATIC_SEMANTIC", "DETERMINISTIC", "INDEPENDENT_REVIEW"], ["READ_MODEL_AUTHORITY" if False else "AUTHORITY", "PRESENTATION"],
    [R("src/presentation/createGamePresentation.ts", "createGamePresentation")],
    ui=["every surface reflects projection", "no component edits PlayerData fields"]),

inv("I-CR-1", "Combat request -> settlement -> reward is exactly-once: no double settlement on abort/restart/death-between-declaration-and-impact; rewards cannot duplicate or drop silently.", "combat-rail", "HIGH",
    "src/core/battle/BattleLootSystem.ts", "BattleLootSystem",
    ["DETERMINISTIC", "INTEGRATION", "INDEPENDENT_REVIEW"], ["COMBAT", "STATE", "ASYNC"],
    [R("src/core/battle/BattleLootSystem.ts", "settle")],
    runtime=["reward exactly-once", "death mid-flight handled deterministically"]),

inv("I-PG-1", "Each of the 3 precursor skills gains floor(casts/10) growth with no cap and no divergence — parity law holds at all cast counts including boundaries and overflow.", "precursor-growth", "HIGH",
    "src/core/skill/MortalPrecursors.ts", "MortalPrecursors",
    ["DETERMINISTIC", "PROPERTY", "MUTATION"], ["CONTRACT", "COMBAT", "ECONOMY"],
    [C("J-precursor"), R("src/core/skill/MortalPrecursors.ts", "precursorGrowth")],
    post=["growth == floor(casts/10) for every precursor", "no cap at any level"]),

inv("I-SS-1", "Stage read-model transitions are monotonic (locked -> available -> cleared); betaComplete fires only on foundation_ferocious_flood_dragon_whelp defeat; no skip/replay/abort can fabricate completion.", "stage-state", "STANDARD",
    "src/core/stage/StageManager.ts", "StageManager",
    ["DETERMINISTIC", "INTEGRATION", "INDEPENDENT_REVIEW"], ["TRANSITION", "CONTENT_PATH"],
    [R("src/core/stage/StageManager.ts", "StageManager"), R("src/core/betaScope.ts", "BETA_ENEMY_ROSTER")]),

inv("I-EC-1", "Every beta economy flow has a reachable source and sink; no dead sources, dead sinks, orphan quests/equipment/materials; census lists every flow.", "economy-census", "HIGH",
    "src/core/economy/VendorSystem.ts", "VendorSystem",
    ["DETERMINISTIC", "INDEPENDENT_REVIEW", "MUTATION"], ["ECONOMY", "CONTRACT"],
    [R("src/core/economy/VendorSystem.ts", "VendorSystem"), R("tests/architecture/betaEconomyCensus.test.ts", "census")],
    post=["source->sink graph closed over beta scope", "no orphan content"]),

inv("I-SF-1", "betaSupportedFor/unsupportedReleaseReason classify every hostile save (hidden progression state, companion/artifact/formation owned, realm beyond release, way out of scope) as unsupported with the declared reason; deserialization never throws and never leaks hidden content into play.", "save-safety", "CRITICAL",
    "src/core/betaScopeSurface.ts", "unsupportedReleaseReason",
    ["DETERMINISTIC", "FUZZ", "PERSISTENCE", "MUTATION", "INDEPENDENT_REVIEW"], ["PERSISTENCE", "AUTHORITY", "ROBUSTNESS"],
    [R("src/core/betaScopeSurface.ts", "unsupportedReleaseReason"), C("H-ending-save")],
    post=["hostile save flagged not played", "deserialize-safe for every malformed beta payload"]),

inv("I-PM-1", "Save version contract enforced (CURRENT_SAVE_VERSION), version rejection explicit, restore atomic (all-or-nothing), retired fields handled, malformed-but-schema-valid payloads rejected deterministically.", "persistence-migration", "STANDARD",
    "src/services/save/SaveSystem.ts", "SaveSystem",
    ["DETERMINISTIC", "PERSISTENCE"], ["PERSISTENCE", "ROBUSTNESS"],
    [R("src/services/save/SaveSystem.ts", "restore")]),

inv("I-EN-1", "BETA_ENEMY_ROSTER is valid: 12 enemies across acts 1-3 (3 normals + 1 boss per act); every enemy reachable, killable, lootable; final boss = foundation_ferocious_flood_dragon_whelp.", "enemy-content", "STANDARD",
    "src/core/betaScope.ts", "BETA_ENEMY_ROSTER",
    ["DETERMINISTIC", "INDEPENDENT_REVIEW"], ["CONTENT_PATH", "COMBAT", "CONTRACT"],
    [R("src/core/betaScope.ts", "BETA_ENEMY_ROSTER")]),

inv("I-UH-1", "UI renders verdicts honestly: available surfaces work, progression-locked shows lock reason, scope-hidden renders nothing; i18n strings exist for all user-visible beta text; no teaser/ghost UI for hidden content.", "ui-honesty", "STANDARD",
    "src/core/presentation/labels.ts", "labels",
    ["DETERMINISTIC", "RUNTIME_E2E", "INDEPENDENT_REVIEW"], ["PRESENTATION", "CONTRACT"],
    [R("src/core/presentation/labels.ts", "labels"), C("G-nav")]),

inv("I-RT-1", "Electron updates are verified (signature/metadata), channel cannot downgrade, quitAndInstall has declared semantics; update failures never corrupt the installed game.", "release-trust", "STANDARD",
    "electron/main.ts", "autoUpdater",
    ["STATIC_SEMANTIC", "DETERMINISTIC"], ["TOOLING_SECURITY", "PERSISTENCE"],
    [R("electron/main.ts", "autoUpdater")]),

inv("I-TS-1", "Devtools, debug seams, scripts and CSP grant no privileged path to scope-hidden state and no production-bypass surface; tool integrity is preserved.", "tooling-security", "STANDARD",
    "src/core/dev", "devtools",
    ["STATIC_SEMANTIC", "DETERMINISTIC"], ["TOOLING_SECURITY", "AUTHORITY"],
    [R("src/core/dev", "devtools")]),

inv("I-CN-1", "Save/load lifecycle seams are race-free: pagehide/quit flush, no double initialization, no stale re-entry; duplicate invocation collapses to single authority.", "concurrency", "STANDARD",
    "src/services/save/SaveSystem.ts", "flush",
    ["DETERMINISTIC", "INTEGRATION"], ["ASYNC", "STATE", "PERSISTENCE"],
    [R("src/services/save/SaveSystem.ts", "flush")]),

inv("I-TQ-1", "Tests assert behavior and invariants, not implementation details; counted oracles fail closed; every regression pin is real (fails without the fix).", "test-quality", "STANDARD",
    "tests", "vitest suite",
    ["STATIC_SEMANTIC", "INDEPENDENT_REVIEW", "MUTATION"], ["TEST_QUALITY"],
    [R("tests", "vitest suite", "HISTORICAL")],
    oracles=["mutation kills each pin for intended reason"]),

inv("I-QI-1", "QA runner records honest state: ledger reflects executed reality, machine checks sound, no counted-oracle inflation, no forged independence.", "qa-integrity", "STANDARD",
    "scripts/qa/cli.mjs", "qa:internal",
    ["STATIC_SEMANTIC", "INDEPENDENT_REVIEW"], ["QA_INTEGRITY"],
    [R("scripts/qa/cli.mjs", "cli"), R("scripts/qa/ledger.schema.json", "schema")]),
]

CEN = [
("CEN-CC", ["I-CC-1"], "src/services/character", "CharacterCreationService", "CANONICAL"),
("CEN-IA", ["I-IA-1", "I-IA-2"], "src/core/game", "GameManagerRealmAdvanceOps", "CANONICAL"),
("CEN-PA", ["I-PA-1"], "src/core/game", "GameManagerRealmAdvanceOps.chooseCultivationPath", "CANONICAL"),
("CEN-SV", ["I-SV-1"], "src/core", "betaScopeSurface", "CANONICAL"),
("CEN-AS", ["I-AS-1", "I-DS-1"], "src/core", "betaScope", "CANONICAL"),
("CEN-RM", ["I-RM-1"], "src/presentation", "createGamePresentation", "PROJECTION"),
("CEN-CR", ["I-CR-1"], "src/core/battle", "BattleLootSystem", "CANONICAL"),
("CEN-PG", ["I-PG-1"], "src/core/skill", "MortalPrecursors", "CANONICAL"),
("CEN-SS", ["I-SS-1"], "src/core/stage", "StageManager+StageSystem", "CANONICAL"),
("CEN-EC", ["I-EC-1"], "src/core/economy", "VendorSystem+economy census", "CANONICAL"),
("CEN-SF", ["I-SF-1"], "src/core", "betaScopeSurface.unsupportedReleaseReason", "CANONICAL"),
("CEN-PM", ["I-PM-1"], "src/services/save", "SaveSystem", "CANONICAL"),
("CEN-EN", ["I-EN-1"], "src/core/enemy", "enemy registry + BETA_ENEMY_ROSTER", "CANONICAL"),
("CEN-UH", ["I-UH-1"], "src/core/presentation", "labels+OverlayLayers", "PROJECTION"),
("CEN-RT", ["I-RT-1"], "electron", "main.ts autoUpdater", "CANONICAL"),
("CEN-TS", ["I-TS-1"], "src/core/dev", "devtools seams", "TEST_ONLY"),
("CEN-CN", ["I-CN-1"], "src/services/save", "lifecycle flush seams", "CANONICAL"),
("CEN-TQ", ["I-TQ-1"], "tests", "vitest suite + pins", "TEST_ONLY"),
("CEN-QI", ["I-QI-1"], "scripts/qa", "qa:internal runner", "CANONICAL"),
]

records = list(INV)
for cid, iids, path, sym, cls in CEN:
    records.append({
        "kind": "census", "id": cid, "invariantIds": iids,
        "location": R(path, sym), "classification": cls,
        "reads": [], "writes": [sym] if cls == "CANONICAL" else [],
        "eventsIn": [], "eventsOut": [], "consumerIds": [],
        "searchEvidenceIds": [],
        "disposition": "adjudicated canonical authority for declared invariants" if cls == "CANONICAL" else f"adjudicated {cls.lower()} role",
    })

for i in INV:
    for surf in i["requiredEvidenceSurfaces"]:
        records.append({
            "kind": "coverage", "id": f"COV-{i['id']}-{surf}",
            "invariantId": i["id"], "surface": surf,
            "attackIds": [], "taxonomyIds": i["taxonomyIds"],
            "applicability": "REQUIRED", "reason": f"{surf} surface required by {i['id']} risk={i['risk']}",
            "evidenceIds": [], "reviewerIds": [], "status": "PENDING", "weakProtection": False,
        })

json.dump({"records": records}, open("docs/qa/runs/qa-fixpoint-master/records-01-invariants.json", "w"), indent=1)
print(f"{len(INV)} invariants, {len(CEN)} census, {sum(len(i['requiredEvidenceSurfaces']) for i in INV)} coverage rows")
