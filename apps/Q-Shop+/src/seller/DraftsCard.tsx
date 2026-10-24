/**
 * "Ready to publish": this shop's products added or edited since the last
 * publish (`global.productsToSave`), shown above the seller's tabs so they are never
 * forgotten. Review lists them with Edit and Remove; Publish sends them all.
 */
import { useId, useState } from "react";
import { ProductImage } from "../components/common/ProductImage";
import { useDispatch } from "react-redux";
import { Alert, Box, Button, Chip, CircularProgress, Collapse, IconButton, Tooltip, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { removeFromProductsToSave } from "../state/features/globalSlice";
import { AmountTag } from "../components/money/PriceTag";
import { qortPrice } from "../money/pricing";
import useConfirmationModal from "../hooks/useConfirmModal";
import { primarySoft } from "../hub-theme";
import { useShopDrafts } from "./shopDrafts";

interface DraftsCardProps {
  onEdit: (product: Record<string, any> & { id: string }) => void;
  onPublish: () => void;
  preparing: boolean;
  error: string | null;
  /** Something the seller should know before publishing again (the product list changed on QDN). */
  notice?: string | null;
}

export function DraftsCard({ onEdit, onPublish, preparing, error, notice = null }: DraftsCardProps) {
  const dispatch = useDispatch();
  const productsToSave = useShopDrafts();
  const [open, setOpen] = useState(false);
  const listId = useId();
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
    <Box
      component="section"
      aria-label="Ready to publish"
      sx={(theme) => ({
        border: 1,
        borderColor: "primary.main",
        borderRadius: 1,
        bgcolor: primarySoft(theme),
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: 17 }}>
            Ready to publish: {drafts.length === 1 ? "1 product" : `${drafts.length} products`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Buyers see them once you publish. Hub asks you to confirm and charges a small fee.
          </Typography>
        </Box>
        <Button
          color="inherit"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={listId}
          endIcon={<ExpandMoreIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />}
          sx={{ minHeight: 44 }}
        >
          Review
        </Button>
        <Button
          variant="contained"
          onClick={onPublish}
          disabled={preparing}
          startIcon={preparing ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ minHeight: 44 }}
        >
          {preparing ? "Preparing…" : "Publish"}
        </Button>
      </Box>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="info" role="status">
          {notice}
        </Alert>
      )}
      <Collapse in={open} id={listId} unmountOnExit>
        <Box component="ul" aria-label="Drafts" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {drafts.map((draft) => {
            const title = draft.title || "Untitled product";
            const image = draft.images?.[draft.mainImageIndex ?? 0] ?? draft.images?.[0];
            return (
              <Box
                component="li"
                key={draft.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: "divider",
                }}
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
                  {image ? (
                    <ProductImage src={image} alt="" />
                  ) : (
                    <ImageOutlinedIcon />
                  )}
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
      </Collapse>
      {dialog}
    </Box>
  );
}
