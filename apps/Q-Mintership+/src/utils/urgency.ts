/** How close a deadline is, for colours: calm > 3 days, soon > 1 day, urgent under a day. */
export type Urgency = 'calm' | 'soon' | 'urgent' | 'over';

export function urgencyOf(msLeft: number): Urgency {
  if (msLeft <= 0) return 'over';
  if (msLeft < 86_400_000) return 'urgent';
  if (msLeft < 3 * 86_400_000) return 'soon';
  return 'calm';
}
