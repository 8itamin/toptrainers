import { Routes } from '@angular/router';

export const SHOWCASE_ROUTES: Routes = [
  {
    path: '',
    title: 'TopTrainers — тренировки с тренером',
    loadComponent: () =>
      import('./pages/showcase-home.component').then((module) => module.ShowcaseHomeComponent),
  },
  {
    path: '**',
    title: 'TopTrainers — витрина тренера',
    loadComponent: () =>
      import('./pages/showcase-home.component').then((module) => module.ShowcaseHomeComponent),
  },
];
