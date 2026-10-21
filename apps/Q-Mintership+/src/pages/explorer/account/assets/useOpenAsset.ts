/**
 * Which asset's popup is open, kept in the page's URL (`?asset=<id>`), so a
 * copied link opens it, Back isn't needed to close it (it replaces), and the
 * Assets tab and the Overview each open it where they are (Simon,
 * 2026-10-21: "when clicking on each asset it gets its own popup overview
 * window"). The asset is one the account holds, else any from Core's list
 * (one it owns and holds none of, or another).
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AssetMeta, AssetView } from '../../../../rules/explorer/assets';
import { appParam } from '../../../../routes/hubLocation';

/** An asset the account doesn't hold, as a view its popup can show. */
export function notHeldView(meta: AssetMeta, address: string): AssetView {
  return {
    assetId: meta.assetId,
    name: meta.name,
    balance: 0n,
    meta,
    share: 0,
    owned: meta.owner === address,
  };
}

export function useOpenAsset(
  address: string,
  views: readonly AssetView[] | undefined,
  list: ReadonlyMap<number, AssetMeta> | undefined
): { open: AssetView | null; setOpen: (assetId: number | null) => void } {
  const [params, setParams] = useSearchParams();
  const openId = Number(appParam(params, 'asset'));
  const open = useMemo(() => {
    if (!Number.isInteger(openId) || openId <= 0) return null;
    const held = views?.find((v) => v.assetId === openId);
    if (held) return held;
    const meta = list?.get(openId);
    return meta ? notHeldView(meta, address) : null;
  }, [openId, views, list, address]);
  const setOpen = (assetId: number | null) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (assetId === null) out.delete('asset');
        else out.set('asset', String(assetId));
        return out;
      },
      { replace: true }
    );
  return { open, setOpen };
}
