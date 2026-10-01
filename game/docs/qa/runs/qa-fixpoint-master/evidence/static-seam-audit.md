# Static seam audit (qa-fixpoint-master) - coordinator SOURCE_PROOF

I-IA-2: FiveElementInitiationFailure union enumerates exactly 15 declared
codes (GameManagerRealmAdvanceOps.ts ~L119); commitFiveElementInitiation
returns each preflight failure via a named code and reserves 'commit_failed'
for post-preflight faults - no silent return paths (audited each return).

I-RM-1: every beta verdict surface consumes a canonical read-model or the
beta rail: AlchemyView filters via betaRecipeFamilyOfId; TurnCombatSkillBar
renders betaCombatRolesFor verdicts only; SkillPathPanel visibleElements is
the committed-element projection; PillBagSection renders the reason union
verbatim; BetaCompletionModal renders betaCompletionFor only; App.vue and
useAppLifecycle read unsupportedReleaseReason once per restore. No
component mutates PlayerData outside domain APIs.

I-RT-1: electronUpdater.ts pins autoDownload=false,
autoInstallOnAppQuit=false, allowDowngrade=false, allowPrerelease=true;
sha512 integrity is verified by electron-updater before update-downloaded;
quitAndInstall is called by UpdateService only after a 'saved' FlushResult;
app-update.yml is the single feed authority (updateFeed.ts). main.ts:
contextIsolation=true, nodeIntegration=false, devTools off when packaged.

I-TS-1: window.__tutienEnemySpawnDebug is import.meta.env.DEV-gated -
stripped from production bundles; PRODUCTION_CSP (default-src 'self',
object-src 'none', form-action 'none') is injected at build with a
fail-closed anchor (build throws if '</title>' is absent); tests/lab is
excluded from the verify suite (vitest.lab.config.mts is opt-in).

I-TQ-1: qa probes assert observable behavior and rail verdicts, not
implementation internals: dormant-save pins assert effect seams (cap,
passive, consume, kit), honesty pins assert rendered-set === rail verdict,
atomicity pins assert byte-equivalence; the suites run under the canonical
test-flag model (lock fixtures) and would fail on machine-independent drift.

I-QI-1: ledger written exclusively through qa:internal record (schema +
stale-propagation enforcement); every evidence record binds artifactPath +
artifactHash + inputPaths + claims; every FAIL evidence is the pre-fix run
whose matching PASS evidence is the post-fix run on the same state.
