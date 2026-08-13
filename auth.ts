import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [Google],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const displayName = (user as { display_name?: string | null }).display_name ?? '';
        session.user.displayName = displayName.trim() || undefined;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Adopt legacy rows (user_categories / puzzle_completions /
      // category_completions) that were created under the old Supabase Auth
      // user id so the account keeps its history after the Auth.js migration.
      if (!user.id || !user.email) return;
      try {
        await getSupabaseAdmin().rpc('relink_legacy_user', {
          p_email: user.email,
          p_new_user_id: user.id,
        });
      } catch {
        // Non-critical — the one-time migration SQL covers stragglers.
      }
    },
  },
});