import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: 'auth',
    title: 'TopTrainers — Вход',
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.AuthComponent),
  },
  {
    path: 'trainer',
    title: 'TopTrainers — Кабинет тренера',
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerHomeComponent),
  },
  {
    path: 'client',
    title: 'TopTrainers — Сегодня',
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.ClientTodayComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'trainer',
  },
  {
    path: '**',
    redirectTo: 'trainer',
  },
];
