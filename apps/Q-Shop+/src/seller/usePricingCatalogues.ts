/**
 * Every catalogue of the shop, read for a prices publish (Shop tab → Prices
 * and the header's QORT rate): products' prices in the currency are kept
 * there, and a new rate reprices every product that follows it, so all of
 * them must be read before anything is sent. A catalogue that can't be read
 * is asked about on QDN: one that never landed (a publish that didn't
 * finish) holds nothing to price, so it doesn't stop the others; one that
 * exists does (`blocking`), until Retry reads it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resourceExists } from "../qdn/search";
import type { SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";

export function usePricingCatalogues(rows: SellerRow[], owner: string) {
  const { request, retry, statusOf, productOf } = useCatalogueLoader(owner);
  const catalogueIds = useMemo(() => [...new Set(rows.map((row) => row.catalogueId))], [rows]);
  const catalogueKey = catalogueIds.join("|");
  useEffect(() => {
    if (catalogueKey) request(catalogueKey.split("|"));
  }, [catalogueKey, request]);
  const loads = catalogueIds.map(statusOf);
  const failed = catalogueIds.filter((_, i) => loads[i] === "failed");
  const loading = loads.some((l) => l !== "ready" && l !== "failed");
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  const asked = useRef(new Set<string>());
  const failedKey = failed.join("|");
  useEffect(() => {
    if (!owner || !failedKey) return;
    let alive = true;
    for (const id of failedKey.split("|")) {
      if (asked.current.has(id)) continue;
      asked.current.add(id);
      resourceExists("DOCUMENT", owner, id, { fresh: true }).then(
        (exists) => alive && setAbsent((prev) => ({ ...prev, [id]: !exists })),
        () => alive && setAbsent((prev) => ({ ...prev, [id]: false }))
      );
    }
    return () => {
      alive = false;
    };
  }, [failedKey, owner]);
  const blocking = failed.filter((id) => absent[id] !== true);
  const missingProducts = rows.filter((row) => failed.includes(row.catalogueId) && absent[row.catalogueId] === true).length;
  const details = (row: SellerRow) => productOf(row.catalogueId, row.productId);
  const blockingKey = blocking.join("|");
  const retryBlocking = useCallback(() => {
    for (const id of blockingKey ? blockingKey.split("|") : []) {
      asked.current.delete(id);
      retry(id);
    }
  }, [blockingKey, retry]);
  return {
    details,
    statusOf,
    loading,
    blocking,
    missingProducts,
    retryBlocking,
    read: loads.filter((l) => l === "ready").length,
    total: catalogueIds.length,
  };
}
