import { prioritariusRoutes } from './prioritarius-routing';

describe('prioritariusRoutes', () => {
  it('exposes the lists overview route', () => {
    expect(prioritariusRoutes.some((r) => r.path === 'lists')).toBe(true);
  });

  it('exposes the list detail route with listType + listID params', () => {
    expect(
      prioritariusRoutes.some((r) => r.path === 'list/:listType/:listID'),
    ).toBe(true);
  });

  it('lazy-loads every route via loadComponent', () => {
    for (const route of prioritariusRoutes) {
      expect(typeof route.loadComponent).toBe('function');
    }
  });
});
