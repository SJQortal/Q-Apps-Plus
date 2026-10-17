/**
 * An account's name transactions, per name: what it did with each name it
 * owns now, and the names it had (sold, or renamed to something else).
 * A rename (UPDATE_NAME with a new name) belongs to both its old and its
 * new name. Pure: no reads.
 */
import type { TxRow } from '../../../../data/types';

/** The names a name transaction is about: its name, and a rename's new name. */
export function namesOfTx(tx: TxRow): string[] {
  const names: string[] = [];
  if (typeof tx.name === 'string' && tx.name) names.push(tx.name);
  if (typeof tx.newName === 'string' && tx.newName && tx.newName !== tx.name)
    names.push(tx.newName);
  return names;
}

/** Each name's transactions, in the order given (newest first, as Core answers). */
export function historyByName(rows: readonly TxRow[]): Map<string, TxRow[]> {
  const byName = new Map<string, TxRow[]>();
  for (const tx of rows) {
    for (const name of namesOfTx(tx)) {
      const list = byName.get(name);
      if (list) list.push(tx);
      else byName.set(name, [tx]);
    }
  }
  return byName;
}

/**
 * The names in its history it doesn't own now, the most recently touched
 * first: names it sold, and old names it renamed.
 */
export function pastNames(
  byName: ReadonlyMap<string, readonly TxRow[]>,
  owned: readonly string[]
): string[] {
  const now = new Set(owned);
  return [...byName.entries()]
    .filter(([name]) => !now.has(name))
    .sort(([, a], [, b]) => (b[0]?.timestamp ?? 0) - (a[0]?.timestamp ?? 0))
    .map(([name]) => name);
}

/**
 * Nothing to show under "Its whole history" (Simon, 2026-10-17: "if there is
 * no changes to the names history, do not show Name history expandable
 * button"): its own transactions about the name, read in full, are just its
 * registration. Any rename, sale or update since would be among them (only
 * the owner changes a name), so no read is needed to know it.
 */
export function unchangedSince(txs: readonly TxRow[] | undefined, capped: boolean): boolean {
  return !capped && txs?.length === 1 && txs[0].type === 'REGISTER_NAME';
}
