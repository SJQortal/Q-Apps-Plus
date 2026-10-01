import { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Avatar, Box, IconButton, Tooltip, Typography } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useAuth } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import { ThemePicker } from '../hub-theme';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { ChangelogDialog } from '../components/Settings/ChangelogDialog';
import {
  QNODE_PLUS_VERSION,
  SOURCE_REPO,
  UPSTREAM_REPO,
} from '../constants/changelog';

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
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
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
  const { address, name } = useAuth();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable inside some webviews; the address is still shown.
    }
  };

  const tr = (key: string) =>
    t(`core:settings.${key}`, { postProcess: 'capitalizeFirstChar' });

  return (
    <>
      <PageHeader
        title={t('core:header.settings', {
          postProcess: 'capitalizeFirstChar',
        })}
      />
      <PageBody $maxWidth={720}>
        <Section>
          <SectionTitle>{tr('account')}</SectionTitle>
          <Card>
            <Row>
              <Avatar
                sx={{ width: 44, height: 44 }}
                src={
                  name
                    ? `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar?async=true`
                    : undefined
                }
                alt={name || ''}
              >
                {(name || address || '?').charAt(0)}
              </Avatar>
              <Copy>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {name || tr('no_name')}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {address ? shortAddress(address) : tr('not_signed_in')}
                </Typography>
              </Copy>
              {address ? (
                <Tooltip title={copied ? tr('copied') : tr('copy_address')}>
                  <IconButton
                    aria-label={tr('copy_address')}
                    onClick={copyAddress}
                  >
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>{tr('appearance')}</SectionTitle>
          <ThemePicker />
        </Section>

        <Section>
          <SectionTitle>{tr('about')}</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>
                  Q-Node+ {QNODE_PLUS_VERSION}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tr('changelog')}
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow
              type="button"
              onClick={() => window.open(UPSTREAM_REPO, '_blank', 'noopener')}
            >
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>
                  {tr('upstream')}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {UPSTREAM_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow
              type="button"
              onClick={() => window.open(SOURCE_REPO, '_blank', 'noopener')}
            >
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>{tr('source')}</Typography>
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
      <ChangelogDialog
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
      />
    </>
  );
};

export default Settings;
