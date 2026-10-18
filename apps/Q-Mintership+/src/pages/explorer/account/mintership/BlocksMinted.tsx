/**
 * The Minter Profile's Blocks minted with QORT minted beside it (Simon,
 * 2026-10-17: "In blocks minted, I would also like to see / QORT Minted
 * (and small fetch icon next to it if it needs fetching)"): "1,736,799 /
 * 19,306 QORT", worked out as on the Overview (overview/qortSummaries.tsx).
 * When its history is longer than the first read, a small fetch icon reads
 * the rest; its ⓘ says how it was worked out.
 */
import { Box, ButtonBase, CircularProgress, Tooltip } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { InfoTip } from '../../../../components/common/InfoTip';
import { formatCount } from '../../../../utils/format';
import { useQortSummaries } from '../overview/qortSummaries';
import { Fact } from './parts';

const TARGET = 44;
const ICON = 20;
const FETCH = 'Read the rest of its transactions to work out the QORT it minted';

export function BlocksMintedFact({
  address,
  blocksMinted,
  neverMinted,
}: {
  address: string;
  blocksMinted: number;
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
      label="Blocks minted / QORT minted"
      value={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
        >
          {formatCount(blocksMinted)} /{' '}
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            {minted}
          </Box>
        </Box>
      }
    />
  );
}
