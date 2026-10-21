/**
 * What every publish encrypted to the Minter Admins says (a poll's records,
 * a note or a comment for the Minter Admins): who can read it, and what to
 * check in Hub's dialog.
 */
import { plural } from '../../utils/format';

/** What to check in Hub's dialog for an encrypted publish. */
export function encryptedCheck(name: string, prefix: string): string[] {
  return [
    `The name is ${name}.`,
    'The service is DOCUMENT_PRIVATE.',
    `The identifier starts with ${prefix}.`,
    'It says isEncrypted: true.',
    'The fee.',
  ];
}

/** "Encrypted to the 19 Minter Admins: only they can read it. …" */
export function encryptedTo(admins: number): string {
  return `Encrypted to the ${plural(admins, 'Minter Admin')}: only they can read it. Anyone can see that a record was published under your name, not what it says.`;
}
