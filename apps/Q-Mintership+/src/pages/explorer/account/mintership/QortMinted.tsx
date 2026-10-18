/**
 * The Minter Profile's QORT minted (Simon, 2026-10-17: "In blocks minted, I
 * would also like to see / QORT Minted (and small fetch icon next to it if
 * it needs fetching)"; 2026-10-18: "seperate Blocks minted / QORT minted"):
 * a fact of its own beside Blocks minted, worked out as on the Overview
 * (overview/qortSummaries.tsx). When its history is longer than the first
 * read, a small fetch icon reads the rest; its ⓘ says how it was worked out.
 */
import { Box, ButtonBase, CircularProgress, Tooltip } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { InfoTip } from '../../../../components/common/InfoTip';
import { useQortSummaries } from '../overview/qortSummaries';
import { Fact } from './parts';

const TARGET = 44;
const ICON = 20;
const FETCH = 'Read the rest of its transactions to work out the QORT it minted';

export function QortMintedFact({
  address,
  neverMinted,
}: {
  address: string;
  neverMinted: boolean;
}) {
  const qort = useQortSummaries(address, neverMinted, { trades: false });
  let minted: React.ReactNode;
  if (qort.mintedWords)
    minted = (
      <>
        {qort.mintedWords}
        {qort.mintedInfo ? (
          <InfoTip label={`About QORT minted: ${qort.mintedInfo}`}>{qort.mintedInfo}</InfoTip>
        ) : null}
      </>
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
      label="QORT minted"
      value={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          {minted}
        </Box>
      }
    />
  );
}
