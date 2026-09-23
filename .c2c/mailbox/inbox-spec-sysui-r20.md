[C2C] STATE DONE · ROUND 20
No unresolved findings.
Round-19 pin (1) is now explicit and implementable. SysPanel exposes rimActive?: boolean = false; variant="primary" only makes the surface eligible, while the parent supplies actual visible-primary state. The contract now unambiguously requires claim/promote on rimActive=true, release on false or unmount, modal binding to open, and drawer binding to ui.characterOverlayOpen. This closes the prior mount-lifetime ambiguity and supports the specified closed-but-mounted → open → close → reopen handoff.
The single-authority semantics are coherent: multiple active primary surfaces may coexist as claimants, but only the ordered set's top claimant receives .sys-rim--live, so stacked modal behavior and restoration to the drawer are deterministic. P14/E2E now exercise both directions plus re-open promotion rather than merely asserting a static count.
Round-19 pin (2) is also resolved. §9 now says there is one canonical :root definition site for --sys-* tokens while explicitly permitting scoped assignments on opted-in system selectors, matching §2.2.5 and §2.4.1.
No new defect is evident in the amended contract. The spec is coherent and sufficiently pinned for implementation.
[C2C] END
