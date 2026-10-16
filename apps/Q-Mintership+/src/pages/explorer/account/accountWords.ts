/** The account header's words: where an account stands in MINTER, and the name it was opened from. */
import type { NamesOf } from '../../../data/explorer/account';
import type { MyStatus } from '../../../rules/status';
import type { NameMatch } from '../../../state/explorer';
import { formatCount } from '../../../utils/format';

/**
 * Where an account stands in MINTER, in the words of its person page
 * (pages/person/PersonHero.tsx), from the app's own status
 * (rules/status.ts): nothing here works out bans or invites itself.
 */
export function minterStatusWord(status: Pick<MyStatus, 'kind' | 'wasMember'>): string {
  switch (status.kind) {
    case 'admin':
      return 'Minter Admin';
    case 'member':
    case 'memberNominator':
      return 'MINTER member';
    case 'formerBanned':
      return 'Banned from MINTER';
    case 'formerLeft':
      return 'Former member';
    case 'formerKicked':
      // "Former member" only for someone who was one (as on the person page).
      return status.wasMember ? 'Former member' : 'Not in MINTER';
    default:
      return 'Not in MINTER';
  }
}

export interface OpenedFrom {
  /** What was typed or picked. */
  viaName: string;
  /** Core's own spelling, when it differs from what was typed. */
  matched: string | null;
  /** How the name stands among the account's names: ", one of this account's 3 names." */
  among: string;
}

/**
 * The note for an account opened by a name: none when it was its primary
 * name, spelled the same (the title already says it). Null until the
 * primary name is known, so the note never flashes.
 */
export function openedFrom(
  match: NameMatch | null,
  primary: string | null | undefined,
  names: NamesOf | undefined
): OpenedFrom | null {
  if (!match || primary === undefined) return null;
  const spellingDiffers = match.matched !== match.viaName;
  const isPrimary = primary !== null && primary === match.matched;
  if (isPrimary && !spellingDiffers) return null;
  let among = '.';
  if (!isPrimary) {
    const count = names?.names.length;
    among =
      count === undefined
        ? ", one of this account's names."
        : count <= 1 && !names?.truncated
          ? ', the only name this account owns.'
          : `, one of this account's ${formatCount(count)}${names?.truncated ? '+' : ''} names.`;
  }
  return { viaName: match.viaName, matched: spellingDiffers ? match.matched : null, among };
}
