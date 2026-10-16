/**
 * Compare → In common: what two or more of the compared accounts share,
 * each with its denominator: the same sponsor (and how many accounts it
 * sponsored, to its sponsees page), the same first payer (and how many
 * payments it has sent), accounts they paid or were paid by (with the
 * direction and the counts; busy payers and AT addresses left out and
 * counted), groups smallest first, and how far apart some firsts were.
 * Raw facts: no threshold decides what is shown, and nothing says what it
 * means. Then what was checked and found nothing, and what a failed read
 * left unchecked (never counted as nothing found).
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Section } from '../../../components/common/Section';
import { TxSentence } from '../../../components/explorer/TxSentence';
import { explorerSponseesPath } from '../../../routes/paths';
import {
  bandWords,
  counterpartyCounts,
  counterpartyParts,
  groupsLead,
  leftOutLine,
  listWords,
  sameFirstPayerParts,
  sameSponsorParts,
} from '../../../rules/explorer/compare';
import { formatCount, plural } from '../../../utils/format';
import { inCommonState, PAIR_ANCHOR_SX } from './compareView';
import { FailedReads, LIST_SX, Note, SteppedList, SubHeading, Waiting } from './parts';
import type { CompareData } from './useCompareData';
import { GroupAvatar } from '../../../components/common/GroupAvatar';

const LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: 44,
  fontWeight: 600,
  overflowWrap: 'anywhere',
} as const;

export function InCommonSection({ data }: { data: CompareData }) {
  const total = data.liveSides.length;
  const state = inCommonState(data);
  const { counterparties } = data;
  const leftOut = leftOutLine(counterparties);
  return (
    // The pair grid jumps here for a pair with only something in common.
    <Box id="compare-common" tabIndex={-1} sx={PAIR_ANCHOR_SX}>
      <Section title="In common" id="compare-common-section">
        {data.sponsors.length || data.firstPayers.length ? (
          <Box component="ul" aria-label="Sponsor and first payer" sx={LIST_SX}>
            {data.sponsors.map((same) => (
              <Box component="li" key={`sponsor:${same.sponsor}`} sx={{ minWidth: 0 }}>
                <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
                  <TxSentence parts={sameSponsorParts(same, total)} />
                </Typography>
                <Link
                  component={RouterLink}
                  to={explorerSponseesPath(same.sponsor)}
                  state={{ via: 'explorer' }}
                  sx={LINK_SX}
                >
                  {same.sponsees !== null
                    ? `The ${formatCount(same.sponsees)}${same.capped ? '+' : ''} accounts it sponsored`
                    : 'The accounts it sponsored'}
                  <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
                </Link>
              </Box>
            ))}
            {data.firstPayers.map((same) => (
              <Box component="li" key={`first:${same.from}`} sx={{ minWidth: 0 }}>
                <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
                  <TxSentence parts={sameFirstPayerParts(same, total, data.bands[same.from])} />
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        {counterparties.rows.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <SubHeading>Same accounts in their payments</SubHeading>
            <SteppedList
              items={counterparties.rows}
              label="Same accounts in their payments"
              keyOf={(row) => row.address}
              render={(row) => {
                // Busy marks for 100+ and 500+ (1,000+ are left out).
                const mark = bandWords(data.bands[row.address]);
                return (
                  <>
                    <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
                      <TxSentence parts={counterpartyParts(row, total)} />
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {counterpartyCounts(row)}
                      {mark ? ` · it ${mark}` : ''}
                    </Typography>
                  </>
                );
              }}
            />
            {leftOut ? <Note>{leftOut}</Note> : null}
            <Note>
              In each account’s newest 100 QORT payments each way and its newest 100 asset transfers
              and multi-payments; the compared accounts themselves are left out.
            </Note>
          </Box>
        ) : leftOut ? (
          <Note>Same accounts in their payments: none besides these. {leftOut}</Note>
        ) : null}

        {data.groupsShared.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <SubHeading>Groups</SubHeading>
            <Typography>{groupsLead(data.groupsShared, total)}, smallest first:</Typography>
            <SteppedList
              items={data.groupsShared}
              label="Shared groups"
              keyOf={(group) => String(group.groupId)}
              render={(group) => (
                <Typography sx={{ overflowWrap: 'anywhere' }}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      verticalAlign: 'middle',
                      mr: 0.5,
                      lineHeight: 0,
                    }}
                  >
                    <GroupAvatar
                      groupId={group.groupId}
                      groupName={group.groupName}
                      ownerName={group.ownerName}
                      size={24}
                    />
                  </Box>
                  <bdi dir="auto">{group.groupName || 'A group without a name'}</bdi>
                  {group.memberCount !== undefined
                    ? ` (${plural(group.memberCount, 'member')})`
                    : ''}
                  {group.letters.length < total ? ` · ${listWords(group.letters)}` : ''}
                </Typography>
              )}
            />
          </Box>
        ) : null}

        {data.timing.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <SubHeading>Timing</SubHeading>
            <Box component="ul" aria-label="Timing" sx={{ ...LIST_SX, gap: 0.5 }}>
              {data.timing.map((row) => (
                <Typography component="li" key={row.key}>
                  {row.text}
                </Typography>
              ))}
            </Box>
          </Box>
        ) : null}

        {state.reading ? (
          <Waiting announce="Reading what they share…">
            Reading sponsors, first payments, payments each way and groups to see what they share…
          </Waiting>
        ) : null}
        <FailedReads
          lead="Couldn’t finish checking for"
          what={state.failed}
          error={state.failedReads[0]?.error}
          onRetry={() => state.failedReads.forEach((q) => void q.refetch())}
          retryLabel="Retry In common"
          announce="In common: some reads failed."
        />
        {state.empty.length ? <Note>Checked, none found: {state.empty.join(', ')}.</Note> : null}
      </Section>
    </Box>
  );
}
