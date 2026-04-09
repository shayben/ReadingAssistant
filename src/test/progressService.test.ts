import { describe, it, expect } from 'vitest';
import { computeConsecutiveWeeks } from '../services/progressService';

describe('computeConsecutiveWeeks', () => {
  it('returns 0 for empty dates', () => {
    expect(computeConsecutiveWeeks([])).toBe(0);
  });

  it('returns 1 for a single date', () => {
    expect(computeConsecutiveWeeks(['2024-03-15'])).toBe(1);
  });

  it('returns 1 for dates all in the same week', () => {
    // Mon Mar 11 – Fri Mar 15, 2024 (same week)
    expect(computeConsecutiveWeeks(['2024-03-11', '2024-03-13', '2024-03-15'])).toBe(1);
  });

  it('returns 2 for two consecutive weeks', () => {
    // Week of Mar 11 and week of Mar 18, 2024
    expect(computeConsecutiveWeeks(['2024-03-12', '2024-03-19'])).toBe(2);
  });

  it('returns 3 for three consecutive weeks', () => {
    expect(computeConsecutiveWeeks(['2024-03-11', '2024-03-18', '2024-03-25'])).toBe(3);
  });

  it('returns longest run when there is a gap', () => {
    // 3 consecutive weeks, then a gap, then 1 week
    expect(computeConsecutiveWeeks([
      '2024-03-04', '2024-03-11', '2024-03-18',
      '2024-04-08',
    ])).toBe(3);
  });

  it('handles duplicate dates in the same week', () => {
    expect(computeConsecutiveWeeks([
      '2024-03-11', '2024-03-12', '2024-03-13',
      '2024-03-18', '2024-03-19',
    ])).toBe(2);
  });

  it('handles cross-year boundaries', () => {
    // Last week of 2023 + first week of 2024
    expect(computeConsecutiveWeeks(['2023-12-28', '2024-01-03'])).toBe(2);
  });
});
