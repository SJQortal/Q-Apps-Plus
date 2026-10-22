/**
 * The product form's fields: images (up to 3, the first is the main one),
 * title, description, the QORT price and an optional own price for every
 * other coin the shop takes, type, category and (when editing) status. It is
 * controlled: NewProduct.tsx holds the values and turns them into a draft.
 */
import type { Dispatch, SetStateAction } from "react";
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import ImageUploader from "../../../components/common/ImageUploader";
import { CoinIcon } from "../../../components/money/CoinIcon";
import { SHOP_CATEGORIES } from "../../../constants/categories";
import { COINS, assetIdOf, coinLabel, isCoinTicker, type ShopCoinSettings } from "../../../money/coins";
import {
  MAX_PRODUCT_IMAGES,
  MAX_TITLE_LENGTH,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  STATUS_LABEL,
  TYPE_LABEL,
  sanitizeAmountInput,
  type ProductFormValues,
} from "../../../seller/productDraft";

interface ProductFormProps {
  values: ProductFormValues;
  /** A state setter: several images picked at once each add to the latest values. */
  onChange: Dispatch<SetStateAction<ProductFormValues>>;
  /** The coins the shop takes, QORT first (money/coins.ts shopCoins). */
  coins: string[];
  shop: ShopCoinSettings | null | undefined;
  /** The product's saved category when it isn't one of the list (constants/categories.ts): kept until another is picked. */
  oldCategory?: string | null;
  /** Editing a published product: the status can change. */
  editing: boolean;
  onImageError: (message: string) => void;
}

const SectionTitle = ({ children }: { children: string }) => (
  <Typography component="h3" sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
    {children}
  </Typography>
);

function coinName(coin: string, shop: ShopCoinSettings | null | undefined): string {
  return isCoinTicker(coin) ? COINS[coin].label : coinLabel(coin, shop);
}

export const ProductForm = ({ values, onChange, coins, shop, oldCategory, editing, onImageError }: ProductFormProps) => {
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));
  const setPrice = (coin: string, text: string) =>
    onChange((prev) => ({ ...prev, prices: { ...prev.prices, [coin]: sanitizeAmountInput(text) } }));
  const title = values.title.trim() || "Product";
  const otherCoins = coins.filter((c) => c !== "QORT");

  const removeImage = (index: number) => onChange((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  const makeMain = (index: number) =>
    onChange((prev) => {
      const next = prev.images.slice();
      const [img] = next.splice(index, 1);
      return { ...prev, images: [img, ...next] };
    });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box component="section" aria-label="Images" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <SectionTitle>Images</SectionTitle>
        {values.images.length > 0 && (
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
            {values.images.map((img, index) => (
              <Box component="li" key={`${index}-${img.slice(-24)}`} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box
                  component="img"
                  src={img}
                  alt={`${title}, image ${index + 1}${index === 0 ? " (main)" : ""}`}
                  sx={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: 1,
                    border: 1,
                    borderColor: index === 0 ? "primary.main" : "divider",
                    bgcolor: "action.hover",
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5 }}>
                  {index > 0 && (
                    <Tooltip title="Make main image">
                      <IconButton aria-label={`Make image ${index + 1} the main image`} onClick={() => makeMain(index)} sx={{ width: 44, height: 44 }}>
                        <StarOutlineOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Remove image">
                    <IconButton aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(index)} sx={{ width: 44, height: 44 }}>
                      <DeleteOutlineOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        {values.images.length < MAX_PRODUCT_IMAGES && (
          <ImageUploader
            label={values.images.length === 0 ? "Add images" : "Add another image"}
            max={MAX_PRODUCT_IMAGES - values.images.length}
            onPick={(img) => onChange((prev) => ({ ...prev, images: [...prev.images, img].slice(0, MAX_PRODUCT_IMAGES) }))}
            onError={onImageError}
          />
        )}
        <Typography variant="body2" color="text.secondary">
          The first image is the one buyers see in lists.
        </Typography>
      </Box>

      <Box component="section" aria-label="Details" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionTitle>Details</SectionTitle>
        <TextField
          label="Title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_TITLE_LENGTH } }}
          helperText={`${values.title.length}/${MAX_TITLE_LENGTH}`}
        />
        <TextField
          label="Description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          fullWidth
          multiline
          minRows={3}
          maxRows={10}
        />
        <Box>
          <Typography id="product-type-label" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
            Type
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={values.type}
            onChange={(_, value) => value && set("type", value)}
            aria-labelledby="product-type-label"
            sx={{ "& .MuiToggleButton-root": { minHeight: 44, px: 2.5, textTransform: "none" } }}
          >
            {PRODUCT_TYPES.map((type) => (
              <ToggleButton key={type} value={type}>
                {TYPE_LABEL[type]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {values.type === "physical" ? "Buyers give a delivery address at checkout." : "No delivery address is asked for."}
          </Typography>
        </Box>
        <TextField
          select
          label="Category"
          required
          fullWidth
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
          slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
          helperText={
            oldCategory && values.category === oldCategory
              ? `“${oldCategory}” isn't one of the categories every shop uses. Pick one, so buyers find this product with others like it.`
              : "The same categories in every shop, so buyers can browse all products by them."
          }
          sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
        >
          <option value="" disabled>
            Choose a category
          </option>
          {SHOP_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
          {oldCategory && (
            <optgroup label="This product's category now">
              <option value={oldCategory}>{oldCategory}</option>
            </optgroup>
          )}
        </TextField>
        {editing && (
          <Box>
            <Typography id="product-status-label" variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              Status
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={values.status}
              onChange={(_, value) => value && set("status", value)}
              aria-labelledby="product-status-label"
              sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { minHeight: 44, px: 2, textTransform: "none" } }}
            >
              {PRODUCT_STATUSES.map((status) => (
                <ToggleButton key={status} value={status}>
                  {STATUS_LABEL[status]}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}
      </Box>

      <Box component="section" aria-label="Price" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionTitle>Price</SectionTitle>
        <TextField
          label="Price in QORT"
          value={values.prices.QORT ?? ""}
          onChange={(e) => setPrice("QORT", e.target.value)}
          required
          fullWidth
          slotProps={{
            htmlInput: { inputMode: "decimal", autoComplete: "off" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <CoinIcon coin="QORT" size={20} />
                </InputAdornment>
              ),
              endAdornment: <InputAdornment position="end">QORT</InputAdornment>,
            },
          }}
        />
        {otherCoins.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary">
              Your shop also takes {otherCoins.map((c) => coinLabel(c, shop)).join(", ")}. Set your own price in a coin, or
              leave it empty to convert the QORT price at your node&apos;s rate when the buyer pays.
            </Typography>
            {otherCoins.map((coin) => {
              const isAsset = assetIdOf(coin) !== null;
              const label = coinLabel(coin, shop);
              return (
                <TextField
                  key={coin}
                  label={`Price in ${coinName(coin, shop)}`}
                  value={values.prices[coin] ?? ""}
                  onChange={(e) => setPrice(coin, e.target.value)}
                  fullWidth
                  helperText={
                    isAsset
                      ? `Buyers can pay in ${label} only when you set a price here.`
                      : "Optional. Empty: converted from the QORT price."
                  }
                  slotProps={{
                    htmlInput: { inputMode: "decimal", autoComplete: "off" },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <CoinIcon coin={coin} size={20} />
                        </InputAdornment>
                      ),
                      endAdornment: <InputAdornment position="end">{label}</InputAdornment>,
                    },
                  }}
                />
              );
            })}
          </>
        )}
      </Box>
    </Box>
  );
};
