/**
 * A variant group's products, for editing it as one (variants/drafts.ts
 * groupFormValues): every product the shop's list names in the group, as
 * its draft when it has one, else as published (its catalogue read for it,
 * cached), plus the group's drafts not published yet. A product whose
 * catalogue doesn't hold it starts from its list row, as the Products tab
 * does. `lead` is the item that carries the product's fields and pictures.
 */
import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { useCatalogueLoader } from "../seller/useCatalogueLoader";
import { productForEdit, productFromIndexRow } from "../seller/productDraft";
import { valuesKey, variantItems, variantOf, variantRowOf, type ProductVariant } from "./model";

type Base = Record<string, any> & { id: string };

export type VariantGroupLoad =
  | { status: "loading" | "failed"; retry: () => void }
  | { status: "ready"; variant: ProductVariant; members: Base[]; lead: Base };

export function useVariantGroup(product: Base, variant: ProductVariant): VariantGroupLoad {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave) as unknown as Record<string, Base>;
  const { request, retry, statusOf, productOf } = useCatalogueLoader(owner);

  const rows = useMemo(
    () =>
      Object.entries((dataContainer?.products ?? {}) as Record<string, Record<string, any>>)
        .filter(([, row]) => variantRowOf(row)?.group === variant.group)
        .map(([productId, row]) => ({ ...row, productId }) as Record<string, any> & { productId: string; catalogueId: string }),
    [dataContainer, variant.group]
  );
  // Only the catalogues of products without a draft (the form's product is in hand).
  const needed = [...new Set(rows.filter((r) => !productsToSave[r.productId] && r.productId !== product.id).map((r) => r.catalogueId))].join("|");
  useEffect(() => {
    if (needed) request(needed.split("|"));
  }, [needed, request]);

  const members = new Map<string, Base>([[product.id, product]]);
  let pending = false;
  let failed: string[] = [];
  for (const row of rows) {
    if (members.has(row.productId)) continue;
    const draft = productsToSave[row.productId];
    if (draft) {
      members.set(row.productId, draft);
      continue;
    }
    const details = productOf(row.catalogueId, row.productId);
    const load = statusOf(row.catalogueId);
    if (details) members.set(row.productId, productForEdit(row as never, details));
    else if (load === "ready") {
      // Not in its catalogue: its row, and its place in the group from the list.
      const values = variantRowOf(row)?.values ?? [];
      members.set(row.productId, { ...productFromIndexRow(row as never, storeId), variant: { ...variant, values } });
    } else if (load === "failed") failed = [...failed, row.catalogueId];
    else pending = true;
  }
  for (const draft of Object.values(productsToSave)) {
    if (!members.has(draft.id) && variantOf(draft)?.group === variant.group) members.set(draft.id, draft);
  }

  const retryFailed = () => [...new Set(failed)].forEach((id) => retry(id));
  if (failed.length > 0) return { status: "failed", retry: retryFailed };
  if (pending) return { status: "loading", retry: retryFailed };
  // The lead's group is the group as last saved; without the lead, the first item leads.
  const list = [...members.values()];
  const order = variantItems(variant.options).map(valuesKey);
  const place = (m: Base) => {
    const values = variantOf(m)?.values;
    const at = values ? order.indexOf(valuesKey(values)) : -1;
    return at < 0 ? order.length : at;
  };
  const lead = members.get(variant.lead) ?? [...list].sort((a, b) => place(a) - place(b))[0];
  return { status: "ready", variant: variantOf(lead) ?? variant, members: list, lead };
}
