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
