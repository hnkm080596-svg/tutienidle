-- VALIDATE the character_saves owner composite FK
--
-- The prepare migration creates character_saves_owner_is_character_owner
-- NOT VALID on purpose: during cutover the constraint must admit legacy
-- rows without locking the table for a full scan. Operators validate it
-- once restore-verify reports the legacy set consistent.
--
-- Recording the step here keeps fresh installs schema-identical to the
-- live project - the fresh-vs-upgrade schema diff treats NOT VALID vs
-- VALID as drift otherwise.
--
-- Idempotent: VALIDATE on an already-valid constraint is a no-op check.

alter table public.character_saves
  validate constraint character_saves_owner_is_character_owner;
