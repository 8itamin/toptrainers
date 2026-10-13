import '@angular/compiler';
import { expect, it } from 'vitest';
import { clientOperationPath } from './clients';
it('client routes come from OpenAPI and encode IDs',()=>{
  expect(clientOperationPath('list')).toBe('/clients/cards');
  expect(clientOperationPath('update','card/id')).toBe('/clients/cards/card%2Fid');
  expect(clientOperationPath('email','card/id')).toBe('/clients/cards/card%2Fid/invite/email');
  expect(clientOperationPath('summary','client/id')).toBe('/clients/client%2Fid/training-summary');
});
