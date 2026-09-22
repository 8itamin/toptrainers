export type TrainerNavigationId =
  | 'today'
  | 'clients'
  | 'programs'
  | 'chats'
  | 'competitions'
  | 'showcase';

export type TrainerNavigationIcon =
  | 'home'
  | 'clients'
  | 'programs'
  | 'chats'
  | 'competitions'
  | 'showcase';

export interface TrainerNavigationItem {
  readonly id: TrainerNavigationId;
  readonly path: string;
  readonly label: string;
  readonly icon: TrainerNavigationIcon;
}

export const TRAINER_NAVIGATION: readonly TrainerNavigationItem[] = [
  { id: 'today', path: '/trainer', label: 'Сегодня', icon: 'home' },
  { id: 'clients', path: '/trainer/clients', label: 'Клиенты', icon: 'clients' },
  { id: 'programs', path: '/trainer/programs', label: 'Программы', icon: 'programs' },
  { id: 'chats', path: '/trainer/chats', label: 'Чаты', icon: 'chats' },
  {
    id: 'competitions',
    path: '/trainer/competitions',
    label: 'Соревн.',
    icon: 'competitions',
  },
  { id: 'showcase', path: '/trainer/showcase', label: 'Витрина', icon: 'showcase' },
];

function matchesRoute(path: string, route: string): boolean {
  return path === route || path.startsWith(`${route}/`);
}

export function activeTrainerNavigationId(url: string): TrainerNavigationId | null {
  const path = url.split(/[?#]/, 1)[0] ?? '';

  if (path === '/trainer') {
    return 'today';
  }
  if (matchesRoute(path, '/trainer/programs') || matchesRoute(path, '/trainer/library')) {
    return 'programs';
  }

  return (
    TRAINER_NAVIGATION.find((item) => item.id !== 'today' && matchesRoute(path, item.path))?.id ??
    null
  );
}
