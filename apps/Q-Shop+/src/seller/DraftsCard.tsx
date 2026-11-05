/**
 * "Ready to publish": this shop's products added or edited since the last
 * publish (`global.productsToSave`), listed in the seller page's View changes.
 */
import { ProductImage } from "../components/common/ProductImage";
import { useDispatch } from "react-redux";
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { removeFromProductsToSave } from "../state/features/globalSlice";
import { AmountTag } from "../components/money/PriceTag";
import { qortPrice } from "../money/pricing";
import useConfirmationModal from "../hooks/useConfirmModal";
import { useShopDrafts } from "./shopDrafts";

/**
 * The products waiting to be published, each with Edit and Remove, for the
 * seller page's View changes (seller/PublishBar.tsx). Publishing them is the
 * Publish changes button's.
 */
export function ProductDrafts({ onEdit }: { onEdit: (product: Record<string, any> & { id: string }) => void }) {
  const dispatch = useDispatch();
  const productsToSave = useShopDrafts();
  const { dialog, showModal } = useConfirmationModal({
    title: "Remove from drafts?",
    message: "This product leaves Ready to publish.",
    confirmLabel: "Remove",
    destructive: true,
  });
  const drafts = Object.values(productsToSave);
  if (drafts.length === 0) return null;

  const remove = async (id: string, title: string) => {
    const ok = await showModal({
      message: `"${title}" leaves Ready to publish. A product already in your shop stays as it is there.`,
    });
    if (ok) dispatch(removeFromProductsToSave(id));
  };

  return (
    <>
      <Box component="ul" aria-label="Drafts" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        {drafts.map((draft) => {
          const title = draft.title || "Untitled product";
          const image = draft.images?.[draft.mainImageIndex ?? 0] ?? draft.images?.[0];
          return (
            <Box
              component="li"
              key={draft.id}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1, borderRadius: 1, bgcolor: "background.paper", border: 1, borderColor: "divider" }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  borderRadius: 1,
                  overflow: "hidden",
                  bgcolor: "action.hover",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "text.secondary",
                }}
              >
                {image ? <ProductImage src={image} alt="" /> : <ImageOutlinedIcon />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }} noWrap title={title}>
                  {title}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Chip size="small" variant="outlined" label={draft.isUpdate ? "Edited" : "New"} />
                  <AmountTag value={qortPrice(draft)} coin="QORT" size="small" />
                </Box>
              </Box>
              <Tooltip title="Edit">
                <IconButton aria-label={`Edit ${title}`} onClick={() => onEdit(draft as unknown as Record<string, any> & { id: string })} sx={{ width: 44, height: 44 }}>
                  <EditOutlinedIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove from drafts">
                <IconButton aria-label={`Remove ${title} from drafts`} onClick={() => void remove(draft.id, title)} sx={{ width: 44, height: 44 }}>
                  <DeleteOutlineOutlinedIcon />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
      {dialog}
    </>
  );
}
