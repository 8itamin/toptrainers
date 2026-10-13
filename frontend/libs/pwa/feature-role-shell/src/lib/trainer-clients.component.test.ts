// @vitest-environment jsdom
import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { ClientsApi, ProgramsApi, WorkoutHistoryApi } from '@toptrainers/shared/data-access';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { TrainerClientsComponent } from './trainer-clients.component';

beforeAll(() => TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()));
afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});
const card = {
  id: 'card',
  display_name: 'Иван',
  contact_email: 'ivan@example.com',
  client_account_id: null,
  relationship_id: null,
  group: 'pending',
  created_at: '2026-10-13T00:00:00Z',
};
const active = {
  ...card,
  client_account_id: 'client',
  relationship_id: 'relation',
  group: 'active',
};
async function fixture(cards = [card], apiOverrides = {}, programsOverrides = {}) {
  const api = {
    list: () => of({ items: cards, counts: { pending: cards.length }, next_cursor: null }),
    summary: () => of({ programs: [], completed_workouts: 0, last_completed_at: null }),
    ...apiOverrides,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ClientsApi, useValue: api },
      { provide: ProgramsApi, useValue: { list: () => of([]), ...programsOverrides } },
      {
        provide: WorkoutHistoryApi,
        useValue: { listTrainerClient: () => of({ items: [], next_cursor: null }) },
      },
    ],
  });
  const f = TestBed.createComponent(TrainerClientsComponent);
  await f.whenStable();
  f.detectChanges();
  return f;
}
function button(f: ReturnType<typeof TestBed.createComponent>, text: string) {
  return Array.from(
    f.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.textContent?.includes(text));
}
it('pending card has invite actions and cannot issue a program', async () => {
  const f = await fixture();
  button(f, 'Иван')?.click();
  f.detectChanges();
  expect(button(f, 'Отправить по email')).toBeTruthy();
  expect(button(f, 'Назначить')).toBeUndefined();
});
it('email failure keeps a link available to share', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const f = await fixture([card], {
    invite: () =>
      of({
        id: 'join',
        url: 'https://example.com/client-invite#token=abc',
        delivery_status: 'FAILED',
        expires_at: '2026-10-20',
      }),
  });
  button(f, 'Иван')?.click();
  f.detectChanges();
  button(f, 'Отправить по email')?.click();
  f.detectChanges();
  expect(f.nativeElement.textContent).toContain('Письмо не отправлено');
  expect(f.nativeElement.querySelector('a[href^="https://t.me/share/url"]')).toBeTruthy();
});
it('program load error is not hidden by card selection', async () => {
  const f = await fixture([active], {}, { list: () => throwError(() => new Error('offline')) });
  button(f, 'Иван')?.click();
  f.detectChanges();
  expect(f.nativeElement.textContent).toContain('Не удалось загрузить список программ');
});
it('terminating an old selected card does not overwrite a new selection', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const response = new Subject();
  const other = { ...card, id: 'other', display_name: 'Мария' };
  const f = await fixture([active, other], { terminate: () => response });
  button(f, 'Иван')?.click();
  f.detectChanges();
  button(f, 'Завершить сотрудничество')?.click();
  button(f, 'Мария')?.click();
  f.detectChanges();
  response.next({});
  f.detectChanges();
  expect(f.nativeElement.querySelector('aside h2')?.textContent).toBe('Мария');
});
