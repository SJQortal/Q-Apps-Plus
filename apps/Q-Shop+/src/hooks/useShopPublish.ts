/**
 * Create and edit a shop (moved out of GlobalWrapper). The payloads come from
 * qdn/payloads.ts and match the original's (payloads.test.ts); the publish
 * gets Hub's 30-minute budget and a decline is a quiet cancel.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setCurrentStore, setDataContainer, setOwnShopStatus } from "../state/features/globalSlice";
import { addToAllMyStores, addToHashMapStores, addToStores } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { buildCreateStorePublish, buildEditStorePublish, type StoreFields } from "../qdn/payloads";
import { dataContainerIdentifier, finalizeShortStoreId, storeIdentifier } from "../qdn/identifiers";
import { invalidateQdnJson, invalidateQdnSearches, resourceExists } from "../qdn/search";
import { errorMessage, isHubDecline } from "../qdn/hubErrors";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";

export class ShopFormError extends Error {}

export interface CreateShopInput extends StoreFields {
  shortStoreId: string;
}

export function validateShopFields(fields: StoreFields): string | null {
  if (!fields.title.trim()) return "A title is required";
  if (!fields.description.trim()) return "A description is required";
  if (!fields.location.trim()) return "A location is required";
  if (!fields.shipsTo.trim()) return "Ships to is required";
  if (!fields.logo) return "A logo is required";
  for (const coin of fields.supportedCoins) {
    if (coin !== "QORT" && !fields.foreignCoins[coin]?.trim()) return `Please add a ${coin} address`;
  }
  return null;
}

export function useShopPublish() {
  const dispatch = useDispatch<AppDispatch>();
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const [busy, setBusy] = useState(false);

  /** Resolves true when published; false when the seller declined in Hub. Throws ShopFormError with a message otherwise. */
  const createShop = useCallback(
    async (input: CreateShopInput): Promise<boolean> => {
      if (!userName) throw new ShopFormError("Cannot publish: you do not have a Qortal name");
      const invalid = validateShopFields(input);
      if (invalid) throw new ShopFormError(invalid);
      const shortStoreId = finalizeShortStoreId(input.shortStoreId.trim());
      if (!shortStoreId) throw new ShopFormError("Please insert a valid store id");
      const name = userName;
      const identifier = storeIdentifier(shortStoreId);
      setBusy(true);
      try {
        if (await resourceExists("STORE", name, identifier, { fresh: true })) {
          throw new ShopFormError("The store identifier already exists");
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
        invalidateQdnSearches((url) => url.includes("service=STORE"));
        dispatch(setNotification({ msg: "Shop created", alertType: "success" }));
        return true;
      } catch (error) {
        if (error instanceof ShopFormError) throw error;
        if (isHubDecline(error)) return false;
        throw new ShopFormError(errorMessage(error, "Failed to create the shop"));
      } finally {
        setBusy(false);
      }
    },
    [dispatch, userName]
  );

  const editShop = useCallback(
    async (fields: StoreFields): Promise<boolean> => {
      if (!userName || !currentStore?.id) throw new ShopFormError("Cannot publish: you do not have a Qortal name");
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
        throw new ShopFormError(errorMessage(error, "Failed to update the shop"));
      } finally {
        setBusy(false);
      }
    },
    [currentStore, dispatch, userName]
  );

  return { createShop, editShop, busy };
}
