/**
 * "How Explorer Works" (Simon, 2026-10-18: renamed from How to read the
 * Explorer, and brought up to date): what the Explorer is for, how to find
 * something, what each part shows, where it comes from, its limits, and what
 * acts. Its words follow what the viewer sees (rules/explorer/access.ts):
 * someone who sees the detailed parts reads about them too, and that they are
 * shown to Minter Admins, Dev Admins and MINTER members at level 5 or above;
 * anyone else reads about the rest only, with nothing about what isn't there.
 */
import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { EXPLORER_NEUTRAL_LINE, EXPLORER_PURPOSE, EXPLORER_PURPOSE_BASIC } from './explorerWords';

export const HOW_EXPLORER_WORKS = 'How Explorer Works';

/** One part of the guide: a short heading and plain sentences. */
function GuidePart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Lines({ items }: { items: Array<[string, string]> }) {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {items.map(([part, what]) => (
        <li key={part}>
          <Typography variant="body2">
            <strong>{part}</strong>: {what}
          </Typography>
        </li>
      ))}
    </Box>
  );
}

/** An account's tabs, as this viewer has them. */
function tabLines(full: boolean): Array<[string, string]> {
  return [
    [
      'Overview',
      full
        ? 'Who the account is: its level and progress, blocks minted and how much of the time its node was online, balance, first seen and groups; its direct links to other accounts; its activity over time, a chart with its milestones; QORT minted, purchased / sold and received / sent, added up from its whole history; MINTER, minting now, its latest transactions and notes.'
        : 'Who the account is: its level and progress, blocks minted and how much of the time its node was online, balance, first seen and groups; MINTER, minting now, its latest transactions and notes.',
    ],
    ...(full
      ? ([
          [
            'Connections',
            'How it is linked to other accounts, as a circle or a list: payments each way, sponsorships, minting levels and names moved between them, where its first QORT came from, QORT sent to or got from exchanges, and what they have in common. Each link opens to the transactions behind it; the circle puts the most transactions first, or the most QORT.',
          ],
        ] as Array<[string, string]>)
      : []),
    [
      'Transactions',
      'Everything it sent or took part in, in plain words: by kind, type, name, time or blocks, newest or oldest first. Each one opens to its fields and its raw API response.',
    ],
    [
      'Minter Profile',
      'Where it stands in MINTER and what you can do for it (nominate, support, decide), its nominations and MINTER timeline, and its records in Q-Mintership+ and the original app.',
    ],
    [
      'Names',
      'Every name it owns, as cards or a list, each with its history beside it, and each name’s whole history back through its owners.',
    ],
  ];
}

function moreLines(full: boolean): Array<[string, string]> {
  return [
    ...(full
      ? ([
          [
            'Compare',
            '2 to 4 accounts side by side: what passed between them, a timeline together, what they have in common, and their facts.',
          ],
        ] as Array<[string, string]>)
      : []),
    [
      'Transactions on Qortal',
      'The whole chain’s latest transactions, by type, over the latest blocks or from a block.',
    ],
    [
      'Open File',
      'What a public QDN publish holds (pictures, videos, sound, PDFs, text, a ZIP’s files), and Save File keeps it on your device. Encrypted ones are never opened.',
    ],
    [
      'Minter Admin activity',
      'Under Browse: Minter Admins. How each Minter Admin takes part in decisions, and the group’s pulse.',
    ],
    ['Explorer Quiz', 'Questions you answer by digging through the Explorer.'],
  ];
}

export function HowExplorerWorks({
  open,
  onClose,
  full,
}: {
  open: boolean;
  onClose: () => void;
  /** The viewer sees the Explorer's detailed parts. */
  full: boolean;
}) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={HOW_EXPLORER_WORKS}
      actions={
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Close
        </Button>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography>{full ? EXPLORER_PURPOSE : EXPLORER_PURPOSE_BASIC}</Typography>
        <GuidePart title="Finding something">
          <Typography variant="body2">
            Type a name, a Q-address, an AT address, a transaction signature or a QDN identifier.
            Names are suggested as you type; Enter looks up exactly what you typed. Quick starts
            open your own account, who is nominated now, the Minter Admins and who joined MINTER
            lately, and Recent explorations remembers the accounts you opened on this device.
          </Typography>
        </GuidePart>
        <GuidePart title="An account">
          <Lines items={tabLines(full)} />
          <Typography variant="body2">
            Accounts opened one from another make a trail at the top, to go back along. On a phone,
            swipe sideways to go through the tabs.
          </Typography>
        </GuidePart>
        <GuidePart title="More">
          <Lines items={moreLines(full)} />
        </GuidePart>
        <GuidePart title="Where it comes from">
          <Typography variant="body2">
            Everything here is public: the Qortal chain and QDN, read from your own node.
          </Typography>
          {full ? <Typography variant="body2">{EXPLORER_NEUTRAL_LINE}</Typography> : null}
        </GuidePart>
        <GuidePart title="Its limits">
          <Typography variant="body2">
            Long lists are read in pages, and each list says how far it got, so a missing row is
            never a silent cap. Accounts are labelled by their primary name; their other names are
            on their Names tab.
          </Typography>
        </GuidePart>
        {full ? (
          <GuidePart title="Who sees what">
            <Typography variant="body2">
              You see all of the Explorer. Connections, Compare, the activity chart, QORT minted,
              purchased / sold and received / sent, and exchanges named as such are shown only to
              Minter Admins, Dev Admins and MINTER members at level 5 or above.
            </Typography>
          </GuidePart>
        ) : null}
        <GuidePart title="What acts">
          <Typography variant="body2">
            Looking things up costs nothing and sends nothing, and needs no sign-in. Only what says
            so acts: joining a group from its card, and the Minter Profile’s own actions
            (nominating, supporting, deciding), each explained before Hub opens.
          </Typography>
        </GuidePart>
      </Box>
    </ResponsiveDialog>
  );
}
