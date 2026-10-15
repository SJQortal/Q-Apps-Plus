/**
 * Who answered, side by side: a column of Minter Admins per answer under
 * its count, so the answers read at a glance instead of one list under
 * another. On phones each person is a small avatar centred beside their
 * name (which wraps onto two lines), so three columns still fit and the
 * people sit close one under another. PeopleColumns draws any set of columns (a Minter Admin
 * poll's Yes, No and Neutral); AnswerColumns is a decision's Approved,
 * Rejected and (while it collects answers) Considering.
 *
 * An answer still on its way shows in its column, faded, with "confirming…"
 * (until then the one it replaces, if any, still counts in the other); a
 * rejection from an admin who had approved first says so; a Considering
 * note shows under its name. With `phoneLimit`, a phone shows that many
 * people per column ("+5 more" under the rest) and one Show all for them.
 */
import { useId, useState, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PersonChip } from '../common/Person';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { formatCount, plural } from '../../utils/format';

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

export type ColumnTone = 'success' | 'error' | 'neutral';

const TONE_COLOR: Record<ColumnTone, string> = {
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
  /** The columns' headings: h4 under a decision card's h3 title (default), h3 on a nomination card. */
  headingLevel?: 'h3' | 'h4';
  /** On phones, at most this many people per column, with Show all for the rest. */
  phoneLimit?: number;
  /** What the columns are about, for Show all's name: "the answers on bob+builder". */
  label?: string;
}

export function AnswerColumns({
  approved,
  rejected,
  considering,
  emptyText = 'None yet',
  headingLevel,
  phoneLimit,
  label,
}: AnswerColumnsProps) {
  return (
    <PeopleColumns
      headingLevel={headingLevel}
      phoneLimit={phoneLimit}
      label={label}
      columns={[
        {
          key: 'approved',
          title: 'Approved',
          listLabel: (n) => `Approved by ${plural(n, 'Minter Admin')}`,
          icon: <CheckCircleOutlineOutlinedIcon aria-hidden />,
          tone: 'success',
          people: approved,
          emptyText,
        },
        {
          key: 'rejected',
          title: 'Rejected',
          listLabel: (n) => `Rejected by ${plural(n, 'Minter Admin')}`,
          icon: <CancelOutlinedIcon aria-hidden />,
          tone: 'error',
          people: rejected,
          emptyText,
        },
        ...(considering
          ? [
              {
                key: 'considering',
                title: 'Considering',
                listLabel: (n: number) => `Considering: ${plural(n, 'Minter Admin')}`,
                icon: <VisibilityOutlinedIcon aria-hidden />,
                tone: 'neutral' as const,
                people: considering,
                emptyText: 'Nobody',
              },
            ]
          : []),
      ]}
    />
  );
}

export interface PeopleColumn {
  key: string;
  title: string;
  /** The list's name for screen readers, from the count that counts. */
  listLabel: (count: number) => string;
  icon: ReactNode;
  tone: ColumnTone;
  people: AnswerPerson[];
  /** Said when the column has nobody. */
  emptyText: string;
  /** The count in the heading, when it isn't the people who count here. */
  count?: number;
}

/** Columns of people side by side, each under its title and count. */
export function PeopleColumns(props: PeopleColumnsProps) {
  // Only a capped set asks for the screen size: every decision card renders columns.
  return props.phoneLimit ? <CappedColumns {...props} /> : <ColumnsGrid {...props} limit={null} />;
}

interface PeopleColumnsProps {
  columns: PeopleColumn[];
  /** The columns' headings: h4 under a card's h3 title, h3 where the card has none or in a dialog (under its h2). */
  headingLevel?: 'h3' | 'h4';
  /** On phones, at most this many people per column, with Show all for the rest. */
  phoneLimit?: number;
  /** What the columns are about, for Show all's name. */
  label?: string;
}

function CappedColumns({ phoneLimit, label, ...props }: PeopleColumnsProps) {
  const phone = usePhoneLayout();
  const [all, setAll] = useState(false);
  const id = useId();
  const long = Boolean(
    phone && phoneLimit && props.columns.some((c) => c.people.length > phoneLimit)
  );
  const words = all ? 'Show fewer' : 'Show all';
  return (
    <>
      <ColumnsGrid {...props} id={id} limit={long && !all ? (phoneLimit as number) : null} />
      {long ? (
        <Button
          size="small"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          aria-controls={id}
          aria-label={label ? `${words}: ${label}` : undefined}
          sx={{ alignSelf: 'flex-start', minHeight: 44, mt: -1, ml: -0.75 }}
        >
          {words}
        </Button>
      ) : null}
    </>
  );
}

function ColumnsGrid({
  columns,
  headingLevel = 'h4',
  id,
  limit,
}: Pick<PeopleColumnsProps, 'columns' | 'headingLevel'> & { id?: string; limit: number | null }) {
  return (
    <Box
      id={id}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
        columnGap: { xs: 1, sm: 2 },
        rowGap: 1,
      }}
    >
      {columns.map(({ key, ...column }) => (
        <Column key={key} {...column} headingLevel={headingLevel} limit={limit} />
      ))}
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
  count,
  headingLevel,
  limit,
}: Omit<PeopleColumn, 'key'> & { headingLevel: 'h3' | 'h4'; limit: number | null }) {
  const headingId = useId();
  const counted = count ?? people.filter((p) => !p.confirming).length;
  const coming = people.filter((p) => p.confirming).length;
  const shown = limit === null ? people : people.slice(0, limit);
  const more = people.length - shown.length;
  return (
    <Box
      role="group"
      aria-labelledby={headingId}
      sx={{ minWidth: 0, borderTop: 3, borderColor: TONE_COLOR[tone], pt: 0.75 }}
    >
      <Typography
        component={headingLevel}
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
        <>
          <Box
            component="ul"
            aria-label={listLabel(counted)}
            sx={{
              listStyle: 'none',
              m: 0,
              mt: 0.5,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {shown.map((p) => (
              <Box
                component="li"
                key={`${p.address}${p.confirming ? ':confirming' : ''}`}
                sx={{ minWidth: 0, opacity: p.confirming ? 0.7 : 1 }}
              >
                <PersonChip
                  address={p.address}
                  name={p.name}
                  size={28}
                  compactOnPhone
                  secondary={personNote(p)}
                />
              </Box>
            ))}
          </Box>
          {more ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              +{formatCount(more)} more
            </Typography>
          ) : null}
        </>
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
