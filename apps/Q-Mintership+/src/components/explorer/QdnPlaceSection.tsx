/**
 * "Where it belongs" on a QDN publish's own page (Simon, 2026-10-19: "links
 * to the website or q-app or whatever that transaction refers to, link
 * Q-Tube comment, or like on Torq"): what it is and in which app, with a
 * button that opens it there in a new Hub tab (OPEN_NEW_TAB), or its page
 * here for Q-Mintership's own records (rules/explorer/qdnPlaces.ts). What a
 * reply, a comment or a like answers is found with one read as the page
 * opens; one that hashes what it's about is looked for only when asked
 * ("Find the video it's on"), as it looks through up to 1,000 resources
 * (data/explorer/qdnPlace.ts). Only for public resources.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { Card, Section } from '../common/Section';
import { ErrorState, ListSkeleton } from '../common/states';
import type { TxRow } from '../../data/types';
import { findPlace, placeKey, SCAN_PAGES, type PlaceSource } from '../../data/explorer/qdnPlace';
import { useQuery } from '../../hooks/useQuery';
import { openableResource } from '../../rules/explorer/qdnFiles';
import { qdnPlace, type QdnPlace } from '../../rules/explorer/qdnPlaces';
import { copyText, linkLabel, openQortalLink } from '../../utils/links';
import { formatCount } from '../../utils/format';

const BUTTON_SX = { minHeight: 44 } as const;

/** Opens `link` in a new Hub tab; outside Hub it copies it instead, and says so. */
function OpenButton({
  link,
  label,
  primary = false,
}: {
  link: string;
  label: string;
  primary?: boolean;
}) {
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Button
        variant={primary ? 'contained' : 'outlined'}
        endIcon={<LaunchOutlinedIcon />}
        onClick={async () => {
          if (await openQortalLink(link)) return;
          setCopied(await copyText(link));
        }}
        sx={{ ...BUTTON_SX, alignSelf: 'flex-start' }}
      >
        {label}
      </Button>
      <Typography
        variant="body2"
        color="text.secondary"
        role={copied === null ? undefined : 'status'}
        sx={{ overflowWrap: 'anywhere' }}
      >
        {copied === true
          ? 'Copied the link: open it in Qortal Hub or GO.'
          : copied === false
            ? `Open it in Qortal Hub or GO: ${linkLabel(link)}`
            : linkLabel(link)}
      </Typography>
    </Box>
  );
}

/** What a reply, a comment or a like answers, read as the page opens or when asked. */
function Found({ place, source }: { place: QdnPlace; source: PlaceSource }) {
  const kind = place.read!;
  const [asked, setAsked] = useState(!place.onRequest);
  const found = useQuery(asked ? placeKey(kind, source) : null, (force) =>
    findPlace(kind, source, { force })
  );
  const target = place.target ?? 'what it answers';
  if (!asked)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Button
          variant="contained"
          startIcon={<SearchOutlinedIcon />}
          onClick={() => setAsked(true)}
          sx={{ ...BUTTON_SX, alignSelf: 'flex-start' }}
        >
          {`Find ${target}`}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {`Its identifier only holds a hash of ${target}: this looks through the newest ${formatCount(
            SCAN_PAGES * 100
          )} published before it.`}
        </Typography>
      </Box>
    );
  if (found.isError && found.data === undefined)
    return (
      <ErrorState
        compact
        title={`Couldn't look for ${target}.`}
        error={found.error}
        onRetry={() => void found.refetch()}
      />
    );
  if (found.data === undefined) return <ListSkeleton count={1} label={`Looking for ${target}`} />;
  if (found.data === null)
    return (
      <Typography role="status" color="text.secondary">
        {place.onRequest
          ? `Not found among the newest ${formatCount(SCAN_PAGES * 100)} published before it.`
          : `Couldn't find ${target} on your node.`}
      </Typography>
    );
  return <OpenButton link={found.data.link} label={found.data.label} primary />;
}

export function QdnPlaceSection({ tx }: { tx: TxRow }) {
  const ref = openableResource(tx);
  const place = ref ? qdnPlace(ref.service, ref.name, ref.identifier) : null;
  if (!ref || !place) return null;
  const source: PlaceSource = {
    service: ref.service,
    name: ref.name,
    identifier: ref.identifier ?? '',
    version: tx.signature,
    created: tx.timestamp,
  };
  return (
    <Section title="Where it belongs" id="explorer-tx-place">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {place.path
            ? `${place.what}.`
            : place.app === 'Qortal'
              ? `${place.what} on Qortal.`
              : `${place.what} in ${place.app}.`}
        </Typography>
        {place.read ? <Found place={place} source={source} /> : null}
        {place.path ? (
          <Button
            component={RouterLink}
            to={place.path}
            variant="contained"
            endIcon={<ChevronRightOutlinedIcon />}
            sx={{ ...BUTTON_SX, alignSelf: 'flex-start' }}
          >
            {place.label ?? 'Open it'}
          </Button>
        ) : null}
        {place.link ? (
          <OpenButton
            link={place.link}
            label={place.label ?? `Open in ${place.app}`}
            primary={!place.read}
          />
        ) : null}
        {place.fallback ? (
          <OpenButton link={place.fallback.link} label={place.fallback.label} />
        ) : null}
      </Card>
    </Section>
  );
}
