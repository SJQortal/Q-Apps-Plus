/**
 * Shop tab → Advanced → Delete shop. Says what goes (the shop and all its
 * products, in both apps), what stays (orders and reviews, which belong to
 * buyers and reviewers), and that the shop's orders won't show on a seller
 * page any more; the seller types the shop's id to confirm. Then
 * useDeleteShop builds the delete and PublishProductsDialog sends it (the
 * shop first, in batches past 20). Once the shop is gone, the seller goes
 * home.
 */
import { useId, useState } from "react";
import { useSelector } from "react-redux";
import { forgetShopDrafts, leaveWithoutAsking } from "./usePendingChanges";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { shortStoreIdOf } from "../qdn/identifiers";
import { collectionsPointer } from "../qdn/collections";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import { useDeleteShop } from "./useDeleteShop";

export function DeleteShopDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const userName = useSelector((state: RootState) => state.auth.user?.name ?? "");
  // The deleted shop's drafts go from this device, and leaving its seller page doesn't ask about them.
  const leaveDeletedShop = () => {
    if (currentStore) forgetShopDrafts(userName, currentStore.owner || userName, currentStore.id);
    leaveWithoutAsking();
    // Back mustn't lead to the deleted shop's seller page.
    navigate("/", { replace: true });
  };
  const del = useDeleteShop();
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const shortId = currentStore?.id ? shortStoreIdOf(currentStore.id) : "";
  const instructionId = useId();
  const title = currentStore?.title || "your shop";
  const ownList = dataContainer && currentStore && dataContainer.storeId === currentStore.id ? dataContainer : null;
  const products = ownList ? Object.keys(ownList.products ?? {}).length : null;
  const hasCollections = !!ownList && !!currentStore && !!collectionsPointer(ownList, currentStore.id);
  const parts = [
    products === null ? "all its products" : products === 1 ? "its product" : products > 1 ? `its ${products} products` : null,
    hasCollections ? "its collections" : null,
  ].filter(Boolean) as string[];
  const what = parts.length > 0 ? ` and ${parts.join(" and ")}` : "";
  const confirmed = shortId !== "" && typed.trim() === shortId;

  const run = async () => {
    if (await del.prepare()) setSending(true);
  };

  if (sending && del.job) {
    return (
      <PublishProductsDialog
        open
        resources={del.job.resources}
        labels={del.job.labels}
        publicKey={publicKey}
        order="given"
        verb="delete"
        settledNote="Your shop leaves every list as soon as the shop itself is sent."
        onDone={() => {
          del.done();
          onClose();
          leaveDeletedShop();
        }}
        onClose={(sent) => {
          const gone = del.closed(sent);
          onClose();
          if (gone) leaveDeletedShop();
        }}
      />
    );
  }

  const working = del.preparing;
  return (
    <ResponsiveDialog
      open
      onClose={working ? () => {} : onClose}
      title="Delete shop?"
      maxWidth="xs"
      dismissible={!working}
      busy={working}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={working}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void run()}
            disabled={!confirmed || working}
            startIcon={working ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineOutlinedIcon />}
          >
            Delete shop
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Alert severity="warning">
          This deletes {title}
          {what}: buyers can no longer find, open or order anything from it, here or in Q-Shop. It can&apos;t be undone.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Orders and reviews stay: buyers keep their orders in My orders, and you keep the order mails in Q-Mail. This shop&apos;s orders
          no longer show on a seller page, so handle open orders first.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          If you open a shop with the same id later, it starts empty, and this shop&apos;s orders and reviews show there again.
        </Typography>
        <Typography id={instructionId}>
          To go ahead, type your shop id,{" "}
          <Box component="strong" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
            {shortId}
          </Box>
          .
        </Typography>
        <TextField
          label="Shop id"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          fullWidth
          disabled={working}
          helperText={`Type ${shortId} to confirm.`}
          slotProps={{
            htmlInput: {
              autoComplete: "off",
              autoCapitalize: "off",
              spellCheck: false,
              "aria-describedby": `${instructionId} ${instructionId}-help`,
            },
            formHelperText: { id: `${instructionId}-help` },
          }}
        />
        <Typography variant="body2" color="text.secondary">
          Hub asks you to confirm: one publish for the shop, its product list{hasCollections ? ", its collections" : ""} and each
          catalogue, with a small fee each.
        </Typography>
        <FormError message={del.error} />
      </Box>
    </ResponsiveDialog>
  );
}
