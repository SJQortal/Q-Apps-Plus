/**
 * Outside Hub, or not signed in: what Mintership is, in two sentences with
 * today's numbers, and the one way forward (Sign in, or open it in Hub/GO).
 */
import { Button } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { signIn, useSession } from '../../../state/session';
import { appLink } from '../../../utils/links';
import { CopyButton, Hero, HeroText, Num } from '../Hero';
import { APP_NAME } from '../../../constants/plus';

export function AnonymousHero({ outside, needed }: { outside: boolean; needed: number | null }) {
  const session = useSession();
  return (
    <Hero
      eyebrow={APP_NAME}
      title="Who mints QORT is decided here"
      actions={
        outside ? (
          <CopyButton text={appLink('/')} label="Copy the app link" variant="contained" />
        ) : (
          <Button
            variant="contained"
            startIcon={<LoginOutlinedIcon />}
            disabled={session.status === 'loading'}
            onClick={() => void signIn()}
          >
            {session.status === 'loading' ? 'Signing in…' : 'Sign in'}
          </Button>
        )
      }
      next={
        outside
          ? 'Open this in Qortal Hub or GO. Signed in, this page shows where you stand: your level, any nomination for you, and your next step.'
          : 'Signed in, this page shows where you stand: your level, any nomination for you, and your next step.'
      }
    >
      <HeroText>
        To mint QORT, an account needs to be a member of the MINTER group. Members at level 5 or
        above nominate potential new minters, and Minter Admins then approve or reject each one
        {needed ? (
          <>
            : <Num>{needed}</Num> approvals are needed today
          </>
        ) : null}
        .
      </HeroText>
      <HeroText>
        A nomination goes through once enough Minter Admins approve it. If time runs out first, the
        person can be nominated again.
      </HeroText>
      {outside ? (
        <HeroText muted>Open this in Qortal Hub or GO to sign in.</HeroText>
      ) : session.status === 'error' ? (
        <HeroText muted>
          Hub didn&rsquo;t answer when asked who is signed in. Check that Hub is unlocked, then try
          again.
        </HeroText>
      ) : null}
    </Hero>
  );
}
