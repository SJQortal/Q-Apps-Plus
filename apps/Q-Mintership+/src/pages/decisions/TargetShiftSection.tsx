/**
 * "Admin changes and the target", above the queue, only when it has
 * something the cards don't already say: an admin change that has enough
 * signatures (it applies in the next block) and would tip other decisions
 * over, and waiting admin changes that would only do so together (every
 * removal, every new admin, or all of them).
 */
import type { ChainNow } from '../../data/chain';
import { Section } from '../../components/common/Section';
import type { Decision } from '../../rules/decision';
import type { ShiftScenario } from '../../rules/targetShift';
import { whenApplied } from './decisionUi';
import { TargetImpact } from './TargetImpact';
import { scenarioLead, type LabelOf } from './targetShiftUi';

const flipsOf = (s: ShiftScenario) =>
  s.effects.filter((e) => e.effect !== 'needsMore').map((e) => e.signature);

export function TargetShiftSection({
  scenarios,
  decisions,
  now,
  labelOf,
  advice,
}: {
  scenarios: ShiftScenario[];
  decisions: Decision[];
  now: ChainNow;
  labelOf: LabelOf;
  /** Minter Admins also get what they can do about it. */
  advice: boolean;
}) {
  const byId = new Map(decisions.map((d) => [d.signature, d]));
  const singles = scenarios.filter((s) => s.scope === 'one');
  const seen = new Set(singles.flatMap(flipsOf));
  const urgent = singles.filter((s) => {
    const sig = s.changes[0]?.signature;
    return sig && byId.get(sig)?.phase === 'thresholdMet' && flipsOf(s).length > 0;
  });
  const together = scenarios.filter(
    (s) => s.scope !== 'one' && flipsOf(s).some((sig) => !seen.has(sig))
  );
  if (!urgent.length && !together.length) return null;
  return (
    <Section title="Admin changes and the target" id="target-shift">
      {urgent.map((s) => {
        const sig = s.changes[0]?.signature as string;
        const d = byId.get(sig) as Decision;
        return (
          <TargetImpact
            key={sig}
            scenario={s}
            labelOf={labelOf}
            lead={`${labelOf(sig)} has enough signatures: Core applies it ${whenApplied(d, now)}. When it does`}
            advice={advice}
          />
        );
      })}
      {together.map((s) => (
        <TargetImpact
          key={s.scope}
          scenario={s}
          labelOf={labelOf}
          lead={scenarioLead(s)}
          advice={advice}
        />
      ))}
    </Section>
  );
}
