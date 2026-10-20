/**
 * The Minter Profile's QORT minted (Simon, 2026-10-17: "In blocks minted, I
 * would also like to see / QORT Minted (and small fetch icon next to it if
 * it needs fetching)"; 2026-10-18: "seperate Blocks minted / QORT minted"):
 * a fact of its own beside Blocks minted, worked out as on the Overview
 * (overview/qortSummaries.tsx). When its history is longer than the first
 * read, a small fetch icon reads the rest; its ⓘ, beside the label, says how
 * it was worked out.
 */
import { useEffect } from 'react';
import { Box, ButtonBase, CircularProgress, Link, Tooltip } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useQortSummaries } from '../overview/qortSummaries';
import { Fact } from './parts';

const TARGET = 44;
const ICON = 20;
const FETCH = 'Read the rest of its transactions to work out the QORT it minted';

export function QortMintedFact({
  address,
  neverMinted,
  label = 'QORT minted',
  onMinted,
}: {
  address: string;
  neverMinted: boolean;
  /** "QORT minted there" for an account a minting level moved from. */
  label?: string;
  /** Told the QORT minted, atomic, once worked out (null until then). */
  onMinted?: (atomic: bigint | null) => void;
}) {
  const qort = useQortSummaries(address, neverMinted, { trades: false });
  const atomic = qort.mintedAtomic;
  useEffect(() => {
    onMinted?.(atomic);
  }, [atomic, onMinted]);
  let minted: React.ReactNode;
  if (qort.mintedWords) minted = qort.mintedWords;
  // A read it needs failed: said, with Retry, rather than "…" for ever.
  else if (qort.mintedFailed)
    minted = (
      <Box component="span" sx={{ fontWeight: 400, fontSize: 14 }}>
        Couldn&rsquo;t read it.{' '}
        <Link component="button" type="button" onClick={qort.retryMinted} sx={{ fontSize: 14 }}>
          Retry
        </Link>
      </Box>
    );
  else if (qort.readingRest)
    minted = (
      <Box component="span" role="status" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <CircularProgress size={16} aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Reading its transactions to work out the QORT it minted
        </Box>
      </Box>
    );
  else if (qort.needsRest)
    minted = (
      <Tooltip title={FETCH}>
        <ButtonBase
          aria-label={FETCH}
          onClick={qort.readRest}
          sx={{
            width: TARGET,
            height: TARGET,
            m: `${-(TARGET - ICON) / 2}px`,
            verticalAlign: 'middle',
            borderRadius: '50%',
            color: 'primary.main',
            '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -8 },
          }}
        >
          <DownloadOutlinedIcon aria-hidden sx={{ fontSize: ICON }} />
        </ButtonBase>
      </Tooltip>
    );
  else minted = '…';
  return (
    <Fact
      label={label}
      info={qort.mintedWords ? qort.mintedInfo : null}
      value={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {minted}
        </Box>
      }
    />
  );
}
