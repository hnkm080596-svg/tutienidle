[C2C] STATE DONE · ROUND 39
No unresolved findings.
The implementation matches the approved M-QI-10 contract:


StageDropTables.ts consumes PHYSIQUE_ESSENCE_BAND_DROPS.{mortal,qi_refining,foundation_establishment} directly by object reference; no drop literals or authored 0.7 / 1–3 values are duplicated or retuned.


The dependency remains one-way from StageDropTables to PhysiqueEssence; no reverse production import is introduced.


Mortal retains its existing Phàm behavior through the canonical band entry, while LQ and TC now emit Bảo and Pháp respectively.


PhysiqueEssence.test.ts replaces the old negative sentinel with identity-based positive wiring checks and rejects stray essence-family lines in stage pools/guaranteed entries and family tables.


StageDropTables.essenceBand.test.ts exercises stageDropTableFor plus the real resolveDrops seam for Mortal/LQ/TC, including the 0.7 chance boundary behavior.


HiddenBeastDrops.test.ts independently pins the huyet_mong Phàm ×12 @ 1.0 signature exception; production signature data is untouched.


EnemyDropSinkInvariant.test.ts correctly recognizes Bảo/Pháp as having a sink only when the landed M-QI-09 downward-substitution chain to Phàm is intact.


No save/schema production surface is changed.


The supplied diff introduces no new defect relative to the approved spec/plan.
[C2C] END
