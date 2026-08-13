-- ============================================================================
-- Auth.js (next-auth v5) + @auth/supabase-adapter migration
--
-- Run this in the Supabase SQL editor (or via CLI migration) to:
--   1. Create the `next_auth` schema the adapter writes to.
--   2. Repoint user-id foreign keys from `auth.users` to `next_auth.users`.
--   3. Add a relink helper that remaps legacy rows by email when a user
--      signs in through Auth.js for the first time.
--
-- After applying:
--   * Add `next_auth` to Dashboard -> Project Settings -> API -> Exposed
--     schemas (or apply the pgrst statement at the bottom of this file).
--   * When all legacy users have signed in, run the VALIDATE statements at
--     the bottom to finalize the new foreign keys.
-- ============================================================================

-- 1) next_auth schema -------------------------------------------------------
create schema if not exists next_auth;

grant usage on schema next_auth to service_role;
grant all on schema next_auth to postgres;
grant all on schema next_auth to service_role;

create table if not exists next_auth.users (
  id uuid not null default gen_random_uuid(),
  name text,
  email text,
  "emailVerified" timestamptz,
  image text,
  display_name text,
  constraint users_pkey primary key (id),
  constraint email_unique unique (email)
);
grant all on table next_auth.users to postgres;
grant all on table next_auth.users to service_role;

create table if not exists next_auth.accounts (
  id uuid not null default gen_random_uuid(),
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  "userId" uuid,
  constraint accounts_pkey primary key (id),
  constraint provider_unique unique (provider, "providerAccountId"),
  constraint "accounts_userId_fkey" foreign key ("userId")
    references next_auth.users (id) match simple
    on update no action on delete cascade
);
grant all on table next_auth.accounts to postgres;
grant all on table next_auth.accounts to service_role;

create table if not exists next_auth.sessions (
  id uuid not null default gen_random_uuid(),
  expires timestamptz not null,
  "sessionToken" text not null,
  "userId" uuid,
  constraint sessions_pkey primary key (id),
  constraint "sessionToken_unique" unique ("sessionToken"),
  constraint "sessions_userId_fkey" foreign key ("userId")
    references next_auth.users (id) match simple
    on update no action on delete cascade
);
grant all on table next_auth.sessions to postgres;
grant all on table next_auth.sessions to service_role;

create table if not exists next_auth.verification_tokens (
  identifier text,
  token text,
  expires timestamptz not null,
  constraint verification_tokens_pkey primary key (token),
  constraint token_unique unique (token),
  constraint token_identifier_unique unique (token, identifier)
);
grant all on table next_auth.verification_tokens to postgres;
grant all on table next_auth.verification_tokens to service_role;

-- uid() helper (mirrors the documented adapter schema; used by RLS policies)
create or replace function next_auth.uid()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Protect next_auth tables from the public API: enable RLS with no policies,
-- so only the service role (which bypasses RLS) can read/write them.
alter table next_auth.users enable row level security;
alter table next_auth.accounts enable row level security;
alter table next_auth.sessions enable row level security;
alter table next_auth.verification_tokens enable row level security;

-- 2) Repoint user-id foreign keys to next_auth.users ------------------------
alter table user_categories drop constraint if exists user_categories_creator_id_fkey;
alter table puzzle_completions drop constraint if exists puzzle_completions_user_id_fkey;
alter table category_completions drop constraint if exists category_completions_user_id_fkey;

alter table user_categories add constraint user_categories_creator_id_fkey
  foreign key (creator_id) references next_auth.users (id) on delete cascade not valid;
alter table puzzle_completions add constraint puzzle_completions_user_id_fkey
  foreign key (user_id) references next_auth.users (id) on delete cascade not valid;
alter table category_completions add constraint category_completions_user_id_fkey
  foreign key (user_id) references next_auth.users (id) on delete cascade not valid;

-- 3) Relink helper: remap legacy rows keyed by old auth.users ids to the
--    new next_auth.users id for a given email. Called by Auth.js on sign-in.
create or replace function public.relink_legacy_user(p_email text, p_new_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update user_categories uc
    set creator_id = p_new_user_id,
        creator_avatar = coalesce(uc.creator_avatar, nu.image, au.raw_user_meta_data->>'avatar_url')
    from auth.users au
    left join next_auth.users nu on nu.id = p_new_user_id
    where uc.creator_id = au.id
      and lower(au.email) = lower(p_email)
      and uc.creator_id <> p_new_user_id;

  update puzzle_completions pc
    set user_id = p_new_user_id
    from auth.users au
    where pc.user_id = au.id
      and lower(au.email) = lower(p_email)
      and pc.user_id <> p_new_user_id;

  update category_completions cc
    set user_id = p_new_user_id
    from auth.users au
    where cc.user_id = au.id
      and lower(au.email) = lower(p_email)
      and cc.user_id <> p_new_user_id;
end;
$$;

grant execute on function public.relink_legacy_user(text, uuid) to service_role;

-- 4) Expose the next_auth schema to the PostgREST API ------------------------
-- Prefer the Dashboard: Project Settings -> API -> Exposed schemas -> add
-- "next_auth". The statements below achieve the same result via SQL:
-- alter role authenticator set pgrst.db_schemas = 'public, next_auth';
-- notify pgrst, 'reload config';

-- 5) Finalize the new foreign keys once legacy users have signed in ----------
-- alter table user_categories validate constraint user_categories_creator_id_fkey;
-- alter table puzzle_completions validate constraint puzzle_completions_user_id_fkey;
-- alter table category_completions validate constraint category_completions_user_id_fkey;