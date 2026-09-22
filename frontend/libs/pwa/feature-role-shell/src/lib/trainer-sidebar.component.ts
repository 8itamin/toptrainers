import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import {
  activeTrainerNavigationId,
  TRAINER_NAVIGATION,
  type TrainerNavigationItem,
} from './trainer-navigation';

@Component({
  selector: 'tt-trainer-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside class="sidebar" aria-label="Навигация тренера">
      <a class="sidebar-logo" routerLink="/trainer" aria-label="TopTrainers: Сегодня">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg>
      </a>
      <nav class="sidebar-nav">
        @for (item of items; track item.id) {
          <a class="side-item" [class.is-active]="isActive(item)" [routerLink]="item.path">
            <span class="side-icon">
              @switch (item.icon) {
                @case ('home') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg> }
                @case ('clients') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg> }
                @case ('programs') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg> }
                @case ('chats') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg> }
                @case ('competitions') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg> }
                @case ('showcase') { <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg> }
              }
            </span>
            <span>{{ item.label }}</span>
          </a>
        }
      </nav>
      <span class="sidebar-avatar" aria-hidden="true"></span>
    </aside>
  `,
  styles: `
    :host { display: none; }
    @media (min-width: 1080px) {
      :host { display: block; width: 5.5rem; flex: 0 0 5.5rem; }
      .sidebar { position: sticky; top: 0; height: 100dvh; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; padding: 1.5rem 0; background: #0e1116; border-right: 1px solid rgb(245 247 250 / 6%); }
      .sidebar-logo { color: #c9f24b; }
      .sidebar-nav { display: flex; width: 4rem; flex-direction: column; align-items: center; gap: 1.375rem; margin-top: 2rem; }
      .side-item { display: flex; width: 100%; flex-direction: column; align-items: center; gap: 0.3125rem; color: #8a94a6; text-align: center; text-decoration: none; white-space: nowrap; font-size: 0.5625rem; }
      .side-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
      .side-item.is-active { color: #c9f24b; font-weight: 600; }
      .side-item.is-active .side-icon { background: rgb(201 242 75 / 12%); }
      .sidebar-avatar { width: 2.5rem; height: 2.5rem; margin-top: auto; border-radius: 999px; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerSidebarComponent {
  private readonly router = inject(Router);
  protected readonly items = TRAINER_NAVIGATION;
  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { requireSync: true },
  );

  protected isActive(item: TrainerNavigationItem): boolean {
    return activeTrainerNavigationId(this.currentUrl()) === item.id;
  }
}
