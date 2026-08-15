// Shared realtime channel helpers (imported by both server routes and client).
// The realtime broadcast channel a user subscribes to for incoming DMs.
export function dmChannel(userId: string): string {
  return `dm:${userId}`;
}