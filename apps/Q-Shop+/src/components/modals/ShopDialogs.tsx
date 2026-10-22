/**
 * The Create shop and Edit shop dialogs, mounted by GlobalWrapper and opened
 * from anywhere through Redux (toggleCreateStoreModal / toggleEditStoreModal).
 * Each mounts only while open. A new shop opens its seller page.
 */
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../state/store";
import { toggleCreateStoreModal, toggleEditStoreModal } from "../../state/features/globalSlice";
import CreateStoreModal from "./CreateStoreModal";
import EditStoreModal from "./EditStoreModal";

export function ShopDialogs() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const isOpenCreate = useSelector((state: RootState) => state.global.isOpenCreateStoreModal);
  const isOpenEdit = useSelector((state: RootState) => state.global.isOpenEditStoreModal);
  const viewedStoreId = useSelector((state: RootState) => state.store.storeId);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  // Edit shop opened on one of the seller's shop pages edits that shop.
  const editStoreId = viewedStoreId && myStores.some((s) => s.id === viewedStoreId) ? viewedStoreId : null;

  return (
    <>
      {isOpenCreate && userName && (
        <CreateStoreModal
          open={isOpenCreate}
          onClose={() => dispatch(toggleCreateStoreModal(false))}
          onCreated={(storeId) => {
            dispatch(toggleCreateStoreModal(false));
            navigate(`/product-manager/${encodeURIComponent(storeId)}?tab=products`);
          }}
        />
      )}
      {isOpenEdit && userName && (
        <EditStoreModal open={isOpenEdit} storeId={editStoreId} onClose={() => dispatch(toggleEditStoreModal(false))} />
      )}
    </>
  );
}
