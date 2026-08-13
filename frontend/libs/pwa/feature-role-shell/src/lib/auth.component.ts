import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import { isUserRole, type UserRole } from '@toptrainers/shared/domain';

type AuthMode = 'register' | 'login';
type AuthRole = Extract<UserRole, 'client' | 'trainer'>;

interface AuthResponse {
  account_id: string;
  role: UserRole;
}

interface MessageResponse { message: string; }

const ROLE_HOME: Record<UserRole, string> = {
  client: '/client',
  trainer: '/trainer',
  admin: '/trainer',
};

@Component({
  selector: 'tt-auth',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-screen">
      <div class="auth-shell" [class.has-rail]="isTrainerRegister()">
        @if (isTrainerRegister()) {
          <aside class="brand-rail">
            <div>
              <a class="brand" href="https://toptrainers.ru" aria-label="TopTrainers — главная">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
                <span>toptrainers</span>
              </a>
              <p class="rail-kicker">РЕЖИМ СИЛЫ · ДЛЯ ТРЕНЕРА</p>
              <h3>Ведите зал с одного табло</h3>
            </div>
            <ul class="rail-benefits">
              <li><span class="check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>Конструктор программ</li>
              <li><span class="check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>Очередь «Обработать»</li>
              <li><span class="check"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>CRM и прогресс клиентов</li>
            </ul>
          </aside>
        }

        <div class="auth-card">
          @if (!isTrainerRegister()) {
            <a class="brand" href="https://toptrainers.ru" aria-label="TopTrainers — главная">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
              <span>toptrainers</span>
            </a>
          }

          @if (mode() === 'register') {
            @if (isTrainerRegister()) {
              <div class="card-heading">
                <h3>Регистрация тренера</h3>
                <span class="step">шаг 1 / 2</span>
              </div>
            } @else {
              <h1>Создать<br />аккаунт</h1>
              <p class="lede">30 секунд — и вы на дорожке. Настроим детали позже.</p>

              <div class="field-label">Я регистрируюсь как</div>
              <div class="role-toggle" role="radiogroup" aria-label="Роль">
                <button type="button" role="radio" [attr.aria-checked]="role() === 'client'" [class.is-active]="role() === 'client'" (click)="role.set('client')">
                  Клиент
                </button>
                <button type="button" role="radio" [attr.aria-checked]="role() === 'trainer'" [class.is-active]="role() === 'trainer'" (click)="role.set('trainer')">
                  Тренер
                </button>
              </div>
            }
          } @else {
            <h1>С<br />возвращением</h1>
            <p class="lede">Войдите, чтобы продолжить работу с программами и тренировками.</p>
          }

          <div class="oauth-list">
            <button type="button" class="oauth oauth--yandex" (click)="oauthClick('Яндекс')">
              <span class="oauth__chip">Я</span>Продолжить с Яндекс<span class="oauth__arrow">›</span>
            </button>
            <button type="button" class="oauth oauth--tbank" (click)="oauthClick('Т-Банк')">
              <span class="oauth__chip">Т</span>Продолжить с Т-Банк<span class="oauth__arrow">›</span>
            </button>
            <button type="button" class="oauth oauth--vk" (click)="oauthClick('VK')">
              <span class="oauth__chip">VK</span>Продолжить с VK<span class="oauth__arrow">›</span>
            </button>
          </div>

          <div class="divider"><span></span>ИЛИ ПО EMAIL<span></span></div>

          <form (ngSubmit)="submit()">
            <label class="input">
              <input name="email" type="email" placeholder="you@email.ru" [(ngModel)]="email" required autocomplete="email" />
            </label>
            <label class="input">
              <input
                name="password"
                type="password"
                [placeholder]="mode() === 'register' ? 'Пароль · от 12 символов' : 'Пароль'"
                [(ngModel)]="password"
                required
                [minlength]="mode() === 'register' ? 12 : 1"
                [autocomplete]="mode() === 'register' ? 'new-password' : 'current-password'"
              />
            </label>

            <button class="cta" type="submit" [disabled]="busy()">
              {{ busy() ? 'Проверяем…' : ctaLabel() }}
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>

          @if (message()) {
            <p class="form-message">{{ message() }}</p>
          }

          @if (mode() === 'register') {
            <p class="legal">Регистрируясь, вы принимаете <a href="#">оферту</a> и <a href="#">политику данных</a></p>
            @if (isTrainerRegister()) {
              <p class="switch">Уже с нами? <button type="button" (click)="setMode('login')">Войти в кабинет</button></p>
              <p class="switch-role">Не тренер? <button type="button" (click)="role.set('client')">Зарегистрироваться как клиент</button></p>
            } @else {
              <p class="switch">Уже есть аккаунт? <button type="button" (click)="setMode('login')">Войти</button></p>
            }
          } @else {
            <p class="switch">Ещё нет аккаунта? <button type="button" (click)="setMode('register')">Зарегистрироваться</button></p>
            <p class="switch"><button type="button" (click)="requestPasswordReset()">Не помню пароль</button></p>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .auth-screen {
      display: flex;
      justify-content: center;
      padding: clamp(1rem, 6vw, 3rem) 1rem;
      background: #14181d;
      min-height: 100dvh;
      font-family: 'Golos Text', system-ui, sans-serif;
    }
    .auth-shell { width: 100%; max-width: 26rem; }
    .brand-rail { display: none; }
    .rail-kicker { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #8a94a6; margin: 0.375rem 0 0; }
    .brand-rail h3 { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.5rem; line-height: 1.1; letter-spacing: -0.02em; color: #f5f7fa; margin: 1.875rem 0 0; }
    .rail-benefits { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.875rem; }
    .rail-benefits li { display: flex; align-items: center; gap: 0.6875rem; color: #c7ccd6; font-size: 0.8125rem; }
    .rail-benefits .check { display: inline-flex; align-items: center; justify-content: center; width: 1.375rem; height: 1.375rem; border-radius: 0.375rem; background: rgb(201 242 75 / 14%); color: #c9f24b; flex-shrink: 0; }
    .card-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .card-heading h3 { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: 1.375rem; letter-spacing: -0.02em; color: #f5f7fa; margin: 0; }
    .step { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; white-space: nowrap; }
    .switch-role { font-size: 0.8125rem; color: #8a94a6; margin: 0.375rem 0 0; text-align: center; }
    .switch-role button { border: 0; background: none; color: #8a94a6; text-decoration: underline; font: inherit; cursor: pointer; padding: 0; }
    @media (min-width: 860px) {
      .has-rail {
        max-width: 45rem;
        display: flex;
        border-radius: 1.5rem;
        overflow: hidden;
        background: #14181d;
        border: 1px solid rgb(245 247 250 / 6%);
        box-shadow: 0 30px 80px rgb(20 24 29 / 28%);
      }
      .has-rail .brand-rail {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        width: 16.875rem;
        padding: 2.125rem 1.875rem;
        background: #1c222b;
        border-right: 1px solid rgb(245 247 250 / 6%);
      }
      .has-rail .auth-card { flex: 1; max-width: none; padding: 2.125rem 2.5rem; }
    }
    .brand { display: inline-flex; align-items: center; gap: 0.5rem; color: #c9f24b; text-decoration: none; }
    .brand span { font-weight: 700; font-size: 1.0625rem; color: #f5f7fa; }
    h1 {
      font-family: 'Unbounded', sans-serif;
      font-weight: 700;
      font-size: 1.75rem;
      line-height: 1.08;
      letter-spacing: -0.025em;
      color: #f5f7fa;
      margin: 1.375rem 0 0;
    }
    .lede { font-size: 0.875rem; line-height: 1.45; color: #8a94a6; margin: 0.625rem 0 0; }
    .field-label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #5b6472; margin-top: 1.125rem; }
    .role-toggle { display: flex; gap: 0.375rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 6%); border-radius: 0.875rem; padding: 0.3125rem; margin-top: 0.375rem; }
    .role-toggle button {
      flex: 1;
      height: 2.75rem;
      border: 0;
      border-radius: 0.625rem;
      background: transparent;
      color: #8a94a6;
      font: inherit;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .role-toggle button.is-active { background: #c9f24b; color: #14181d; font-weight: 700; }
    .oauth-list { display: flex; flex-direction: column; gap: 0.625rem; margin-top: 1.25rem; }
    .oauth {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      height: 3.375rem;
      padding: 0 1.125rem;
      border: 0;
      border-radius: 0.8125rem;
      font: inherit;
      font-weight: 600;
      font-size: 0.9375rem;
      cursor: pointer;
      text-align: left;
    }
    .oauth__chip { display: inline-flex; align-items: center; justify-content: center; width: 1.625rem; height: 1.625rem; border-radius: 0.4375rem; font-weight: 700; font-size: 0.875rem; }
    .oauth__arrow { margin-left: auto; }
    .oauth--yandex { background: #f5f7fa; color: #14181d; }
    .oauth--yandex .oauth__chip { background: #fc3f1d; color: #fff; }
    .oauth--yandex .oauth__arrow { color: #8a94a6; }
    .oauth--tbank { background: #ffdd2d; color: #14181d; }
    .oauth--tbank .oauth__chip { background: #14181d; color: #ffdd2d; }
    .oauth--tbank .oauth__arrow { color: rgb(20 24 29 / 40%); }
    .oauth--vk { background: #0077ff; color: #fff; }
    .oauth--vk .oauth__chip { background: rgb(255 255 255 / 16%); color: #fff; }
    .oauth--vk .oauth__arrow { color: rgb(255 255 255 / 55%); }
    .divider { display: flex; align-items: center; gap: 0.75rem; margin: 1.25rem 0; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.14em; color: #5b6472; }
    .divider span { flex: 1; height: 1px; background: rgb(245 247 250 / 10%); }
    form { display: flex; flex-direction: column; gap: 0.625rem; }
    .input { display: block; }
    .input input {
      width: 100%;
      height: 3.375rem;
      padding: 0 1rem;
      background: #1c222b;
      border: 1px solid rgb(245 247 250 / 8%);
      border-radius: 0.8125rem;
      color: #f5f7fa;
      font: inherit;
      font-size: 0.9375rem;
    }
    .input input::placeholder { color: #5b6472; }
    .input input:focus { outline: 2px solid #2f5cff; outline-offset: 1px; }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 3.5rem;
      margin-top: 0.375rem;
      border: 0;
      border-radius: 0.8125rem;
      background: #c9f24b;
      color: #14181d;
      font: inherit;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
    }
    .cta:disabled { opacity: 0.6; cursor: default; }
    .form-message { font-size: 0.875rem; color: #c9f24b; margin: 0.875rem 0 0; }
    .legal { font-size: 0.6875rem; line-height: 1.5; color: #5b6472; margin: 0.875rem 0 0; text-align: center; }
    .legal a { color: #8a94a6; text-decoration: underline; }
    .switch { font-size: 0.8125rem; color: #8a94a6; margin: 1rem 0 0; text-align: center; }
    .switch button { border: 0; background: none; color: #c9f24b; font: inherit; font-weight: 600; cursor: pointer; padding: 0; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  protected readonly mode = signal<AuthMode>('register');
  protected readonly role = signal<AuthRole>('trainer');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected email = '';
  protected password = '';

  protected readonly isTrainerRegister = computed(() => this.mode() === 'register' && this.role() === 'trainer');
  protected readonly ctaLabel = computed(() => {
    if (this.mode() !== 'register') return 'Войти';
    return this.isTrainerRegister() ? 'Продолжить' : 'Создать аккаунт';
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const role = params.get('role');
    if (role === 'trainer' || role === 'client') {
      this.role.set(role);
    }
    const mode = params.get('mode');
    if (mode === 'login' || mode === 'register') {
      this.mode.set(mode);
    }
  }

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.message.set('');
  }

  protected oauthClick(provider: string): void {
    this.message.set(`Вход через ${provider} появится в одном из следующих обновлений.`);
  }

  protected submit(): void {
    this.busy.set(true);
    this.message.set('');

    const path = this.mode() === 'register' ? 'register' : 'login';
    const body =
      this.mode() === 'register'
        ? { email: this.email, password: this.password, role: this.role() }
        : { email: this.email, password: this.password };

    this.http.post<AuthResponse | MessageResponse>(`${this.config.apiBaseUrl}/auth/${path}`, body).subscribe({
      next: (result) => {
        if (this.mode() === 'register') {
          this.message.set('Проверьте почту и подтвердите email — после этого можно войти.');
          return;
        }
        const { role } = result as AuthResponse;
        const destination = isUserRole(role) ? ROLE_HOME[role] : '/trainer';
        this.router.navigateByUrl(destination);
      },
      error: () => {
        this.message.set(
          this.mode() === 'register'
            ? 'Не удалось создать аккаунт. Проверьте email и пароль от 12 символов.'
            : 'Не удалось войти. Проверьте email и пароль.',
        );
        this.busy.set(false);
      },
      complete: () => this.busy.set(false),
    });
  }

  protected requestPasswordReset(): void {
    if (!this.email) {
      this.message.set('Введите email, чтобы получить ссылку для сброса пароля.');
      return;
    }
    this.busy.set(true);
    this.http.post<MessageResponse>(`${this.config.apiBaseUrl}/auth/password-reset/request`, { email: this.email }).subscribe({
      next: () => this.message.set('Если аккаунт существует, ссылка для сброса отправлена на почту.'),
      error: () => this.message.set('Не удалось отправить письмо. Попробуйте позже.'),
      complete: () => this.busy.set(false),
    });
  }
}
