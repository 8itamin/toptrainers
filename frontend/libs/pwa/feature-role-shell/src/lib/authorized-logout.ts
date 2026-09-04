import type { Observable } from 'rxjs';

export const AUTHORIZED_LOGOUT_ERROR = 'Не удалось выйти. Попробуйте ещё раз.';

export interface AuthorizedLogoutUi {
  isBusy(): boolean;
  setBusy(value: boolean): void;
  setError(message: string): void;
  onSuccess(): void;
}

export type AuthorizedLogoutPost = (url: string, body: null) => Observable<void>;

export function runAuthorizedLogout(
  apiBaseUrl: string,
  post: AuthorizedLogoutPost,
  ui: AuthorizedLogoutUi,
): void {
  if (ui.isBusy()) return;

  ui.setBusy(true);
  ui.setError('');
  post(`${apiBaseUrl}/auth/logout`, null).subscribe({
    error: () => {
      ui.setBusy(false);
      ui.setError(AUTHORIZED_LOGOUT_ERROR);
    },
    complete: () => {
      ui.setBusy(false);
      ui.onSuccess();
    },
  });
}
