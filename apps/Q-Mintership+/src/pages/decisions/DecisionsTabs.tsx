/**
 * Decisions' tabs: Decisions · Nominations · Ready to mint
 * (decisionsViews.ts), each with how many it lists. Each tab is a link that
 * swaps the URL in place (`replace`), as the Explorer's account tabs do:
 * Back leaves Decisions rather than stepping through its views, and a
 * copied link opens the same view. On a phone all three fit in a row (a
 * smaller size, no scroll arrows); on the narrowest the row scrolls under a
 * finger, and the panel below swipes between them too.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Tab, Tabs } from '@mui/material';
import { formatCount } from '../../utils/format';
import {
  DECISIONS_PANEL_ID,
  DECISIONS_VIEWS,
  decisionsTabId,
  decisionsViewPath,
  type DecisionsView,
} from './decisionsViews';

export function DecisionsTabs({
  view,
  counts,
}: {
  /** The view on screen; null while the account's own default isn't known yet. */
  view: DecisionsView | null;
  counts: Partial<Record<DecisionsView, number>>;
}) {
  return (
    <Tabs
      value={view ?? false}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Decisions, nominations and the people ready to mint"
      sx={{
        minHeight: 44,
        borderBottom: 1,
        borderColor: 'divider',
        '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 },
      }}
    >
      {DECISIONS_VIEWS.map(({ key, label }) => {
        const count = counts[key];
        return (
          <Tab
            key={key}
            value={key}
            id={decisionsTabId(key)}
            aria-controls={DECISIONS_PANEL_ID}
            component={RouterLink}
            to={decisionsViewPath(key)}
            replace
            // One line: a tab stacks its children (an icon above its words).
            label={
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
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
