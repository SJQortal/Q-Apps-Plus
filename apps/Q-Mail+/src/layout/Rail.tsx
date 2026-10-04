/**
 * The navigation rail: Compose, the mailboxes (Inbox, Aliases, Sent, Threads)
 * with their per-name / per-group children, the publish-state action and
 * Settings. It renders the same `LeftSidebarItem[]` model that Mail.tsx builds
 * (`buildSidebarItems`), so the item ids and the select handler are unchanged.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  ButtonBase,
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
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { LeftSidebarItem } from '@qortal/qapp-lib/left-sidebar/core';
import { primarySoft } from '../hub-theme';
import { SHORT_FRAME_MEDIA } from '../utils/hubFrame';
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
  const base = item.ariaLabel || item.label;
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
      {item.label.charAt(0).toUpperCase()}
    </Avatar>
  );
}

export function Rail({
  items,
  activeItemId,
  onSelect,
  avatarUrlByName,
  groupAvatarUrlById,
  onOpenSettings,
  version,
  onClose,
}: RailProps) {
  const theme = useTheme();
  const [nameFilter, setNameFilter] = useState('');
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
    if (child.hidden) return null;
    if (filter && !child.id.startsWith(THREAD_GROUP_PREFIX) && !child.label.toLowerCase().includes(filter)) return null;
    const active = child.id === activeItemId;
    return (
      <Row
        key={child.id}
        $child
        $active={active}
        disabled={child.disabled}
        onClick={() => select(child.id)}
        data-qapp-lib-sidebar-item={child.id}
        aria-current={active ? 'page' : undefined}
        aria-label={rowAriaLabel(child)}
      >
        {childAvatar(child, avatarUrlByName, groupAvatarUrlById)}
        <Label>
          {child.label}
          {child.secondaryLabel && <Secondary>↩ {child.secondaryLabel}</Secondary>}
        </Label>
        {renderBadge(child.badgeText)}
      </Row>
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
            variant="outlined"
            fullWidth
            startIcon={<ReplyOutlinedIcon />}
            onClick={() => select(aliasCompose.id)}
            sx={{ minHeight: 44, justifyContent: 'flex-start' }}
          >
            <Label>Compose as {aliasCompose.secondaryLabel}</Label>
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
          return (
            <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                {isThreads && children.length > 0 && (expanded ? <ExpandMoreIcon /> : <ChevronRightIcon />)}
              </Row>
              {children.map(renderChild)}
            </Box>
          );
        })}
      </Scroll>

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
