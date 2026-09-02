import { Estimate, EstimateUnit, HOURS_PER_DAY } from './types';

/** Normalizes any {@link Estimate} to hours (1 day = 8 hours). */
export function estimateToHours(estimate: Estimate): number {
  return estimate.unit === 'days'
    ? estimate.value * HOURS_PER_DAY
    : estimate.value;
}

/** Converts a raw hours figure into an {@link Estimate} in the given unit. */
export function hoursToEstimate(hours: number, unit: EstimateUnit): Estimate {
  return unit === 'days'
    ? { value: hours / HOURS_PER_DAY, unit: 'days' }
    : { value: hours, unit: 'hours' };
}
