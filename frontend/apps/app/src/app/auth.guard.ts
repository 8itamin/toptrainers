import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';

type AppRole = 'client' | 'trainer' | 'admin';

interface AuthSessionResponse {
  account_id: string;
  role: AppRole;
}

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  return http.get(`${config.apiBaseUrl}/auth/session`).pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } }))),
  );
};

const roleGuard = (allowedRoles: readonly AppRole[]): CanActivateFn => (_route, state) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  return http.get<AuthSessionResponse>(`${config.apiBaseUrl}/auth/session`).pipe(
    map((session) => {
      if (allowedRoles.includes(session.role)) return true;
      if (session.role === 'client') return router.createUrlTree(['/client']);
      return router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } });
    }),
    catchError(() => of(router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } }))),
  );
};

export const trainerGuard = roleGuard(['trainer']);
export const clientGuard = roleGuard(['client']);
