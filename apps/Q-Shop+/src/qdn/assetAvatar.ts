/**
 * A Qortal asset's avatar, in this order:
 * 1. the avatar of the Qortal name spelled as the asset (THUMBNAIL
 *    `qortal_avatar`), when the asset's owner holds that name: issuers
 *    register their coin's name and give it the coin's picture (Simon:
 *    "BHC Coin should map to BHC Coin avatar, all coins have their own
 *    avatars"; 10 of mainnet's 93 assets, 2026-10-22);
 * 2. as the Q-Assets app publishes it (gitea.qortal.link/crowetic/Q-Assets,
 *    src/utils/fetchAssetAvatar.ts): service IMAGE, identifier
 *    `asset<id>_<name>_aavatar` (the asset's name as it is, spaces and all),
 *    under a name of the asset's owner: the primary name first, then the
 *    owner's other names, newest first.
 * Anyone can publish under any identifier, so only names the owner's address
 * holds count. A few small reads per asset (the name's owner, one search
 * each, the owner's primary name), all kept for the session.
 */
import { assetInfo } from "./assets";
import { searchQdn } from "./search";

const avatars = new Map<number, Promise<string | null>>();
const primaryNames = new Map<string, Promise<string | null>>();
const nameOwners = new Map<string, Promise<string | null>>();

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function primaryName(address: string): Promise<string | null> {
  let hit = primaryNames.get(address);
  if (!hit) {
    hit = getJson(`/names/primary/${encodeURIComponent(address)}`).then(
      (body) => (body && typeof (body as { name?: unknown }).name === "string" ? (body as { name: string }).name : null),
      () => null
    );
    primaryNames.set(address, hit);
  }
  return hit;
}

function ownerOf(name: string): Promise<string | null> {
  let hit = nameOwners.get(name);
  if (!hit) {
    hit = getJson(`/names/${encodeURIComponent(name)}`).then(
      (body) => (body && typeof (body as { owner?: unknown }).owner === "string" ? (body as { owner: string }).owner : null),
      () => null
    );
    nameOwners.set(name, hit);
  }
  return hit;
}

/** The identifier Q-Assets publishes an asset's avatar under. */
export function assetAvatarIdentifier(assetId: number, assetName: string): string {
  return `asset${assetId}_${assetName}_aavatar`;
}

/** The avatar's URL on the node, or null when the asset has none (or the node can't tell). */
export function assetAvatarUrl(assetId: number): Promise<string | null> {
  let hit = avatars.get(assetId);
  if (hit) return hit;
  hit = (async () => {
    const info = await assetInfo({ id: assetId }).catch(() => null);
    if (!info?.owner) return null;
    // 1. The coin's own name, when its issuer holds it.
    if ((await ownerOf(info.assetName)) === info.owner) {
      const thumbs = await searchQdn({
        service: "THUMBNAIL",
        name: info.assetName,
        exactmatchnames: true,
        identifier: "qortal_avatar",
        prefix: true,
        includemetadata: false,
        limit: 5,
      }).catch(() => []);
      if (thumbs.some((row) => row.name === info.assetName && row.identifier === "qortal_avatar")) {
        return `/arbitrary/THUMBNAIL/${encodeURIComponent(info.assetName)}/qortal_avatar`;
      }
    }
    // 2. Q-Assets' asset avatar.
    const identifier = assetAvatarIdentifier(assetId, info.assetName);
    const rows = await searchQdn({ service: "IMAGE", identifier, prefix: true, includemetadata: false, limit: 20 }).catch(() => []);
    const candidates = rows
      .filter((row) => row.identifier === identifier && row.name)
      .sort((a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0));
    if (candidates.length === 0) return null;
    const primary = await primaryName(info.owner);
    const ordered = [...candidates.filter((row) => row.name === primary), ...candidates.filter((row) => row.name !== primary)];
    for (const row of ordered) {
      if (row.name === primary || (await ownerOf(row.name)) === info.owner) {
        return `/arbitrary/IMAGE/${encodeURIComponent(row.name)}/${encodeURIComponent(identifier)}`;
      }
    }
    return null;
  })();
  // A failure isn't kept: the next icon asks again.
  hit.catch(() => avatars.delete(assetId));
  avatars.set(assetId, hit);
  return hit;
}

/** For tests. */
export function resetAssetAvatars(): void {
  avatars.clear();
  primaryNames.clear();
  nameOwners.clear();
}
