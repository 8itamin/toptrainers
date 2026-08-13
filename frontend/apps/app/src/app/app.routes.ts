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
    path: 'trainer/clients',
    pathMatch: 'full',
    title: 'TopTrainers — Клиенты',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerClientsComponent),
  },
  {
    path: 'trainer/chats',
    pathMatch: 'full',
    title: 'TopTrainers — Чаты',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerChatsComponent),
  },
  {
    path: 'trainer/competitions',
    pathMatch: 'full',
    title: 'TopTrainers — Соревнования',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerCompetitionsComponent),
  },
  {
    path: 'trainer/showcase',
    pathMatch: 'full',
    title: 'TopTrainers — Витрина',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerShowcasePlaceholderComponent),
  },
  {
    path: 'trainer/programs',
    pathMatch: 'full',
    title: 'TopTrainers — Программы',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.ProgramBuilderComponent),
  },
  {
    path: 'trainer/programs/library',
    title: 'TopTrainers — Упражнения и тренировки',
    canActivate: [authenticatedGuard],
    loadComponent: () =>
      import('@toptrainers/pwa/feature-role-shell').then((module) => module.TrainerProgramsComponent),
  },
  { path: 'trainer/programs/builder', pathMatch: 'full', redirectTo: 'trainer/programs' },
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
