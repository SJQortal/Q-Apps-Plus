/**
 * The Create shop and Edit shop dialogs, mounted once by GlobalWrapper and
 * opened through Redux (toggleCreateStoreModal / toggleEditStoreModal). The
 * publishing lives in hooks/useShopPublish.ts.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import { toggleEditStoreModal } from "../../state/features/globalSlice";
import CreateStoreModal, { type onPublishParam } from "./CreateStoreModal";
import EditStoreModal, { type onPublishParamEdit } from "./EditStoreModal";
import { useShopPublish } from "../../hooks/useShopPublish";

export function ShopDialogs() {
  const dispatch = useDispatch();
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const isOpenCreate = useSelector((state: RootState) => state.global.isOpenCreateStoreModal);
  const isOpenEdit = useSelector((state: RootState) => state.global.isOpenEditStoreModal);
  const { createShop, editShop } = useShopPublish();
  const [closeCreate, setCloseCreate] = useState(false);

  const onCreate = async (p: onPublishParam) => {
    const done = await createShop({
      title: p.title,
      description: p.description,
      location: p.location,
      shipsTo: p.shipsTo,
      logo: p.logo,
      foreignCoins: p.foreignCoins,
      supportedCoins: p.supportedCoins,
      shortStoreId: p.storeIdentifier,
    });
    if (done) setCloseCreate(true);
  };

  const onEdit = async (p: onPublishParamEdit) => {
    await editShop({
      title: p.title,
      description: p.description,
      location: p.location,
      shipsTo: p.shipsTo,
      logo: p.logo,
      foreignCoins: p.foreignCoins,
      supportedCoins: p.supportedCoins,
    });
  };

  return (
    <>
      {isOpenCreate && userName && (
        <CreateStoreModal
          open={isOpenCreate}
          closeCreateStoreModal={closeCreate}
          setCloseCreateStoreModal={setCloseCreate}
          onPublish={onCreate}
          username={userName}
        />
      )}
      <EditStoreModal
        open={isOpenEdit}
        onClose={() => dispatch(toggleEditStoreModal(false))}
        onPublish={onEdit}
        username={userName || ""}
      />
    </>
  );
}
