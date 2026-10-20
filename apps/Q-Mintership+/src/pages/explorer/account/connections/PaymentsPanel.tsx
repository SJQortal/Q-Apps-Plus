/**
 * Connections → Payments: QORT payments, asset transfers and multi-payments
 * grouped by the other account, "Sent to" or "Received from", sorted by
 * how many or how much, or by the latest or the earliest payment. Each account that has sent 100+ or 500+ payments
 * says so; those with 1,000+ are folded into one line that opens them. AT
 * addresses come last, as contracts, 20 at a time like the people
 * ("Show more"). "MINTER members only" filters by the
 * app's cached member list (read once this part is near the screen). The
 * line under the list says how far back it read; "Check older" reads the
 * next 100 that way. With the tab's search (`found`), each way lists only
 * the accounts found, sorted as picked: the matches, then those only
 * similar under "Similar to …"; the counts on Sent to and Received from
 * are what was found.
 */
import { useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ExpandChevron } from '../../../../components/common/ExpandChevron';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { loadOlderPayments, type PayDirection } from '../../../../data/explorer/money';
import { bandWords } from '../../../../rules/explorer/connections';
import {
  busyLine,
  collapseBusy,
  flowCountWords,
  flowParts,
  FLOW_SORTS,
  isFlowSort,
  paymentsCoverage,
  sortFlows,
  splitAt,
  type Flow,
  type FlowSort,
} from '../../../../rules/explorer/money';
import { formatCount, plural } from '../../../../utils/format';
import { useFocusNewRows } from '../names/useShowMore';
import { ConnectionRow, ROW_LIST_SX } from './ConnectionRow';
import { blocksLine } from './words';
import { usePayerBands, type MinterMarks } from './hooks';
import type { ConnectionsData } from './useConnections';
import type { Found } from './searchEntries';
import { SimilarHeading } from '../../../../components/explorer/search/SimilarHeading';
import { useViewState } from '../../../../hooks/useViewState';

/** People rows shown before "Show more" (each looks up a name). */
const PAGE_ROWS = 20;

type Direction = 'sent' | 'received';

export interface PaymentsPanelProps {
  address: string;
  accountLabel: string;
  data: ConnectionsData;
  marks: MinterMarks;
  /** Plain tags for a known relation: "its sponsor", "its first QORT came from them". */
  relationOf: (address: string) => string[];
  /** The sort it starts with: Most payments, or Most QORT when the circle is ordered by QORT. */
  initialSort?: FlowSort;
  /** The tab's search, when one is typed: the accounts it found each way. */
  found?: {
    sent: Found<Flow>;
    received: Found<Flow>;
    typed: string;
    /** "holds the name “…”" for an account found by a name it holds. */
    tagOf: (address: string) => string | null;
  } | null;
}

function FlowRow({
  flow,
  direction,
  address,
  accountLabel,
  tags,
}: {
  flow: Flow;
  direction: Direction;
  address: string;
  accountLabel: string;
  tags: Array<string | null>;
}) {
  return (
    <ConnectionRow
      address={address}
      accountLabel={accountLabel}
      other={flow.address}
      parts={flowParts(flow, direction)}
      when={blocksLine(flow.first.height, flow.last.height)}
      tags={tags}
      evidence={{ words: flowCountWords(flow), txs: flow.txs }}
      flow={direction === 'received' ? 'in' : 'out'}
    />
  );
}

export function PaymentsPanel({
  address,
  accountLabel,
  data,
  marks,
  relationOf,
  initialSort = 'count',
  found = null,
}: PaymentsPanelProps) {
  // Each choice here is kept for Back (useViewState).
  const [chosen, setDirection] = useViewState<Direction | null>('direction', null);
  // Until one is picked: Sent to, unless it sent nothing and received something.
  const direction: Direction =
    chosen ??
    (data.flowsSent?.length === 0 && (data.flowsReceived?.length ?? 0) > 0 ? 'received' : 'sent');
  const [sort, setSort] = useViewState<FlowSort>('sort', initialSort);
  const [membersOnly, setMembersOnly] = useViewState('members-only', false);
  const [limit, setLimit] = useViewState('limit', PAGE_ROWS);
  const peopleFocus = useFocusNewRows();
  const [atLimit, setAtLimit] = useViewState('at-limit', PAGE_ROWS);
  const atFocus = useFocusNewRows();
  const [busyOpen, setBusyOpen] = useViewState('busy-open', false);
  const [older, setOlder] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [said, setSaid] = useState('');
  const [similarLimit, setSimilarLimit] = useViewState('similar-limit', PAGE_ROWS);

  const page = direction === 'sent' ? data.sent : data.recv;
  const flowsHere = direction === 'sent' ? data.flowsSent : data.flowsReceived;
  // With a search, the matches here (those only similar follow under their heading).
  const foundHere = found ? found[direction] : null;
  const all = flowsHere && foundHere ? foundHere.match : flowsHere;
  const similar = sortFlows(foundHere?.similar ?? [], sort).filter(
    (flow) => !membersOnly || !marks.ready || marks.markOf(flow.address)
  );
  const sorted = sortFlows(all ?? [], sort);
  const { people: everyone, ats } = splitAt(sorted);
  const people =
    membersOnly && marks.ready ? everyone.filter((flow) => marks.markOf(flow.address)) : everyone;
  const visible = people.slice(0, limit);
  const bands = usePayerBands(visible.map((flow) => flow.address));
  const { shown, busy } = collapseBusy(visible, bands);
  const busyId = `payments-busy-${direction}`;

  const tagsOf = (other: string) => [
    marks.markOf(other),
    marks.devOf(other),
    ...relationOf(other),
    bandWords(bands[other]),
    found?.tagOf(other) ?? null,
  ];

  const sentCount = found ? found.sent.all.length : data.flowsSent?.length;
  const receivedCount = found ? found.received.all.length : data.flowsReceived?.length;
  const apiDirection: PayDirection = direction === 'sent' ? 'sent' : 'recv';

  const checkOlder = async () => {
    setOlder('loading');
    setSaid('');
    const before = page.data?.rows.length ?? 0;
    try {
      const next = await loadOlderPayments(address, apiDirection);
      const added = (next?.rows.length ?? before) - before;
      setOlder('idle');
      setSaid(
        added > 0
          ? `${plural(added, 'older payment')} checked.`
          : 'No older payments found that way.'
      );
    } catch {
      setOlder('failed');
    }
  };

  const coverage =
    data.sent.data && data.recv.data
      ? paymentsCoverage(
          { count: data.sent.data.rows.length, done: data.sent.data.done },
          { count: data.recv.data.rows.length, done: data.recv.data.done },
          data.assets.data
            ? { count: data.assets.data.rows.length, truncated: data.assets.data.truncated }
            : undefined
        )
      : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={direction}
          onChange={(_, value: Direction | null) => {
            if (!value) return;
            setDirection(value);
            setLimit(PAGE_ROWS);
            setAtLimit(PAGE_ROWS);
            setSimilarLimit(PAGE_ROWS);
            setBusyOpen(false);
            setSaid('');
          }}
          aria-label="Which payments"
        >
          <ToggleButton value="sent" sx={{ minHeight: 44, textTransform: 'none', fontSize: 14 }}>
            Sent to{sentCount !== undefined ? ` · ${formatCount(sentCount)}` : ''}
          </ToggleButton>
          <ToggleButton
            value="received"
            sx={{ minHeight: 44, textTransform: 'none', fontSize: 14 }}
          >
            Received from{receivedCount !== undefined ? ` · ${formatCount(receivedCount)}` : ''}
          </ToggleButton>
        </ToggleButtonGroup>
        <TextField
          select
          label="Sort"
          size="small"
          value={sort}
          onChange={(e) => {
            if (isFlowSort(e.target.value)) setSort(e.target.value);
          }}
          slotProps={{ select: { native: true } }}
          sx={{ flex: '0 1 220px', minWidth: 180, '& .MuiInputBase-root': { minHeight: 44 } }}
        >
          {FLOW_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </TextField>
        <FormControlLabel
          control={
            <Switch
              checked={membersOnly}
              disabled={!marks.ready}
              onChange={(event) => {
                setMembersOnly(event.target.checked);
                setLimit(PAGE_ROWS);
              }}
            />
          }
          label="MINTER members only"
          sx={{ minHeight: 44, mr: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
        />
      </Box>

      {page.isError && !page.data ? (
        <ErrorState
          compact
          title="Couldn’t load the payments."
          error={page.error}
          onRetry={() => void page.refetch()}
        />
      ) : !all ? (
        <ListSkeleton count={2} label="Loading the payments" />
      ) : found && people.length === 0 && ats.length === 0 && similar.length === 0 ? (
        <Typography color="text.secondary" role="status">
          {`Nothing in ${direction === 'sent' ? 'Sent to' : 'Received from'} matches “${found.typed}”${
            (direction === 'sent' ? receivedCount : sentCount)
              ? `; ${direction === 'sent' ? 'Received from' : 'Sent to'} has ${formatCount(
                  (direction === 'sent' ? receivedCount : sentCount) as number
                )}`
              : ''
          }.`}
        </Typography>
      ) : !found && people.length === 0 && ats.length === 0 ? (
        <Typography color="text.secondary" role="status">
          {membersOnly
            ? 'None with MINTER members in the data checked.'
            : direction === 'sent'
              ? 'No payments sent in the data checked.'
              : 'No payments received in the data checked.'}
        </Typography>
      ) : (
        <>
          <Box
            component="ul"
            ref={peopleFocus.listRef}
            aria-label={direction === 'sent' ? 'Sent to' : 'Received from'}
            sx={ROW_LIST_SX}
          >
            {shown.map((flow) => (
              <FlowRow
                key={flow.address}
                flow={flow}
                direction={direction}
                address={address}
                accountLabel={accountLabel}
                tags={tagsOf(flow.address)}
              />
            ))}
          </Box>
          {busy.length ? (
            <Box>
              <Button
                onClick={() => setBusyOpen((value) => !value)}
                aria-expanded={busyOpen}
                aria-controls={busyId}
                endIcon={<ExpandChevron open={busyOpen} />}
                sx={{ minHeight: 44, textAlign: 'left', fontSize: 14 }}
              >
                {busyLine(busy.length)}
              </Button>
              <Box id={busyId}>
                <SmoothReveal open={busyOpen}>
                  <Box
                    component="ul"
                    aria-label="Accounts that have sent 1,000+ payments"
                    sx={ROW_LIST_SX}
                  >
                    {busy.map((flow) => (
                      <FlowRow
                        key={flow.address}
                        flow={flow}
                        direction={direction}
                        address={address}
                        accountLabel={accountLabel}
                        tags={tagsOf(flow.address)}
                      />
                    ))}
                  </Box>
                </SmoothReveal>
              </Box>
            </Box>
          ) : null}
          {people.length > visible.length ? (
            <Button
              onClick={() => {
                peopleFocus.focusFrom(shown.length);
                setLimit((value) => value + PAGE_ROWS);
              }}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              Show more ({formatCount(people.length - visible.length)} more)
            </Button>
          ) : null}
          {ats.length ? (
            <Box
              component="ul"
              ref={atFocus.listRef}
              aria-label="AT addresses (automated contracts)"
              sx={ROW_LIST_SX}
            >
              {ats.slice(0, atLimit).map((flow) => (
                <FlowRow
                  key={flow.address}
                  flow={flow}
                  direction={direction}
                  address={address}
                  accountLabel={accountLabel}
                  tags={[]}
                />
              ))}
            </Box>
          ) : null}
          {ats.length > atLimit ? (
            <Button
              onClick={() => {
                atFocus.focusFrom(atLimit);
                setAtLimit((value) => value + PAGE_ROWS);
              }}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              Show more AT addresses ({formatCount(ats.length - atLimit)} more)
            </Button>
          ) : null}
          {found && similar.length ? (
            <>
              <SimilarHeading typed={found.typed} />
              <Box
                component="ul"
                aria-label={`${direction === 'sent' ? 'Sent to' : 'Received from'}, similar to “${found.typed}”`}
                sx={ROW_LIST_SX}
              >
                {similar.slice(0, similarLimit).map((flow) => (
                  <FlowRow
                    key={flow.address}
                    flow={flow}
                    direction={direction}
                    address={address}
                    accountLabel={accountLabel}
                    tags={flow.isAt ? [] : tagsOf(flow.address)}
                  />
                ))}
              </Box>
              {similar.length > similarLimit ? (
                <Button
                  onClick={() => setSimilarLimit((value) => value + PAGE_ROWS)}
                  sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                >
                  Show more ({formatCount(similar.length - similarLimit)} more)
                </Button>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {coverage ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 240px', minWidth: 0 }}
          >
            {coverage}
          </Typography>
          {page.data && !page.data.done ? (
            <Button
              onClick={() => void checkOlder()}
              disabled={older === 'loading'}
              aria-label={`Check older payments ${direction === 'sent' ? 'sent' : 'received'}`}
              sx={{ minHeight: 44 }}
            >
              {older === 'loading' ? 'Checking…' : 'Check older'}
            </Button>
          ) : null}
        </Box>
      ) : null}
      {data.assets.isError && data.assets.data === undefined ? (
        <ErrorState
          compact
          title="Couldn’t read its asset transfers and multi-payments."
          error={data.assets.error}
          onRetry={() => void data.assets.refetch()}
        />
      ) : null}
      {older === 'failed' ? (
        <ErrorState
          compact
          title="Couldn’t read older payments."
          onRetry={() => void checkOlder()}
        />
      ) : null}
      <Typography role="status" variant="body2" color="text.secondary" sx={{ minHeight: 0 }}>
        {said}
      </Typography>
    </Box>
  );
}
