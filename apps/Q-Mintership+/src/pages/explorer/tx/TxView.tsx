/**
 * One transaction on its own page: the sentence first (with links), Open
 * File and Save File under it for a public QDN publish
 * (components/explorer/file) and where it belongs (the app that shows it,
 * and what a reply, a comment or a like answers: QdnPlaceSection), then the facts (block and time, or that it waits for a block, with a link to
 * every transaction in that block; the fee; where group approval stands,
 * only when it needs one; its signature, with Copy), the accounts involved,
 * for a group approval the transaction it answers, the type's fields in
 * plain words, and its raw API response, collapsed (components/explorer/
 * RawJson.tsx; less what never shows: rules/explorer/rawTx.ts).
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Card, Section } from '../../../components/common/Section';
import { usePersonLinks } from '../../../components/common/personLinks';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { CopyTextButton } from '../../../components/common/CopyTextButton';
import { RawResponse } from '../../../components/explorer/RawJson';
import { TxFields, TxPeople } from '../../../components/explorer/TxFields';
import { TxSentence } from '../../../components/explorer/TxSentence';
import { useTxWords } from '../../../components/explorer/useTxWords';
import { MINTER_GROUP_ID } from '../../../data/constants';
import { getTx } from '../../../data/explorer/account';
import type { TxRow } from '../../../data/types';
import { useQuery } from '../../../hooks/useQuery';
import { decisionPath, explorerBlockPath, explorerTxPath } from '../../../routes/paths';
import { formatAmount } from '../../../rules/explorer/txWords';
import { formatCount, formatDateTime, formatRelative } from '../../../utils/format';
import { approvalWords, makerOf } from './txPageWords';
import { FIELD_BLOCK_SX } from '../../../components/explorer/fieldBlock';
import { QdnFileButtons } from '../../../components/explorer/file/QdnFileButtons';
import { QdnPlaceSection } from '../../../components/explorer/QdnPlaceSection';
import { openableResource } from '../../../rules/explorer/qdnFiles';
import { isMinterGroupChange } from '../../../rules/decision';

function Fact({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  /** Across the whole row (the signature). */
  wide?: boolean;
}) {
  return (
    <Box sx={{ ...FIELD_BLOCK_SX, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function Facts({ tx }: { tx: TxRow }) {
  const approval = approvalWords(tx.approvalStatus);
  const confirmed = typeof tx.blockHeight === 'number';
  return (
    <Card>
      <Box
        component="dl"
        aria-label="About this transaction"
        sx={{
          m: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <Fact label="Block">
          {confirmed ? (
            <>
              {formatCount(tx.blockHeight as number)}
              <Box component="span" sx={{ display: 'block', fontWeight: 400 }}>
                <Link component={RouterLink} to={explorerBlockPath(tx.blockHeight as number)}>
                  Every transaction in this block
                </Link>
              </Box>
            </>
          ) : (
            'Waiting to be confirmed'
          )}
        </Fact>
        <Fact label={confirmed ? 'Time' : 'Sent'}>
          {formatDateTime(tx.timestamp)}{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
            ({formatRelative(tx.timestamp)})
          </Box>
        </Fact>
        {tx.fee !== undefined ? <Fact label="Fee">{formatAmount(tx.fee)} QORT</Fact> : null}
        {approval || isMinterGroupChange(tx) ? (
          <Fact label="Group approval">
            {approval ?? 'Needs the Minter Admins’ approval'}
            {/* A MINTER group change is one of MINTER's decisions, with a page of its own. */}
            {isMinterGroupChange(tx) ? (
              <Box component="span" sx={{ display: 'block', fontWeight: 400 }}>
                <Link component={RouterLink} to={decisionPath(tx.signature)}>
                  Open the MINTER decision
                </Link>
              </Box>
            ) : null}
          </Fact>
        ) : null}
        <Fact label="Signature" wide>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="span"
              sx={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 14,
                fontWeight: 500,
                wordBreak: 'break-all',
              }}
            >
              {tx.signature}
            </Box>
            <CopyTextButton text={tx.signature} what="the signature" />
          </Box>
        </Fact>
      </Box>
    </Card>
  );
}

/** The transaction a group approval answers, read on its own (light, kept once confirmed). */
function TargetSentence({ tx }: { tx: TxRow }) {
  const words = useTxWords(tx, null);
  return (
    <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
      <TxSentence parts={words.parts} />
    </Typography>
  );
}

function AnsweredTx({ signature }: { signature: string }) {
  const target = useQuery(`xtxsig:${signature}`, (force) => getTx(signature, { force }));
  const links = usePersonLinks();
  let line;
  if (target.isError && target.data === undefined)
    line = (
      <ErrorState
        compact
        title="Couldn't load the transaction it answers."
        error={target.error}
        onRetry={() => void target.refetch()}
      />
    );
  else if (target.data === undefined)
    line = <ListSkeleton count={1} label="Loading the transaction it answers" />;
  else if (target.data === null)
    line = <Typography color="text.secondary">Your node doesn't have that transaction.</Typography>;
  else line = <TargetSentence tx={target.data} />;
  // A MINTER group change is one of MINTER's decisions, with a page of its own.
  const minter = target.data?.groupId === MINTER_GROUP_ID;
  return (
    <Section title="The transaction it answers" id="explorer-tx-answers">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {line}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            component={RouterLink}
            to={explorerTxPath(signature)}
            state={links.state}
            variant="outlined"
            endIcon={<ChevronRightOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Open that transaction
          </Button>
          {minter ? (
            <Button
              component={RouterLink}
              to={decisionPath(signature)}
              variant="outlined"
              endIcon={<ChevronRightOutlinedIcon />}
              sx={{ minHeight: 44 }}
            >
              Open the MINTER decision
            </Button>
          ) : null}
        </Box>
      </Card>
    </Section>
  );
}

export function TxView({ tx }: { tx: TxRow }) {
  const words = useTxWords(tx, null);
  // The approval status is one of the facts above; the fields don't repeat it.
  const fields = words.fields.filter((field) => field.label !== 'Group approval');
  const pending = tx.type === 'GROUP_APPROVAL' && typeof tx.pendingSignature === 'string';
  return (
    <>
      <Typography
        component="div"
        sx={{ fontSize: { xs: 17, sm: 18 }, lineHeight: 1.45, overflowWrap: 'anywhere' }}
      >
        <TxSentence parts={words.parts} />
      </Typography>
      {openableResource(tx) ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <QdnFileButtons tx={tx} />
        </Box>
      ) : null}
      <QdnPlaceSection tx={tx} />
      <Facts tx={tx} />
      <TxPeople addresses={words.participants} maker={makerOf(tx)} viewId={tx.signature} />
      {pending ? <AnsweredTx signature={tx.pendingSignature as string} /> : null}
      {fields.length ? (
        <Section title="Details" id="explorer-tx-details">
          <Card>
            <TxFields fields={fields} label={`${words.title} details`} viewId={tx.signature} />
          </Card>
        </Section>
      ) : null}
      <RawResponse tx={tx} />
    </>
  );
}
