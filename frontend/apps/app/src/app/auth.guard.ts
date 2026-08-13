import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  return http.get(`${config.apiBaseUrl}/auth/session`).pipe(
    map(() => true),
    catchError(() => of(router.createUrlTree(['/auth'], { queryParams: { returnUrl: state.url } }))),
  );
};
