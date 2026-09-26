cleanF INT adjudication fixes (coordinator):
- npx vitest run reflection+hoIntercept -> 36/36 PASS
- PIN: 'double-wipe: a lethal hit whose post-mortem reflect kills the last attacker resolves as defeat'
  (reflection.test.ts) -- simultaneous wipe resolves defeat (players checked first).
- PIN: 'an intercepted hit reflects off the intercepting protector'
  (hoIntercept.test.ts) -- phan_chan reflect queued on the protector, lands once on attacker.
