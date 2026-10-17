/**
 * A transaction's sentence (rules/explorer/txWords.ts → parts) on screen:
 * accounts as people (their name, linking where the page links people:
 * into the Explorer inside it), names as isolated text, so a name with
 * right-to-left marks or label-like words can't change how the line reads,
 * amounts in bold (an asset's name isolated too, and free to wrap), groups
 * by name, and a transaction it points at as a link.
 *
 * A name links to the name (its owner's Names tab, with that name's card
 * and its whole history: routes/paths.ts explorerNamePath), so any name on
 * screen can be opened (Simon, 2026-10-17).
 *
 * `plain` renders accounts, names and transactions as text without links,
 * for a sentence inside a button: a link inside a button is not allowed.
 * `quiet` looks the same, but its accounts, names and transactions are
 * links a press or a tap opens, left out of the Tab order: for a sentence
 * over an expandable row's button (TxListRow), whose opened part has the
 * same links for the keyboard.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { PersonInline } from '../common/Person';
import { NameWithAvatar } from './NameWithAvatar';
import { GroupAvatar } from '../common/GroupAvatar';
import { getGroupLabel } from '../../data/explorer/account';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import { explorerNamePath, explorerTxPath } from '../../routes/paths';
import { visibleName } from '../../rules/explorer/nameNotes';
import { usePersonLinks } from '../common/personLinks';
import { groupWords, type TxPart } from '../../rules/explorer/txWords';
import { MarkedName } from '../common/MarkedName';

export function GroupName({ groupId }: { groupId: number }) {
  const known = groupWords(groupId);
  const label = useQuery(known === 'MINTER' ? null : `xgroup:${groupId}`, () =>
    getGroupLabel(groupId)
  );
  const name = known === 'MINTER' ? known : (label.data?.name ?? known);
  return (
    <span>
      <span
        style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4, lineHeight: 0 }}
      >
        <GroupAvatar
          groupId={groupId}
          groupName={name}
          ownerName={label.data?.ownerName ?? null}
          size={20}
        />
      </span>
      <bdi dir="auto" style={{ fontWeight: 600 }}>
        {name}
      </bdi>
    </span>
  );
}

function PlainPerson({ address }: { address: string }) {
  const { name, label } = useDisplayName(address);
  return (
    <bdi dir="auto" style={{ fontWeight: 600 }}>
      <MarkedName name={name}>{label}</MarkedName>
    </bdi>
  );
}

/** What a name's link does, after the name in its accessible name. */
export const NAME_LINK_VERB = 'explore this name';

/** A link that looks like the words around it, out of the Tab order (`quiet`). */
function QuietLink({ to, state, children }: { to: string; state?: unknown; children: ReactNode }) {
  return (
    <Link
      component={RouterLink}
      to={to}
      state={state}
      tabIndex={-1}
      color="inherit"
      underline="hover"
      // Over a row's button, whose content lets presses through to it.
      sx={{ pointerEvents: 'auto' }}
    >
      {children}
    </Link>
  );
}

/**
 * A name with its avatar, linking to it (explorerNamePath): in quotes by
 * default, as in a sentence. `onClick` runs first (a dialog closing).
 */
export function NameLink({
  name,
  quoted = true,
  size,
  strong,
  onClick,
}: {
  name: string;
  quoted?: boolean;
  size?: number;
  strong?: boolean;
  onClick?: () => void;
}) {
  const links = usePersonLinks();
  const shown = quoted ? `“${visibleName(name)}”` : visibleName(name);
  return (
    <Link
      component={RouterLink}
      to={explorerNamePath(name)}
      state={links.state}
      onClick={onClick}
      color="inherit"
      underline="hover"
      aria-label={`${shown}: ${NAME_LINK_VERB}`}
    >
      <NameWithAvatar name={name} quoted={quoted} size={size} strong={strong} />
    </Link>
  );
}

type Mode = 'links' | 'quiet' | 'plain';

function QuietPart({ part }: { part: TxPart }) {
  const links = usePersonLinks();
  switch (part.kind) {
    case 'account':
      return (
        <QuietLink to={links.to(part.address)} state={links.state}>
          <PlainPerson address={part.address} />
        </QuietLink>
      );
    case 'name':
      return (
        <QuietLink to={explorerNamePath(part.name)} state={links.state}>
          <NameWithAvatar name={part.name} quoted />
        </QuietLink>
      );
    case 'tx':
      return (
        <QuietLink to={explorerTxPath(part.signature)}>
          transaction {part.signature.slice(0, 8)}…
        </QuietLink>
      );
    default:
      return <Part part={part} mode="plain" />;
  }
}

function Part({ part, mode }: { part: TxPart; mode: Mode }) {
  if (mode === 'quiet' && (part.kind === 'account' || part.kind === 'name' || part.kind === 'tx'))
    return <QuietPart part={part} />;
  const plain = mode !== 'links';
  switch (part.kind) {
    case 'text':
      return <>{part.text}</>;
    case 'account':
      return plain ? (
        <PlainPerson address={part.address} />
      ) : (
        <PersonInline address={part.address} />
      );
    case 'amount':
      // The number never breaks. An asset's name is its issuer's choice (up to
      // 40 characters): it is isolated and may wrap, so it can't push the line
      // past a phone's edge. QORT stays with its number.
      return part.asset === 'QORT' ? (
        <Box component="strong" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {part.amount} QORT
        </Box>
      ) : (
        <Box component="strong" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ whiteSpace: 'nowrap' }}>{part.amount}</span>{' '}
          <bdi dir="auto">{part.asset}</bdi>
        </Box>
      );
    case 'name':
      return plain ? <NameWithAvatar name={part.name} quoted /> : <NameLink name={part.name} />;
    case 'group':
      return <GroupName groupId={part.groupId} />;
    case 'tx':
      return plain ? (
        <span>transaction {part.signature.slice(0, 8)}…</span>
      ) : (
        <Link
          component={RouterLink}
          to={explorerTxPath(part.signature)}
          underline="always"
          color="inherit"
          aria-label={`Open transaction ${part.signature.slice(0, 8)}`}
        >
          transaction {part.signature.slice(0, 8)}…
        </Link>
      );
  }
}

export function TxSentence({
  parts,
  plain = false,
  quiet = false,
}: {
  parts: TxPart[];
  plain?: boolean;
  quiet?: boolean;
}) {
  const mode: Mode = plain ? 'plain' : quiet ? 'quiet' : 'links';
  return (
    <span style={{ overflowWrap: 'anywhere' }}>
      {parts.map((part, i) => (
        <Part key={i} part={part} mode={mode} />
      ))}
    </span>
  );
}
