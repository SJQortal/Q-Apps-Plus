/**
 * For everyone on Home who isn't in MINTER: the Q-Minter Guide, the website
 * that explains minting on Qortal for minters and nominators, to read first
 * (Simon, 2026-10-16; 2026-10-18: "refer them to read the Q-Minter Guide").
 * A newcomer's and a former member's hero already leads with it, so this
 * card is for the rest: signed out, nominated or approved. The link is also
 * written out, for someone who opened the app outside Hub.
 *
 * Its minting overview and the history of minting (Q-Mintership 3.0.7's
 * Q-Minter and The History of Minting buttons) are in it too, and, for every
 * other status, in MintingLinks at the end of Home.
 */
import { Box, Typography } from '@mui/material';
import { Card, Section } from '../../components/common/Section';
import { QortalLinkButton } from '../../components/common/QortalLinks';
import {
  Q_MINTER_GUIDE,
  Q_MINTER_HISTORY_LINK,
  Q_MINTER_LINK,
  Q_MINTER_OVERVIEW_LINK,
} from '../../constants/qMinter';

/** The minting overview and the history of minting, side by side. */
function OverviewLinks() {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      <QortalLinkButton link={Q_MINTER_OVERVIEW_LINK} label="Minting overview" />
      <QortalLinkButton link={Q_MINTER_HISTORY_LINK} label="The history of minting" />
    </Box>
  );
}

/** For every status without MintingGuide: the same two links, at the end of Home. */
export function MintingLinks() {
  return (
    <Section title="Minting on Qortal" id="home-minting-links">
      <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <Typography>
          The {Q_MINTER_GUIDE}: how minting works today, and how it came to be.
        </Typography>
        <OverviewLinks />
      </Card>
    </Section>
  );
}

export function MintingGuide({ outside = false }: { outside?: boolean }) {
  return (
    <Section title="How minting works" id="home-minting-guide">
      <Card sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <Typography>
          New to minting? The {Q_MINTER_GUIDE} explains how minting works on Qortal, what it takes
          to become a minter, and how nominators choose who to nominate.
        </Typography>
        <QortalLinkButton link={Q_MINTER_LINK} label={`Open the ${Q_MINTER_GUIDE}`} />
        <OverviewLinks />
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
