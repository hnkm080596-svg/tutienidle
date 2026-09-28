# Mutants for the Clean-A-R7 / Clean-B-R7 repair batch (state 7ef00fd8).
# MUT-10: revert the arm-regardless fix (restore destination-exists gate) ->
#         oracle: 'a loop request still defers when the one-shot destination
#         registration is missing' must FAIL (request truncates the clip).
# MUT-11: drop the superseded-listener removal -> oracle: 'a same-key one-shot
#         re-arm removes the superseded listener' must FAIL (offCalls empty).
import json, subprocess, hashlib, os

ROOT = 'E:/tutienidle/.agent-worktrees/character-art-infra/game'
PLAY = f'{ROOT}/src/game/scenes/combat/combat-animation-playback.ts'
ORACLE = 'src/game/scenes/CombatScene.combatAnimations.test.ts'

MUTANTS = [
    {
        'id': 'MUT-10',
        'inv': ['I-CLIP-LIFECYCLE'],
        'file': PLAY,
        'old': """    if (typeof gameSprite.once !== 'function') {
      return
    }

    const listener""",
        'new': """    if (!this.scene.anims.exists(combatAnimationKey(prefix, destination)) || typeof gameSprite.once !== 'function') {
      return
    }

    const listener""",
        'desc': 'one-shot listener no longer arms when destination registration missing',
    },
    {
        'id': 'MUT-11',
        'inv': ['I-CLIP-LIFECYCLE'],
        'file': PLAY,
        'old': """    if (sprite.pendingTransitionListener && typeof gameSprite.off === 'function') {
      gameSprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, sprite.pendingTransitionListener)
    }

    sprite.pendingTransitionListener = listener""",
        'new': """    sprite.pendingTransitionListener = listener""",
        'desc': 'superseded same-key listener is left orphaned on the emitter',
    },
]

results = []
orig = open(PLAY, encoding='utf-8').read()

for m in MUTANTS:
    src = open(m['file'], encoding='utf-8').read()
    if m['old'] not in src:
        results.append({**{k: m[k] for k in ('id', 'desc')}, 'result': 'INVALID',
                        'reason': 'patch site not found'})
        print(f"{m['id']}: SITE NOT FOUND", flush=True)
        continue
    open(m['file'], 'w', encoding='utf-8', newline='').write(src.replace(m['old'], m['new'], 1))
    mutant = hashlib.sha256(open(m['file'], 'rb').read()).hexdigest()
    try:
        run = subprocess.run(
            ['npx', 'vitest', 'run', ORACLE],
            cwd=ROOT, capture_output=True, text=True, encoding='utf-8',
            errors='replace', timeout=300, shell=True)
        out = (run.stdout or '') + (run.stderr or '')
        killed = run.returncode != 0
        results.append({
            'id': m['id'], 'inv': m['inv'], 'file': m['file'], 'old': m['old'],
            'new': m['new'], 'oracle': ORACLE, 'desc': m['desc'],
            'result': 'KILLED_EXPECTED' if killed else 'SURVIVED',
            'mutantHash': mutant, 'exitCode': run.returncode,
        })
        print(f"{m['id']}: {'KILLED' if killed else 'SURVIVED'} (exit {run.returncode})", flush=True)
        if not killed:
            print(out[-800:], flush=True)
    finally:
        open(m['file'], 'w', encoding='utf-8', newline='').write(src)

for m, r in zip(MUTANTS, results):
    if r.get('result') in ('KILLED_EXPECTED', 'SURVIVED'):
        r['candidateUnchanged'] = open(m['file'], encoding='utf-8').read() == orig

open(f'{ROOT}/docs/qa/runs/character-art-infra-2026-09-28/mutation-round5-results.json',
     'w', encoding='utf-8').write(json.dumps(results, indent=1))
print('done')
