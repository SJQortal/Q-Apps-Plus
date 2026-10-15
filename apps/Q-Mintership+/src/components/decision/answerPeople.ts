/**
 * A decision's answers as its columns show them (AnswerColumns): each Minter
 * Admin's latest confirmed answer, then the ones still on their way
 * ("confirming…"), with a rejection after the admin's own approval marked.
 * Shared by the decision and nomination cards, so both say the same.
 */
import type { SignerDecision, Tally } from '../../rules/tally';
import type { AnswerPerson } from './AnswerColumns';

type Known = SignerDecision & { address: string };

function known(rows: readonly SignerDecision[]): Known[] {
  return rows.filter((x): x is Known => Boolean(x.address));
}

/**
 * Who approved and who rejected, from a tally. `nameOf` gives a name the
 * caller already has (null: none), or undefined to let the chip look it up.
 */
export function tallyPeople(
  tally: Pick<Tally, 'approvals' | 'rejections' | 'inFlight'> | null | undefined,
  nameOf: (address: string) => string | null | undefined = () => undefined
): { approved: AnswerPerson[]; rejected: AnswerPerson[] } {
  if (!tally) return { approved: [], rejected: [] };
  const person = (address: string): AnswerPerson => ({ address, name: nameOf(address) });
  return {
    approved: [
      ...known(tally.approvals).map((x) => person(x.address)),
      ...known(tally.inFlight.filter((x) => x.approval)).map((x) => ({
        ...person(x.address),
        confirming: true,
      })),
    ],
    rejected: [
      ...known(tally.rejections).map((x) => ({ ...person(x.address), hadApproved: x.withdrew })),
      ...known(tally.inFlight.filter((x) => !x.approval)).map((x) => ({
        ...person(x.address),
        confirming: true,
        hadApproved: tally.approvals.some((a) => a.address === x.address),
      })),
    ],
  };
}
