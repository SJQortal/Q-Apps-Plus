/**
 * Not in MINTER yet, with or without a registered name. Nominators, minters
 * at level 5 or above, choose community members who'd make good minters and
 * nominate them; nobody asks to be nominated (Simon, 2026-10-18). Home points
 * to the Q-Minter Guide's Becoming a Minter page, which explains what that
 * takes, and to the open nominations. An account that sent MINTER a join
 * request before (another app, or an older version of this one) is told,
 * plainly, that it stays open until a nomination is approved or the Minter
 * Admins decline it.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Button } from '@mui/material';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { NAMES_APP_LINK } from '../../../constants/links';
import { Q_MINTER_BECOMING_LINK, Q_MINTER_GUIDE } from '../../../constants/qMinter';
import { NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { decisionsViewPath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { openQortalLink } from '../../../utils/links';
import { Hero, HeroText, Num } from '../Hero';
import { JoinRequestOpen } from './joinRequest';

export function NewcomerHero({ status, needed }: { status: MyStatus; needed: number | null }) {
  const name = status.name;
  return (
    <Hero
      eyebrow="Not in MINTER yet"
      title={name ? `Hi ${name}, you're not in MINTER yet` : "You're not in the MINTER group yet"}
      actions={
        <>
          <Button
            variant="contained"
            startIcon={<MenuBookOutlinedIcon />}
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => void openQortalLink(Q_MINTER_BECOMING_LINK)}
          >
            Read the {Q_MINTER_GUIDE}
          </Button>
          <Button component={RouterLink} to={decisionsViewPath('nominations')}>
            See open nominations
          </Button>
          {name ? null : (
            <Button
              endIcon={<OpenInNewOutlinedIcon />}
              onClick={() => void openQortalLink(NAMES_APP_LINK)}
            >
              Register a name (optional)
            </Button>
          )}
        </>
      }
      next="When someone nominates you, this page shows who did, and how the Minter Admins answer."
    >
      <HeroText>
        MINTER members mint QORT: while their minting key is online, every block counts towards
        their level.
      </HeroText>
      <HeroText>
        Nominators, minters at level {NOMINATOR_MIN_LEVEL} or above, choose community members
        who&rsquo;d make good minters and nominate them. When one nominates you, you accept, and
        once {needed ? <Num>{needed}</Num> : 'enough'} Minter Admins approve, you&rsquo;re in.
      </HeroText>
      <HeroText>
        The {Q_MINTER_GUIDE} explains what it takes to become a minter, and how nominations work.
      </HeroText>
      <JoinRequestOpen status={status} />
    </Hero>
  );
}
