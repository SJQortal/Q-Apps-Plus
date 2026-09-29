import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useIframe } from '../hooks/useIframeListener';
import { AppBar, Toolbar, Button, Box, useTheme } from '@mui/material';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import StorefrontIcon from '@mui/icons-material/Storefront';
import { PendingTxsTable } from '../components/Tables/PendingTxsTable';
import { useTranslation } from 'react-i18next';
import { useHandleNameData } from '../hooks/useHandleNameData';

const Layout = () => {
  useHandleNameData();

  useIframe();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { t } = useTranslation(['core']);

  const navItems = [
    {
      label: t('core:header.my_names', { postProcess: 'capitalizeFirstChar' }),
      path: '/',
      Icon: FormatListBulletedIcon,
    },
    {
      label: t('core:header.market', { postProcess: 'capitalizeFirstChar' }),
      path: '/market',
      Icon: StorefrontIcon,
    },
  ];

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100%',
        // overflow: 'hidden',
      }}
    >
      <AppBar
        position="sticky"
        color="default"
        elevation={1}
        sx={{ height: 64 }}
      >
        <Toolbar
          sx={{
            gap: '25px',
          }}
        >
          {navItems.map(({ label, path, Icon }) => (
            <Button
              key={path}
              startIcon={<Icon />}
              onClick={() => navigate(path)}
              sx={{
                backgroundColor:
                  location.pathname === path
                    ? theme.palette.action.selected
                    : 'unset',
              }}
            >
              {label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>

      <Box component="main">
        <main>
          <PendingTxsTable />
          <Outlet />
        </main>
      </Box>
    </Box>
  );
};

export default Layout;
