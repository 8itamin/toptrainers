import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';

import { AuthorizedAccountMenuComponent } from './authorized-account-menu.component';
import { authorizedSurfaceForUrl, type AuthorizedSurface } from './authorized-surface';

@Component({
  selector: 'tt-root',
  standalone: true,
  imports: [RouterOutlet, AuthorizedAccountMenuComponent],
  template: `
    <div class="app-shell">
      <router-outlet />

      @if (authorizedSurface() === 'client') {
        <span class="account-access account-access--client">
          <tt-authorized-account-menu trigger="profile" />
        </span>
      }

      @if (authorizedSurface() === 'trainer') {
        <span class="account-access account-access--trainer-mobile">
          <tt-authorized-account-menu trigger="more" />
        </span>
        <span class="account-access account-access--trainer-desktop">
          <tt-authorized-account-menu trigger="avatar" />
        </span>
      }
    </div>
  `,
  styles: `
    .account-access { position: fixed; z-index: 100; }
    .account-access--client {
      right: max(1.25rem, calc((100vw - 30rem) / 2 + 1.25rem));
      bottom: calc(.75rem + env(safe-area-inset-bottom));
    }
    .account-access--trainer-mobile {
      right: 18%;
      bottom: calc(.75rem + env(safe-area-inset-bottom));
    }
    .account-access--trainer-desktop { display: none; }
    @media (min-width: 980px) {
      .account-access--trainer-mobile { display: none; }
      .account-access--trainer-desktop { display: inline-flex; left: 1rem; bottom: 1rem; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  protected readonly authorizedSurface = signal<AuthorizedSurface>(
    authorizedSurfaceForUrl(this.router.url),
  );

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.authorizedSurface.set(authorizedSurfaceForUrl(event.urlAfterRedirects));
      }
    });
  }
}
