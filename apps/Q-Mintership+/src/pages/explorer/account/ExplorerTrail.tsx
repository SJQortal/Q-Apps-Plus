/**
 * The accounts opened one from another (state/explorer.ts trail), as
 * crumbs under the account header: each one opens that account again (and
 * the trail goes back to it). On phones the middle collapses into one
 * 44 px button, by CSS (no screen-size listener per crumb); pressing it
 * moves focus to the first crumb it revealed, since the button goes.
 * "Compare 2" closes the row when two or more accounts are picked to compare.
 */
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase } from '@mui/material';
import { NameAvatar } from '../../../components/common/NameAvatar';
import { usePrimaryName } from '../../../hooks/useData';
import { explorerAccountPath, explorerComparePath } from '../../../routes/paths';
import { visibleName } from '../../../rules/explorer/nameNotes';
import { useComparePicks, useTrail } from '../../../state/explorer';
import { shortAddress } from '../../../utils/format';

/** Crumbs past this many have their middle collapsed on phones. */
const COLLAPSE_FROM = 4;

const CRUMB_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.75,
  minHeight: 44,
  maxWidth: { xs: 180, sm: 240 },
  px: 0.75,
  borderRadius: 1,
  fontSize: 14,
  color: 'text.primary',
  textDecoration: 'none',
} as const;

const LABEL_SX = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
} as const;

function Crumb({ address, current }: { address: string; current: boolean }) {
  const name = usePrimaryName(address.startsWith('Q') ? address : null).data ?? null;
  const label = name ? visibleName(name) : shortAddress(address);
  const content = (
    <>
      <NameAvatar name={name} size={20} />
      <Box component="bdi" dir="auto" sx={LABEL_SX}>
        {label}
      </Box>
    </>
  );
  if (current)
    return (
      <Box component="span" aria-current="page" sx={{ ...CRUMB_SX, fontWeight: 700 }}>
        {content}
      </Box>
    );
  return (
    <ButtonBase
      component={RouterLink}
      to={explorerAccountPath(address)}
      state={{ via: 'explorer' }}
      sx={{
        ...CRUMB_SX,
        color: 'primary.main',
        '&:hover': { bgcolor: 'action.hover' },
        '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main' },
      }}
    >
      {content}
    </ButtonBase>
  );
}

const ITEM_SX = { display: 'flex', alignItems: 'center', minWidth: 0 } as const;

export function ExplorerTrail() {
  const trail = useTrail();
  const picks = useComparePicks();
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  // Set when "n more" is pressed: focus goes to the first crumb it revealed.
  const revealed = useRef(false);
  useEffect(() => {
    if (!expanded || !revealed.current) return;
    revealed.current = false;
    list.current?.children[1]?.querySelector<HTMLElement>('a')?.focus();
  }, [expanded]);
  const showTrail = trail.length >= 2;
  if (!showTrail && picks.length < 2) return null;
  const collapse = !expanded && trail.length >= COLLAPSE_FROM;
  const hidden = trail.length - 2;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        minWidth: 0,
      }}
    >
      {showTrail ? (
        <Box component="nav" aria-label="Your trail" sx={{ flex: 1, minWidth: 0 }}>
          <Box
            component="ol"
            ref={list}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              // A separator before every crumb but the first; not read out.
              '& > li + li::before': {
                content: '"›" / ""',
                px: 0.25,
                color: 'text.secondary',
                fontSize: 16,
              },
            }}
          >
            {trail.map((address, index) => {
              const last = index === trail.length - 1;
              const middle = index > 0 && !last;
              return [
                // On phones the middle steps aside for one button, right after the first crumb.
                index === 1 && collapse ? (
                  <Box
                    component="li"
                    key="more"
                    sx={{ ...ITEM_SX, display: { xs: 'flex', sm: 'none' } }}
                  >
                    <Button
                      onClick={() => {
                        revealed.current = true;
                        setExpanded(true);
                      }}
                      aria-label={`Show ${hidden} more accounts in the trail`}
                      sx={{ minHeight: 44, minWidth: 44, px: 1 }}
                    >
                      {hidden} more
                    </Button>
                  </Box>
                ) : null,
                <Box
                  component="li"
                  key={address}
                  sx={{
                    ...ITEM_SX,
                    ...(middle && collapse ? { display: { xs: 'none', sm: 'flex' } } : {}),
                  }}
                >
                  <Crumb address={address} current={last} />
                </Box>,
              ];
            })}
          </Box>
        </Box>
      ) : null}
      {picks.length >= 2 ? (
        <Button
          component={RouterLink}
          to={explorerComparePath(picks)}
          sx={{ minHeight: 44, ml: 'auto' }}
        >
          Compare {picks.length}
        </Button>
      ) : null}
    </Box>
  );
}
