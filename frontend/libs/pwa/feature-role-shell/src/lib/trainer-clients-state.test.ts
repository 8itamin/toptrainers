import { expect, it } from 'vitest';
import { RequestSelection, issueKey } from './trainer-clients-state';
it('late response cannot replace selected client', () => {
  const selection = new RequestSelection();
  const first = selection.next(); selection.next();
  expect(selection.current(first)).toBe(false);
});
it('program issue retry uses same operation key', () => {
  expect(issueKey('card', 'program', '2026-10-13')).toBe(issueKey('card', 'program', '2026-10-13'));
});
