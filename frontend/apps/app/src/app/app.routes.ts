import { Routes } from '@angular/router';

import { authenticatedGuard } from './auth.guard';

export const APP_ROUTES: Routes = [
  {
    path: 'auth',
    pathMatch: 'full',
    title: 'TopTrainers — Вход',
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.AuthComponent),
  },
  {
    path: 'auth/verify-email',
    title: 'TopTrainers — Подтверждение email',
    data: { action: 'verify' },
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.AuthActionComponent),
  },
  {
    path: 'auth/reset-password',
    title: 'TopTrainers — Новый пароль',
    data: { action: 'reset' },
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.AuthActionComponent),
  },
  {
    path: 'trainer',
    pathMatch: 'full',
    title: 'TopTrainers — Сегодня',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerTodayComponent),
  },
  {
    path: 'trainer/programs',
    pathMatch: 'full',
    title: 'TopTrainers — Программы',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerHomeComponent),
  },
  {
    path: 'trainer/programs/builder',
    title: 'TopTrainers — Конструктор программы',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.ProgramBuilderComponent),
  },
  {
    path: 'client',
    pathMatch: 'full',
    title: 'TopTrainers — Сегодня',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.ClientTodayComponent),
  },
  {
    path: 'client/workout',
    pathMatch: 'full',
    title: 'TopTrainers — Упражнения на сегодня',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.ClientWorkoutListComponent),
  },
  {
    path: 'client/workout/player',
    title: 'TopTrainers — Тренировка',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.WorkoutPlayerComponent),
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
