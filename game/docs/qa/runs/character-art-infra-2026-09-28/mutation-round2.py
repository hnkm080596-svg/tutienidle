"""Round-2 mutants for the two SURVIVED results.
MUT-02: new oracle pins resolvePlayerEntityKey output directly.
MUT-04: hit the SECOND staticForm block (enemy path, ~line 489)."""
import hashlib, json, subprocess

ROOT = 'E:/tutienidle/.agent-worktrees/character-art-infra/game'
LOG = []

def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()

MUTANTS = [
    {
        'id': 'MUT-02', 'inv': ['I-ANIMATED-CHAR-OVERRIDE'],
        'file': 'src/presentation/art/CombatPresentationCatalogue.ts',
        'old': "    return reskinSlug",
        'new': "    return fallbackTextureKey // MUTANT: entity key ignores reskin slug",
        'oracle': 'tests/architecture/characterArtReskin.test.ts',
        'desc': 'mapped profile falls back to legacy texture key inside combat',
        'occurrence': 2,
    },
    {
        'id': 'MUT-04', 'inv': ['I-AVATAR-FALLBACK'],
        'file': 'src/game/scenes/combat/combat-grid-view.ts',
        'old': "      if (staticForm && this.host.textures.exists(staticForm.texture.textureKey)) {",
        'new': "      if (false && staticForm && this.host.textures.exists(staticForm.texture.textureKey)) { // MUTANT: avatar fallback skipped",
        'oracle': 'src/game/scenes/combat/combat-grid-view.test.ts',
        'desc': 'atlas-miss falls straight to placeholder, skipping the avatar',
        'occurrence': 2,
    },
]

results = []
for m in MUTANTS:
    path = f"{ROOT}/{m['file']}"
    before = sha(path)
    src = open(path, encoding='utf-8', newline='').read()
    idx = -1
    pos = 0
    for _ in range(m['occurrence']):
        idx = src.find(m['old'], pos)
        if idx < 0:
            break
        pos = idx + 1
    if idx < 0:
        results.append({**m, 'result': 'INVALID', 'reason': 'patch site not found'})
        print(f"{m['id']}: SITE NOT FOUND", flush=True)
        continue
    mutated = src[:idx] + m['new'] + src[idx + len(m['old']):]
    open(path, 'w', encoding='utf-8', newline='').write(mutated)
    mutant_hash = sha(path)
    run = subprocess.run(['npx', 'vitest', 'run', m['oracle']], cwd=ROOT,
                         capture_output=True, text=True, timeout=300, shell=True,
                         encoding='utf-8', errors='replace')
    out = (run.stdout or '') + (run.stderr or '')
    killed = run.returncode != 0
    LOG.append(f"===== {m['id']} {m['desc']}\n{out[-3500:]}\n")
    src2 = open(path, encoding='utf-8', newline='').read()
    idx2 = src2.find(m['new'])
    reverted = src2[:idx2] + m['old'] + src2[idx2 + len(m['new']):]
    open(path, 'w', encoding='utf-8', newline='').write(reverted)
    unchanged = sha(path) == before
    results.append({**m, 'result': 'KILLED_EXPECTED' if killed else 'SURVIVED',
                    'mutantHash': mutant_hash, 'candidateUnchanged': unchanged,
                    'exitCode': run.returncode})
    print(f"{m['id']}: {'KILLED' if killed else 'SURVIVED'} (exit {run.returncode}) unchanged={unchanged}", flush=True)

prev = open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/evidence/mutation-campaign.txt',
            encoding='utf-8').read()
open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/evidence/mutation-campaign.txt', 'w',
     encoding='utf-8').write(prev + '\n' + '\n'.join(LOG))
open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/mutation-round2-results.json', 'w',
     encoding='utf-8').write(json.dumps(results, indent=1))
print('done')
