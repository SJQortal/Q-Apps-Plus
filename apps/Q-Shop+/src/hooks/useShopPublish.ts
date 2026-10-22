/**
 * Create and edit a shop, and publish a new, empty product index for it
 * (moved out of GlobalWrapper and the original's Edit shop dialog). The
 * payloads come from qdn/payloads.ts and match the original's
 * (payloads.test.ts); each publish gets Hub's 30-minute budget, a decline is
 * a quiet cancel, and a timeout says the publish may still land instead of
 * inviting a second fee.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import {
  resetListProducts,
  resetProducts,
  setCurrentStore,
  setDataContainer,
  setOwnShopStatus,
  updateRecentlyVisitedStoreId,
} from "../state/features/globalSlice";
import { addToAllMyStores, addToHashMapStores, addToStores } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import {
  buildCreateStorePublish,
  buildEditStorePublish,
  buildRecreateDataContainerPublish,
  type StoreFields,
} from "../qdn/payloads";
import { dataContainerIdentifier, finalizeShortStoreId, shortStoreIdOf, storeIdentifier } from "../qdn/identifiers";
import { invalidateQdnJson, invalidateQdnSearches, resourceExists } from "../qdn/search";
import { errorMessage, isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";

export class ShopFormError extends Error {}

export interface CreateShopInput extends StoreFields {
  shortStoreId: string;
}

export function validateShopFields(fields: StoreFields): string | null {
  if (!fields.title.trim()) return "Add a title";
  if (!fields.description.trim()) return "Add a description";
  if (!fields.location.trim()) return "Add a location";
  if (!fields.shipsTo.trim()) return "Say where the shop ships to";
  if (!fields.logo) return "Add a shop logo";
  for (const coin of fields.supportedCoins) {
    if (coin !== "QORT" && !fields.foreignCoins[coin]?.trim()) return `Add your ${coin} payout address, or switch ${coin} off`;
  }
  return null;
}

const NO_NAME_TEXT = "Sign in with a Qortal name to publish your shop.";
const NO_SHOP_TEXT = "Your shop isn't loaded yet. Try again in a moment.";

/** What to say when Hub didn't answer in time: the publish may still land. */
const TIMEOUT_TEXT = "Hub didn't answer in time. It may still be publishing, so check again in a minute before you try again.";

function publishError(error: unknown, fallback: string): ShopFormError {
  return new ShopFormError(isHubTimeout(error) ? TIMEOUT_TEXT : errorMessage(error, fallback));
}

export function useShopPublish() {
  const dispatch = useDispatch<AppDispatch>();
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const [busy, setBusy] = useState(false);

  /**
   * Resolves the new shop's id when published, or null when the seller
   * declined in Hub. Throws ShopFormError with a message otherwise.
   */
  const createShop = useCallback(
    async (input: CreateShopInput): Promise<string | null> => {
      if (!userName) throw new ShopFormError(NO_NAME_TEXT);
      const invalid = validateShopFields(input);
      if (invalid) throw new ShopFormError(invalid);
      const shortStoreId = finalizeShortStoreId(input.shortStoreId.trim());
      if (!shortStoreId) throw new ShopFormError("Pick a shop id: letters, numbers and dashes.");
      const name = userName;
      const identifier = storeIdentifier(shortStoreId);
      setBusy(true);
      try {
        if (await resourceExists("STORE", name, identifier, { fresh: true })) {
          throw new ShopFormError("You already have a shop with this id. Pick another id.");
        }
        const created = Date.now();
        const { storeObj, dataContainer, request } = buildCreateStorePublish({
          name,
          shortStoreId,
          fields: input,
          created,
        });
        await qortalRequestWithTimeout(request, PUBLISH_TIMEOUT_MS);
        const full = { ...storeObj, id: identifier, isValid: true, owner: name, created, updated: created };
        dispatch(setCurrentStore(full));
        dispatch(addToHashMapStores(full));
        dispatch(addToStores(full));
        dispatch(
          addToAllMyStores({
            title: input.title,
            description: input.description,
            created,
            owner: name,
            id: identifier,
            shortStoreId,
            logo: input.logo,
          })
        );
        dispatch(setDataContainer({ ...dataContainer, id: dataContainerIdentifier(identifier) }));
        dispatch(setOwnShopStatus("ready"));
        // The new shop is the one the seller is on now (useOwnShops follows this id),
        // so an earlier shop doesn't take its place, and visiting that one again counts.
        dispatch(updateRecentlyVisitedStoreId(identifier));
        invalidateQdnSearches((url) => url.includes("service=STORE"));
        dispatch(setNotification({ msg: "Shop created", alertType: "success" }));
        return identifier;
      } catch (error) {
        if (error instanceof ShopFormError) throw error;
        if (isHubDecline(error)) return null;
        throw publishError(error, "Failed to create the shop");
      } finally {
        setBusy(false);
      }
    },
    [dispatch, userName]
  );

  /** Resolves true when published; false when the seller declined in Hub. Throws ShopFormError otherwise. */
  const editShop = useCallback(
    async (fields: StoreFields): Promise<boolean> => {
      if (!userName || !currentStore?.id) throw new ShopFormError(userName ? NO_SHOP_TEXT : NO_NAME_TEXT);
      const invalid = validateShopFields(fields);
      if (invalid) throw new ShopFormError(invalid);
      setBusy(true);
      try {
        const { storeObj, request } = buildEditStorePublish({
          name: userName,
          currentStore: currentStore as unknown as Record<string, any> & { id: string },
          fields,
        });
        await qortalRequestWithTimeout(request, PUBLISH_TIMEOUT_MS);
        dispatch(setCurrentStore(storeObj));
        dispatch(addToHashMapStores({ ...storeObj, owner: userName, isValid: true }));
        invalidateQdnJson("STORE", userName, currentStore.id);
        invalidateQdnSearches((url) => url.includes("service=STORE"));
        dispatch(setNotification({ msg: "Shop updated", alertType: "success" }));
        return true;
      } catch (error) {
        if (isHubDecline(error)) return false;
        throw publishError(error, "Failed to update the shop");
      } finally {
        setBusy(false);
      }
    },
    [currentStore, dispatch, userName]
  );

  /**
   * Publishes a new, empty product index for the current shop: the
   * original's "Recreate shop data", and the fix when a shop has none on QDN.
   * It hides every product of the shop, so callers ask first. Resolves true
   * when published, false when declined; throws ShopFormError otherwise.
   */
  const recreateProductList = useCallback(async (): Promise<boolean> => {
    if (!userName || !currentStore?.id) throw new ShopFormError(userName ? NO_SHOP_TEXT : NO_NAME_TEXT);
    const storeId = currentStore.id;
    setBusy(true);
    try {
      const { dataContainer, request } = buildRecreateDataContainerPublish({
        name: userName,
        storeId,
        shortStoreId: currentStore.shortStoreId || shortStoreIdOf(storeId),
      });
      await qortalRequestWithTimeout(request, PUBLISH_TIMEOUT_MS);
      dispatch(setDataContainer({ ...dataContainer, id: dataContainerIdentifier(storeId) }));
      dispatch(resetListProducts());
      dispatch(resetProducts());
      dispatch(setOwnShopStatus("ready"));
      invalidateQdnJson("DOCUMENT", userName, dataContainerIdentifier(storeId));
      invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
      dispatch(setNotification({ msg: "Product list published", alertType: "success" }));
      return true;
    } catch (error) {
      if (isHubDecline(error)) return false;
      throw publishError(error, "Couldn't publish the product list. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [currentStore, dispatch, userName]);

  return { createShop, editShop, recreateProductList, busy };
}
