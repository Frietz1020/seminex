export function getConfirmationWindow(
  startsAt: string,
  opensMinutesBefore = 1440,
  closesMinutesBefore = 60,
): { opensAt: number; closesAt: number } {
  const start = Date.parse(startsAt);
  return {
    opensAt: start - opensMinutesBefore * 60_000,
    closesAt: start - closesMinutesBefore * 60_000,
  };
}
