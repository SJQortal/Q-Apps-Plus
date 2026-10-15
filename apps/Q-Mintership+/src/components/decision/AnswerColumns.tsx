/**
 * Who answered a decision, side by side: Approved, Rejected and (while it
 * collects answers) Considering, each a column of Minter Admins under its
 * count, so the answers read at a glance instead of one list under another.
 * On phones each person is their avatar over their name, so three columns
 * still fit.
 *
 * An answer still on its way shows in its column, faded, with "confirming…"
 * (until then the one it replaces, if any, still counts in the other); a
 * rejection from an admin who had approved first says so; a Considering
 * note shows under its name.
 */
import { useId, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PersonChip } from '../common/Person';
import { plural } from '../../utils/format';

export interface AnswerPerson {
  address: string;
  /** A name the caller already has; omit to look it up. */
  name?: string | null;
  /** On its way into a block: it doesn't count yet. */
  confirming?: boolean;
  /** A rejection sent after this admin's own approval. */
  hadApproved?: boolean;
  /** A Considering note. */
  note?: string | null;
}

type Tone = 'success' | 'error' | 'neutral';

const TONE_COLOR: Record<Tone, string> = {
  success: 'success.main',
  error: 'error.main',
  neutral: 'text.secondary',
};

export interface AnswerColumnsProps {
  approved: AnswerPerson[];
  rejected: AnswerPerson[];
  /** Who is considering it; null leaves the column out (a decided decision). */
  considering: AnswerPerson[] | null;
  /** Said by an empty column: "None yet" while it collects answers, "None" once decided. */
  emptyText?: string;
}

export function AnswerColumns({
  approved,
  rejected,
  considering,
  emptyText = 'None yet',
}: AnswerColumnsProps) {
  const columns = considering ? 3 : 2;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        columnGap: { xs: 1, sm: 2 },
        rowGap: 1,
      }}
    >
      <Column
        title="Approved"
        listLabel={(n) => `Approved by ${plural(n, 'Minter Admin')}`}
        icon={<CheckCircleOutlineOutlinedIcon aria-hidden />}
        tone="success"
        people={approved}
        emptyText={emptyText}
      />
      <Column
        title="Rejected"
        listLabel={(n) => `Rejected by ${plural(n, 'Minter Admin')}`}
        icon={<CancelOutlinedIcon aria-hidden />}
        tone="error"
        people={rejected}
        emptyText={emptyText}
      />
      {considering ? (
        <Column
          title="Considering"
          listLabel={(n) => `Considering: ${plural(n, 'Minter Admin')}`}
          icon={<VisibilityOutlinedIcon aria-hidden />}
          tone="neutral"
          people={considering}
          emptyText="Nobody"
        />
      ) : null}
    </Box>
  );
}

function Column({
  title,
  listLabel,
  icon,
  tone,
  people,
  emptyText,
}: {
  title: string;
  /** The list's name for screen readers, from the count that counts. */
  listLabel: (count: number) => string;
  icon: ReactNode;
  tone: Tone;
  people: AnswerPerson[];
  emptyText: string;
}) {
  const headingId = useId();
  const counted = people.filter((p) => !p.confirming).length;
  const coming = people.length - counted;
  return (
    <Box
      role="group"
      aria-labelledby={headingId}
      sx={{ minWidth: 0, borderTop: 3, borderColor: TONE_COLOR[tone], pt: 0.75 }}
    >
      <Typography
        component="h4"
        id={headingId}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 0.5,
          fontWeight: 700,
          fontSize: 14,
          lineHeight: 1.4,
          '& svg': { fontSize: 18, color: TONE_COLOR[tone] },
        }}
      >
        {icon}
        <span>{title}</span>
        <Box component="span" sx={{ color: 'text.secondary' }}>
          {counted}
        </Box>
        {coming ? (
          <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
            (+{coming} confirming)
          </Box>
        ) : null}
      </Typography>
      {people.length ? (
        <Box
          component="ul"
          aria-label={listLabel(counted)}
          sx={{ listStyle: 'none', m: 0, mt: 0.5, p: 0, display: 'flex', flexDirection: 'column' }}
        >
          {people.map((p) => (
            <Box
              component="li"
              key={`${p.address}${p.confirming ? ':confirming' : ''}`}
              sx={{ minWidth: 0, opacity: p.confirming ? 0.7 : 1 }}
            >
              <PersonChip
                address={p.address}
                name={p.name}
                size={28}
                stackOnPhone
                secondary={personNote(p)}
              />
            </Box>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {emptyText}
        </Typography>
      )}
    </Box>
  );
}

function personNote(p: AnswerPerson): ReactNode {
  const parts: string[] = [];
  if (p.confirming) parts.push('confirming…');
  if (p.hadApproved) parts.push('had approved first');
  if (!parts.length && !p.note) return undefined;
  return (
    <>
      {parts.join(' · ')}
      {p.note ? (
        <Box
          component="span"
          sx={{ display: 'block', overflowWrap: 'anywhere', fontStyle: 'italic' }}
        >
          “{p.note}”
        </Box>
      ) : null}
    </>
  );
}
