/**
 * Which name an asset's avatar is published under, as the Q-Assets app
 * publishes it (IMAGE `asset<id>_<name>_aavatar`): the asset owner's primary
 * name first; another name only when the owner's names list holds it.
 * Anyone else's image for the asset is never used. Reads the one search of
 * every asset avatar (`xassetavatars`), the owner's primary name, and the
 * owner's names only when a candidate isn't the primary one.
 */
import { getNamesOf } from '../../data/explorer/account';
import { ASSET_AVATARS_KEY, getAssetAvatars } from '../../data/explorer/assets';
import { usePrimaryName } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { avatarPublishers } from '../../rules/explorer/assets';

export interface AssetAvatarAsset {
  assetId: number;
  name: string;
  /** The asset's owner; without it, only the coin. */
  owner?: string;
}

/** The name the asset's avatar is published under, once known; null: none to load. */
export function useAssetImage(asset: AssetAvatarAsset): string | null {
  const avatars = useQuery(ASSET_AVATARS_KEY, (force) => getAssetAvatars({ force }));
  const ownerName = usePrimaryName(asset.owner ?? null);
  const resources = avatars.data?.get(asset.assetId) ?? [];
  // Wait for the owner's primary name: it goes first, and needs nothing more read.
  const primary = asset.owner && resources.length ? ownerName.data : null;
  const publishers =
    primary === undefined ? [] : avatarPublishers(resources, asset, primary ?? null);
  const needNames = Boolean(asset.owner) && publishers.length > 0 && publishers[0] !== primary;
  const ownerNames = useQuery(needNames ? `xnames:${asset.owner}` : null, (force) =>
    getNamesOf(asset.owner as string, { force })
  );
  if (!publishers.length) return null;
  if (publishers[0] === primary) return primary;
  return publishers.find((p) => ownerNames.data?.names.includes(p)) ?? null;
}
