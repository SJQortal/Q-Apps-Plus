/**
 * Whose first QORT payment came from this account
 * (`/explorer/funded/:address`): of the accounts it paid in its first 100
 * payments, those whose earliest QORT payment received was its own. 50
 * accounts are checked at first (with progress) and 50 more per tap; the
 * summary says how many were checked of how many. Rows carry the MINTER
 * mark from the app's cached lists. Read-only; nothing polls.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, LinearProgress, Typography } from '@mui/material';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { PersonChip } from '../../components/common/Person';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { isAddress } from '../../data/accounts';
import { checkMoreFunded, firstPaidBy, FUNDED_BATCH, getFunded } from '../../data/explorer/funded';
import { usePrimaryName } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { explorerFundedPath, PATHS } from '../../routes/paths';
import { formatAmount } from '../../rules/explorer/txWords';
import { visibleName } from '../../rules/explorer/nameNotes';
import { formatCount, formatDate, plural, shortAddress } from '../../utils/format';
import { useMinterMarks } from './account/connections/hooks';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from './account/names/useShowMore';
import { INVALID_ADDRESS } from './explorerWords';
import { SET_LIST_SX } from './sets/SponseeRows';
import { fundedSummary } from './sets/words';
import { withMarkedName } from '../../components/common/markedText';

/** Rows shown before "Show more". */
const ROWS = 20;

export default function FundedPage() {
  const address = (useParams().address ?? '').trim();
  const valid = isAddress(address);
  const name = usePrimaryName(valid ? address : null).data ?? null;
  const label = name ? visibleName(name) : shortAddress(address);
  const funded = useQuery(valid ? `xfunded:${address}` : null, (force) =>
    getFunded(address, { force })
  );
  const marks = useMinterMarks(valid);
  const [limit, setLimit] = useState(ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const checkMore = async () => {
    setMore('loading');
    try {
      await checkMoreFunded(address, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setMore('idle');
    } catch {
      setMore('failed');
    } finally {
      setProgress(null);
    }
  };

  // The first 50 are checked without a tap (again after a fresh read).
  const unchecked =
    funded.data !== undefined && funded.data.checked === 0 && funded.data.paid.length > 0;
  const started = useRef<unknown>(null);
  useEffect(() => {
    if (!unchecked || started.current === funded.data) return;
    started.current = funded.data;
    void checkMore();
    // checkMore reads the address it was made with; one run per read of the payments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unchecked, funded.data]);

  let body: React.ReactNode;
  if (!valid)
    body = <EmptyState title={INVALID_ADDRESS} description={<bdi dir="auto">{address}</bdi>} />;
  else if (funded.isError && !funded.data)
    body = (
      <ErrorState
        title="Couldn’t read its payments."
        error={funded.error}
        onRetry={() => void funded.refetch()}
      />
    );
  else if (!funded.data) body = <ListSkeleton count={3} label="Checking its first payments" />;
  else if (!funded.data.paid.length)
    body = (
      <EmptyState
        title={withMarkedName(`${label} has sent no QORT payments to other accounts.`, name, label)}
      />
    );
  else {
    const data = funded.data;
    const first = firstPaidBy(data, address);
    const left = data.paid.length - data.checked;
    body = (
      <>
        <Typography role="status" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {withMarkedName(
            data.checked === 0
              ? `${label} paid ${plural(data.paid.length, 'account')} in its ${
                  data.truncated ? 'first ' : ''
                }${plural(data.payments, 'payment')}. Checking whose first QORT payment it was…`
              : fundedSummary(data, label, first.length),
            name,
            label
          )}
        </Typography>
        {progress ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <LinearProgress
              variant="determinate"
              value={progress.total ? (progress.done / progress.total) * 100 : 0}
              aria-label="Accounts checked"
            />
            <Typography variant="body2" color="text.secondary">
              Checked {formatCount(progress.done)} of {plural(progress.total, 'account')}…
            </Typography>
          </Box>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          An account’s first QORT payment is the earliest QORT payment it received. Asset transfers,
          multi-payments and AT payouts aren’t counted
          {data.atLeftOut
            ? `; payments to ${plural(data.atLeftOut, 'AT address', 'AT addresses')} are left out`
            : ''}
          .
        </Typography>
        {left > 0 && data.checked > 0 ? (
          <Button
            variant="outlined"
            onClick={() => void checkMore()}
            disabled={more === 'loading'}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {more === 'loading'
              ? 'Checking…'
              : `Check ${formatCount(Math.min(FUNDED_BATCH, left))} more`}
          </Button>
        ) : null}
        {more === 'failed' ? (
          <ErrorState
            compact
            title="Couldn’t check more accounts."
            onRetry={() => void checkMore()}
          />
        ) : null}
        {first.length ? (
          <Section title="First QORT payment from it" id="funded-list" count={first.length}>
            <Box
              component="ul"
              ref={listRef}
              aria-label={`Accounts whose first QORT payment came from ${label}`}
              sx={SET_LIST_SX}
            >
              {first.slice(0, limit).map((paid) => (
                <Box component="li" key={paid.address} tabIndex={-1} sx={FOCUSABLE_ROW_SX}>
                  <PersonChip
                    address={paid.address}
                    size={32}
                    secondary={[
                      `${formatAmount(paid.amount)} QORT, ${formatDate(paid.timestamp)} · block ${formatCount(paid.height)}`,
                      marks.markOf(paid.address),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </Box>
              ))}
            </Box>
            {first.length > limit ? (
              <Button
                onClick={() => {
                  focusFrom(limit);
                  setLimit((n) => n + ROWS);
                }}
                sx={{ alignSelf: 'flex-start', minHeight: 44 }}
              >
                Show more ({formatCount(first.length - limit)} more)
              </Button>
            ) : null}
          </Section>
        ) : null}
      </>
    );
  }

  return (
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <PageHeader
        title={valid ? `First QORT payments from ${label}` : 'First QORT payments'}
        heading={
          valid ? withMarkedName(`First QORT payments from ${label}`, name, label) : undefined
        }
        back={PATHS.explorer}
        actions={
          valid ? <CopyLinkButton path={explorerFundedPath(address)} what="this list" /> : undefined
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>{body}</PageBody>
    </PersonLinkContext>
  );
}
