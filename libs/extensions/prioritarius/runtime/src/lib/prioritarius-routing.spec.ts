import { prioritariusRoutes } from './prioritarius-routing';

describe('prioritariusRoutes', () => {
  it('exposes the outline surface and the node detail route', () => {
    expect(prioritariusRoutes.map((r) => r.path)).toEqual([
      'outline',
      'node/:id',
    ]);
  });

  it('lazy-loads every route via loadComponent', () => {
    for (const route of prioritariusRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
