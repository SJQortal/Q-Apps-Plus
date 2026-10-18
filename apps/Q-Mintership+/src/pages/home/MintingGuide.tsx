/**
 * For everyone on Home who isn't in MINTER: the Q-Minter Guide, the website
 * that explains minting on Qortal for minters and nominators, to read first
 * (Simon, 2026-10-16; 2026-10-18: "refer them to read the Q-Minter Guide").
 * The link is also written out, for someone who opened the app outside Hub.
 */
import { Box, Typography } from '@mui/material';
import { Card, Section } from '../../components/common/Section';
import { QortalLinkButton } from '../../components/common/QortalLinks';
import { Q_MINTER_GUIDE, Q_MINTER_LINK } from '../../constants/qMinter';

export function MintingGuide({ outside = false }: { outside?: boolean }) {
  return (
    <Section title="How minting works" id="home-minting-guide">
      <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <Typography>
          New to minting? The {Q_MINTER_GUIDE} explains how minting works on Qortal, what it takes
          to become a minter, and how nominators choose who to nominate.
        </Typography>
        <QortalLinkButton link={Q_MINTER_LINK} label={`Open the ${Q_MINTER_GUIDE}`} />
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
