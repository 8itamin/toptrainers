import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AUTHORIZED_LOGOUT_ERROR, runAuthorizedLogout } from './authorized-logout';

describe('authorized account menu logout', () => {
  function setup() {
    const request = new Subject<void>();
    const post = vi.fn(() => request.asObservable());
    const onSuccess = vi.fn();
    let busy = false;
    let errorMessage = '';

    const ui = {
      isBusy: () => busy,
      setBusy: (value: boolean) => {
        busy = value;
      },
      setError: (message: string) => {
        errorMessage = message;
      },
      onSuccess,
    };

    return {
      request,
      post,
      onSuccess,
      ui,
      busy: () => busy,
      errorMessage: () => errorMessage,
    };
  }

  it('POSTs the current-session logout endpoint and completes the authorized flow', () => {
    const state = setup();

    runAuthorizedLogout('/api/v1', state.post, state.ui);

    expect(state.post).toHaveBeenCalledWith('/api/v1/auth/logout', null);
    expect(state.busy()).toBe(true);
    expect(state.onSuccess).not.toHaveBeenCalled();

    state.request.complete();

    expect(state.busy()).toBe(false);
    expect(state.onSuccess).toHaveBeenCalledOnce();
  });

  it('keeps the authorized flow active and exposes an error when logout fails', () => {
    const state = setup();

    runAuthorizedLogout('/api/v1', state.post, state.ui);
    state.request.error(new Error('server error'));

    expect(state.busy()).toBe(false);
    expect(state.errorMessage()).toBe(AUTHORIZED_LOGOUT_ERROR);
    expect(state.onSuccess).not.toHaveBeenCalled();
  });

  it('does not send a second logout request while the first is in flight', () => {
    const state = setup();

    runAuthorizedLogout('/api/v1', state.post, state.ui);
    runAuthorizedLogout('/api/v1', state.post, state.ui);

    expect(state.post).toHaveBeenCalledTimes(1);
  });
});
