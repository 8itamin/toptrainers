import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthApiService, UserRole } from './auth-api.service';

type AuthMode = 'register' | 'login' | 'forgot' | 'reset';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly authApi = inject(AuthApiService);

  protected readonly mode = signal<AuthMode>('register');
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly errorMessage = signal('');
  protected readonly authenticatedUser = signal<{
    email: string | null | undefined;
    role: UserRole | null;
  } | null>(this.getStoredUser());

  protected readonly registerData = {
    email: '',
    password: '',
    role: 'trainer' as UserRole
  };

  protected readonly loginData = {
    email: '',
    password: ''
  };

  protected readonly forgotData = {
    email: ''
  };

  protected readonly resetData = {
    password: '',
    confirmPassword: '',
    accessToken: '',
    refreshToken: ''
  };

  ngOnInit(): void {
    this.restoreRecoverySessionFromHash();
  }

  protected setMode(mode: AuthMode): void {
    this.message.set('');
    this.errorMessage.set('');
    this.mode.set(mode);
  }

  protected async register(): Promise<void> {
    this.loading.set(true);
    this.message.set('');
    this.errorMessage.set('');

    try {
      const response = await this.authApi.register(this.registerData);
      this.message.set(response.message);

      if (response.user) {
        this.authenticatedUser.set({
          email: response.user.email,
          role: response.user.role
        });
      }

      if (response.session) {
        localStorage.setItem('toptrainers_session', JSON.stringify(response.session));
      }

      localStorage.setItem(
        'toptrainers_user',
        JSON.stringify({
          email: response.user?.email ?? this.registerData.email,
          role: response.user?.role ?? this.registerData.role
        })
      );

      this.registerData.password = '';
    } catch (error) {
      this.errorMessage.set(this.extractErrorMessage(error, 'Не удалось зарегистрироваться.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async login(): Promise<void> {
    this.loading.set(true);
    this.message.set('');
    this.errorMessage.set('');

    try {
      const response = await this.authApi.login(this.loginData);
      this.message.set(response.message);
      this.authenticatedUser.set({
        email: response.user?.email ?? this.loginData.email,
        role: response.user?.role ?? null
      });

      if (response.session) {
        localStorage.setItem('toptrainers_session', JSON.stringify(response.session));
      }

      localStorage.setItem(
        'toptrainers_user',
        JSON.stringify({
          email: response.user?.email ?? this.loginData.email,
          role: response.user?.role ?? null
        })
      );

      this.loginData.password = '';
    } catch (error) {
      this.errorMessage.set(this.extractErrorMessage(error, 'Не удалось выполнить вход.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async forgotPassword(): Promise<void> {
    this.loading.set(true);
    this.message.set('');
    this.errorMessage.set('');

    try {
      const response = await this.authApi.forgotPassword(this.forgotData);
      this.message.set(response.message);
    } catch (error) {
      this.errorMessage.set(
        this.extractErrorMessage(error, 'Не удалось отправить письмо для сброса пароля.')
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async resetPassword(): Promise<void> {
    if (this.resetData.password !== this.resetData.confirmPassword) {
      this.errorMessage.set('Пароли не совпадают.');
      return;
    }

    if (!this.resetData.accessToken || !this.resetData.refreshToken) {
      this.errorMessage.set('Ссылка для восстановления недействительна или устарела.');
      return;
    }

    this.loading.set(true);
    this.message.set('');
    this.errorMessage.set('');

    try {
      const response = await this.authApi.resetPassword({
        accessToken: this.resetData.accessToken,
        refreshToken: this.resetData.refreshToken,
        password: this.resetData.password
      });

      this.message.set(response.message);
      this.resetData.password = '';
      this.resetData.confirmPassword = '';
      this.resetData.accessToken = '';
      this.resetData.refreshToken = '';
      window.location.hash = '';
      this.setMode('login');
    } catch (error) {
      this.errorMessage.set(
        this.extractErrorMessage(error, 'Не удалось обновить пароль.')
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected logout(): void {
    localStorage.removeItem('toptrainers_session');
    localStorage.removeItem('toptrainers_user');
    this.authenticatedUser.set(null);
    this.message.set('Вы вышли из аккаунта.');
    this.errorMessage.set('');
    this.setMode('login');
  }

  private getStoredUser(): { email: string | null; role: UserRole | null } | null {
    const rawUser = localStorage.getItem('toptrainers_user');

    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as { email: string | null; role: UserRole | null };
    } catch {
      return null;
    }
  }

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error
    ) {
      const message = error.error.message;

      if (typeof message === 'string') {
        return message;
      }
    }

    return fallback;
  }

  private restoreRecoverySessionFromHash(): void {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (!hash) {
      return;
    }

    const params = new URLSearchParams(hash);

    if (params.get('type') !== 'recovery') {
      return;
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return;
    }

    this.resetData.accessToken = accessToken;
    this.resetData.refreshToken = refreshToken;
    this.message.set('Введите новый пароль для завершения восстановления.');
    this.errorMessage.set('');
    this.mode.set('reset');
  }
}
