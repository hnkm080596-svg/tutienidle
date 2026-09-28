"""Mutation campaign for character-art-infra QA run.
Each mutant: patch one site, run the oracle test file, expect FAIL (KILLED),
revert, verify candidate file hash restored."""
import hashlib, json, subprocess, sys, time

ROOT = 'E:/tutienidle/.agent-worktrees/character-art-infra/game'
LOG = []

def sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()

MUTANTS = [
    {
        'id': 'MUT-01', 'inv': ['I-CHAR-RESKIN-RESOLVE'],
        'file': 'src/game/support/CharacterArt.ts',
        'old': "  return (CHARACTER_RESKIN_MAP as Record<string, string>)[profileId]",
        'new': "  return undefined // MUTANT: reskin resolution severed",
        'oracle': 'tests/architecture/characterArtReskin.test.ts',
        'desc': 'mapped profile no longer resolves to a character slug',
    },
    {
        'id': 'MUT-02', 'inv': ['I-ANIMATED-CHAR-OVERRIDE'],
        'file': 'src/presentation/art/CombatPresentationCatalogue.ts',
        'old': "    return reskinSlug",
        'new': "    return fallbackTextureKey // MUTANT: entity key ignores reskin slug",
        'oracle': 'src/game/scenes/TranPhapCombatPreviewScene.test.ts',
        'desc': 'mapped profile falls back to legacy texture key inside combat',
    },
    {
        'id': 'MUT-03', 'inv': ['I-ULT-SLOT-SELECT'],
        'file': 'src/game/scenes/combat/combat-action-feedback.ts',
        'old': "        event.slotRole === 'ultimate' ? 'ult' : 'attack',",
        'new': "        'attack', // MUTANT: ult slot ignored",
        'oracle': 'src/game/scenes/CombatScene.combatAnimations.test.ts',
        'desc': 'ultimate cast plays attack instead of ult',
    },
    {
        'id': 'MUT-04', 'inv': ['I-AVATAR-FALLBACK'],
        'file': 'src/game/scenes/combat/combat-grid-view.ts',
        'old': "      if (staticForm && this.host.textures.exists(staticForm.texture.textureKey)) {",
        'new': "      if (false && staticForm && this.host.textures.exists(staticForm.texture.textureKey)) { // MUTANT: avatar fallback skipped",
        'oracle': 'src/game/scenes/combat/combat-grid-view.test.ts',
        'desc': 'atlas-miss falls straight to placeholder, skipping the avatar',
    },
    {
        'id': 'MUT-05', 'inv': ['I-REGISTRY-MANIFEST-PARITY'],
        'file': 'src/game/support/CharacterArt.ts',
        'old': "    { idle: [1, 8, 1], attack: [1, 18, 2], ult: [1, 14, 3], death: [1, 1, 3] },",
        'new': "    { idle: [1, 8, 1], attack: [1, 17, 2], ult: [1, 14, 3], death: [1, 1, 3] }, // MUTANT: attack range drift",
        'oracle': 'tests/architecture/characterArtReskin.test.ts',
        'desc': 'registry clip range drifts from the emitted manifest',
    },
    {
        'id': 'MUT-06', 'inv': ['I-PREVIEW-PARITY'],
        'file': 'src/game/scenes/TranPhapCombatPreviewScene.ts',
        'old': "          const staticForm = staticArtFormFor(mappedKey)\n\n          if (staticForm) {\n            acceptableTextureKeys.add(staticForm.texture.textureKey)\n          }",
        'new': "          // MUTANT: avatar key dropped from the acceptable set",
        'oracle': 'src/game/scenes/TranPhapCombatPreviewScene.test.ts',
        'desc': 'avatar fallback key removed from acceptable sync keys',
    },
    {
        'id': 'MUT-07', 'inv': ['I-CLIP-LIFECYCLE'],
        'file': 'src/game/scenes/combat/combat-animation-playback.ts',
        # post-F-CAI-28 site: chain resolution tests emptiness inline
        'old': "      const empty = this.scene.anims.get?.(candidateKey)?.frames.length === 0",
        'new': "      const empty = false // MUTANT: zero-frame anim treated as playable",
        'oracle': 'src/game/scenes/CombatScene.combatAnimations.test.ts',
        'desc': 'empty registered anim gets played, swapping the avatar texture',
    },
]

results = []
for m in MUTANTS:
    path = f"{ROOT}/{m['file']}"
    before = sha(path)
    src = open(path, encoding='utf-8').read()
    if m['old'] not in src:
        results.append({**m, 'result': 'INVALID', 'reason': 'patch site not found'})
        print(f"{m['id']}: SITE NOT FOUND", flush=True)
        continue
    open(path, 'w', encoding='utf-8').write(src.replace(m['old'], m['new'], 1))
    mutant_hash = sha(path)
    run = subprocess.run(['npx', 'vitest', 'run', m['oracle']], cwd=ROOT,
                         capture_output=True, text=True, timeout=300, shell=True)
    out = (run.stdout or '') + (run.stderr or '')
    killed = run.returncode != 0
    LOG.append(f"===== {m['id']} {m['desc']}\n{out[-3500:]}\n")
    # revert
    src2 = open(path, encoding='utf-8').read()
    open(path, 'w', encoding='utf-8').write(src2.replace(m['new'], m['old'], 1))
    unchanged = sha(path) == before
    results.append({**m, 'result': 'KILLED_EXPECTED' if killed else 'SURVIVED',
                    'mutantHash': mutant_hash, 'candidateUnchanged': unchanged,
                    'exitCode': run.returncode})
    print(f"{m['id']}: {'KILLED' if killed else 'SURVIVED'} (exit {run.returncode}) unchanged={unchanged}", flush=True)

open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/evidence/mutation-campaign.txt', 'w',
     encoding='utf-8').write('\n'.join(LOG))
open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/mutation-results.json', 'w',
     encoding='utf-8').write(json.dumps(results, indent=1))
print('done')
