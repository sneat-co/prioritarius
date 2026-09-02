import { providePrioritarius } from './provide-prioritarius';

describe('providePrioritarius', () => {
  it('returns a valid (currently empty) provider array', () => {
    const providers = providePrioritarius();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers).toEqual([]);
  });
});
