-- F-BX-24 forward migration: character_saves has no DELETE policy, so a
-- reset save could never remove the remote row and the next login pull
-- resurrected it. The client-side tombstone suppresses the pull on its
-- own, but this policy is what lets the reconcile DELETE the stale row
-- for real (best-effort - deployments before this migration keeps
-- denying the delete and the tombstone alone keeps the save suppressed).
create policy saves_own_delete on public.character_saves
  for delete using (user_id = auth.uid());
