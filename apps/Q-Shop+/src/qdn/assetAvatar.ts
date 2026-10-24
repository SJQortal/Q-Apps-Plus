/**
 * A Qortal asset's avatar (Simon: "all should use their Q-Assets images and
 * fall back to avatars if they don't have asset image"), in this order:
 * 1. its Q-Assets image, as the Q-Assets app publishes it
 *    (gitea.qortal.link/crowetic/Q-Assets, src/utils/fetchAssetAvatar.ts):
 *    service IMAGE, identifier `asset<id>_<name>_aavatar` (the asset's name
 *    as it is, spaces and all), under a name of the asset's owner: the
 *    primary name first, then the owner's other names, newest first;
 * 2. else the avatar of the Qortal name spelled as the asset (THUMBNAIL
 *    `qortal_avatar`), when the asset's owner holds that name (issuers often
 *    register their coin's name: 10 of mainnet's 93 assets, 2026-10-22);
 * 3. else the avatar of the owner's primary name (Simon: "then the primary
 *    name's avatar");
 * 4. else none (the icon shows the asset's initial).
 * Anyone can publish under any identifier, so only names the owner's address
 * holds count. A few small reads per asset (one search each, the owner's
 * primary name, a name's owner), all kept for the session.
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

const nameAvatars = new Map<string, Promise<boolean>>();

/** Whether a name has published its avatar (THUMBNAIL `qortal_avatar`): one search, kept for the session. */
function hasNameAvatar(name: string): Promise<boolean> {
  let hit = nameAvatars.get(name);
  if (!hit) {
    hit = searchQdn({ service: "THUMBNAIL", name, exactmatchnames: true, identifier: "qortal_avatar", prefix: true, includemetadata: false, limit: 5 }).then(
      (rows) => rows.some((row) => row.name === name && row.identifier === "qortal_avatar"),
      () => false
    );
    nameAvatars.set(name, hit);
  }
  return hit;
}

function nameAvatarUrl(name: string): string {
  return `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar`;
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
    // 1. Its Q-Assets image.
    const identifier = assetAvatarIdentifier(assetId, info.assetName);
    const rows = await searchQdn({ service: "IMAGE", identifier, prefix: true, includemetadata: false, limit: 20 }).catch(() => []);
    const candidates = rows
      .filter((row) => row.identifier === identifier && row.name)
      .sort((a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0));
    const primary = candidates.length > 0 ? await primaryName(info.owner) : null;
    const ordered = [...candidates.filter((row) => row.name === primary), ...candidates.filter((row) => row.name !== primary)];
    for (const row of ordered) {
      if (row.name === primary || (await ownerOf(row.name)) === info.owner) {
        return `/arbitrary/IMAGE/${encodeURIComponent(row.name)}/${encodeURIComponent(identifier)}`;
      }
    }
    // 2. Else the avatar of the coin's own name, when its issuer holds it.
    if ((await ownerOf(info.assetName)) === info.owner && (await hasNameAvatar(info.assetName))) {
      return nameAvatarUrl(info.assetName);
    }
    // 3. Else the issuer's primary name's avatar.
    const issuer = primary ?? (await primaryName(info.owner));
    if (issuer && (await hasNameAvatar(issuer))) return nameAvatarUrl(issuer);
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
  nameAvatars.clear();
  primaryNames.clear();
  nameOwners.clear();
}
