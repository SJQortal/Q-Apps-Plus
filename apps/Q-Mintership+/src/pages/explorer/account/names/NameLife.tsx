/**
 * "Its whole history" under a name's own history (Simon, 2026-10-17): on
 * request, every change to the name since it was registered, by each
 * account that had it and under its earlier spellings, newest first
 * (data/explorer/nameLife.ts), each saying who did it, with the date and
 * block. The line over it says when it was registered, how many changes
 * since and how many owners; one under it says where it stops short, if it
 * does. Opened, it stays open for Back (useViewState).
 */
import { useEffect, useId } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { ExpandChevron } from '../../../../components/common/ExpandChevron';
import { PersonInline } from '../../../../components/common/Person';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { ErrorState } from '../../../../components/common/states';
import { HeavyCancelled } from '../../../../data/explorer/heavy';
import {
  getNameLife,
  NAME_LIFE_HOPS,
  nameLifeKey,
  type NameLife,
} from '../../../../data/explorer/nameLife';
import { useQuery } from '../../../../hooks/useQuery';
import { useViewState } from '../../../../hooks/useViewState';
import { visibleName } from '../../../../rules/explorer/nameNotes';
import { formatCount } from '../../../../utils/format';
import { HistoryRow } from './NameHistoryList';
import {
  CUT_CAPPED_AFTER,
  CUT_NOT_FOUND_AFTER,
  cutHopsLine,
  LIFE_BUTTON,
  LIFE_ERROR,
  LIFE_NO_RECORD,
  LIFE_READING,
  LIFE_SHOWN,
  lifeSummary,
  otherRegistrationLine,
} from './nameLifeWords';

function EndNote({ life }: { life: NameLife }) {
  const end = life.end;
  let note: React.ReactNode = null;
  if (end.kind === 'registered') {
    if (!end.matches) note = otherRegistrationLine(life.registered);
  } else if (end.why === 'capped')
    note = (
      <>
        <PersonInline address={end.at} />
        {CUT_CAPPED_AFTER}
      </>
    );
  else if (end.why === 'notFound')
    note = (
      <>
        How <PersonInline address={end.at} />
        {CUT_NOT_FOUND_AFTER}
      </>
    );
  else note = cutHopsLine(NAME_LIFE_HOPS);
  if (!note) return null;
  return (
    <Typography
      component="div"
      variant="body2"
      color="text.secondary"
      role="note"
      sx={{ overflowWrap: 'anywhere' }}
    >
      {note}
    </Typography>
  );
}

function LifeBody({ name }: { name: string }) {
  const life = useQuery(nameLifeKey(name), (force) => getNameLife(name, { force }));
  const [all, setAll] = useViewState(`life:${name}:all`, false);
  // A read dropped by a page closing isn't a failure: read again.
  const dropped = life.isError && life.error instanceof HeavyCancelled;
  const { refetch } = life;
  useEffect(() => {
    if (dropped) void refetch();
  }, [dropped, refetch]);

  if (life.isError && life.data === undefined && !dropped)
    return (
      <ErrorState
        compact
        title={LIFE_ERROR}
        error={life.error}
        onRetry={() => void life.refetch()}
      />
    );
  if (life.data === undefined || dropped)
    return (
      <Box role="status" sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {LIFE_READING}
        </Typography>
        <Skeleton variant="text" width="85%" aria-hidden />
        <Skeleton variant="text" width="50%" aria-hidden />
      </Box>
    );
  if (life.data === null)
    return (
      <Typography variant="body2" color="text.secondary">
        {LIFE_NO_RECORD}
      </Typography>
    );
  const data = life.data;
  const shown = all ? data.steps : data.steps.slice(0, LIFE_SHOWN);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
        {lifeSummary(data)}
      </Typography>
      {shown.length ? (
        <Box
          component="ul"
          aria-label={`Every change to “${visibleName(name)}”`}
          sx={{ listStyle: 'none', m: 0, p: 0, minWidth: 0 }}
        >
          {shown.map((tx) => (
            <HistoryRow key={tx.signature} tx={tx} viewpoint={null} />
          ))}
        </Box>
      ) : null}
      {data.steps.length > shown.length ? (
        <Button
          onClick={() => setAll(true)}
          sx={{ alignSelf: 'flex-start', minHeight: 44, px: 1, ml: -1 }}
        >
          Show all {formatCount(data.steps.length)}{' '}
          <Box component="span" sx={visuallyHidden}>
            {`changes to “${visibleName(name)}”`}
          </Box>
        </Button>
      ) : null}
      <EndNote life={data} />
    </Box>
  );
}

export function NameLifeToggle({
  name,
  openNow = false,
}: {
  name: string;
  /** Open it (the name was opened from a link to it): kept for Back like a press. */
  openNow?: boolean;
}) {
  const [open, setOpen] = useViewState(`life:${name}`, false);
  useEffect(() => {
    if (openNow) setOpen(true);
  }, [openNow, setOpen]);
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        endIcon={<ExpandChevron open={open} />}
        sx={{ alignSelf: 'flex-start', minHeight: 44, px: 1, ml: -1 }}
      >
        {LIFE_BUTTON}{' '}
        <Box component="span" sx={visuallyHidden}>
          {`of “${visibleName(name)}”`}
        </Box>
      </Button>
      <SmoothReveal open={open}>
        <Box id={id} sx={{ pt: 0.5 }}>
          <LifeBody name={name} />
        </Box>
      </SmoothReveal>
    </Box>
  );
}
