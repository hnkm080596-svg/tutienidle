# Unified ledger schema and validation contract

Status: CANONICAL — installed by the internal fixed-point QA protocol adoption. Sole QA authority: `README.md` in this directory.
The JSON block below is the complete structural schema; the extracted verbatim copy lives at `game/scripts/qa/ledger.schema.json` and is enforced by the runner (`game/scripts/qa/validate.mjs` invoked via `qa:internal`). Schema acceptance only establishes shape; the semantic checks below are mandatory and cannot be replaced by JSON validation.

## Structural schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:tutienidle:internal-qa:ledger:1",
  "title": "Internal aggregate QA ledger",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion", "run", "invariants", "census", "findings", "evidence", "coverage", "attacks", "reviews", "cycles", "mutations", "corpus", "lessons", "messages", "events"],
  "properties": {
    "schemaVersion": {"const": 1},
    "run": {"$ref": "#/$defs/run"},
    "invariants": {"type": "array", "items": {"$ref": "#/$defs/invariant"}},
    "census": {"type": "array", "items": {"$ref": "#/$defs/census"}},
    "findings": {"type": "array", "items": {"$ref": "#/$defs/finding"}},
    "evidence": {"type": "array", "items": {"$ref": "#/$defs/evidence"}},
    "coverage": {"type": "array", "items": {"$ref": "#/$defs/coverage"}},
    "attacks": {"type": "array", "items": {"$ref": "#/$defs/attack"}},
    "reviews": {"type": "array", "items": {"$ref": "#/$defs/review"}},
    "cycles": {"type": "array", "items": {"$ref": "#/$defs/cycle"}},
    "mutations": {"type": "array", "items": {"$ref": "#/$defs/mutation"}},
    "corpus": {"type": "array", "items": {"$ref": "#/$defs/corpus"}},
    "lessons": {"type": "array", "items": {"$ref": "#/$defs/lesson"}},
    "messages": {"type": "array", "items": {"$ref": "#/$defs/message"}},
    "events": {"type": "array", "items": {"$ref": "#/$defs/event"}}
  },
  "$defs": {
    "text": {"type": "string", "minLength": 1},
    "texts": {"type": "array", "items": {"$ref": "#/$defs/text"}, "uniqueItems": true},
    "hash": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
    "maybeHash": {"oneOf": [{"$ref": "#/$defs/hash"}, {"type": "null"}]},
    "maybeText": {"type": ["string", "null"], "minLength": 1},
    "time": {"type": "string", "format": "date-time"},
    "ref": {
      "type": "object", "additionalProperties": false,
      "required": ["path", "symbolOrSection", "revision", "basis"],
      "properties": {
        "path": {"$ref": "#/$defs/text"}, "symbolOrSection": {"$ref": "#/$defs/text"},
        "revision": {"$ref": "#/$defs/text"},
        "basis": {"enum": ["USER", "MAINTAINED_CONTRACT", "SOURCE", "HISTORICAL", "SPEC_DRIFT"]}
      }
    },
    "state": {
      "type": "object", "additionalProperties": false,
      "required": ["productStateId", "contractId", "attackModelId", "environmentId"],
      "properties": {
        "productStateId": {"$ref": "#/$defs/hash"}, "contractId": {"$ref": "#/$defs/hash"},
        "attackModelId": {"$ref": "#/$defs/hash"}, "environmentId": {"$ref": "#/$defs/hash"}
      }
    },
    "run": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "createdAt", "scope", "authorizedRepairs", "nonGoals", "checkout", "branch", "base", "head", "state", "learningPolicyId", "consumedLessonIds", "manifestPath", "environmentPath", "aggregateParents", "requiredDomains", "exclusions", "phase", "cleanRoundA", "cleanRoundB", "finalEvidenceIds", "outcome"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "createdAt": {"$ref": "#/$defs/time"},
        "scope": {"const": "AGGREGATE_REPOSITORY"}, "authorizedRepairs": {"$ref": "#/$defs/texts"}, "nonGoals": {"$ref": "#/$defs/texts"},
        "checkout": {"$ref": "#/$defs/text"}, "branch": {"$ref": "#/$defs/text"}, "base": {"$ref": "#/$defs/text"}, "head": {"$ref": "#/$defs/text"},
        "state": {"$ref": "#/$defs/state"}, "manifestPath": {"$ref": "#/$defs/text"}, "environmentPath": {"$ref": "#/$defs/text"},
        "learningPolicyId": {"$ref": "#/$defs/hash"}, "consumedLessonIds": {"$ref": "#/$defs/texts"},
        "aggregateParents": {"type": "array", "items": {"$ref": "#/$defs/ref"}},
        "requiredDomains": {"$ref": "#/$defs/texts"}, "exclusions": {"type": "array", "items": {"$ref": "#/$defs/exclusion"}},
        "phase": {"enum": ["INTAKE", "SNAPSHOT", "CONTRACT_AND_CENSUS", "VERIFY", "ATTACK", "REVIEW", "RECONCILE", "REPAIR", "CLEAN_A", "NOVEL_ATTACK", "CLEAN_B", "FINAL_MUTATION", "FINAL_VERIFY", "DECIDE", "PAUSED"]},
        "cleanRoundA": {"$ref": "#/$defs/maybeText"}, "cleanRoundB": {"$ref": "#/$defs/maybeText"},
        "finalEvidenceIds": {"$ref": "#/$defs/texts"},
        "outcome": {"enum": [null, "QA_FIXED_POINT_REACHED", "QA_FINDINGS_OPEN", "QA_UNVERIFIED", "QA_BLOCKED_SCOPE", "QA_ACCEPTED_WITH_EXCEPTIONS"]}
      }
    },
    "exclusion": {
      "type": "object", "additionalProperties": false,
      "required": ["pathOrCapability", "reason", "evidenceIds", "affectsRequiredSurface"],
      "properties": {
        "pathOrCapability": {"$ref": "#/$defs/text"}, "reason": {"$ref": "#/$defs/text"},
        "evidenceIds": {"$ref": "#/$defs/texts"}, "affectsRequiredSurface": {"type": "boolean"}
      }
    },
    "invariant": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "statement", "domain", "risk", "sources", "owner", "legalWriters", "legalReaders", "projections", "caches", "validStates", "forbiddenStates", "preconditions", "postconditions", "legalTransitions", "illegalTransitions", "failureBehavior", "atomicity", "inverseBehavior", "persistence", "migration", "lifecycle", "runtimeConsequences", "uiConsequences", "oracles", "requiredEvidenceSurfaces", "taxonomyIds", "status"],
      "properties": {
        "id": {"type": "string", "pattern": "^I-[A-Z0-9-]+$"}, "statement": {"$ref": "#/$defs/text"}, "domain": {"$ref": "#/$defs/text"},
        "risk": {"enum": ["CRITICAL", "HIGH", "STANDARD"]}, "sources": {"type": "array", "minItems": 1, "items": {"$ref": "#/$defs/ref"}},
        "owner": {"$ref": "#/$defs/ref"}, "legalWriters": {"$ref": "#/$defs/texts"}, "legalReaders": {"$ref": "#/$defs/texts"},
        "projections": {"$ref": "#/$defs/texts"}, "caches": {"$ref": "#/$defs/texts"}, "validStates": {"$ref": "#/$defs/texts"}, "forbiddenStates": {"$ref": "#/$defs/texts"},
        "preconditions": {"$ref": "#/$defs/texts"}, "postconditions": {"$ref": "#/$defs/texts"}, "legalTransitions": {"$ref": "#/$defs/texts"}, "illegalTransitions": {"$ref": "#/$defs/texts"},
        "failureBehavior": {"$ref": "#/$defs/text"}, "atomicity": {"$ref": "#/$defs/text"}, "inverseBehavior": {"$ref": "#/$defs/text"},
        "persistence": {"$ref": "#/$defs/text"}, "migration": {"$ref": "#/$defs/text"}, "lifecycle": {"$ref": "#/$defs/text"},
        "runtimeConsequences": {"$ref": "#/$defs/texts"}, "uiConsequences": {"$ref": "#/$defs/texts"}, "oracles": {"$ref": "#/$defs/texts"},
        "requiredEvidenceSurfaces": {"$ref": "#/$defs/texts"}, "taxonomyIds": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["ACTIVE", "DISPUTED", "SUPERSEDED"]}
      }
    },
    "census": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "invariantIds", "location", "classification", "reads", "writes", "eventsIn", "eventsOut", "consumerIds", "searchEvidenceIds", "disposition"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "invariantIds": {"$ref": "#/$defs/texts"}, "location": {"$ref": "#/$defs/ref"},
        "classification": {"enum": ["CANONICAL", "LEGAL_WRITER", "PROJECTION", "CACHE", "COMPATIBILITY", "MIGRATION", "LEGACY", "TEST_ONLY", "DEAD", "SUSPICIOUS"]},
        "reads": {"$ref": "#/$defs/texts"}, "writes": {"$ref": "#/$defs/texts"}, "eventsIn": {"$ref": "#/$defs/texts"}, "eventsOut": {"$ref": "#/$defs/texts"},
        "consumerIds": {"$ref": "#/$defs/texts"}, "searchEvidenceIds": {"$ref": "#/$defs/texts"}, "disposition": {"$ref": "#/$defs/text"}
      }
    },
    "finding": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "title", "state", "severity", "classification", "actionable", "reachability", "locations", "discoveredBy", "invariantIds", "evidenceIds", "counterexample", "expected", "actual", "rootCause", "rootClass", "subsystem", "siblingSearch", "siblingFindingIds", "repair", "pinEvidenceIds", "verificationEvidenceIds", "closureReviewIds", "status", "duplicateOf", "rejectionReason", "exception"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "title": {"$ref": "#/$defs/text"}, "state": {"$ref": "#/$defs/state"},
        "severity": {"enum": ["Critical", "High", "Medium", "Low", "Nit"]},
        "classification": {"enum": ["REAL_DEFECT", "SPEC_DEFECT", "TEST_DEFECT", "COVERAGE_GAP", "DOCUMENTATION_DEFECT", "FALSE_POSITIVE", "NON_ACTIONABLE"]},
        "actionable": {"type": "boolean"},
        "reachability": {"enum": ["PRODUCTION", "SUPPORTED_BOUNDARY", "FIXTURE_INJECTED", "HYPOTHETICAL", "UNKNOWN"]},
        "locations": {"type": "array", "items": {"$ref": "#/$defs/ref"}}, "discoveredBy": {"$ref": "#/$defs/text"}, "invariantIds": {"$ref": "#/$defs/texts"}, "evidenceIds": {"$ref": "#/$defs/texts"},
        "counterexample": {"$ref": "#/$defs/text"}, "expected": {"$ref": "#/$defs/text"}, "actual": {"$ref": "#/$defs/text"},
        "rootCause": {"$ref": "#/$defs/maybeText"}, "rootClass": {"$ref": "#/$defs/maybeText"}, "subsystem": {"$ref": "#/$defs/text"},
        "siblingSearch": {"type": "array", "items": {"$ref": "#/$defs/search"}}, "siblingFindingIds": {"$ref": "#/$defs/texts"},
        "repair": {"$ref": "#/$defs/maybeText"}, "pinEvidenceIds": {"$ref": "#/$defs/texts"}, "verificationEvidenceIds": {"$ref": "#/$defs/texts"}, "closureReviewIds": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["OBSERVED", "TRIAGED", "PROVEN", "REPAIR_AUTHORIZED", "FIXED_PENDING_PROOF", "PINNED", "SIBLINGS_RESOLVED", "CLOSED", "REJECTED_WITH_PROOF", "DUPLICATE_LINKED", "HUMAN_EXCEPTION"]},
        "duplicateOf": {"$ref": "#/$defs/maybeText"}, "rejectionReason": {"$ref": "#/$defs/maybeText"},
        "exception": {"oneOf": [{"type": "null"}, {"$ref": "#/$defs/exception"}]}
      }
    },
    "search": {
      "type": "object", "additionalProperties": false,
      "required": ["roots", "termsAndMethod", "evidenceIds", "hitDispositions", "coverageLimits"],
      "properties": {
        "roots": {"$ref": "#/$defs/texts"}, "termsAndMethod": {"$ref": "#/$defs/text"}, "evidenceIds": {"$ref": "#/$defs/texts"},
        "hitDispositions": {"$ref": "#/$defs/texts"}, "coverageLimits": {"$ref": "#/$defs/texts"}
      }
    },
    "exception": {
      "type": "object", "additionalProperties": false,
      "required": ["humanInstructionRef", "scope", "reason", "expiresWhen"],
      "properties": {
        "humanInstructionRef": {"$ref": "#/$defs/text"}, "scope": {"$ref": "#/$defs/text"}, "reason": {"$ref": "#/$defs/text"}, "expiresWhen": {"$ref": "#/$defs/text"}
      }
    },
    "evidence": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "state", "kind", "producer", "startedAt", "finishedAt", "commandOrMethod", "cwd", "exitCode", "result", "artifactPath", "artifactHash", "inputPaths", "inputEvidenceIds", "invariantIds", "claims", "limitations", "status"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "state": {"$ref": "#/$defs/state"},
        "kind": {"enum": ["EXECUTED_RUNTIME", "EXECUTED_INTEGRATION", "EXECUTED_PROPERTY", "SOURCE_PROOF", "EXECUTED_MUTATION", "EXECUTED_UNIT_STRUCTURAL", "HISTORICAL", "INFERRED", "SPEC_DRIFT"]},
        "producer": {"$ref": "#/$defs/text"}, "startedAt": {"$ref": "#/$defs/time"}, "finishedAt": {"$ref": "#/$defs/time"},
        "commandOrMethod": {"$ref": "#/$defs/text"}, "cwd": {"$ref": "#/$defs/maybeText"}, "exitCode": {"type": ["integer", "null"]},
        "result": {"enum": ["PASS", "FAIL", "MISSING", "FLAKY", "NOT_APPLICABLE"]},
        "artifactPath": {"$ref": "#/$defs/text"}, "artifactHash": {"$ref": "#/$defs/hash"}, "inputPaths": {"$ref": "#/$defs/texts"}, "inputEvidenceIds": {"$ref": "#/$defs/texts"},
        "invariantIds": {"$ref": "#/$defs/texts"}, "claims": {"$ref": "#/$defs/texts"}, "limitations": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["CURRENT", "STALE", "REJECTED"]}
      }
    },
    "coverage": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "invariantId", "surface", "attackIds", "taxonomyIds", "applicability", "reason", "evidenceIds", "reviewerIds", "status", "weakProtection"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "invariantId": {"$ref": "#/$defs/text"},
        "surface": {"enum": ["SPEC", "STATIC_SEMANTIC", "DETERMINISTIC", "INTEGRATION", "RUNTIME_E2E", "PERSISTENCE", "PROPERTY", "FUZZ", "MUTATION", "INDEPENDENT_REVIEW"]},
        "attackIds": {"$ref": "#/$defs/texts"}, "taxonomyIds": {"$ref": "#/$defs/texts"},
        "applicability": {"enum": ["REQUIRED", "NOT_APPLICABLE"]}, "reason": {"$ref": "#/$defs/text"},
        "evidenceIds": {"$ref": "#/$defs/texts"}, "reviewerIds": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["PENDING", "SATISFIED", "FAILED", "MISSING", "STALE", "NOT_APPLICABLE"]}, "weakProtection": {"type": "boolean"}
      }
    },
    "review": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "state", "round", "phase", "reviewerId", "contextId", "model", "role", "inputBundleHash", "priorFindingsVisible", "accessLimitations", "startedAt", "sealedAt", "previousPhaseReviewId", "reviewedAfterPreviousFixes", "coverageIds", "evidenceIds", "findingIds", "novelAttackIds", "status"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "state": {"$ref": "#/$defs/state"}, "round": {"type": "integer", "minimum": 1},
        "phase": {"enum": ["CONTRACT", "CORRECTNESS", "AUTHORITY", "INTEGRATION", "NOVEL_SYNTHESIS", "CLOSURE", "TERMINAL_CHECK"]},
        "reviewerId": {"$ref": "#/$defs/text"}, "contextId": {"$ref": "#/$defs/text"}, "model": {"$ref": "#/$defs/text"}, "role": {"$ref": "#/$defs/text"},
        "inputBundleHash": {"$ref": "#/$defs/hash"}, "priorFindingsVisible": {"type": "boolean"}, "accessLimitations": {"$ref": "#/$defs/texts"},
        "startedAt": {"$ref": "#/$defs/time"}, "sealedAt": {"$ref": "#/$defs/time"}, "previousPhaseReviewId": {"$ref": "#/$defs/maybeText"}, "reviewedAfterPreviousFixes": {"type": "boolean"},
        "coverageIds": {"$ref": "#/$defs/texts"}, "evidenceIds": {"$ref": "#/$defs/texts"}, "findingIds": {"$ref": "#/$defs/texts"},
        "novelAttackIds": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["SEALED", "INCOMPLETE", "CONTAMINATED", "STALE"]}
      }
    },
    "cycle": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "state", "reviewIds", "coverageIds", "evidenceIds", "noveltyEvidenceIds", "startedAt", "finishedAt", "status"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "state": {"$ref": "#/$defs/state"}, "reviewIds": {"$ref": "#/$defs/texts"},
        "coverageIds": {"$ref": "#/$defs/texts"}, "evidenceIds": {"$ref": "#/$defs/texts"}, "noveltyEvidenceIds": {"$ref": "#/$defs/texts"},
        "startedAt": {"$ref": "#/$defs/time"}, "finishedAt": {"$ref": "#/$defs/time"}, "status": {"enum": ["CLEAN", "FINDINGS", "INCOMPLETE", "STALE"]}
      }
    },
    "lesson": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "version", "supersedes", "triggerType", "findingIds", "incidentEvidenceIds", "originatingRun", "rootClass", "missedInvariantIds", "escapeReason", "applicability", "exclusions", "proposedProtection", "promotionEvidenceIds", "qualifiedBy", "capabilityDelta", "status", "policyVersion", "effectiveFromRun", "recurrenceFindingIds", "preventionEvidenceIds"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "version": {"type": "integer", "minimum": 1}, "supersedes": {"$ref": "#/$defs/maybeText"},
        "triggerType": {"enum": ["DEFECT", "ESCAPE", "SPEC", "TEST", "TOOL", "FLAKE", "FALSE_POSITIVE", "EVIDENCE_INTEGRITY"]},
        "findingIds": {"$ref": "#/$defs/texts"}, "incidentEvidenceIds": {"$ref": "#/$defs/texts"}, "originatingRun": {"$ref": "#/$defs/text"},
        "rootClass": {"$ref": "#/$defs/text"}, "missedInvariantIds": {"$ref": "#/$defs/texts"}, "escapeReason": {"$ref": "#/$defs/text"},
        "applicability": {"$ref": "#/$defs/texts"}, "exclusions": {"$ref": "#/$defs/texts"}, "proposedProtection": {"$ref": "#/$defs/texts"},
        "promotionEvidenceIds": {"$ref": "#/$defs/texts"}, "qualifiedBy": {"$ref": "#/$defs/texts"}, "capabilityDelta": {"$ref": "#/$defs/text"},
        "status": {"enum": ["CAPTURED", "CLASSIFIED", "CANDIDATE", "CHALLENGED", "QUALIFIED", "PROMOTED", "REJECTED_WITH_REASON", "ROLLED_BACK", "SUPERSEDED"]},
        "policyVersion": {"$ref": "#/$defs/maybeHash"}, "effectiveFromRun": {"$ref": "#/$defs/maybeText"}, "recurrenceFindingIds": {"$ref": "#/$defs/texts"}, "preventionEvidenceIds": {"$ref": "#/$defs/texts"}
      }
    },
    "attack": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "invariantIds", "taxonomyIds", "challengedAssumption", "sequenceOrInput", "oracle", "noveltyReason", "evidenceIds"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "invariantIds": {"$ref": "#/$defs/texts"}, "taxonomyIds": {"$ref": "#/$defs/texts"},
        "challengedAssumption": {"$ref": "#/$defs/text"}, "sequenceOrInput": {"$ref": "#/$defs/text"}, "oracle": {"$ref": "#/$defs/text"}, "noveltyReason": {"$ref": "#/$defs/text"}, "evidenceIds": {"$ref": "#/$defs/texts"}
      }
    },
    "mutation": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "candidateState", "invariantIds", "rootClass", "operator", "isolationPath", "mutantHash", "expectedDetector", "result", "evidenceIds", "equivalenceReason", "candidateUnchanged"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "candidateState": {"$ref": "#/$defs/state"}, "invariantIds": {"$ref": "#/$defs/texts"}, "rootClass": {"$ref": "#/$defs/text"},
        "operator": {"$ref": "#/$defs/text"}, "isolationPath": {"$ref": "#/$defs/text"}, "mutantHash": {"$ref": "#/$defs/hash"}, "expectedDetector": {"$ref": "#/$defs/text"},
        "result": {"enum": ["KILLED_EXPECTED", "SURVIVED", "INVALID", "EQUIVALENT", "NOT_RUN"]},
        "evidenceIds": {"$ref": "#/$defs/texts"}, "equivalenceReason": {"$ref": "#/$defs/maybeText"}, "candidateUnchanged": {"type": "boolean"}
      }
    },
    "corpus": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "historicalFinding", "originalRevision", "severity", "subsystem", "invariantIds", "rootClass", "counterexample", "historicalDetector", "requiredEvidence", "visibility", "replayMode", "baselineEvidenceIds", "candidateEvidenceIds", "status"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "historicalFinding": {"$ref": "#/$defs/ref"}, "originalRevision": {"$ref": "#/$defs/maybeText"},
        "severity": {"enum": [null, "Critical", "High", "Medium", "Low", "Nit"]}, "subsystem": {"$ref": "#/$defs/text"}, "invariantIds": {"$ref": "#/$defs/texts"}, "rootClass": {"$ref": "#/$defs/text"},
        "counterexample": {"$ref": "#/$defs/text"}, "historicalDetector": {"$ref": "#/$defs/text"}, "requiredEvidence": {"$ref": "#/$defs/texts"},
        "visibility": {"enum": ["TRAINING", "SEALED_HOLDOUT"]}, "replayMode": {"enum": ["ORIGINAL", "REPRESENTATIVE_MUTANT", "PENDING_RECOVERY"]},
        "baselineEvidenceIds": {"$ref": "#/$defs/texts"}, "candidateEvidenceIds": {"$ref": "#/$defs/texts"},
        "status": {"enum": ["PENDING", "DETECTED", "MISSED", "INVALID", "UNVERIFIED"]}
      }
    },
    "message": {
      "type": "object", "additionalProperties": false,
      "required": ["id", "runId", "requestId", "parentRequestId", "sender", "recipient", "kind", "state", "phase", "bundleHash", "payloadPath", "payloadHash", "createdAt", "leaseId"],
      "properties": {
        "id": {"$ref": "#/$defs/text"}, "runId": {"$ref": "#/$defs/text"}, "requestId": {"$ref": "#/$defs/text"}, "parentRequestId": {"$ref": "#/$defs/maybeText"},
        "sender": {"$ref": "#/$defs/text"}, "recipient": {"$ref": "#/$defs/text"},
        "kind": {"enum": ["ASSIGN", "ACK", "NEED_CONTEXT", "SEALED_RESULT", "FINDING", "REPAIR_ASSIGN", "REPAIR_RESULT", "INVALIDATE", "STALE_RESULT", "BLOCKED", "CANCEL", "RESUME"]},
        "state": {"$ref": "#/$defs/state"}, "phase": {"$ref": "#/$defs/text"}, "bundleHash": {"$ref": "#/$defs/hash"},
        "payloadPath": {"$ref": "#/$defs/text"}, "payloadHash": {"$ref": "#/$defs/hash"}, "createdAt": {"$ref": "#/$defs/time"}, "leaseId": {"$ref": "#/$defs/maybeText"}
      }
    },
    "event": {
      "type": "object", "additionalProperties": false,
      "required": ["seq", "at", "kind", "actor", "state", "previousEventHash", "payloadPath", "payloadHash", "eventHash"],
      "properties": {
        "seq": {"type": "integer", "minimum": 1}, "at": {"$ref": "#/$defs/time"},
        "kind": {"enum": ["PHASE", "SNAPSHOT", "EVIDENCE", "FINDING", "INVALIDATION", "REVIEW_SEALED", "EXCEPTION", "DECISION"]},
        "actor": {"$ref": "#/$defs/text"}, "state": {"$ref": "#/$defs/state"}, "previousEventHash": {"$ref": "#/$defs/maybeHash"},
        "payloadPath": {"$ref": "#/$defs/text"}, "payloadHash": {"$ref": "#/$defs/hash"}, "eventHash": {"$ref": "#/$defs/hash"}
      }
    }
  }
}
```

## Machine checks beyond shape

The installed validator must fail closed on each condition below. It must print the offending record ID and exact reason; exit success only when both structural and requested semantic validation succeed. Default validation never emits a fixed-point verdict.

Mechanical checks verify shape, references, hashes, chronology, state transitions and required attestations. They cannot determine whether a causal explanation is true or a reviewer reasoned well. Those judgments require the named independent reviewer and inspectable evidence; the runner verifies their presence/freshness and the coordinator challenges their content. Do not market schema validation or a hash chain as proof of honest QA. Unknown corpus severity is permitted only while recovering historical metadata and is never a measured severity result.

1. Unique IDs within and across reference namespaces; every ID/reference resolves; no cycles in evidence prerequisites or duplicate-findings chains. Taxonomy IDs resolve to the canonical taxonomy. Referenced paths are contained, exist, and have matching recorded hashes; external citations are metadata, not commands to execute.
2. All time fields are valid UTC instants; start <= finish/seal; chronology and sequential predecessor IDs are consistent. Report counters derive from actual evidence. Event sequence is contiguous, first previous hash null, subsequent links valid. Hash-chain validity detects accidental alteration, not a malicious author with full write access.
3. Recompute state manifests before/after each gate. Staged/working/untracked identities cannot be conflated. Reject unknown excluded source files, stale runtime server identity, unrecorded environment change and unpinned aggregate parents.
4. Current evidence must match required product/contract/attack/environment dependencies. Invalidation is transitive. Historical/INFERRED evidence cannot satisfy an EXECUTED requirement. A source proof needs a source artifact, not a fabricated command exit status. Executed gate evidence needs actual command result and log.
5. CLOSED actionable findings require root cause/class, original-failure proof, implemented repair, sibling-search evidence and resolved sibling graph, regression kill proof or an explicit alternative rationale, current affected verification and a closure reviewer different from the fixer. Cyclic sibling links use one atomic closure event for the strongly connected group: all members must meet local closure conditions and outgoing dependencies must already be closed. Reject a CLOSED finding whose sibling is open outside that validated closure transaction.
6. Actionability is derived from adjudication, not a free bypass flag: every proven REAL_DEFECT/SPEC_DEFECT/TEST_DEFECT/material COVERAGE_GAP/DOCUMENTATION_DEFECT is actionable. Setting actionable=false requires classification FALSE_POSITIVE or NON_ACTIONABLE and evidence-backed REJECTED_WITH_PROOF disposition. A human exception leaves actionable=true. DUPLICATE_LINKED inherits its primary's unresolved decision state. HUMAN_EXCEPTION requires explicit human instruction scope/reason/expiry; automatic model judgment is never a waiver.
7. Each active invariant has every coverage-surface cell, including justified NOT_APPLICABLE. Required SATISFIED needs current sufficient evidence of the right kind and no material limitation. REQUIRED + NOT_APPLICABLE status is invalid. Missing coverage rows count as MISSING, never silently reduce the denominator.
8. Required domain and cross-domain inventory is complete; census suspicious/live legacy entries have adjudicated dispositions. A reviewer reading only the diff cannot satisfy aggregate INDEPENDENT_REVIEW. Static-only runtime correctness is marked weakProtection.
9. Review identity/context and material bundle match assignments. A clean-independent role requires no prior findings visible and no material access limitation; seal precedes reconciliation disclosure. Reviewer cannot be its own fixer/closure certifier. Sequential reviews begin after predecessor resolution/verification. Self-review records cannot count toward independent quota.
10. Clean A/B reference entries in cycles, each containing all required sequential phase review IDs and coverage evidence, on identical candidate/contract/model/environment identity. New findings/fixes invalidate them, even if low severity. Novel challenges resolve to attacks and have actual executable/source-proof results, not merely a list of ideas. Per-execution seeds/inputs are retained in hashed evidence artifacts, not environmentId. A different seed alone does not establish novelty.
11. High-risk invariants have valid representative mutations caught by the intended detector. SURVIVED/NOT_RUN cannot satisfy; INVALID/EQUIVALENT do not count as kills. Original/candidate hashes match after mutation job. Every historically meaningful golden case has a detected result or remains an explicit benchmark gap.
12. Full final command matrix passed with no missing/failed/flaky required evidence, after clean rounds and final mutation check. All skips are accounted for against applicability, not ignored because exit=0. No open actionable finding, exception, critical access gap or disputed oracle. Independent terminal review signs the same state. Only now may the separate `decide` command return QA_FIXED_POINT_REACHED.
13. Every meaningful incident has a linked lesson record; unresolved material missing protection is a coverage gap. PROMOTED lessons meet the learning protocol's kill/control/sibling/independent qualification predicate and have a policy hash/effective run. A policy relaxation without human authority is rejected. All matched promoted lessons are present in consumedLessonIds and coverage. Cross-run references use `runId:recordId`; lesson revisions are uniquely addressed `lessonId@version`, avoiding duplicate-ID ambiguity.

## State-file ownership and race behavior

The primary coordinator is the sole ledger writer. Workers return immutable result files; they never edit shared state. A coordinator event append uses compare-and-swap against expected event sequence/hash, writes a temporary record then atomically publishes it on the same filesystem. A lease identifies coordinator instance/run; a second coordinator cannot acquire an active lease. Lease expiry requires explicit recovery and state revalidation, not automatic duplicate ownership.

Payload hashes use raw bytes. Object identity/event hashing uses UTF-8 JSON with recursively sorted object keys, array order preserved, no insignificant whitespace; omit only the object's own eventHash during event hashing. Manifest paths use forward slashes. Reject absolute/parent traversal paths in worker payload destinations; normalize then check containment before reads/writes. Never interpolate worker content into shell commands.

Crash recovery replays the journal, verifies artifacts, compares current candidate identity, and resumes the first unmet prerequisite. The assignment tuple for a requestId is immutable. Multiple ACK/NEED_CONTEXT/FINDING/SEALED_RESULT messages may belong to that request, each with a unique message.id. Duplicate delivery is idempotent by message.id+payloadHash; the same message.id with different content is an integrity error. Exactly one terminal SEALED_RESULT is accepted per requestId: an identical terminal payload is a harmless replay, a different terminal payload requires a new linked request. Additional context that changes bundleHash also creates a new request with parentRequestId. Stale worker results remain historical evidence and cannot advance current phase.

## Human-readable views

Generate reports from the ledger, not an independently maintained second status document:

- **Run:** exact candidate, dependencies, scope, access/tool limits, current phase and outcome.
- **Invariants:** ID / owner / rule / transitions / oracle / required evidence / coverage.
- **Findings:** ID / severity + class / evidence strength + reachability / root class / repair / pins / sibling closure / status.
- **Coverage:** invariant x surface; required, satisfied, missing, stale and N/A counts separately; no single green percentage hides an unprotected critical invariant.
- **Chronology:** one block per sequential pass: reviewed state, reviewed after previous fixes YES/NO, findings, repairs, verification IDs, reviewer context.
- **Convergence:** Clean A, novel synthesis/results, Clean B, mutation audit, final full verification and terminal predicate. Unfulfilled clauses remain explicit.

An example invariant's semantic content is `I-RESTORE-ATOMIC`: canonical owner is the current GameManager save/restore boundary; invalid payloads leave live player, bags, managers, pending operations, emitted events and persistence state unchanged according to the maintained failure contract. Its inverse is reset/new-session replacement; migration policy is current-version validation plus explicit unsupported-version rejection. Use the actual current symbols and call paths from census when populating a run, never this example as a substitute for source inspection.
