-- Run this in your Supabase SQL editor to set up the schema

create table if not exists puzzles (
  id uuid primary key default gen_random_uuid(),
  puzzle_date date unique not null,
  puzzle_number integer unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid references puzzles(id) on delete cascade not null,
  name text not null,
  color text not null check (color in ('yellow', 'blue', 'green', 'purple')),
  words text[] not null,
  constraint words_length check (array_length(words, 1) = 4)
);

-- Index for date lookups
create index if not exists puzzles_puzzle_date_idx on puzzles(puzzle_date);

-- Row-level security: public read, no public write
alter table puzzles enable row level security;
alter table categories enable row level security;

create policy "Public read puzzles"
  on puzzles for select
  using (true);

create policy "Public read categories"
  on categories for select
  using (true);

-- Service role has full access (used by admin API routes)
-- No additional policies needed — service role bypasses RLS

-- Add creator_name to categories (nullable — only set when sourced from community)
alter table categories add column if not exists creator_name text;

-- User-created categories (individual, not full puzzles)
create table if not exists user_categories (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references auth.users(id) on delete cascade not null,
  creator_name text not null,
  name text not null,
  words text[] not null,
  constraint user_category_words_length check (array_length(words, 1) = 4),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_categories_creator_name_idx on user_categories(creator_name);

alter table user_categories enable row level security;

create policy "Public read user_categories"
  on user_categories for select
  using (true);

create policy "User insert user_categories"
  on user_categories for insert
  with check (auth.uid() = creator_id);

create policy "User update user_categories"
  on user_categories for update
  using (auth.uid() = creator_id);

create policy "User delete user_categories"
  on user_categories for delete
  using (auth.uid() = creator_id);

-- Puzzle completions (for leaderboard — logged-in users only)
create table if not exists puzzle_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  user_name text not null,
  completion_type text not null check (completion_type in ('daily', 'custom')),
  puzzle_date text, -- YYYY-MM-DD for daily, null for custom
  completed_at timestamptz default now(),
  constraint unique_daily_completion unique (user_id, puzzle_date)
);

alter table puzzle_completions enable row level security;

create policy "Public read puzzle_completions"
  on puzzle_completions for select
  using (true);

create policy "User insert puzzle_completions"
  on puzzle_completions for insert
  with check (auth.uid() = user_id);
