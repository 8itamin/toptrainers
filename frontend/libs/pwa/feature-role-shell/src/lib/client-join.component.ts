import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ClientsApi } from '@toptrainers/shared/data-access';
import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import { invitationToken } from './client-invitation-context';

@Component({
  selector: 'tt-client-join',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main>
    <a routerLink="/auth" [fragment]="'invite=' + token">toptrainers</a>
    <h1>Приглашение от тренера</h1>
    @if (loading()) {
      <p>Проверяем приглашение…</p>
    }
    @if (name()) {
      <p>{{ name() }}, вас приглашают подключиться к тренеру.</p>
      @if (emailRequired()) {
        <p>Войдите с email, на который пришло приглашение.</p>
      } @else {
        <p>Убедитесь, что тренер отправил эту ссылку именно вам.</p>
      }
      @if (accepted()) {
        <p>Вы подключены! Тренер теперь может назначить программу.</p>
        <a routerLink="/client">К тренировкам</a>
      } @else if (role() === 'client') {
        <button (click)="accept()" [disabled]="busy()">
          {{ busy() ? 'Подключаем…' : 'Принять приглашение' }}
        </button>
      } @else if (role()) {
        <p>Приглашение предназначено для клиентского аккаунта. Войдите в аккаунт клиента.</p>
      } @else {
        <a
          routerLink="/auth"
          [queryParams]="{ role: 'client', mode: 'register' }"
          [fragment]="'invite=' + token"
          >Зарегистрироваться</a
        >
        <a routerLink="/auth" [queryParams]="{ mode: 'login' }" [fragment]="'invite=' + token"
          >Уже есть аккаунт — войти</a
        >
      }
      @if (role() && !accepted()) {
        <a routerLink="/auth" [queryParams]="{ mode: 'login' }" [fragment]="'invite=' + token"
          >Войти в другой аккаунт</a
        >
      }
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
  </main>`,
  styles: `
    :host {
      display: grid;
      min-height: 100dvh;
      place-items: center;
      background: #14181d;
      color: #f5f7fa;
      font-family: system-ui;
    }
    main {
      width: min(28rem, calc(100% - 3rem));
      padding: 2rem;
      border-radius: 1rem;
      background: #1c222b;
      display: grid;
      gap: 1rem;
    }
    h1,
    p {
      margin: 0;
    }
    p {
      line-height: 1.5;
      color: #b6bfcc;
    }
    a {
      color: #c9f24b;
    }
    button {
      padding: 1rem;
      border: 0;
      border-radius: 0.75rem;
      background: #c9f24b;
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
    }
  `,
})
export class ClientJoinComponent {
  private readonly api = inject(ClientsApi);
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  protected readonly token =
    invitationToken(
      new URLSearchParams(inject(ActivatedRoute).snapshot.fragment ?? '').get('token'),
    ) ?? '';
  protected readonly name = signal('');
  protected readonly emailRequired = signal(false);
  protected readonly role = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly accepted = signal(false);
  protected readonly message = signal('');
  constructor() {
    inject(Meta).updateTag({ name: 'referrer', content: 'no-referrer' });
    if (!this.token) {
      this.loading.set(false);
      this.message.set('Ссылка недействительна.');
      return;
    }
    this.api.preview(this.token).subscribe({
      next: (r) => {
        this.name.set(r.display_name);
        this.emailRequired.set(r.email_required);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.set('Ссылка истекла или отменена. Попросите тренера новое приглашение.');
      },
    });
    this.http
      .get<{ role: string }>(`${this.config.apiBaseUrl}/auth/session`)
      .subscribe({ next: (r) => this.role.set(r.role), error: () => this.role.set('') });
  }
  protected accept() {
    if (this.busy() || this.accepted()) return;
    if (!navigator.onLine) {
      this.message.set('Для подключения нужен интернет.');
      return;
    }
    this.busy.set(true);
    this.message.set('');
    this.api.accept(this.token).subscribe({
      next: () => {
        this.accepted.set(true);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        const code = e.error?.detail?.code;
        this.message.set(
          code === 'INVITATION_EMAIL_MISMATCH'
            ? 'Войдите с email, на который пришло приглашение.'
            : 'Не удалось принять приглашение. Проверьте аккаунт и срок действия ссылки.',
        );
      },
    });
  }
}
