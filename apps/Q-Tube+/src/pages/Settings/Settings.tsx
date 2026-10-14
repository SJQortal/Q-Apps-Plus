import { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Avatar, Box, IconButton, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import { useAtomValue } from 'jotai';
import { useAuth } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ThemePicker } from '../../hub-theme';
import { namesAtom } from '../../state/global/names';
import { PageHeader } from '../../components/layout/shell/PageHeader';
import { PageBody } from '../../components/layout/shell/PageBody';
import { ChangelogDialog } from '../../components/Settings/ChangelogDialog';
import { BlockedNamesModal } from '../../components/common/BlockedNamesModal/BlockedNamesModal';
import { QTUBE_PLUS_VERSION, SOURCE_REPO, UPSTREAM_REPO } from '../../constants/changelog';

const Section = styled('section')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: theme.spacing(0, 0.5),
}));

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  '& + &, & + button': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const LinkRow = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  width: '100%',
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  border: 0,
  background: 'none',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
  transition: 'background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled('div')({ flex: 1, minWidth: 0 });

function shortAddress(address: string): string {
  if (address.length <= 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

export const Settings = () => {
  const { t } = useTranslation(['core']);
  const { name, address, avatarUrl, switchName } = useAuth();
  const names = useAtomValue(namesAtom);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const avatar = avatarUrl || (name ? `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar` : undefined);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.success(t('core:settings.copied'));
    } catch {
      // Clipboard can be unavailable inside some webviews; the address is still shown.
    }
  };

  return (
    <>
      <PageHeader title={t('core:sidenav.settings')} />
      <PageBody $maxWidth={720}>
        <Section>
          <SectionTitle>{t('core:settings.account')}</SectionTitle>
          <Card>
            <Row>
              <Avatar sx={{ width: 44, height: 44 }} src={avatar} alt={name || ''}>
                {(name || address || '?').charAt(0).toUpperCase()}
              </Avatar>
              <Copy>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {name || t('core:settings.no_name')}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {address
                    ? t('core:settings.names_count', { count: names.length })
                    : t('core:settings.not_signed_in')}
                </Typography>
              </Copy>
              {names.length > 1 ? (
                <Select
                  size="small"
                  value={name || ''}
                  onChange={(event) => switchName(String(event.target.value))}
                  aria-label={t('core:settings.switch_name')}
                  sx={{ maxWidth: 200 }}
                >
                  {names.map((item) => (
                    <MenuItem key={item.name} value={item.name}>
                      {item.name}
                    </MenuItem>
                  ))}
                </Select>
              ) : null}
            </Row>
            {address ? (
              <Row>
                <Copy>
                  <Typography variant="body2" color="text.secondary">
                    {t('core:settings.address')}
                  </Typography>
                  <Typography sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }} noWrap>
                    {shortAddress(address)}
                  </Typography>
                </Copy>
                <Tooltip title={t('core:settings.copy_address')}>
                  <IconButton aria-label={t('core:settings.copy_address')} onClick={copyAddress}>
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Row>
            ) : null}
          </Card>
        </Section>

        <Section>
          <SectionTitle>{t('core:settings.appearance')}</SectionTitle>
          <ThemePicker />
        </Section>

        <Section>
          <SectionTitle>{t('core:settings.privacy')}</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setBlockedOpen(true)}>
              <PersonOffOutlinedIcon sx={{ color: 'text.secondary' }} />
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>{t('core:settings.blocked_names')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('core:settings.blocked_names_hint')}
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
          </Card>
        </Section>

        <Section>
          <SectionTitle>{t('core:settings.about')}</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Q-Tube+ {QTUBE_PLUS_VERSION}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('core:settings.changelog')}
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(UPSTREAM_REPO, '_blank', 'noopener')}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>{t('core:settings.upstream')}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {UPSTREAM_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(SOURCE_REPO, '_blank', 'noopener')}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>{t('core:settings.source')}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {SOURCE_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
          </Card>
          <Box sx={{ px: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {t('core:settings.about_blurb')}
            </Typography>
          </Box>
        </Section>
      </PageBody>
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      {blockedOpen ? <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} /> : null}
    </>
  );
};

export default Settings;
