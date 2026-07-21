import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Showcase pages remain dynamic server-rendered: the host name later selects a
 * trainer slug and published block document without rebuilding the application.
 */
export const SERVER_ROUTES: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
