import { useCallback, useEffect, useState } from "react";
import { fetchMorePictures, morePicturesOf } from "../qdn/productPictures";

export type MorePicturesStatus = "none" | "loading" | "ready" | "failed";

/**
 * A product's pictures past the third (qdn/productPictures.ts), read when it
 * points at some: for the product page's gallery and the edit form. Pass
 * nulls to read nothing. `retry` reads the node again.
 */
export function useMorePictures(owner: string | null | undefined, product: { id: string; morePictures?: unknown } | null | undefined) {
  const ref = product ? morePicturesOf(product) : null;
  const productId = product?.id ?? "";
  const picturesId = ref && ref.count > 0 ? ref.id : "";
  const key = owner && productId && picturesId ? `${owner}\n${productId}\n${picturesId}\n${ref?.sig ?? ""}` : "";
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; status: "ready" | "failed"; images: string[] } | null>(null);
  useEffect(() => {
    if (!key || !owner) return;
    let alive = true;
    fetchMorePictures(owner, productId, picturesId, { fresh: attempt > 0 }).then(
      (images) => alive && setResult({ key, status: "ready", images }),
      () => alive && setResult({ key, status: "failed", images: [] })
    );
    return () => {
      alive = false;
    };
  }, [key, owner, productId, picturesId, attempt]);
  const retry = useCallback(() => {
    setResult(null);
    setAttempt((n) => n + 1);
  }, []);
  const done = result?.key === key ? result : null;
  const status: MorePicturesStatus = !key ? "none" : done ? done.status : "loading";
  return { key, status, images: done?.images ?? [], count: ref?.count ?? 0, retry };
}
