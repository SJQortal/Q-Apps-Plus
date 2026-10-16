/**
 * A transaction's sentence (rules/explorer/txWords.ts → parts) on screen:
 * accounts as people (their name, linking where the page links people:
 * into the Explorer inside it), names as isolated text, so a name with
 * right-to-left marks or label-like words can't change how the line reads,
 * amounts in bold, groups by name, and a transaction it points at as a link.
 *
 * `plain` renders accounts and transactions as text without links, for a
 * sentence inside a button (an expandable row): a link inside a button is
 * not allowed.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { PersonInline } from '../common/Person';
import { getGroupName } from '../../data/explorer/account';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import { explorerTxPath } from '../../routes/paths';
import { groupWords, type TxPart } from '../../rules/explorer/txWords';
import { visibleName } from '../../rules/explorer/nameNotes';

export function GroupName({ groupId }: { groupId: number }) {
  const known = groupWords(groupId);
  const name = useQuery(known === 'MINTER' ? null : `xgroup:${groupId}`, () =>
    getGroupName(groupId)
  );
  const label = known === 'MINTER' ? known : (name.data ?? known);
  return (
    <bdi dir="auto" style={{ fontWeight: 600 }}>
      {label}
    </bdi>
  );
}

function PlainPerson({ address }: { address: string }) {
  const { label } = useDisplayName(address);
  return (
    <bdi dir="auto" style={{ fontWeight: 600 }}>
      {label}
    </bdi>
  );
}

function Part({ part, plain }: { part: TxPart; plain: boolean }) {
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
      return (
        <Box component="strong" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {part.amount} {part.asset}
        </Box>
      );
    case 'name':
      return (
        <>
          “
          <bdi dir="auto" style={{ fontWeight: 600 }}>
            {visibleName(part.name)}
          </bdi>
          ”
        </>
      );
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

export function TxSentence({ parts, plain = false }: { parts: TxPart[]; plain?: boolean }) {
  return (
    <span style={{ overflowWrap: 'anywhere' }}>
      {parts.map((part, i) => (
        <Part key={i} part={part} plain={plain} />
      ))}
    </span>
  );
}
