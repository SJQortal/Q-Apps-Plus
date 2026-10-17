/**
 * The Explorer's landing page: one field for any account or transaction,
 * the accounts explored on this device, the accounts picked to compare,
 * quick starts from reads the app shares with its other pages (your
 * account, open nominations, Minter Admins, members who joined lately),
 * Transactions on Qortal, how to read the Explorer, and the Explorer Quiz
 * (a question about the chain at the bottom of the screen, answered by
 * exploring: components/explorer/quiz/).
 *
 * Read-only, like every Explorer page: nothing here sends anything. Lists
 * that cost a read load only once they near the screen, and nothing polls.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { focusPageTitle } from '../../components/layout/pageFocus';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { AvatarStack, PersonChip } from '../../components/common/Person';
import { EXPLORER_START_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { Card, Section } from '../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../components/common/states';
import { ExplorerSearch } from '../../components/explorer/ExplorerSearch';
import { getAdmins } from '../../data/group';
import { loadNominations } from '../../data/nominations';
import { usePrimaryName, useMembers } from '../../hooks/useData';
import { useInView } from '../../hooks/useInView';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useQuery } from '../../hooks/useQuery';
import { explorerComparePath, explorerTransactionsPath, PATHS } from '../../routes/paths';
import {
  clearPicks,
  clearRecent,
  COMPARE_MAX,
  removePick,
  useComparePicks,
  useRecent,
} from '../../state/explorer';
import { useSession } from '../../state/session';
import { formatDate, shortAddress } from '../../utils/format';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { EXPLORER_NEUTRAL_LINE, EXPLORER_PURPOSE } from './explorerWords';
import { useViewState } from '../../hooks/useViewState';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';

/** How many rows a quick start shows before "Show all". */
const QUICK_ROWS = 6;
/** Members who joined MINTER most recently. */
const RECENT_MEMBERS = 8;

const LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.5,
} as const;

/** An account explored before: its name (or short address) and its address. */
function RecentRow({ address }: { address: string }) {
  const name = usePrimaryName(address.startsWith('Q') ? address : null).data ?? null;
  return (
    <PersonChip
      address={address}
      name={name}
      size={32}
      secondary={name ? shortAddress(address) : address.startsWith('A') ? 'AT address' : null}
    />
  );
}

function RecentSection() {
  const recent = useRecent();
  if (!recent.length) return null;
  return (
    <Section
      title="Recent explorations"
      id="explorer-recent"
      action={
        <Button
          onClick={() => {
            clearRecent();
            // The section goes with its button: the page keeps the focus.
            focusPageTitle();
          }}
          aria-label="Clear recent explorations"
          sx={{ minHeight: 44 }}
        >
          Clear
        </Button>
      }
    >
      <Card>
        <Box component="ul" sx={LIST_SX}>
          {recent.map((address) => (
            <li key={address}>
              <RecentRow address={address} />
            </li>
          ))}
        </Box>
      </Card>
    </Section>
  );
}

function PickRow({ address, onRemove }: { address: string; onRemove: () => void }) {
  const name = usePrimaryName(address.startsWith('Q') ? address : null).data ?? null;
  const label = name ?? shortAddress(address);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <PersonChip address={address} name={name} size={32} />
      </Box>
      <Tooltip title="Remove from compare">
        <IconButton
          aria-label={`Remove ${label} from compare`}
          data-remove
          onClick={onRemove}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function CompareSection() {
  const picks = useComparePicks();
  const navigate = useNavigate();
  const listRef = useRef<HTMLUListElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  // The removed row's button is gone: focus the next one, or the hint when none is left.
  const remove = (address: string, index: number) => {
    removePick(address);
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLElement>('button[data-remove]');
      const next = buttons?.length ? buttons[Math.min(index, buttons.length - 1)] : null;
      (next ?? hintRef.current)?.focus();
    });
  };

  return (
    <Section title="Compare" id="explorer-compare">
      {picks.length === 0 ? (
        <Typography ref={hintRef} tabIndex={-1} variant="body2" color="text.secondary">
          Open an account and press its Compare button to pick it. Compare holds up to {COMPARE_MAX}{' '}
          accounts.
        </Typography>
      ) : (
        <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box component="ul" ref={listRef} aria-label="Picked to compare" sx={LIST_SX}>
            {picks.map((address, index) => (
              <li key={address}>
                <PickRow address={address} onRemove={() => remove(address, index)} />
              </li>
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            {picks.length >= 2 ? (
              <Button
                variant="contained"
                onClick={() => navigate(explorerComparePath(picks))}
                sx={{ minHeight: 44 }}
              >
                Compare now
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
                Pick one more account to compare.
              </Typography>
            )}
            <Button
              onClick={() => {
                clearPicks();
                requestAnimationFrame(() => hintRef.current?.focus());
              }}
              sx={{ minHeight: 44 }}
            >
              Clear
            </Button>
          </Box>
        </Card>
      )}
    </Section>
  );
}

/** One quick start: a small titled card. */
function QuickCard({
  title,
  id,
  children,
  inViewRef,
}: {
  title: string;
  id: string;
  children: ReactNode;
  inViewRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <Card
      ref={inViewRef}
      as="section"
      aria-labelledby={`${id}-title`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography id={`${id}-title`} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      {children}
    </Card>
  );
}

/** The first rows of a list, then "Show all n" (nothing more is read). */
function ShortList({ items, label }: { items: ReactNode[]; label: string }) {
  const [all, setAll] = useViewState(`short:${label}`, false);
  const shown = all ? items : items.slice(0, QUICK_ROWS);
  return (
    <>
      <Box component="ul" aria-label={label} sx={LIST_SX}>
        {shown}
      </Box>
      {items.length > QUICK_ROWS && !all ? (
        <Button onClick={() => setAll(true)} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
          Show all {items.length}
        </Button>
      ) : null}
    </>
  );
}

function YourAccount() {
  const session = useSession();
  if (session.status !== 'ready' || !session.address) return null;
  return (
    <QuickCard title="Your account" id="explorer-you">
      <PersonChip
        address={session.address}
        name={session.name}
        size={32}
        secondary={shortAddress(session.address)}
      />
    </QuickCard>
  );
}

function NominatedNow() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  // The app's cached nominations (Home and Nominations read the same key); no polling here.
  const query = useQuery('nominations:all', (force) => loadNominations({ force }), {
    enabled: near,
  });
  const open = query.data?.open ?? [];
  return (
    <QuickCard title="Nominated now" id="explorer-nominated" inViewRef={setNode}>
      {query.isError && !query.data ? (
        <ErrorState
          compact
          title="Couldn't load the open nominations."
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <ListSkeleton count={2} label="Loading the open nominations" />
      ) : open.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No open nominations right now.
        </Typography>
      ) : (
        <ShortList
          label="Nominated now"
          items={open.map((nomination) => (
            <li key={nomination.nominee}>
              <PersonChip address={nomination.nominee} name={nomination.nomineeName} size={32} />
            </li>
          ))}
        />
      )}
    </QuickCard>
  );
}

function MinterAdmins() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const query = useQuery('group:admins', (force) => getAdmins({ force }), { enabled: near });
  const signers = query.data?.signers ?? [];
  return (
    <QuickCard title="Browse: Minter Admins" id="explorer-admins" inViewRef={setNode}>
      {query.isError && !query.data ? (
        <ErrorState
          compact
          title="Couldn't load the Minter Admins."
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <ListSkeleton count={1} label="Loading the Minter Admins" />
      ) : (
        <AvatarStack
          label="Minter Admins"
          max={signers.length}
          size={32}
          showNames
          people={signers.map((row) => ({ address: row.member, name: row.primaryName ?? null }))}
        />
      )}
      {/* Their approvals, rejections and misses (Simon, 2026-10-17: Activity lives here now). */}
      <Button
        component={RouterLink}
        to={PATHS.activity}
        variant="outlined"
        startIcon={<InsightsOutlinedIcon />}
        sx={{ alignSelf: 'flex-start', minHeight: 44 }}
      >
        Minter Admin Activity
      </Button>
    </QuickCard>
  );
}

function RecentlyJoined() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  // The whole member list (7 pages), shared with the rest of the app: only once this nears the screen.
  const members = useMembers(near);
  const newest = [...(members.data?.members ?? [])]
    .filter((row) => typeof row.joined === 'number')
    .sort((a, b) => (b.joined ?? 0) - (a.joined ?? 0))
    .slice(0, RECENT_MEMBERS);
  return (
    <QuickCard title="Recently joined MINTER" id="explorer-joined" inViewRef={setNode}>
      {members.isError && !members.data ? (
        <ErrorState
          compact
          title="Couldn't load MINTER's members."
          error={members.error}
          onRetry={() => void members.refetch()}
        />
      ) : !members.data ? (
        <ListSkeleton count={2} label="Loading MINTER's members" />
      ) : (
        <ShortList
          label="Recently joined MINTER"
          items={newest.map((row) => (
            <li key={row.member}>
              <PersonChip
                address={row.member}
                name={row.primaryName ?? null}
                size={32}
                secondary={`Joined ${formatDate(row.joined as number)}`}
              />
            </li>
          ))}
        />
      )}
    </QuickCard>
  );
}

function QuickStarts() {
  return (
    <Section title="Quick starts" id="explorer-quick">
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          alignItems: 'start',
        }}
      >
        <YourAccount />
        <NominatedNow />
        <MinterAdmins />
        <RecentlyJoined />
      </Box>
    </Section>
  );
}

function TransactionsCard() {
  return (
    <ButtonBase
      component={RouterLink}
      to={explorerTransactionsPath()}
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: '100%',
        minHeight: 64,
        p: 2,
        textAlign: 'left',
        justifyContent: 'flex-start',
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
        color: 'text.primary',
        '&:hover': { bgcolor: 'action.hover' },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}` },
      })}
    >
      <ReceiptLongOutlinedIcon aria-hidden color="primary" />
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="span" sx={{ display: 'block', fontWeight: 700 }}>
          Transactions on Qortal
        </Typography>
        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ display: 'block' }}
        >
          The whole chain&apos;s latest transactions, by type and blocks.
        </Typography>
      </Box>
      <ChevronRightOutlinedIcon aria-hidden sx={{ opacity: 0.6 }} />
    </ButtonBase>
  );
}

/** One part of the guide: a short heading and plain sentences. */
function GuidePart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

const TAB_GUIDE: Array<[string, string]> = [
  [
    'Overview',
    'Who the account is: its level, names, groups, minting, and its latest transactions.',
  ],
  [
    'Connections',
    'How it is linked to other accounts: payments, sponsorships, minting levels and names moved between them, and what they have in common.',
  ],
  ['Transactions', 'Everything it sent or took part in, newest first, in plain words.'],
  [
    'Minter Profile',
    'Where it stands in MINTER and what you can do for it (nominate, support, decide), its nominations and MINTER timeline, and its records in Q-Mintership and the original app.',
  ],
  ['Names', 'Every name it owns, their history, and what they published on QDN.'],
];

function HowToRead({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="How to read the Explorer"
      actions={
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Close
        </Button>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography>{EXPLORER_PURPOSE}</Typography>
        <GuidePart title="What each part shows">
          <Box
            component="ul"
            sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}
          >
            {TAB_GUIDE.map(([tab, what]) => (
              <li key={tab}>
                <Typography variant="body2">
                  <strong>{tab}</strong>: {what}
                </Typography>
              </li>
            ))}
          </Box>
          <Typography variant="body2">
            Compare puts 2 to 4 accounts side by side. Transactions on Qortal lists the whole
            chain&apos;s latest transactions.
          </Typography>
        </GuidePart>
        <GuidePart title="Where it comes from">
          <Typography variant="body2">
            Everything here is public: the Qortal chain and QDN, read from your own node.
          </Typography>
          <Typography variant="body2">{EXPLORER_NEUTRAL_LINE}</Typography>
        </GuidePart>
        <GuidePart title="Its limits">
          <Typography variant="body2">
            Long lists are read in pages, and each list says how far it got, so a missing row is
            never a silent cap. Names are labelled by an account&apos;s primary name; its other
            names are listed on its Names tab.
          </Typography>
        </GuidePart>
        <GuidePart title="It only reads">
          <Typography variant="body2">
            The Explorer never sends a transaction or publishes anything. It needs no sign-in.
          </Typography>
        </GuidePart>
      </Box>
    </ResponsiveDialog>
  );
}

export default function ExplorerPage() {
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const touch = useMediaQuery('(pointer: coarse)');
  const [guideOpen, setGuideOpen] = useState(false);
  return (
    <PersonLinkContext value={EXPLORER_START_LINKS}>
      <PageHeader
        title="Explorer"
        subtitle="Look up any Qortal account or transaction"
        actions={<CopyLinkButton path={PATHS.explorer} what="the Explorer" />}
      />
      <PageBody>
        {/* No focus on phones or touch screens: the keyboard would cover the page. */}
        <ExplorerSearch autoFocus={!phone && !landscape && !touch} />
        {/* Right under the search (Simon, 2026-10-17). */}
        <Section title="The whole chain" id="explorer-chain">
          <TransactionsCard />
        </Section>
        <RecentSection />
        <CompareSection />
        <QuickStarts />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<InfoOutlinedIcon />}
            onClick={() => setGuideOpen(true)}
            sx={{ minHeight: 44 }}
          >
            How to read the Explorer
          </Button>
          <Button
            variant="outlined"
            startIcon={<QuizOutlinedIcon />}
            onClick={() =>
              void import('../../components/explorer/quiz/quizActions').then((quiz) =>
                quiz.startQuiz()
              )
            }
            sx={{ minHeight: 44 }}
          >
            Explorer Quiz
          </Button>
        </Box>
      </PageBody>
      <HowToRead open={guideOpen} onClose={() => setGuideOpen(false)} />
    </PersonLinkContext>
  );
}
