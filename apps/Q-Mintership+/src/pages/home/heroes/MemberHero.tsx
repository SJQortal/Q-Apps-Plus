/**
 * MINTER members. Below level 5: minting as an online account, blocks to
 * the next level, and a bar to level 5 with what it unlocks. Level 5 and
 * up: "you can nominate", with their open nominations in one sentence.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';
import { CUMULATIVE_BLOCKS_BY_LEVEL, NOMINATOR_MIN_LEVEL } from '../../../data/constants';
import { ProgressBar } from '../../../components/common/ProgressRing';
import { useChainNow, useNominations } from '../../../hooks/useData';
import { blocksToMs } from '../../../data/chain';
import { PROPOSE_NOMINATION } from '../../../constants/words';
import { nominatePath } from '../../../routes/paths';
import type { MyStatus } from '../../../rules/status';
import { formatCount, formatRoughDuration } from '../../../utils/format';
import { openQortalLink } from '../../../utils/links';
import { NAMES_APP_LINK } from '../../../constants/links';
import { MintingTipsDialog } from '../HelpDialogs';
import { Hero, HeroText, Num } from '../Hero';
import { countStates, myNominations } from '../homeData';

const TARGET_AT = CUMULATIVE_BLOCKS_BY_LEVEL[NOMINATOR_MIN_LEVEL - 1];

/**
 * "Level 3 comes at 201,600 blocks minted: 111,100 more blocks to go, about
 * 3 months if your node stays online." A minter that stays online gains
 * about one block minted per chain block (Core adds them 1,000 at a time),
 * so the time is the blocks to go at the measured block time.
 */
function NextLevel({ status }: { status: MyStatus }) {
  const { nextLevelAt, blocksToNextLevel } = status.progress;
  const now = useChainNow().data;
  const eta =
    now && blocksToNextLevel !== null && blocksToNextLevel > 0
      ? formatRoughDuration(blocksToMs(now, blocksToNextLevel))
      : null;
  return (
    <HeroText>
      You&rsquo;ve minted <Num>{formatCount(status.blocksMinted)}</Num> blocks.
      {nextLevelAt !== null && blocksToNextLevel !== null ? (
        <>
          {' '}
          Level {status.level + 1} comes at <Num>{formatCount(nextLevelAt)}</Num> blocks minted:{' '}
          <Num>{formatCount(blocksToNextLevel)}</Num> more blocks to go
          {eta ? `, about ${eta} if your node stays online` : ''}.
        </>
      ) : (
        " You're at the top level."
      )}
    </HeroText>
  );
}

/** "Welcome to MINTER, Ada!" for someone who just became a member. */
function welcomeTitle(name: string | null): string {
  return `Welcome to MINTER${name ? `, ${name}` : ''}!`;
}

export function LearnerHero({ status, welcome }: { status: MyStatus; welcome?: boolean }) {
  const [tipsOpen, setTipsOpen] = useState(false);
  const pct = Math.round(status.progress.targetProgress * 100);
  return (
    <>
      <Hero
        eyebrow={`MINTER member · Level ${status.level}`}
        title={
          welcome
            ? welcomeTitle(status.name)
            : status.name
              ? `You're minting, ${status.name}`
              : "You're minting"
        }
        celebrate={welcome}
        actions={
          <Button
            variant="contained"
            startIcon={<TipsAndUpdatesOutlinedIcon />}
            onClick={() => setTipsOpen(true)}
          >
            Minting tips
          </Button>
        }
        next="Keep your node online and synced: your level rises as the blocks add up."
      >
        {status.level === 0 ? (
          <HeroText>
            You&rsquo;re in MINTER at level 0: you mint, and rewards start at level 1 (
            <Num>{formatCount(CUMULATIVE_BLOCKS_BY_LEVEL[0])}</Num> blocks).
          </HeroText>
        ) : null}
        <NextLevel status={status} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <ProgressBar
            value={status.progress.targetProgress}
            label={`Progress to level ${NOMINATOR_MIN_LEVEL}: ${pct}%`}
          />
          <Typography variant="body2" color="text.secondary">
            <Num>{formatCount(status.blocksMinted)}</Num> of <Num>{formatCount(TARGET_AT)}</Num>{' '}
            blocks for level {NOMINATOR_MIN_LEVEL} (
            <Num>{formatCount(status.progress.blocksToTarget)}</Num> blocks to go)
          </Typography>
        </Box>
        <HeroText>
          Level {NOMINATOR_MIN_LEVEL} lets you nominate new minters here, and it&rsquo;s the level
          at which nodes submit blocks by default.
        </HeroText>
      </Hero>
      <MintingTipsDialog open={tipsOpen} onClose={() => setTipsOpen(false)} level={status.level} />
    </>
  );
}

/** One sentence about the nominator's own open nominations. */
function OpenNominationsLine({ address }: { address: string }) {
  const nominations = useNominations(true);
  if (!nominations.data) return null;
  const open = myNominations(nominations.data.open, address);
  if (!open.length) return <HeroText>You have no open nominations right now.</HeroText>;
  const counts = countStates(open);
  const parts = [
    counts.waiting ? `${counts.waiting} waiting for a Minter Admin` : null,
    counts.signing ? `${counts.signing} collecting approvals` : null,
    counts.approved ? `${counts.approved} approved and waiting for the nominee to join` : null,
    counts.blocked ? `${counts.blocked} blocked by a ban` : null,
  ].filter(Boolean) as string[];
  return (
    <HeroText>
      You have <Num>{open.length}</Num> open nomination{open.length === 1 ? '' : 's'}
      {parts.length
        ? `: ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}`
        : ''}
      .
    </HeroText>
  );
}

export function NominatorHero({
  status,
  needed,
  welcome,
}: {
  status: MyStatus;
  needed: number | null;
  welcome?: boolean;
}) {
  const name = status.name;
  return (
    <Hero
      eyebrow={`MINTER member · Level ${status.level}`}
      title={
        welcome
          ? welcomeTitle(name)
          : name
            ? `${name}, you can nominate new minters`
            : 'You can nominate new minters'
      }
      celebrate={welcome}
      actions={
        status.canNominate ? (
          <Button
            component={RouterLink}
            to={nominatePath()}
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
          >
            {PROPOSE_NOMINATION}
          </Button>
        ) : (
          <Button
            variant="contained"
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => void openQortalLink(NAMES_APP_LINK)}
          >
            Register a name
          </Button>
        )
      }
      next={
        <>
          A Minter Admin approves a nomination first, then the others:{' '}
          {needed ? (
            <>
              at <Num>{needed}</Num> approvals
            </>
          ) : (
            'with enough approvals'
          )}{' '}
          your nominee is in.
        </>
      }
    >
      <NextLevel status={status} />
      <OpenNominationsLine address={status.address} />
      {status.canNominate ? null : (
        <Alert severity="info">
          {status.nominateBlock} A name is how others see who nominated whom.
        </Alert>
      )}
    </Hero>
  );
}
