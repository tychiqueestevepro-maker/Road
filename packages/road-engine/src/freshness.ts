export function ageSeconds(date: Date | undefined, now = new Date()): number | undefined {
  if (!date) return undefined;
  return Math.max(0, Math.round((now.valueOf() - date.valueOf()) / 1000));
}

export function freshnessMultiplier(
  observedAt: Date | undefined,
  staleAfterSeconds: number,
  now = new Date()
): number {
  const age = ageSeconds(observedAt, now);
  if (age === undefined) return 0.75;
  if (age <= staleAfterSeconds) return 1;
  if (age <= staleAfterSeconds * 4) return 0.55;
  return 0.25;
}

