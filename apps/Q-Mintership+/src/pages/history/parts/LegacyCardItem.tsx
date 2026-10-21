/**
 * One old card in a list: who it was about, its title, who published it and
 * when. The whole row opens the card (one big target on phones, no links
 * nested inside). The body loads per row, so a long list fills in as it can;
 * a card deleted by its publisher drops out, one the node can't fetch says so.
 * An Admin Board card is decrypted for the viewer (a Minter Admin) the same
 * way; one that wasn't encrypted to them says so.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import {
  legacyCardKey,
  loadLegacyCard,
  type LegacyCard,
  type LegacyCardRow,
} from '../../../data/legacy';
import { adminCardKey, loadAdminCard } from '../../../data/legacyAdminBoard';
import { QdnDeletedError } from '../../../data/qdn';
import { useQuery } from '../../../hooks/useQuery';
import { NameAvatar } from '../../../components/common/NameAvatar';
import { legacyCardPath } from '../../../routes/paths';
import { legacyKindLabel, legacyMetaLine, legacyProblem } from './legacyWords';

/** What a row says when an Admin Board card wasn't encrypted to the viewer. */
export const NOT_ENCRYPTED_TO_YOU = 'Not encrypted to you';

const Row = styled(RouterLink)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 64,
  padding: theme.spacing(1.5, 2),
  color: 'inherit',
  textDecoration: 'none',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: 'background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  [theme.breakpoints.down('sm')]: { padding: theme.spacing(1.25, 1.5) },
}));

export function LegacyCardItem({
  row,
  card,
  viewer = null,
}: {
  row: LegacyCardRow;
  card?: LegacyCard;
  /** The signed-in Minter Admin, for Admin Board rows (none are shown without one). */
  viewer?: string | null;
}) {
  if (row.board === 'admin') return viewer ? <AdminBoardItem row={row} viewer={viewer} /> : null;
  return <PublicCardItem row={row} card={card} />;
}

function PublicCardItem({ row, card: given }: { row: LegacyCardRow; card?: LegacyCard }) {
  const query = useQuery(given ? null : legacyCardKey(row), () => loadLegacyCard(row));
  const card = given ?? query.data;
  if (!card && query.error instanceof QdnDeletedError) return null;
  return (
    <ItemView
      row={row}
      card={card}
      problem={!card && query.isError ? legacyProblem(query.error) : null}
    />
  );
}

function AdminBoardItem({ row, viewer }: { row: LegacyCardRow; viewer: string }) {
  const query = useQuery(adminCardKey(viewer, row), () => loadAdminCard(viewer, row));
  const read = query.data;
  if (!read && query.error instanceof QdnDeletedError) return null;
  const card = read?.status === 'ok' ? read.value : undefined;
  const problem =
    read?.status === 'locked'
      ? NOT_ENCRYPTED_TO_YOU
      : !read && query.isError
        ? legacyProblem(query.error)
        : null;
  return <ItemView row={row} card={card} problem={problem} />;
}

function ItemView({
  row,
  card,
  problem,
}: {
  row: LegacyCardRow;
  card: LegacyCard | undefined;
  problem: string | null;
}) {
  return (
    <Row to={legacyCardPath(row.identifier)}>
      <NameAvatar name={card?.subject.name ?? null} size={40} />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {card ? (
          <Typography
            sx={{
              fontWeight: 600,
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {card.title}
          </Typography>
        ) : problem ? (
          <Typography sx={{ fontWeight: 600 }} color="text.secondary">
            {problem}
          </Typography>
        ) : (
          <Skeleton variant="text" width="70%" sx={{ fontSize: 16 }} />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {legacyMetaLine(card, row)}
        </Typography>
        {card ? (
          <Box sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              variant="outlined"
              label={legacyKindLabel(card)}
              sx={{ pointerEvents: 'none' }}
            />
          </Box>
        ) : null}
      </Box>
      <ChevronRightOutlinedIcon aria-hidden sx={{ color: 'text.secondary', flexShrink: 0 }} />
    </Row>
  );
}
