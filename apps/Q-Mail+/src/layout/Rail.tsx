/**
 * The navigation rail: Compose, the mailboxes (Inbox, Aliases, Sent, Threads)
 * with their per-name / per-group children, the publish-state action and
 * Settings. It renders the same `LeftSidebarItem[]` model that Mail.tsx builds
 * (`buildSidebarItems`), so the item ids and the select handler are unchanged.
 */
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonBase,
  Collapse,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import AlternateEmailOutlinedIcon from '@mui/icons-material/AlternateEmailOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { LeftSidebarItem } from '@qortal/qapp-lib/left-sidebar/core';
import { primarySoft } from '../hub-theme';
import { SHORT_FRAME_MEDIA } from '../utils/hubFrame';
import { firstVisibleChar } from '../utils/invisibleCharacters';
import { NameText, spokenName } from '../components/common/NameText';
import { useRowMenu } from '../pages/Mail/useRowMenu';
import { useFoldTimeout } from '../hooks/useReducedMotion';
import { UndoSnackbar, type UndoToast } from '../components/common/UndoSnackbar';
import Logo from '../assets/svgs/Logo.svg';
import LogoLight from '../assets/svgs/LogoLight.svg';

export const INBOX_INSTANCE_PREFIX = 'inbox-instance:';
export const ALIASES_INSTANCE_PREFIX = 'aliases-instance:';
export const SENT_INSTANCE_PREFIX = 'sent-instance:';
export const THREAD_GROUP_PREFIX = 'threads-group:';
export const ALIAS_COMPOSE_ID = 'alias-compose';
export const PUBLISH_STATE_ID = 'publish-mail-state';
/** Above this many names the rail shows a filter box. */
export const NAME_FILTER_THRESHOLD = 15;

type SectionId = 'inbox' | 'archived' | 'aliases' | 'sent' | 'drafts' | 'threads';
const CHILD_PREFIXES = [INBOX_INSTANCE_PREFIX, ALIASES_INSTANCE_PREFIX, SENT_INSTANCE_PREFIX, THREAD_GROUP_PREFIX];

const SECTION_ICONS: Record<SectionId, ReactNode> = {
  inbox: <InboxOutlinedIcon />,
  archived: <ArchiveOutlinedIcon />,
  aliases: <AlternateEmailOutlinedIcon />,
  sent: <SendOutlinedIcon />,
  drafts: <DraftsOutlinedIcon />,
  threads: <ForumOutlinedIcon />,
};

export interface RailSection {
  item: LeftSidebarItem;
  children: LeftSidebarItem[];
}

/** Groups the flat sidebar model into sections with their children. Exported for tests. */
export function groupRailItems(items: LeftSidebarItem[]): {
  compose: LeftSidebarItem | null;
  aliasCompose: LeftSidebarItem | null;
  sections: RailSection[];
  publishState: LeftSidebarItem | null;
} {
  let compose: LeftSidebarItem | null = null;
  let aliasCompose: LeftSidebarItem | null = null;
  let publishState: LeftSidebarItem | null = null;
  const sections: RailSection[] = [];
  for (const item of items) {
    if (item.id === 'compose') compose = item;
    else if (item.id === ALIAS_COMPOSE_ID) aliasCompose = item;
    else if (item.id === PUBLISH_STATE_ID) publishState = item;
    else if (CHILD_PREFIXES.some((p) => item.id.startsWith(p))) {
      const parent = sections[sections.length - 1];
      if (parent) parent.children.push(item);
    } else sections.push({ item, children: [] });
  }
  return { compose, aliasCompose, sections, publishState };
}

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  padding: theme.spacing(1.5, 1.25),
  gap: theme.spacing(1),
  // In a short frame (a phone held sideways: 201 px in Hub) the brand,
  // Compose and footer alone fill the height and the list would get 0 px,
  // so the whole rail scrolls as one column instead.
  [`@media ${SHORT_FRAME_MEDIA}`]: {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  },
}));

const Brand = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 0.5, 1),
  minHeight: 44,
}));

const Scroll = styled('nav')({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  [`@media ${SHORT_FRAME_MEDIA}`]: {
    flex: 'none',
    overflowY: 'visible',
  },
});

const Row = styled(ButtonBase, { shouldForwardProp: (p) => p !== '$active' && p !== '$child' })<{
  $active?: boolean;
  $child?: boolean;
}>(({ theme, $active, $child }) => ({
  width: '100%',
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(1.25),
  padding: theme.spacing(0.75, 1.25),
  paddingLeft: $child ? theme.spacing(3.5) : theme.spacing(1.25),
  borderRadius: theme.shape.borderRadius,
  color: $active ? theme.palette.primary.main : theme.palette.text.primary,
  backgroundColor: $active ? primarySoft(theme) : 'transparent',
  fontWeight: $active ? 650 : 500,
  fontSize: $child ? '0.9375rem' : '1rem',
  textAlign: 'left',
  transition: 'background-color 150ms ease, color 150ms ease',
  '&:hover': { backgroundColor: $active ? primarySoft(theme) : theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  '&.Mui-disabled': { opacity: 0.55 },
  '& .MuiSvgIcon-root': { fontSize: 22, flexShrink: 0 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}));

const Label = styled('span')({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const Secondary = styled('span')(({ theme }) => ({
  display: 'block',
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontWeight: 400,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const Footer = styled('div')(({ theme }) => ({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingTop: theme.spacing(1),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

/** One chevron that turns as its list folds (pointing right when folded). */
function FoldChevron({ open }: { open: boolean }) {
  return (
    <ExpandMoreIcon
      aria-hidden
      sx={{
        transition: 'transform 200ms ease',
        transform: open ? 'none' : 'rotate(-90deg)',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    />
  );
}

export interface RailProps {
  items: LeftSidebarItem[];
  activeItemId: string | null;
  onSelect: (id: string) => void;
  /** Avatar URL per lower-cased name (names and aliases). */
  avatarUrlByName?: Map<string, string>;
  /** Avatar URL per group id. */
  groupAvatarUrlById?: Record<string, string>;
  onOpenSettings: () => void;
  version: string;
  /** In a drawer: show a close button and call this. */
  onClose?: () => void;
  /** A name's menu under Inbox offers "Hide from the list" (Settings → Mail shows it again). */
  onHideInboxName?: (name: string) => void;
  /** Undo for a hidden name. */
  onShowInboxName?: (name: string) => void;
}

/** Sections whose names fold away behind a chevron; Threads folds on its own row. */
const COLLAPSIBLE: ReadonlyArray<string> = ['inbox', 'aliases', 'sent'];
export const RAIL_COLLAPSED_STORAGE_KEY = 'qmail_rail_collapsed_sections';

const readCollapsed = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => COLLAPSIBLE.includes(id)) : [];
  } catch {
    return [];
  }
};

/** Which sections are folded, remembered on this device. */
function useCollapsedSections(): [Set<string>, (id: string) => void] {
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const toggle = useCallback((id: string) => {
    setCollapsed((previous) => {
      const next = previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id];
      try {
        localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked: folded for this session.
      }
      return next;
    });
  }, []);
  return [useMemo(() => new Set(collapsed), [collapsed]), toggle];
}

/** A count badge ("99+" past 99) for numeric badge text, else the text itself (e.g. "!"). */
export function badgeFor(text: string | undefined): { kind: 'count'; value: number } | { kind: 'text'; value: string } | null {
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const value = Number(text);
    return value > 0 ? { kind: 'count', value } : null;
  }
  return { kind: 'text', value: text };
}

function renderBadge(text: string | undefined) {
  const badge = badgeFor(text);
  if (!badge) return null;
  return (
    <Badge
      color="primary"
      badgeContent={badge.value}
      max={99}
      aria-hidden
      sx={{ mr: 1.5, '& .MuiBadge-badge': { fontSize: '0.875rem', fontWeight: 700, minWidth: 20, height: 20 } }}
    />
  );
}

/** The accessible name of a row: its label plus the unread count when it has one. */
export function rowAriaLabel(item: LeftSidebarItem): string {
  // Child rows other than groups are names (own names, aliases), so they get
  // NameText's spoken note too; groups and sections are left as they are.
  const isName = CHILD_PREFIXES.some((prefix) => item.id.startsWith(prefix)) && !item.id.startsWith(THREAD_GROUP_PREFIX);
  const base = item.ariaLabel || (isName ? spokenName(item.label) : item.label);
  const badge = badgeFor(item.badgeText);
  if (badge?.kind === 'count') return `${base}, ${badge.value} unread`;
  return base;
}

function childAvatar(item: LeftSidebarItem, avatarUrlByName?: Map<string, string>, groupAvatarUrlById?: Record<string, string>) {
  const groupId = item.id.startsWith(THREAD_GROUP_PREFIX) ? item.id.slice(THREAD_GROUP_PREFIX.length) : null;
  const url = groupId ? groupAvatarUrlById?.[groupId] : avatarUrlByName?.get(item.label.toLowerCase());
  return (
    <Avatar
      src={url}
      alt=""
      sx={(theme) => ({
        width: 24,
        height: 24,
        fontSize: '0.875rem',
        fontWeight: 700,
        // MUI's default grey fallback reads below 4.5:1 in every theme.
        bgcolor: primarySoft(theme),
        color: theme.palette.primary.main,
      })}
    >
      {firstVisibleChar(item.label).toUpperCase()}
    </Avatar>
  );
}

function RailView({
  items,
  activeItemId,
  onSelect,
  avatarUrlByName,
  groupAvatarUrlById,
  onOpenSettings,
  version,
  onClose,
  onHideInboxName,
  onShowInboxName,
}: RailProps) {
  const theme = useTheme();
  const [nameFilter, setNameFilter] = useState('');
  const [collapsed, toggleCollapsed] = useCollapsedSections();
  // A name's menu under Inbox (right click, long press).
  const nameMenu = useRowMenu<LeftSidebarItem>();
  const foldTimeout = useFoldTimeout();

  // Hiding a name is optimistic: it folds away at once, and the mailboxes
  // (a heavier update) follow once it has, as a low-priority render. Undo
  // brings it back, folding open.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [returning, setReturning] = useState<ReadonlySet<string>>(() => new Set());
  // Hidden for real (the fold finished and the mailboxes were told). The name
  // being viewed stays in the model while hidden, so the model can't tell.
  // Refs: Undo runs from a toast made at hide time, and must see them now.
  const committed = useRef(new Set<string>());
  const itemIdsNow = useRef('');
  const [undo, setUndo] = useState<UndoToast | null>(null);
  const undoTarget = useRef<{ id: string; name: string } | null>(null);
  const itemIds = useMemo(() => items.map((item) => item.id).join('\n'), [items]);
  useEffect(() => {
    itemIdsNow.current = itemIds;
  }, [itemIds]);
  // Forget names that have left the model (hidden for good). A hidden name
  // still listed once it is no longer the one being viewed isn't hidden any
  // more (shown again in Settings or another tab): it comes back.
  useEffect(() => {
    const present = new Set(itemIds.split('\n'));
    setLeaving((previous) => {
      const next = new Set(
        [...previous].filter((id) => {
          // Gone from the model: hidden. (Undo may still need `committed`.)
          if (!present.has(id)) return false;
          if (committed.current.has(id) && id !== activeItemId) {
            committed.current.delete(id);
            return false;
          }
          return true;
        })
      );
      return next.size === previous.size ? previous : next;
    });
  }, [itemIds, activeItemId]);
  const without = (set: ReadonlySet<string>, id: string) => {
    if (!set.has(id)) return set;
    const next = new Set(set);
    next.delete(id);
    return next;
  };
  // The row to focus once a name has gone: the next name, else the previous, else Inbox.
  const neighbourOf = (id: string): (() => HTMLElement | null) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-qapp-lib-sidebar-item^="${INBOX_INSTANCE_PREFIX}"]`));
    const at = rows.findIndex((row) => row.getAttribute('data-qapp-lib-sidebar-item') === id);
    const next = (at >= 0 && (rows[at + 1] || rows[at - 1])) || null;
    const nextId = next?.getAttribute('data-qapp-lib-sidebar-item') || 'inbox';
    return () => document.querySelector<HTMLElement>(`[data-qapp-lib-sidebar-item="${CSS.escape(nextId)}"]`);
  };
  const undoHide = () => {
    const target = undoTarget.current;
    if (!target) return;
    undoTarget.current = null;
    const { id, name } = target;
    const wasCommitted = committed.current.delete(id);
    setLeaving((previous) => without(previous, id));
    // Still folding away: it folds open again, nothing was hidden yet.
    if (!wasCommitted) return;
    if (!itemIdsNow.current.split('\n').includes(id)) setReturning((previous) => new Set(previous).add(id));
    startTransition(() => onShowInboxName?.(name));
  };
  const hideName = (child: LeftSidebarItem) => {
    setLeaving((previous) => new Set(previous).add(child.id));
    undoTarget.current = { id: child.id, name: child.label };
    setUndo((previous) => ({
      key: (previous?.key ?? 0) + 1,
      message: (
        <span>
          <NameText name={child.label} /> hidden from the list
        </span>
      ),
      onUndo: onShowInboxName ? undoHide : undefined,
      returnFocus: neighbourOf(child.id),
    }));
  };
  const commitHide = (child: LeftSidebarItem) => {
    committed.current.add(child.id);
    startTransition(() => onHideInboxName?.(child.label));
  };
  const { compose, aliasCompose, sections, publishState } = useMemo(() => groupRailItems(items), [items]);
  const nameCount = useMemo(
    () => items.filter((i) => i.id.startsWith(INBOX_INSTANCE_PREFIX)).length,
    [items]
  );
  const showNameFilter = nameCount > NAME_FILTER_THRESHOLD;
  const filter = nameFilter.trim().toLowerCase();
  // In a drawer, every selection closes it (the page changes behind it).
  const select = (id: string) => {
    onSelect(id);
    onClose?.();
  };
  const openSettings = () => {
    onOpenSettings();
    onClose?.();
  };

  const renderChild = (child: LeftSidebarItem) => {
    if (filter && !child.id.startsWith(THREAD_GROUP_PREFIX) && !child.label.toLowerCase().includes(filter)) return null;
    const active = child.id === activeItemId;
    const hasMenu = Boolean(onHideInboxName) && child.id.startsWith(INBOX_INSTANCE_PREFIX);
    const isLeaving = leaving.has(child.id);
    // Each name folds in and out on its own: hidden (Threads folded), hidden
    // from the list, or back with Undo. A folded one is out of the tab order.
    return (
      <Collapse
        key={child.id}
        in={!child.hidden && !isLeaving}
        appear={returning.has(child.id)}
        timeout={foldTimeout}
        // Folded rows unmount: no avatars load for a folded Threads list.
        unmountOnExit
        onExited={isLeaving ? () => commitHide(child) : undefined}
        onEntered={() =>
          setReturning((previous) => {
            if (!previous.has(child.id)) return previous;
            const next = new Set(previous);
            next.delete(child.id);
            return next;
          })
        }
      >
      <Row
        $child
        $active={active}
        disabled={child.disabled}
        {...(hasMenu ? nameMenu.triggerFor(child) : {})}
        onClick={() => select(child.id)}
        data-qapp-lib-sidebar-item={child.id}
        aria-current={active ? 'page' : undefined}
        aria-label={rowAriaLabel(child)}
      >
        {childAvatar(child, avatarUrlByName, groupAvatarUrlById)}
        <Label>
          {child.id.startsWith(THREAD_GROUP_PREFIX) ? child.label : <NameText name={child.label} />}
          {child.secondaryLabel && (
            <Secondary>
              ↩ <NameText name={child.secondaryLabel} />
            </Secondary>
          )}
        </Label>
        {renderBadge(child.badgeText)}
      </Row>
      </Collapse>
    );
  };

  return (
    <Root>
      <Brand>
        <img src={theme.palette.mode === 'light' ? LogoLight : Logo} alt="" style={{ height: 32, width: 'auto' }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }}>Q-Mail+</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            v{version}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close menu" sx={{ minWidth: 44, minHeight: 44 }}>
            <CloseIcon />
          </IconButton>
        )}
      </Brand>

      {compose && (
        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<EditOutlinedIcon />}
          onClick={() => select(compose.id)}
          data-qapp-lib-sidebar-item={compose.id}
          sx={{ minHeight: 44, justifyContent: 'flex-start' }}
        >
          {compose.label}
        </Button>
      )}
      {aliasCompose && (
        <Tooltip title={`Compose as ${aliasCompose.secondaryLabel ?? ''}`}>
          <Button
            aria-label={`Compose as ${spokenName(aliasCompose.secondaryLabel)}`}
            variant="outlined"
            fullWidth
            startIcon={<ReplyOutlinedIcon />}
            onClick={() => select(aliasCompose.id)}
            sx={{ minHeight: 44, justifyContent: 'flex-start' }}
          >
            <Label>
              Compose as <NameText name={aliasCompose.secondaryLabel} />
            </Label>
          </Button>
        </Tooltip>
      )}

      {showNameFilter && (
        <TextField
          size="small"
          placeholder="Find a name"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              'aria-label': 'Find a name',
            },
          }}
        />
      )}

      <Scroll aria-label="Mailboxes">
        {sections.map(({ item, children }) => {
          const active = item.id === activeItemId;
          const isThreads = item.id === 'threads';
          const expanded = isThreads ? item.badgeText === '-' : true;
          const icon = SECTION_ICONS[item.id as SectionId] ?? null;
          // The Threads row's "+"/"-" only means expanded; it is drawn as a chevron, never as text.
          const sectionItem = isThreads ? { ...item, label: 'Threads', badgeText: undefined } : item;
          // Inbox, Aliases and Sent fold their names behind a chevron of their
          // own, so the row itself still opens the mailbox. A name filter shows all.
          const foldable = COLLAPSIBLE.includes(item.id) && children.length > 0;
          const folded = foldable && collapsed.has(item.id) && !filter;
          const row = (
            <Row
              $active={active}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              data-qapp-lib-sidebar-item={item.id}
              aria-current={active ? 'page' : undefined}
              aria-expanded={isThreads ? expanded : undefined}
              aria-label={rowAriaLabel(sectionItem)}
            >
              {icon}
              <Label>{sectionItem.label}</Label>
              {renderBadge(sectionItem.badgeText)}
              {isThreads && children.length > 0 && <FoldChevron open={expanded} />}
            </Row>
          );
          return (
            <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {foldable ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {row}
                  {/* A steady name with aria-expanded; while "Find a name" filters, everything shows. */}
                  <IconButton
                    onClick={() => toggleCollapsed(item.id)}
                    disabled={Boolean(filter)}
                    aria-expanded={!folded}
                    aria-label={`Names under ${sectionItem.label}`}
                    sx={{ minWidth: 44, minHeight: 44, borderRadius: 1, color: 'text.secondary', flexShrink: 0 }}
                  >
                    <FoldChevron open={!folded} />
                  </IconButton>
                </Box>
              ) : (
                row
              )}
              <Collapse
                in={!folded}
                timeout={foldTimeout}
                unmountOnExit
                sx={{ '& .MuiCollapse-wrapperInner': { display: 'flex', flexDirection: 'column', gap: '2px' } }}
              >
                {children.map(renderChild)}
              </Collapse>
            </Box>
          );
        })}
      </Scroll>

      {nameMenu.renderMenu((child) => ({
        title: <NameText name={child.label} />,
        ariaLabel: `Actions for ${spokenName(child.label)}`,
        actions: [
          { id: 'open', label: 'Open', onSelect: () => select(child.id) },
          { id: 'hide', label: 'Hide from the list', onSelect: () => hideName(child) },
        ],
      }))}
      <UndoSnackbar toast={undo} onDone={() => setUndo(null)} />

      <Footer>
        {publishState && (
          <Row
            disabled={publishState.disabled}
            onClick={() => select(publishState.id)}
            aria-label={publishState.badgeText ? `${publishState.label}, changes not yet published` : publishState.label}
          >
            <CloudUploadOutlinedIcon color={publishState.badgeText ? 'warning' : 'inherit'} />
            <Label>{publishState.label}</Label>
            {publishState.badgeText && <Badge color="warning" variant="dot" sx={{ mr: 1.5 }} />}
          </Row>
        )}
        <Row onClick={openSettings} aria-label="Settings">
          <SettingsOutlinedIcon />
          <Label>Settings</Label>
        </Row>
      </Footer>
    </Root>
  );
}

/** Re-renders only when its props change (Mail.tsx re-renders often; the rail lists every name). */
export const Rail = memo(RailView);
