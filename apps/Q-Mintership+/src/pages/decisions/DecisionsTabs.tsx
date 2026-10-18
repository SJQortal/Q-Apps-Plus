/**
 * Decisions' tabs: All Decisions · Nominations · Ready to mint
 * (decisionsViews.ts), each with how many it lists; then a tab for each
 * kind of decision that has something open (Removals, Declines, Bans, New
 * MAs, …, Clean invites, Ask MAs: All Decisions narrowed to it). Each tab is a link that
 * swaps the URL in place (`replace`), as the Explorer's account tabs do:
 * Back leaves Decisions rather than stepping through its views, and a
 * copied link opens the same view. On a phone all three fit in a row (a
 * smaller size, no scroll arrows); on the narrowest the row scrolls under a
 * finger, and the panel below swipes between them too.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Tab, Tabs } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { sectionAccent } from './sectionAccents';
import { formatCount } from '../../utils/format';
import {
  DECISIONS_PANEL_ID,
  DECISIONS_VIEWS,
  TAB_ACCENT,
  decisionsKindPath,
  decisionsTabId,
  decisionsViewPath,
  type DecisionsKind,
  type DecisionsView,
} from './decisionsViews';

export function DecisionsTabs({
  view,
  counts,
  kinds = [],
}: {
  /** The tab on screen (a view, or a kind); null while the account's own default isn't known yet. */
  view: DecisionsView | DecisionsKind | null;
  counts: Partial<Record<DecisionsView, number>>;
  /** The kinds with something open (and the one on screen), with their counts. */
  kinds?: ReadonlyArray<{ key: DecisionsKind; label: string; count: number | undefined }>;
}) {
  const tabs: Array<{
    key: DecisionsView | DecisionsKind;
    label: string;
    to: string;
    count?: number;
  }> = [
    ...DECISIONS_VIEWS.map((v) => ({ ...v, to: decisionsViewPath(v.key), count: counts[v.key] })),
    ...kinds.map((k) => ({ ...k, to: decisionsKindPath(k.key) })),
  ];
  const theme = useTheme();
  // Each tab's colour, its section's (none for All Decisions and Ready to mint).
  const accentOf = (key: DecisionsView | DecisionsKind) => {
    const accent = TAB_ACCENT[key];
    return accent ? sectionAccent(theme, accent) : null;
  };
  const selectedAccent = view ? accentOf(view) : null;
  return (
    <Tabs
      value={view ?? false}
      slotProps={{
        indicator: selectedAccent ? { sx: { bgcolor: selectedAccent } } : undefined,
      }}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Decisions, nominations, the people ready to mint, and each kind of decision"
      sx={{
        minHeight: 44,
        borderBottom: 1,
        borderColor: 'divider',
        '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 },
      }}
    >
      {tabs.map(({ key, label, to, count }) => {
        return (
          <Tab
            key={key}
            value={key}
            id={decisionsTabId(key)}
            aria-controls={DECISIONS_PANEL_ID}
            component={RouterLink}
            to={to}
            replace
            // One line: a tab stacks its children (an icon above its words).
            label={
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {accentOf(key) ? (
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: accentOf(key),
                      mr: 0.75,
                      verticalAlign: 'middle',
                      position: 'relative',
                      top: -1,
                    }}
                  />
                ) : null}
                {label}
                {count !== undefined ? (
                  <>
                    {' '}
                    <Box component="span" sx={{ ml: 0.25, fontWeight: 700 }}>
                      {formatCount(count)}
                    </Box>
                  </>
                ) : null}
              </Box>
            }
            sx={{
              minHeight: 44,
              minWidth: 0,
              // All three on a 360 px phone, with "All Decisions" (Simon, 2026-10-18).
              px: { xs: 0.5, sm: 2 },
              fontSize: { xs: 13, sm: 15 },
              fontWeight: 600,
              textTransform: 'none',
            }}
          />
        );
      })}
    </Tabs>
  );
}
