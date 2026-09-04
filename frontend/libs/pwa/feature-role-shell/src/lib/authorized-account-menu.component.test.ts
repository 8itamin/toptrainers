// @vitest-environment jsdom
import '@angular/compiler';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RUNTIME_CONFIG } from '@toptrainers/shared/config';

import { AuthorizedAccountMenuComponent } from './authorized-account-menu.component';

describe('authorized account menu logout', () => {
  let http: HttpTestingController;
  const navigateByUrl = vi.fn();

  beforeEach(async () => {
    navigateByUrl.mockReset();
    navigateByUrl.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [AuthorizedAccountMenuComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1', release: 'test' } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function setup() {
    const fixture = TestBed.createComponent(AuthorizedAccountMenuComponent);
    fixture.componentRef.setInput('trigger', 'profile');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="account-menu-trigger"]');
    trigger?.click();
    fixture.detectChanges();

    const logout = fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="logout-action"]');
    return { fixture, logout };
  }

  it('POSTs current-session logout and redirects to auth with replaceUrl after 204', async () => {
    const { fixture, logout } = setup();

    expect(logout).not.toBeNull();
    logout?.click();

    const request = http.expectOne('/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });

    fixture.detectChanges();
    await fixture.whenStable();

    expect(navigateByUrl).toHaveBeenCalledWith('/auth', { replaceUrl: true });
  });

  it('keeps the user in the authorized UI and shows an error when logout fails', () => {
    const { fixture, logout } = setup();

    logout?.click();
    const request = http.expectOne('/api/v1/auth/logout');
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Не удалось выйти. Попробуйте ещё раз.',
    );
    expect(fixture.nativeElement.querySelector('[data-testid="logout-action"]')).not.toBeNull();
  });

  it('does not send a second logout request while the first is in flight', () => {
    const { logout } = setup();

    logout?.click();
    logout?.click();

    expect(http.match('/api/v1/auth/logout')).toHaveLength(1);
  });
});
