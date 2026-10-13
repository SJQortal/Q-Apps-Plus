/**
 * The self-check before someone shows they're ready to mint: three things
 * a minter says yes to, then the fee. The answers stay in the dialog: they
 * are not published or saved anywhere. Kept apart from the dialog so Home
 * can use the words (and the Names link) without loading the write code.
 */
import { formatQort } from '../../data/accounts';

/** The action's name, the same on every button and dialog that offers it. */
export const READY_TITLE = "Show you're ready to mint";

/** Hub's Names app, for registering a name. */
export const NAMES_APP_LINK = 'qortal://APP/Names';

export type ReadyCheckId = 'node' | 'key' | 'final';

export interface ReadyCheck {
  id: ReadyCheckId;
  label: string;
  /** One line on why it matters. */
  why?: string;
}

export const READY_CHECKS: readonly ReadyCheck[] = [
  {
    id: 'node',
    label: 'I run my own Qortal node (Core) and keep it synced and online most of the day.',
    why: 'Minting happens on a node, and levels grow with time online.',
  },
  {
    id: 'key',
    label: "Once I'm in MINTER, I'll create my minting key and add it to my node.",
  },
  {
    id: 'final',
    label:
      "I understand this request can't be withdrawn. It stays open until I'm approved, or Minter Admins remove it.",
  },
];

export type ReadyTicks = Partial<Record<ReadyCheckId, boolean>>;

/** The required checks not ticked yet, in order. */
export function missingChecks(ticks: ReadyTicks): ReadyCheck[] {
  return READY_CHECKS.filter((check) => !ticks[check.id]);
}

export interface ReadyHintInput {
  ticks: ReadyTicks;
  /** Confirmed balance in QORT; undefined while it loads or when it couldn't be read. */
  balance: number | undefined;
  feeQort: number;
  /** Continue was pressed with something missing. */
  attempted: boolean;
  /** The balance is still being read, so Continue waits. */
  checking?: boolean;
}

/** The one line under the checklist: what's still needed, in plain words. */
export function readyHint({
  ticks,
  balance,
  feeQort,
  attempted,
  checking,
}: ReadyHintInput): string {
  if (typeof balance === 'number' && balance < feeQort)
    return `Continue opens once your confirmed balance covers the ${formatQort(feeQort)} fee.`;
  const missing = missingChecks(ticks).length;
  if (missing === 0 && checking) return `Checking your balance for the ${formatQort(feeQort)} fee…`;
  if (missing === 0) return 'Ready. Next, Hub asks you to confirm.';
  const boxes = missing === 1 ? '1 more box' : `${missing} more boxes`;
  if (attempted) return `Can't continue yet: tick ${boxes} above.`;
  return missing === READY_CHECKS.length
    ? `Tick all ${READY_CHECKS.length} boxes to continue.`
    : `Tick ${boxes} to continue.`;
}
