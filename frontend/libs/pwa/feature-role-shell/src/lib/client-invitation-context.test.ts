import { describe, expect, it } from 'vitest';
import { invitationToken, inviteDestination } from './client-invitation-context';

describe('invitation navigation', () => {
  it('accepts only opaque token, never external return URL', () => {
    expect(invitationToken('https://evil.example')).toBeNull();
    expect(invitationToken('a'.repeat(43))).toBe('a'.repeat(43));
    expect(inviteDestination('a'.repeat(43))).toBe('/client-invite#token='+'a'.repeat(43));
  });
});
