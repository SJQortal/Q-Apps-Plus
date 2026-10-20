/**
 * Where an account's minting level came from (Simon, 2026-10-20: "when the
 * minter level was moved from another account can you fetch that another
 * account data for statistics as well, the online % and qort minted and so
 * on"): under the Minter Profile's facts, each account the level moved from
 * (and the ones those got it from: data/explorer/account.ts
 * getLevelLineage), when it moved, the blocks it minted on before, and, for
 * viewers who see the Explorer's detailed parts, the QORT it minted, with
 * the total of this account's and theirs. Node online counts them together
 * (useNodeOnline). Core keeps no public record of a sender's blocks minted
 * at the move, so they are not split out: Level and Blocks minted already
 * include them.
 */
import { useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { PersonChip } from '../../../../components/common/Person';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { getLevelLineage, getMintingStart } from '../../../../data/explorer/account';
import { useQuery } from '../../../../hooks/useQuery';
import { formatAtomic } from '../../../../rules/explorer/money';
import { displayName, formatCount, formatDate } from '../../../../utils/format';
import { Fact, Note, SubHeading } from './parts';
import { QortMintedFact } from './QortMinted';

const FACTS_SX = {
  m: 0,
  display: 'grid',
  gap: 1,
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
} as const;

/** "127,265", "4.75": whole QORT from 100 up, two decimals below. */
function shortQort(value: bigint): string {
  const n = Number(value) / 1e8;
  return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });
}

export function LevelSources({
  address,
  full,
  ownMinted,
}: {
  address: string;
  /** The viewer sees the Explorer's detailed parts: QORT minted (rules/explorer/access.ts). */
  full: boolean;
  /** This account's own QORT minted, atomic, once worked out (QortMintedFact). */
  ownMinted: bigint | null;
}) {
  const start = useQuery(`xmintstart:${address}`, () => getMintingStart(address));
  const movedHere = Boolean(start.data?.moved && !start.data.moved.away);
  const lineage = useQuery(movedHere ? `xlineage:${address}` : null, () =>
    getLevelLineage(address)
  );
  const sources = useMemo(() => lineage.data?.sources ?? [], [lineage.data]);
  const [minted, setMinted] = useState<Record<string, bigint | null>>({});
  const report = useCallback(
    (who: string) => (atomic: bigint | null) =>
      setMinted((now) => (now[who] === atomic ? now : { ...now, [who]: atomic })),
    []
  );
  // One stable reporter per account, so a fact's effect runs only when its value changes.
  const reporters = useMemo(
    () => Object.fromEntries(sources.map((s) => [s.address, report(s.address)])),
    [sources, report]
  );
  if (!movedHere || !sources.length) return null;

  const nameOf = (who: string) =>
    who === address
      ? 'this account'
      : displayName(sources.find((s) => s.address === who)?.name, who);
  const theirs = sources.map((s) => minted[s.address]);
  const total =
    ownMinted !== null && theirs.every((value) => typeof value === 'bigint')
      ? theirs.reduce<bigint>((sum, value) => sum + (value as bigint), ownMinted)
      : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
      <SubHeading id="explorer-level-sources">Where its minting level came from</SubHeading>
      <Note>
        Its minting level moved here from another account, with that account’s blocks minted: Level
        and Blocks minted include them, and Node online counts the time on each.
      </Note>
      <Box
        component="ul"
        aria-labelledby="explorer-level-sources"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {sources.map((source) => (
          <Box
            component="li"
            key={source.address}
            sx={{ ...FIELD_BLOCK_SX, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            <PersonChip
              address={source.address}
              name={source.name ?? undefined}
              size={32}
              secondary={`Moved its minting level to ${nameOf(source.to)} in block ${formatCount(
                source.height
              )}, ${formatDate(source.timestamp)}`}
            />
            <Box component="dl" aria-label={`Minting on ${nameOf(source.address)}`} sx={FACTS_SX}>
              <Fact
                label="Minted there"
                value={
                  source.firstShare !== null
                    ? `Blocks ${formatCount(source.firstShare)}–${formatCount(source.height)}`
                    : 'Not before the move'
                }
                info={
                  source.firstShare !== null
                    ? `From its first reward share, in block ${formatCount(source.firstShare)}, to the move.`
                    : 'It had no reward share before it moved its level: what it moved came from further back.'
                }
              />
              {full ? (
                <QortMintedFact
                  address={source.address}
                  // Its blocks minted moved away (Core clears them), so never "Never minted".
                  neverMinted={false}
                  label="QORT minted there"
                  onMinted={reporters[source.address]}
                />
              ) : null}
            </Box>
          </Box>
        ))}
      </Box>
      {full && total !== null ? (
        <Box component="dl" aria-label="QORT minted with its level" sx={FACTS_SX}>
          <Fact
            label="QORT minted, with theirs"
            value={`${shortQort(total)} QORT`}
            info={`${formatAtomic(total)} QORT: this account’s ${formatAtomic(
              ownMinted as bigint
            )}, and ${sources
              .map((s) => `${formatAtomic(minted[s.address] as bigint)} on ${nameOf(s.address)}`)
              .join(
                ', '
              )}. Each is worked out from that account’s balance and transactions; what an account minted after it moved its level away counts too.`}
          />
        </Box>
      ) : null}
      {lineage.data?.truncated ? (
        <Note>Its earliest moves weren’t followed: there were more than this reads.</Note>
      ) : null}
    </Box>
  );
}
