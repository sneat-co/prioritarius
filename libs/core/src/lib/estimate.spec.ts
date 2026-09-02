import { describe, expect, it } from 'vitest';
import { HOURS_PER_DAY } from './types';
import { estimateToHours, hoursToEstimate } from './estimate';

describe('estimate hours<->days conversion', () => {
  it('converts a days estimate to hours using 1 day = 8 hours', () => {
    expect(estimateToHours({ value: 3, unit: 'days' })).toBe(3 * HOURS_PER_DAY);
  });

  it('returns an hours estimate unchanged', () => {
    expect(estimateToHours({ value: 5, unit: 'hours' })).toBe(5);
  });

  it('converts hours back into a days estimate', () => {
    expect(hoursToEstimate(16, 'days')).toEqual({ value: 2, unit: 'days' });
  });

  it('converts hours back into an hours estimate unchanged', () => {
    expect(hoursToEstimate(5, 'hours')).toEqual({ value: 5, unit: 'hours' });
  });
});
