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

const SECTION_IDS = ['inbox', 'archived', 'aliases', 'sent', 'drafts', 'threads'] as const;
const CHILD_PREFIXES = [INBOX_INSTANCE_PREFIX, ALIASES_INSTANCE_PREFIX, SENT_INSTANCE_PREFIX, THREAD_GROUP_PREFIX];

const SECTION_ICONS: Record<(typeof SECTION_IDS)[number], ReactNode> = {
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
  fontSize: $child ? '0.875rem' : '0.95rem',
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
  fontSize: '0.75rem',
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

function childAvatar(item: LeftSidebarItem, avatarUrlByName?: Map<string, string>, groupAvatarUrlById?: Record<string, string>) {
  const groupId = item.id.startsWith(THREAD_GROUP_PREFIX) ? item.id.slice(THREAD_GROUP_PREFIX.length) : null;
  const url = groupId ? groupAvatarUrlById?.[groupId] : avatarUrlByName?.get(item.label.toLowerCase());
  return (
    <Avatar src={url} alt="" sx={{ width: 24, height: 24, fontSize: '0.75rem', fontWeight: 600 }}>
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
        onClick={() => onSelect(child.id)}
        data-qapp-lib-sidebar-item={child.id}
        aria-current={active ? 'page' : undefined}
        aria-label={child.ariaLabel || child.label}
      >
        {childAvatar(child, avatarUrlByName, groupAvatarUrlById)}
        <Label>
          {child.label}
          {child.secondaryLabel && <Secondary>↩ {child.secondaryLabel}</Secondary>}
        </Label>
        {child.badgeText && <Badge color="primary" badgeContent={child.badgeText} sx={{ mr: 1.5 }} />}
      </Row>
    );
  };

  return (
    <Root>
      <Brand>
        <img src={theme.palette.mode === 'light' ? LogoLight : Logo} alt="" style={{ height: 32, width: 'auto' }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.1 }}>Q-Mail+</Typography>
          <Typography variant="caption" color="text.secondary">
            v{version}
          </Typography>
        </Box>
        {onClose && (
          <IconButton onClick={onClose} aria-label="Close menu" size="small">
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
          onClick={() => onSelect(compose.id)}
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
            onClick={() => onSelect(aliasCompose.id)}
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
          const icon = SECTION_ICONS[item.id as (typeof SECTION_IDS)[number]] ?? null;
          const badge = isThreads ? null : item.badgeText;
          return (
            <Box key={item.id} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <Row
                $active={active}
                disabled={item.disabled}
                onClick={() => onSelect(item.id)}
                data-qapp-lib-sidebar-item={item.id}
                aria-current={active ? 'page' : undefined}
                aria-expanded={isThreads ? expanded : undefined}
                aria-label={item.ariaLabel || item.label}
              >
                {icon}
                <Label>{item.id === 'threads' ? 'Threads' : item.label}</Label>
                {badge && <Badge color="primary" badgeContent={badge} sx={{ mr: 1.5 }} />}
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
            onClick={() => onSelect(publishState.id)}
            aria-label={publishState.label}
          >
            <CloudUploadOutlinedIcon color={publishState.badgeText ? 'warning' : 'inherit'} />
            <Label>{publishState.label}</Label>
            {publishState.badgeText && <Badge color="warning" variant="dot" sx={{ mr: 1.5 }} />}
          </Row>
        )}
        <Row onClick={onOpenSettings} aria-label="Settings">
          <SettingsOutlinedIcon />
          <Label>Settings</Label>
        </Row>
      </Footer>
    </Root>
  );
}
