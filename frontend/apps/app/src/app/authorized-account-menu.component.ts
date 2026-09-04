import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';

import { runAuthorizedLogout } from './authorized-logout';

export type AuthorizedAccountMenuTrigger = 'profile' | 'more' | 'avatar';

@Component({
  selector: 'tt-authorized-account-menu',
  standalone: true,
  template: `
    <span class="account-menu" [attr.data-trigger]="trigger()">
      <button
        type="button"
        class="account-trigger"
        [class.account-trigger--avatar]="trigger() === 'avatar'"
        [attr.aria-label]="triggerLabel()"
        [attr.aria-expanded]="open()"
        (click)="toggle()"
      >
        @switch (trigger()) {
          @case ('profile') {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
            <span>Профиль</span>
          }
          @case ('more') {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
            <span>Ещё</span>
          }
          @case ('avatar') {
            <span class="avatar-dot" aria-hidden="true"></span>
          }
        }
      </button>

      @if (open()) {
        <span class="account-popover" role="menu" aria-label="Аккаунт">
          <button
            type="button"
            class="logout-action"
            role="menuitem"
            [disabled]="busy()"
            (click)="logout()"
          >
            {{ busy() ? 'Выходим…' : 'Выйти' }}
          </button>
          @if (errorMessage()) {
            <span class="logout-error" role="alert">{{ errorMessage() }}</span>
          }
        </span>
      }
    </span>
  `,
  styles: `
    :host { display: contents; }
    .account-menu { position: relative; display: inline-flex; }
    .account-trigger { display: flex; flex-direction: column; align-items: center; gap: .25rem; padding: 0; border: 0; background: transparent; color: #5b6472; font: inherit; font-size: .625rem; cursor: pointer; }
    .account-trigger--avatar { width: 2rem; height: 2rem; border-radius: 999px; overflow: hidden; }
    .avatar-dot { width: 100%; height: 100%; border-radius: inherit; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
    .account-popover { position: absolute; z-index: 20; right: 0; bottom: calc(100% + .75rem); display: flex; width: 13rem; flex-direction: column; gap: .5rem; padding: .75rem; border: 1px solid rgb(245 247 250 / 10%); border-radius: .875rem; background: #1c222b; box-shadow: 0 16px 40px rgb(0 0 0 / 30%); }
    [data-trigger='avatar'] .account-popover { right: auto; bottom: 0; left: calc(100% + .75rem); }
    .logout-action { width: 100%; min-height: 2.75rem; border: 1px solid rgb(255 77 94 / 24%); border-radius: .6875rem; background: rgb(255 77 94 / 8%); color: #ff7b88; font: inherit; font-size: .875rem; font-weight: 700; cursor: pointer; }
    .logout-action:disabled { opacity: .55; cursor: default; }
    .logout-error { color: #ff9ba5; font-size: .75rem; line-height: 1.4; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorizedAccountMenuComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  readonly trigger = input<AuthorizedAccountMenuTrigger>('profile');
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');

  protected triggerLabel(): string {
    if (this.trigger() === 'avatar') return 'Открыть меню аккаунта';
    return this.trigger() === 'more' ? 'Ещё' : 'Профиль';
  }

  protected toggle(): void {
    if (this.busy()) return;
    this.errorMessage.set('');
    this.open.update((value) => !value);
  }

  protected logout(): void {
    runAuthorizedLogout(
      this.config.apiBaseUrl,
      (url, body) => this.http.post<void>(url, body),
      {
        isBusy: () => this.busy(),
        setBusy: (value) => this.busy.set(value),
        setError: (message) => this.errorMessage.set(message),
        onSuccess: () => {
          this.open.set(false);
          void this.router.navigateByUrl('/auth', { replaceUrl: true });
        },
      },
    );
  }
}
