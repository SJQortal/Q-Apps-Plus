/**
 * A shop's JSON (STORE `q-store-general-<shortStoreId>` under the owner's
 * name), through the session cache, so the home list and the shop page
 * share one request per shop. The owner and id are the ones asked for, not
 * the body's (docs/QORTAL.md → pitfall 15).
 */
import { checkStructureStore } from "./checkStructure";
import { fetchQdnJson } from "../qdn/search";

export const fetchAndEvaluateStores = async (data: { owner?: string; storeId?: string; content?: any }) => {
  const { owner, storeId, content } = data ?? {};
  const invalid = { ...content, isValid: false };
  if (!owner || !storeId) return invalid;
  try {
    const json = await fetchQdnJson("STORE", owner, storeId);
    if (!checkStructureStore(json)) return invalid;
    return { ...content, ...json, owner, id: storeId, isValid: true };
  } catch {
    return invalid;
  }
};
