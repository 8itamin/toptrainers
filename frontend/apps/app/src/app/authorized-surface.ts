export type AuthorizedSurface = 'client' | 'trainer' | null;

export function authorizedSurfaceForUrl(url: string): AuthorizedSurface {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  if (path === '/client' || path.startsWith('/client/')) return 'client';
  if (path === '/trainer' || path.startsWith('/trainer/')) return 'trainer';
  return null;
}
