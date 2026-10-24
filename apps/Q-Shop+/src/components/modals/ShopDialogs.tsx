/**
 * The Create shop and Edit shop dialogs, mounted by GlobalWrapper and opened
 * from anywhere through Redux (toggleCreateStoreModal / toggleEditStoreModal).
 * Each loads and mounts only when opened. A new shop opens its seller page.
 */
import { lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../state/store";
import { toggleCreateStoreModal, toggleEditStoreModal } from "../../state/features/globalSlice";

// Loaded when first opened: the forms, image compression and asset lists stay out of the first paint.
const CreateStoreModal = lazy(() => import("./CreateStoreModal"));
const EditStoreModal = lazy(() => import("./EditStoreModal"));

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
    <Suspense fallback={null}>
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
    </Suspense>
  );
}
