import { describe, expect, it } from 'vitest';

import { activeTrainerNavigationId, TRAINER_NAVIGATION } from './trainer-navigation';

describe('trainer navigation', () => {
  it('provides the six desktop trainer destinations with vector icon identifiers', () => {
    expect(TRAINER_NAVIGATION.map(({ id, path, icon }) => ({ id, path, icon }))).toEqual([
      { id: 'today', path: '/trainer', icon: 'home' },
      { id: 'clients', path: '/trainer/clients', icon: 'clients' },
      { id: 'programs', path: '/trainer/programs', icon: 'programs' },
      { id: 'chats', path: '/trainer/chats', icon: 'chats' },
      { id: 'competitions', path: '/trainer/competitions', icon: 'competitions' },
      { id: 'showcase', path: '/trainer/showcase', icon: 'showcase' },
    ]);
  });

  it.each([
    ['/trainer', 'today'],
    ['/trainer?tab=queue', 'today'],
    ['/trainer/programs/library', 'programs'],
    ['/trainer/library/workout#blocks', 'programs'],
    ['/trainer/chats', 'chats'],
    ['/client', null],
  ])('resolves %s to %s', (url, expected) => {
    expect(activeTrainerNavigationId(url)).toBe(expected);
  });

  it.each([
    ['/trainer/clients/ivan', 'clients'],
    ['/trainer/competitions/august', 'competitions'],
    ['/trainer/programs-archive', null],
    ['/trainer/clientship', null],
  ])('resolves %s by complete route segments', (url, expected) => {
    expect(activeTrainerNavigationId(url)).toBe(expected);
  });

  it('keeps a single six-item desktop navigation contract for all trainer screens', () => {
    expect(TRAINER_NAVIGATION).toHaveLength(6);
    expect(new Set(TRAINER_NAVIGATION.map((item) => item.path))).toEqual(
      new Set([
        '/trainer',
        '/trainer/clients',
        '/trainer/programs',
        '/trainer/chats',
        '/trainer/competitions',
        '/trainer/showcase',
      ]),
    );
  });

  it.each([
    ['/trainer/chats', 'chats'],
    ['/trainer/competitions', 'competitions'],
  ])('selects %s as %s', (url, expected) => {
    expect(activeTrainerNavigationId(url)).toBe(expected);
  });
});
