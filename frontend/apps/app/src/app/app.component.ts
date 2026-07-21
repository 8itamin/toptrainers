import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'tt-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="app-shell">
      <header class="app-header">
        <a class="brand" routerLink="/trainer" aria-label="TopTrainers">
          <span class="brand__mark">TT</span>
          <span>TopTrainers</span>
        </a>

        <nav class="role-nav" aria-label="Режим работы">
          <a routerLink="/trainer" routerLinkActive="is-active">Тренер</a>
          <a routerLink="/client" routerLinkActive="is-active">Клиент</a>
        </nav>
      </header>

      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
