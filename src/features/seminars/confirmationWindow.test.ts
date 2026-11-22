import { describe, expect, it } from 'vitest';
import { getConfirmationWindow } from './confirmationWindow';

describe('minute-based attendance confirmation window', () => {
  const startsAt = '2030-06-02T09:00:00.000Z';
  const start = Date.parse(startsAt);

  it('keeps the legacy 24-hour and 1-hour defaults', () => {
    expect(getConfirmationWindow(startsAt)).toEqual({
      opensAt: start - 24 * 60 * 60_000,
      closesAt: start - 60 * 60_000,
    });
  });

  it('interprets configured offsets as minutes', () => {
    expect(getConfirmationWindow(startsAt, 2160, 120)).toEqual({
      opensAt: start - 36 * 60 * 60_000,
      closesAt: start - 2 * 60 * 60_000,
    });
  });
});
