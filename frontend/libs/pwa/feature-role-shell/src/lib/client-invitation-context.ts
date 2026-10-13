export function invitationToken(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null;
}
export function inviteDestination(token: string): string {
  return `/client-invite#token=${encodeURIComponent(token)}`;
}
