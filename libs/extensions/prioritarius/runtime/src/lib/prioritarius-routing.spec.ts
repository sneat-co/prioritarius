import { prioritariusRoutes } from './prioritarius-routing';

describe('prioritariusRoutes', () => {
  it('exposes exactly the goals overview route', () => {
    expect(prioritariusRoutes.map((r) => r.path)).toEqual(['goals']);
  });

  it('lazy-loads every route via loadComponent', () => {
    for (const route of prioritariusRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
