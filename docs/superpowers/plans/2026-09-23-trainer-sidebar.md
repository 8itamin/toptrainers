# Unified Trainer Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every duplicated desktop trainer sidebar with one route-aware `TrainerSidebarComponent`.

**Architecture:** A pure `trainer-navigation` module owns the typed menu model and URL-to-active-section resolver. A standalone `TrainerSidebarComponent` renders that model and reacts to Angular router navigation. Each current desktop trainer screen imports the component and retains only its page layout styles.

**Tech Stack:** Angular 21 standalone components, Angular Router, RxJS, TypeScript, Vitest, Nx.

**Spec:** `docs/superpowers/specs/2026-09-23-trainer-sidebar-design.md`

## Global Constraints

- Scope is the trainer desktop left menu only; do not alter mobile bottom navigation, routes or page content.
- Use the existing safe SVG icon set and do not render font glyphs for navigation icons.
- `/trainer` is an exact active match; `/trainer/programs/*` and `/trainer/library/*` activate «Программы».
- Do not add dependencies, API calls or backend changes.
- Keep work local: do not commit, push or deploy until the owner explicitly confirms the local result and asks to publish it.

## Review Focus

- Visiting `/trainer/programs/library` or `/trainer/library/workout` highlights only «Программы».
- Visiting `/trainer` never leaves «Сегодня» inactive or makes every trainer item active.
- Query strings and fragments do not change the selected desktop item.
- All six trainer destinations have a stable SVG identifier and a working `routerLink`.
- A page-specific CSS selector cannot hide the shared sidebar at the 1080px desktop breakpoint.

---

## File Structure

- Create `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.ts`: trainer menu item types, six-item source of truth, and active-section resolver.
- Create `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`: pure resolver and menu-contract regression tests.
- Create `frontend/libs/pwa/feature-role-shell/src/lib/trainer-sidebar.component.ts`: desktop sidebar markup, SVG switch and router-driven active state.
- Modify `frontend/libs/pwa/feature-role-shell/src/index.ts`: export the common sidebar for the feature library's public surface.
- Modify `frontend/libs/pwa/feature-role-shell/src/lib/trainer-today.component.ts`, `trainer-clients.component.ts`, `program-builder.component.ts`, `trainer-chats.component.ts`, `trainer-competitions.component.ts`, and `library-hub.component.ts`: consume the shared sidebar and remove each local desktop sidebar copy.
- Modify `frontend/libs/pwa/feature-role-shell/src/lib/program-builder-state.ts` and `program-builder-state.test.ts`: remove the program-builder-specific navigation source and its obsolete test.
- Modify `DOC/PROJECT_MEMORY.md`: record the completed trainer-navigation consolidation.

### Task 1: Navigation model and route resolver

**Files:**
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/program-builder-state.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/program-builder-state.test.ts`

**Interfaces:**
- Produces `TrainerNavigationId`, `TrainerNavigationIcon`, `TRAINER_NAVIGATION`, and `activeTrainerNavigationId(url: string): TrainerNavigationId | null`.
- `TrainerSidebarComponent` consumes the constant and resolver in Task 2.

- [x] **Step 1: Write the failing navigation-contract tests**

```ts
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
});
```

- [x] **Step 2: Run the test and verify the expected failure**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Expected: FAIL because `./trainer-navigation` does not exist.

- [x] **Step 3: Add the pure navigation module**

```ts
export type TrainerNavigationId = 'today' | 'clients' | 'programs' | 'chats' | 'competitions' | 'showcase';
export type TrainerNavigationIcon = 'home' | 'clients' | 'programs' | 'chats' | 'competitions' | 'showcase';

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
  { id: 'competitions', path: '/trainer/competitions', label: 'Соревн.', icon: 'competitions' },
  { id: 'showcase', path: '/trainer/showcase', label: 'Витрина', icon: 'showcase' },
];

export function activeTrainerNavigationId(url: string): TrainerNavigationId | null {
  const path = url.split(/[?#]/, 1)[0];
  if (path === '/trainer') return 'today';
  if (path.startsWith('/trainer/programs') || path.startsWith('/trainer/library')) return 'programs';
  return TRAINER_NAVIGATION.find((item) => item.id !== 'today' && path.startsWith(item.path))?.id ?? null;
}
```

Remove `TRAINER_PROGRAM_BUILDER_NAVIGATION` and its assertions from the program-builder state files, so the navigation source has one owner.

- [x] **Step 4: Run the focused tests and verify they pass**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts libs/pwa/feature-role-shell/src/lib/program-builder-state.test.ts`

Expected: PASS; program-draft behavior remains covered and every resolver expectation passes.

### Task 2: Shared desktop sidebar component

**Files:**
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-sidebar.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/index.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

**Interfaces:**
- Consumes `TRAINER_NAVIGATION` and `activeTrainerNavigationId` from Task 1.
- Produces standalone selector `tt-trainer-sidebar` for the page components in Tasks 3 and 4.

- [x] **Step 1: Extend the failing test for route-segment boundaries**

```ts
it.each([
  ['/trainer/clients/ivan', 'clients'],
  ['/trainer/competitions/august', 'competitions'],
  ['/trainer/programs-archive', null],
  ['/trainer/clientship', null],
])('resolves %s by complete route segments', (url, expected) => {
  expect(activeTrainerNavigationId(url)).toBe(expected);
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Expected: FAIL because a plain `startsWith('/trainer/programs')` or `startsWith('/trainer/clients')` treats a longer, unrelated path as active.

- [x] **Step 3: Create the standalone component**

First make the resolver route-segment-safe, then implement `TrainerSidebarComponent` with `RouterLink`, `Router`, `NavigationEnd`, `filter`, `map`, `startWith`, and `toSignal`. It must expose `items = TRAINER_NAVIGATION`, subscribe reactively to `urlAfterRedirects`, and render one `@for` link per item. Use an `@switch` on `item.icon` with the existing safe SVG paths for home, clients, programs, chats, competitions and showcase; keep the existing lime logo and avatar visual treatment. Apply `display: none` below `1080px` and a 5.5rem sticky desktop panel at or above that breakpoint.

```ts
function matchesRoute(path: string, route: string): boolean {
  return path === route || path.startsWith(`${route}/`);
}

export function activeTrainerNavigationId(url: string): TrainerNavigationId | null {
  const path = url.split(/[?#]/, 1)[0];
  if (path === '/trainer') return 'today';
  if (matchesRoute(path, '/trainer/programs') || matchesRoute(path, '/trainer/library')) return 'programs';
  return TRAINER_NAVIGATION.find((item) => item.id !== 'today' && matchesRoute(path, item.path))?.id ?? null;
}
```

```ts
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
```

Export `TrainerSidebarComponent` from the feature library index.

- [x] **Step 4: Run the navigation test and TypeScript compilation**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Run: `frontend\\node_modules\\.bin\\nx.CMD run app:build:development --skip-nx-cache` with `NX_DAEMON=false`.

Expected: tests pass and Angular accepts the shared component template.

### Task 3: Replace dashboard, clients, programs and library copies

**Files:**
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-today.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-clients.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/program-builder.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/library-hub.component.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

**Interfaces:**
- Consumes standalone `TrainerSidebarComponent` from Task 2.
- Produces four trainer screens with no local desktop sidebar DOM or sidebar icon lists.

- [x] **Step 1: Add a regression expectation for the shared six-item menu**

```ts
it('keeps a single six-item desktop navigation contract for all trainer screens', () => {
  expect(TRAINER_NAVIGATION).toHaveLength(6);
  expect(new Set(TRAINER_NAVIGATION.map((item) => item.path))).toEqual(new Set([
    '/trainer', '/trainer/clients', '/trainer/programs',
    '/trainer/chats', '/trainer/competitions', '/trainer/showcase',
  ]));
});
```

- [x] **Step 2: Run the test and verify it passes before migration**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Expected: PASS; the data contract already protects the component migration.

- [x] **Step 3: Replace each local `<aside class="sidebar">`**

Add `TrainerSidebarComponent` to each standalone component's `imports` and replace the desktop sidebar markup with `<tt-trainer-sidebar />`. Remove local `.sidebar`, `.sidebar-logo`, `.sidebar-nav`, `.side-item`, `.side-icon`, and `.sidebar-avatar` styles only when they serve the replaced menu. Preserve each container's existing desktop `display: flex` or grid behavior and preserve all mobile tabbar markup.

- [x] **Step 4: Build and inspect each migrated layout**

Run: `frontend\\node_modules\\.bin\\nx.CMD run app:build:development --skip-nx-cache` with `NX_DAEMON=false`.

Expected: Angular compiles every migrated standalone import; desktop layout containers retain their content columns and the sidebar remains present at 1080px or wider.

### Task 4: Replace chats and competitions copies

**Files:**
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-chats.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-competitions.component.ts`
- Test: `frontend/libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

**Interfaces:**
- Consumes `TrainerSidebarComponent` from Task 2.
- Produces chat and competition shells with the same menu model and SVGs as every other trainer screen.

- [x] **Step 1: Add a regression test for the two non-program destinations**

```ts
it.each([
  ['/trainer/chats', 'chats'],
  ['/trainer/competitions', 'competitions'],
])('selects %s as %s', (url, expected) => {
  expect(activeTrainerNavigationId(url)).toBe(expected);
});
```

- [x] **Step 2: Run the test and verify it passes**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Expected: PASS; the shared route resolver protects both page selections.

- [x] **Step 3: Remove local nav templates and imports**

Replace the desktop `<aside class="sidebar desktop-only">` in chats and competitions with `<tt-trainer-sidebar />`. Remove `NgTemplateOutlet`, `TRAINER_PROGRAM_BUILDER_NAVIGATION`, local `navItems`, and the duplicated SVG template switches introduced during the icon fix. Retain page-specific content icons such as the competition trophy.

- [x] **Step 4: Run focused tests and the development build**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run libs/pwa/feature-role-shell/src/lib/trainer-navigation.test.ts`

Run: `frontend\\node_modules\\.bin\\nx.CMD run app:build:development --skip-nx-cache` with `NX_DAEMON=false`.

Expected: both pages compile and no longer own desktop navigation markup.

### Task 5: Final verification and project continuity record

**Files:**
- Modify: `DOC/PROJECT_MEMORY.md`

**Interfaces:**
- Consumes the completed shared sidebar from Tasks 1-4.
- Produces a documented frontend navigation convention for future trainer screens.

- [x] **Step 1: Add a compact project-memory entry**

Add a dated entry stating that trainer desktop navigation is owned by one shared component and all future trainer screens must consume it rather than duplicating menu markup or icons.

- [x] **Step 2: Run the complete frontend test suite**

Run: `frontend\\node_modules\\.bin\\vitest.CMD run`

Expected: PASS with zero failed test files.

- [x] **Step 3: Run the final Angular development build and whitespace check**

Run: `frontend\\node_modules\\.bin\\nx.CMD run app:build:development --skip-nx-cache` with `NX_DAEMON=false`.

Run: `git diff --check`.

Expected: development build succeeds and `git diff --check` prints no whitespace errors.

- [ ] **Step 4: Perform the desktop visual route check**

Run the local PWA and open `/trainer`, `/trainer/clients`, `/trainer/programs`, `/trainer/chats`, `/trainer/competitions`, `/trainer/showcase`, and `/trainer/library` at a viewport at least 1080px wide. Confirm exactly one left menu is rendered, the same six SVG items occur on every page, and only the expected item has the lime active treatment.

- [ ] **Step 5: Report the local result without committing or deploying**

Report the migrated files and verification evidence. Do not run `git commit`, `git push`, production build/deploy, or a webhook until the owner explicitly confirms the local result and requests publication.
