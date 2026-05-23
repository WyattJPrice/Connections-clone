<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Connections Clone — Project Guide

## Overview
A full-featured NYT Connections game clone with community features. Players group 16 words into 4 hidden categories (yellow, blue, green, purple in increasing difficulty). Includes daily puzzles curated by admins, community-created categories that users can combine into custom games, a leaderboard, and a Telegram admin bot.

**Stack**: Next.js 16.2.4 (App Router), React 19, Supabase (auth + Postgres), Tailwind CSS v4, date-fns, Vercel hosting.

## Architecture

### Client vs Server
- All pages are `'use client'` — there are no React Server Components in use.
- API routes in `app/api/` are the server layer (Route Handlers).
- Two Supabase clients: `lib/supabase.ts` (browser, anon key, singleton via `getSupabase()`) and `lib/supabase-server.ts` (server, service role key via `getSupabaseAdmin()`).

### Global Providers (app/layout.tsx)
The root layout wraps children in `<ThemeProvider><ModalsProvider>{children}</ModalsProvider></ThemeProvider>`.
- **ThemeProvider** (`components/ThemeProvider.tsx`): manages light/dark via `data-theme` attribute on `<html>`, persisted to `localStorage('connections_theme')`.
- **ModalsProvider** (`components/modals/ModalsProvider.tsx`): exposes `openStats()`, `openSettings()`, `openLeaderboard()` via React Context. Mounts StatsModal, SettingsModal, LeaderboardModal globally.

### Navigation
- **Navbar** (`components/layout/Navbar.tsx`): NYT-style fixed navbar (48px tall, exported as `NAVBAR_HEIGHT`). Contains hamburger menu (Today's Puzzle, Custom Game, Create Categories, Leaderboard), "Connections" wordmark, stats icon, settings icon (toggles theme), avatar with dropdown (editable display name, My Categories, Sign Out). Used on all inner pages.
- **GameHeader** (`components/game/GameHeader.tsx`): Today's/Custom tab pills, rendered only on `/play` and `/play/custom`.
- Pages that use the fixed navbar must account for `NAVBAR_HEIGHT` (48px) when positioning content below it.

### Theming
CSS custom properties in `app/globals.css` under `:root` (light) and `[data-theme="dark"]` (dark). Key variables: `--bg`, `--surface`, `--text`, `--text-muted`, `--tile-bg`, `--tile-selected`, `--border`, `--modal-bg`, `--button-bg`, `--button-text`, `--navbar-hover-bg`.

Navbar icon buttons use the `.navbar-icon-btn` class: 48x48px, no border-radius, hover background via `var(--navbar-hover-bg)`. Menu items use `.navbar-menu-item` with rounded corners.

### Authentication
Supabase Auth with Google OAuth. Auth helpers in `lib/auth.ts`:
- `signInWithGoogle()` — redirects to Google, callback at `/auth/callback`.
- `getDisplayName(user)` — returns `user_metadata.display_name`, falls back to Google first name, email prefix, or "Player".
- `hasDisplayNameSet(user)` — checks if a custom display name exists.
- `updateDisplayName(name)` — validates (empty, length <=30, profanity), updates Supabase `user_metadata`, backfills denormalized rows via `/api/profile/display-name`.
- On first sign-in, the Navbar auto-opens the avatar dropdown in edit mode so the user can set a display name.

### Profanity Filter
`lib/profanity.ts` wraps the `bad-words` npm package. `containsProfanity(text)` is used both client-side (block save + show error) and server-side (reject with 422).

### Stats & Progress
- **Daily stats** (`lib/stats.ts`): persisted to `localStorage('connections_stats')`. Tracks games played/won, streaks, mistake distribution, perfect puzzles, purple-first, custom wins. Game state saved per puzzle date in `localStorage('connections_game_{date}')`.
- **Custom category completions** (`lib/customProgress.ts`): localStorage cache + server sync via `category_completions` table. Logged-in users get cross-device persistence.
- **Leaderboard**: `puzzle_completions` table tracks daily/custom wins per user. Rendered in LeaderboardModal.

### Keyboard Shortcuts
`lib/useKey.ts` — custom hook `useKey(key, handler, enabled)`. Used for Enter-to-submit (game board, puzzle creation) and Escape-to-close (all modals, navbar dropdowns).

## Database Schema (supabase-schema.sql)

| Table | Purpose |
|---|---|
| `puzzles` | Daily puzzles (id, puzzle_date, puzzle_number) |
| `categories` | 4 per puzzle (name, color, words[], creator_name?) |
| `game_results` | Anonymous game result logging for admin stats |
| `user_categories` | Community-created categories (creator_id, creator_name, name, words[], play_count) |
| `puzzle_completions` | Per-user win log for leaderboard (user_id, user_name, completion_type, puzzle_date) |
| `category_completions` | Per-user record of solved community categories (user_id, category_id) |
| `telegram_admin_state` | Tracks multi-step Telegram bot edit flows |

RLS policies: puzzles/categories are public-read. user_categories are public-read, user-write. completions are user-scoped.

## Page Routes

| Route | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Splash page — Play Today's, Play Custom, Leaderboard buttons |
| `/play` | `app/play/page.tsx` | Daily puzzle game. Accepts `?date=YYYY-MM-DD` for past puzzles. Blocks future dates. |
| `/play/custom` | `app/play/custom/page.tsx` | Custom game from 4 community categories via `?categories=id1,id2,id3,id4`. Validates no duplicate words. |
| `/custom` | `app/custom/page.tsx` | Browse: calendar of past dailies + community category tiles with View All modal (search, sort by solved/unsolved). |
| `/create` | `app/create/page.tsx` | Auth-gated. Create/edit/delete own community categories with profanity check. |
| `/leaderboard` | `app/leaderboard/page.tsx` | Public leaderboard page. |
| `/admin` | `app/admin/page.tsx` | Password-protected admin calendar for daily puzzle management. |
| `/admin/puzzle/[date]` | `app/admin/puzzle/[date]/page.tsx` | Admin puzzle editor — create/edit daily puzzles, import community categories via modal. |
| `/admin/stats` | `app/admin/stats/page.tsx` | Admin aggregate player stats dashboard. |
| `/admin/user-categories` | `app/admin/user-categories/page.tsx` | Admin view of all community categories with realtime subscription. |
| `/admin/login` | `app/admin/login/page.tsx` | Admin password login. |

## API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/puzzle/today` | GET | Fetch today's puzzle (accepts `?date=` param) |
| `/api/puzzles` | GET | List all puzzle dates for calendar |
| `/api/user-categories` | GET | List community categories (filter by creator, random, paginate) |
| `/api/user-categories` | POST | Create a community category (JWT auth + profanity check) |
| `/api/user-categories/[id]` | PUT/DELETE | Update/delete own category |
| `/api/user-categories/play` | POST | Increment play_count for given category IDs |
| `/api/completions` | POST | Record a puzzle completion for leaderboard |
| `/api/category-completions` | POST | Sync/merge solved category IDs |
| `/api/leaderboard` | GET | Fetch leaderboard data |
| `/api/game/result` | POST | Log anonymous game result for admin stats |
| `/api/profile/display-name` | POST | Backfill display name across denormalized rows |
| `/api/admin/*` | various | Admin CRUD for puzzles, stats, user-categories, login/logout |
| `/api/telegram/*` | various | Telegram bot webhook & setup |
| `/api/stats.svg` | GET | Dynamic SVG stats badge |

## Key Components

| Component | File | Notes |
|---|---|---|
| `GameBoard` | `components/game/GameBoard.tsx` | Core game logic — tile grid, selection, guessing, animations, win/loss. Props: `puzzle`, `noStats?`, `onWin?`, `onBack?`. |
| `Tile` | `components/game/Tile.tsx` | Individual word tile with selection state and animations. |
| `CategoryRow` | `components/game/CategoryRow.tsx` | Solved category display. Shows "by [Name]" if `creatorName` is set. |
| `MistakeDots` | `components/game/MistakeDots.tsx` | Visual mistake counter (dots). |
| `Toast` | `components/ui/Toast.tsx` | Toast notification component. |
| `GoogleSignInButton` | `components/auth/GoogleSignInButton.tsx` | Supabase Google OAuth button. |
| `CommunityBrowserModal` | `components/admin/CommunityBrowserModal.tsx` | Admin modal for importing community categories into daily puzzles. |

## Conventions

- **Supabase client**: always use `getSupabase()` (client) or `getSupabaseAdmin()` (server). Never instantiate new clients.
- **Fonts**: Karnak Condensed (headings/wordmark, `--font-karnak`) and Franklin Gothic (`--font-franklin`, body/default).
- **Hover effects**: use CSS utility classes — `btn-hover` (filled buttons), `btn-hover-outline` (outline buttons), `btn-hover-ghost` (text-only), `tile-hover` (game tiles), `card-hover` (category cards), `navbar-icon-btn` (navbar icons).
- **Icon placeholders**: SVGs in Navbar are wrapped in comments like `<!-- ICON: NAME -->` for easy replacement. Final icon size is 32x32 for navbar icons.
- **Scrollable content below navbar**: use `position: fixed; top: NAVBAR_HEIGHT` pattern with `themed-scrollbar` class.
- **Date handling**: local dates are constructed as `YYYY-MM-DD` strings from `new Date()` to avoid timezone issues. Never use `new Date().toISOString().slice(0,10)` (UTC can be wrong date).
- **API responses for user_categories**: must always include `playCount: c.play_count ?? 0` in every response mapping path.
- **Custom game validation**: duplicate words across selected categories are blocked at three levels — UI selection, shuffle retry, and `/play/custom` page load.
- **Future date prevention**: calendar UI disables future dates AND the `/play` page checks `dateParam > todayDate` before fetching.
- **Admin auth**: simple password check stored in env var `ADMIN_PASSWORD`, session cookie-based.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- `ADMIN_PASSWORD` — Admin portal password
- `TELEGRAM_BOT_TOKEN` — Telegram bot token (optional)
- `TELEGRAM_ADMIN_CHAT_ID` — Telegram admin chat ID (optional)
