/**
 * Small pieces the Mintership tab's sections share: a sub-heading, a list
 * that shows 20 rows at a time (each person row looks up a name), the names
 * an account's records were found under (each isolated), a row that opens
 * an item, and the "Also checked, nothing found" line.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { ListCard } from '../../../history/parts/TimelineList';
import { formatCount } from '../../../../utils/format';
import { FOCUSABLE_ROW_SX, useShowMore } from '../names/useShowMore';
import { alsoChecked, namesLead, NO_NAME_RECORDS } from './mintershipWords';
import { NameWithAvatar } from '../../../../components/explorer/NameWithAvatar';
import { MarkedName } from '../../../../components/common/MarkedName';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { FactLabel } from '../../../../components/explorer/FactLabel';

/** One of a profile's facts: its label (with its ⓘ, if any), and its value in bold. */
export function Fact({
  label,
  value,
  info,
}: {
  label: string;
  value: ReactNode;
  info?: string | null;
}) {
  return (
    <Box sx={FIELD_BLOCK_SX}>
      <FactLabel label={label} info={info} />
      <Typography
        component="dd"
        sx={{ m: 0, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Rows a list shows before "Show more". */
export const SHOWN_STEP = 20;

export function SubHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Typography
      component="h3"
      id={id}
      sx={{ fontWeight: 700, fontSize: 16, px: 0.5, mt: 0.5, overflowWrap: 'anywhere' }}
    >
      {children}
    </Typography>
  );
}

/** A plain line of secondary text. */
export function Note({ children, role }: { children: ReactNode; role?: string }) {
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      role={role}
      sx={{ px: 0.5, overflowWrap: 'anywhere' }}
    >
      {children}
    </Typography>
  );
}

/** "Also checked, nothing found: …", or nothing. */
export function AlsoChecked({ items }: { items: readonly string[] }) {
  const text = alsoChecked(items);
  return text ? <Note>{text}</Note> : null;
}

/**
 * A name, isolated from the words around it, with its own avatar. `label`
 * instead shows a stand-in (a short address for someone with no name),
 * isolated the same way but with no avatar: it isn't a name.
 */
export function IsolatedName({
  name,
  label,
  suffix,
}: {
  name: string | null;
  label?: string;
  suffix?: string;
}) {
  if (name) return <NameWithAvatar name={name} suffix={suffix} />;
  return (
    <>
      <bdi dir="auto" style={{ fontWeight: 600 }}>
        <MarkedName name={name}>{label ?? ''}</MarkedName>
      </bdi>
      {suffix}
    </>
  );
}

/** "Found under 2 of their 3 names: A, B." (each name isolated). */
export function NamesFound({
  names,
  withRecords,
  truncated,
}: {
  names: readonly string[];
  withRecords: readonly string[];
  truncated: boolean;
}) {
  const lead = namesLead(withRecords.length, names.length, truncated);
  if (!lead) return <Note>{NO_NAME_RECORDS}</Note>;
  return (
    <Note>
      {lead}
      {withRecords.map((name, i) => (
        <span key={name}>
          {i === 0 ? ' ' : ', '}
          <IsolatedName name={name} />
        </span>
      ))}
      {withRecords.length ? '.' : ''}
    </Note>
  );
}

/**
 * A list shown 20 rows at a time, with "Show more" (and how many are left);
 * the focus goes to the first row it adds. `render` draws one row (an
 * `li`'s content).
 */
export function SteppedList<T>({
  items,
  label,
  keyOf,
  render,
  card = true,
}: {
  items: readonly T[];
  label: string;
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  /** Rows in one bordered card (default), or as separate cards. */
  card?: boolean;
}) {
  const { shown, showMore, listRef } = useShowMore(SHOWN_STEP, `list:${label}`);
  const visible = items.slice(0, shown);
  const left = items.length - visible.length;
  const list = (
    <Box
      component="ul"
      ref={listRef}
      aria-label={label}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: card ? 0 : 1,
        ...(card ? { '& > li + li': { borderTop: 1, borderColor: 'divider' } } : {}),
      }}
    >
      {visible.map((item) => (
        <Box
          component="li"
          key={keyOf(item)}
          tabIndex={-1}
          sx={[
            card ? { px: { xs: 1.5, sm: 2 }, py: 0.75, minWidth: 0 } : { minWidth: 0 },
            FOCUSABLE_ROW_SX,
          ]}
        >
          {render(item)}
        </Box>
      ))}
    </Box>
  );
  return (
    <>
      {card ? <ListCard>{list}</ListCard> : list}
      {left > 0 ? (
        <Box>
          <Button variant="outlined" onClick={showMore} sx={{ minHeight: 44 }}>
            Show {formatCount(Math.min(left, SHOWN_STEP))} more of {formatCount(left)}
          </Button>
        </Box>
      ) : null}
    </>
  );
}

/** One row that opens an item (a nomination, a decision): the whole row is the link. */
export function ItemLink({
  to,
  title,
  secondary,
  label,
}: {
  to: string;
  title: ReactNode;
  secondary?: ReactNode;
  /** The link's accessible name, when the title alone wouldn't say where it goes. */
  label?: string;
}) {
  return (
    <Link
      component={RouterLink}
      to={to}
      underline="none"
      color="inherit"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 44,
        py: 0.5,
        borderRadius: 1,
        '&:hover .qmp-item-title': { textDecoration: 'underline' },
        '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography className="qmp-item-title" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
        {secondary ? (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {secondary}
          </Typography>
        ) : null}
      </Box>
      <ChevronRightOutlinedIcon aria-hidden sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </Link>
  );
}

/** One row that opens nothing (an item this screen can't link to). */
export function ItemText({ title, secondary }: { title: ReactNode; secondary?: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: 44,
        py: 0.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{title}</Typography>
      {secondary ? (
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {secondary}
        </Typography>
      ) : null}
    </Box>
  );
}
