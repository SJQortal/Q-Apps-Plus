/**
 * A Q-Asset's avatar (Simon, 2026-10-21: "with asset avatars and so on").
 * The image its owner published as the Q-Assets app does (IMAGE
 * `asset<id>_<name>_aavatar`): under the owner's primary name, or another
 * name the owner holds (their names list says so); anyone else's image for
 * the asset is never shown. It loads once it nears the screen and comes in
 * when Core has it (data/avatars.ts). Until then, and for an asset without
 * one, a coin in a colour of its own (from the theme: its info blue turned
 * to the asset's hue) with the name's first letters, or its emoji. With
 * `badge`, the owner's own avatar sits on its edge. Hidden from screen
 * readers: the asset's name beside it says it.
 */
import { useState } from 'react';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { avatarFailed, avatarKey, avatarLoaded, useAvatar } from '../../data/avatars';
import { usePrimaryName } from '../../hooks/useData';
import { useInView } from '../../hooks/useInView';
import { assetAvatarIdentifier, assetHue, assetInitials } from '../../rules/explorer/assets';
import { withHue } from '../../pages/decisions/sectionAccents';
import { readableOn } from '../../utils/readable';
import { NameAvatar } from '../common/NameAvatar';
import { useAssetImage, type AssetAvatarAsset } from './useAssetImage';

export function AssetAvatar({
  asset,
  size = 48,
  badge = false,
}: {
  asset: AssetAvatarAsset;
  size?: number;
  /** The owner's avatar on the coin's edge. */
  badge?: boolean;
}) {
  const theme = useTheme();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node, '200px');
  const publisher = useAssetImage(asset);
  const identifier = assetAvatarIdentifier(asset.assetId, asset.name);
  const image = useAvatar(near ? publisher : null, identifier, 'IMAGE');
  const key = publisher ? avatarKey(publisher, identifier, 'IMAGE') : null;
  const ownerName = usePrimaryName(badge && asset.owner ? asset.owner : null).data ?? null;

  const dark = theme.palette.mode === 'dark';
  const accent = withHue(theme.palette.info.main, assetHue(asset.assetId));
  const wash = dark ? 0.22 : 0.16;
  const letters = assetInitials(asset.name);
  const symbol = !/[\p{L}\p{N}]/u.test(letters);
  const length = [...letters].length;
  const scale = symbol
    ? 0.56
    : length <= 1
      ? 0.44
      : length === 2
        ? 0.38
        : length === 3
          ? 0.3
          : 0.26;
  const rim = Math.max(1.5, Math.round(size * 0.04 * 2) / 2);
  const badgeSize = Math.max(14, Math.round(size * 0.4));

  return (
    <Box
      component="span"
      ref={setNode}
      aria-hidden
      data-avatar=""
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        width: size,
        height: size,
      }}
    >
      <Box
        component="span"
        sx={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(accent, wash),
          backgroundImage: `radial-gradient(circle at 32% 26%, ${alpha(
            theme.palette.common.white,
            dark ? 0.16 : 0.55
          )} 0, transparent 55%), radial-gradient(circle at 72% 82%, ${alpha(accent, 0.22)} 0, transparent 62%)`,
          border: `${rim}px solid ${alpha(accent, dark ? 0.6 : 0.5)}`,
          boxShadow: `inset 0 0 0 ${rim * 1.5}px ${alpha(accent, dark ? 0.14 : 0.1)}`,
          color: readableOn(theme, accent, wash),
          fontWeight: 800,
          fontSize: Math.max(10, Math.round(size * scale)),
          letterSpacing: length >= 3 ? '-0.02em' : 0,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {image.src && image.loaded ? null : letters}
        {image.src ? (
          <Box
            key={image.src}
            component="img"
            src={image.src}
            alt=""
            decoding="async"
            onLoad={() => avatarLoaded(key as string, image.src as string)}
            onError={() => avatarFailed(key as string, image.src as string)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: image.loaded ? 1 : 0,
              bgcolor: 'background.paper',
            }}
          />
        ) : null}
      </Box>
      {badge && ownerName ? (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            right: -Math.round(badgeSize * 0.15),
            bottom: -Math.round(badgeSize * 0.15),
            display: 'inline-flex',
            borderRadius: '50%',
            border: 2,
            borderColor: 'background.paper',
            bgcolor: 'background.paper',
          }}
        >
          <NameAvatar name={ownerName} size={badgeSize} />
        </Box>
      ) : null}
    </Box>
  );
}
