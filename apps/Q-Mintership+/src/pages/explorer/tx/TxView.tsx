/**
 * One transaction on its own page: the sentence first (with links), then
 * the facts (block and time, or that it waits for a block; the fee; where
 * group approval stands, only when it needs one), the accounts involved,
 * for a group approval the transaction it answers, the type's fields in
 * plain words, and its raw API response, collapsed (components/explorer/
 * RawJson.tsx; less what never shows: rules/explorer/rawTx.ts).
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Card, Section } from '../../../components/common/Section';
import { usePersonLinks } from '../../../components/common/personLinks';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { RawResponse } from '../../../components/explorer/RawJson';
import { TxFields, TxPeople } from '../../../components/explorer/TxFields';
import { TxSentence } from '../../../components/explorer/TxSentence';
import { useTxWords } from '../../../components/explorer/useTxWords';
import { MINTER_GROUP_ID } from '../../../data/constants';
import { getTx } from '../../../data/explorer/account';
import type { TxRow } from '../../../data/types';
import { useQuery } from '../../../hooks/useQuery';
import { decisionPath, explorerTxPath } from '../../../routes/paths';
import { formatAmount } from '../../../rules/explorer/txWords';
import { formatCount, formatDateTime, formatRelative } from '../../../utils/format';
import { approvalWords, makerOf } from './txPageWords';
import { FIELD_BLOCK_SX } from '../../../components/explorer/fieldBlock';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={FIELD_BLOCK_SX}>
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
          {confirmed ? formatCount(tx.blockHeight as number) : 'Waiting to be confirmed'}
        </Fact>
        <Fact label={confirmed ? 'Time' : 'Sent'}>
          {formatDateTime(tx.timestamp)}{' '}
          <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
            ({formatRelative(tx.timestamp)})
          </Box>
        </Fact>
        {tx.fee !== undefined ? <Fact label="Fee">{formatAmount(tx.fee)} QORT</Fact> : null}
        {approval ? <Fact label="Group approval">{approval}</Fact> : null}
      </Box>
    </Card>
  );
}

/** The transaction a group approval answers, read on its own (light, kept once confirmed). */
function TargetSentence({ tx }: { tx: TxRow }) {
  const words = useTxWords(tx, null);
  return (
    <Typography sx={{ overflowWrap: 'anywhere' }}>
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
      <Typography sx={{ fontSize: { xs: 17, sm: 18 }, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        <TxSentence parts={words.parts} />
      </Typography>
      <Facts tx={tx} />
      <TxPeople addresses={words.participants} maker={makerOf(tx)} />
      {pending ? <AnsweredTx signature={tx.pendingSignature as string} /> : null}
      {fields.length ? (
        <Section title="Details" id="explorer-tx-details">
          <Card>
            <TxFields fields={fields} label={`${words.title} details`} />
          </Card>
        </Section>
      ) : null}
      <RawResponse tx={tx} />
    </>
  );
}
