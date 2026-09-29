-- ============================================================================
-- BETA-FINAL B1-A / PR2 - cutover: RPC-only access for character_saves
-- ============================================================================
-- Spec: game/docs/qa/missions/2026-09-29-beta-final-production-readiness.md B1.3
-- Plan: game/docs/superpowers/plans/2026-09-29-beta-final-implementation-plan.md
--       section 6.
--
-- Ends the dual-surface window opened by 202609300001_beta_authority_prepare:
--   * drops the legacy claim_active_session(text) overload (sessions must now
--     be minted through the versioned admission overload);
--   * drops the legacy seven-arg create_character overload that persisted a
--     fabricated p_initial_save row at creation;
--   * drops the direct character_saves read/insert/update policies and revokes
--     every remaining api-role grant on the table, the receipt/checkpoint
--     tables, backend_config and the inventory view.
--
-- After this migration the ONLY write path to character_saves is
-- write_character_save (session-guarded CAS + durable receipts). RLS stays
-- enabled as defense-in-depth; with no policies and no table grants the api
-- roles cannot read or mutate a row even if a future client bug issues a
-- direct request. Operators retain full access via direct SQL.
--
-- Idempotent: every statement is safe to re-run.

update public.backend_config
set value = '"cutover"'::jsonb, updated_at = now()
where key = 'contractPhase';

-- Legacy overloads ------------------------------------------------------------

drop function if exists public.claim_active_session(text);
drop function if exists public.create_character(uuid, uuid, text, text[], text, jsonb, integer);

-- Direct character_saves access ----------------------------------------------

drop policy if exists saves_own_read on public.character_saves;
drop policy if exists saves_own_insert on public.character_saves;
drop policy if exists saves_own_update on public.character_saves;
drop policy if exists saves_own_delete on public.character_saves;

revoke all on table public.character_saves
  from public, anon, authenticated, service_role;

-- Defense-in-depth re-application for the authority-side tables and the
-- operator-only inventory view (the same revokes were applied in prepare;
-- repeated here so the cutover is self-contained evidence that the final state
-- holds regardless of how it was reached).
revoke all on public.backend_config
  from public, anon, authenticated, service_role;
revoke all on public.time_checkpoints
  from public, anon, authenticated, service_role;
revoke all on public.save_mutation_receipts
  from public, anon, authenticated, service_role;
revoke all on public.save_inventory_compatibility
  from public, anon, authenticated, service_role;

-- Internal helpers stay unreachable from PostgREST.
revoke all on function public._lock_caller_profile()
  from public, anon, authenticated, service_role;
revoke all on function public._assert_session_locked(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public._assert_session_protocol(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public._issue_checkpoint(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public._classify_save_row(public.character_saves, public.characters)
  from public, anon, authenticated, service_role;
revoke all on function public._check_save_payload(integer, jsonb, public.characters)
  from public, anon, authenticated, service_role;

-- Final public RPC surface (spec B1.3): authenticated only.
grant execute on function public.claim_active_session(text, integer, text) to authenticated;
grant execute on function public.create_character(uuid, uuid, text, text[], text) to authenticated;
grant execute on function public.load_game_state(uuid) to authenticated;
grant execute on function public.write_character_save(uuid, bigint, integer, jsonb, text, uuid, jsonb) to authenticated;
grant execute on function public.heartbeat_session(uuid) to authenticated;
grant execute on function public.revoke_current_session(uuid) to authenticated;
grant execute on function public.beta_contract_phase() to authenticated;
grant execute on function public.get_backend_status() to authenticated;

-- The legacy support RPCs from 202608240001 remain callable for compatibility
-- (assert_active_session, is_character_name_available, create_talent_roll);
-- they all serialize on the shared profile lock via assert_active_session.
