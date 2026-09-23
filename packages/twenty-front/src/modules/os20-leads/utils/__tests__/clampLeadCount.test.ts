import { clampLeadCount } from '@/os20-leads/utils/clampLeadCount';

describe('clampLeadCount', () => {
  it.each([
    ['', 10],
    ['abc', 10],
    [0, 10],
    [-3, 10],
    ['7', 7],
    [4.6, 5],
    [25, 25],
    ['100', 25],
  ])('maps %p to %p', (input, expected) => {
    expect(clampLeadCount(input)).toBe(expected);
  });
});
