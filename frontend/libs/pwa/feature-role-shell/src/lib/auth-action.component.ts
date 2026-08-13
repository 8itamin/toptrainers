import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';

interface MessageResponse { message: string; }

@Component({
  selector: 'tt-auth-action',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="shell">
      <a routerLink="/auth" class="brand">toptrainers</a>
      @if (action() === 'verify') {
        <h1>Подтвердить email</h1>
        <p>Подтвердите адрес, чтобы безопасно включить вход в аккаунт.</p>
        <button (click)="verify()" [disabled]="busy() || !token">{{ busy() ? 'Проверяем…' : 'Подтвердить email' }}</button>
      } @else {
        <h1>Новый пароль</h1>
        <p>Используйте не менее 12 символов, включая строчные, прописные буквы и цифры.</p>
        <form (ngSubmit)="reset()">
          <input name="password" type="password" [(ngModel)]="password" minlength="12" autocomplete="new-password" required placeholder="Новый пароль" />
          <button type="submit" [disabled]="busy() || !token">{{ busy() ? 'Сохраняем…' : 'Сохранить пароль' }}</button>
        </form>
      }
      @if (message()) { <p class="message">{{ message() }}</p> }
      <a routerLink="/auth">К входу</a>
    </main>
  `,
  styles: `:host{display:grid;min-height:100dvh;place-items:center;background:#14181d;color:#f5f7fa;font-family:system-ui}.shell{width:min(100% - 2rem,28rem);display:grid;gap:1rem;padding:2rem;border:1px solid #2b3340;border-radius:1rem;background:#1c222b}.brand,a{color:#c9f24b}h1,p{margin:0}p{color:#b6bfcc;line-height:1.5}input,button{box-sizing:border-box;width:100%;min-height:3rem;border-radius:.75rem;font:inherit}input{padding:0 .9rem;border:1px solid #586273;background:#14181d;color:#f5f7fa}button{border:0;background:#c9f24b;color:#14181d;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:default}form{display:grid;gap:.75rem}.message{color:#c9f24b}`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthActionComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  protected readonly action = signal(this.route.snapshot.data['action'] === 'reset' ? 'reset' : 'verify');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected password = '';

  protected verify(): void {
    this.submit('/auth/verify-email', { token: this.token });
  }

  protected reset(): void {
    this.submit('/auth/password-reset/confirm', { token: this.token, password: this.password });
  }

  private submit(path: string, body: object): void {
    this.busy.set(true);
    this.message.set('');
    this.http.post<MessageResponse>(`${this.config.apiBaseUrl}${path}`, body).subscribe({
      next: (result) => this.message.set(result.message),
      error: () => this.message.set('Ссылка недействительна или срок её действия истёк.'),
      complete: () => this.busy.set(false),
    });
  }
}
