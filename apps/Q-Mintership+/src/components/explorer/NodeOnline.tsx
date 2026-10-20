/**
 * How much of the time an account's node was online for minting (Simon,
 * 2026-10-17), as a value with an ⓘ that explains it: on the Overview under
 * Blocks minted, and among the Minter Profile's facts. From its blocks
 * minted and two one-row searches (`xmintstart:<a>`), and the chain's tip
 * (rules/explorer/onlineShare.ts).
 */
import { Box, Link } from '@mui/material';
import { InfoTip } from '../common/InfoTip';
import { useNodeOnline } from './useNodeOnline';

/** "95% ⓘ", "Not minting ⓘ", or a Retry when it can't be read. */
export function NodeOnlineValue({
  address,
  blocksMinted,
  loading,
  info = true,
}: {
  address: string;
  blocksMinted: number;
  /** What shows while it loads. */
  loading: React.ReactNode;
  /** Its ⓘ after the value; false where the fact's label carries it (FactLabel). */
  info?: boolean;
}) {
  const online = useNodeOnline(address, blocksMinted);
  if (!online) return <>{loading}</>;
  if ('failed' in online)
    return (
      <Box component="span" sx={{ fontWeight: 400, fontSize: 14 }}>
        Couldn&rsquo;t read its reward shares.{' '}
        <Link component="button" type="button" onClick={online.retry} sx={{ fontSize: 14 }}>
          Retry
        </Link>
      </Box>
    );
  if (!info) return <>{online.value}</>;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {online.value}
      <InfoTip label={`About node online: ${online.info}`}>{online.info}</InfoTip>
    </Box>
  );
}
