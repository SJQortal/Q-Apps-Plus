/**
 * For everyone on Home who isn't in MINTER: Q-Minter, the website that
 * explains how minting works on Qortal, to read first (Simon, 2026-10-16).
 * The link is also written out, for someone who opened the app outside Hub.
 */
import { Box, Typography } from '@mui/material';
import { Card, Section } from '../../components/common/Section';
import { QortalLinkButton } from '../../components/common/QortalLinks';
import { Q_MINTER_LINK } from '../../constants/qMinter';

export function MintingGuide({ outside = false }: { outside?: boolean }) {
  return (
    <Section title="How minting works" id="home-minting-guide">
      <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <Typography>
          New to minting? The Q-Minter website explains how minting works on Qortal. It’s a good
          place to start.
        </Typography>
        <QortalLinkButton link={Q_MINTER_LINK} label="Open Q-Minter" />
        {outside ? (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            In Qortal Hub or GO:{' '}
            <Box
              component="span"
              sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {Q_MINTER_LINK}
            </Box>
          </Typography>
        ) : null}
      </Card>
    </Section>
  );
}
