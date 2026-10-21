/**
 * The account page's tabs: Overview · Connections · Transactions · Assets ·
 * Minter Profile · Names. Each tab is a link that swaps the URL in place
 * (`replace`), so Back leaves the account rather than stepping through its
 * tabs, and a copied link opens the same tab. They scroll sideways on
 * narrow screens (with arrows on phones too). The page keeps focus on the
 * tab after a switch (routes/paths.ts pageKeyOf) and brings the new tab's
 * top into view when it is above the screen (useTopInViewOnSwitch).
 */
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Tab, Tabs } from '@mui/material';
import { explorerAccountPath, type ExplorerTab } from '../../../routes/paths';
import { panelIdOf, TAB_LABEL, tabIdOf } from './tabIds';

export function AccountTabs({
  address,
  tab,
  tabs,
}: {
  address: string;
  tab: ExplorerTab;
  tabs: readonly ExplorerTab[];
}) {
  const location = useLocation();
  return (
    <Tabs
      value={tab}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      aria-label="Account sections"
      sx={{ minHeight: 44, '& .MuiTabs-scrollButtons.Mui-disabled': { opacity: 0.3 } }}
    >
      {tabs.map((value) => (
        <Tab
          key={value}
          value={value}
          label={TAB_LABEL[value]}
          id={tabIdOf(value)}
          aria-controls={panelIdOf(value)}
          component={RouterLink}
          to={explorerAccountPath(address, value)}
          replace
          // Keeps what the page was opened with (the name it came from, an Explorer link).
          state={location.state}
          sx={{
            minHeight: 44,
            minWidth: 0,
            px: { xs: 1.5, sm: 2 },
            fontSize: 15,
            fontWeight: 600,
            textTransform: 'none',
          }}
        />
      ))}
    </Tabs>
  );
}
