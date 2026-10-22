/**
 * The product form's fields: images (up to 3, the first is the main one),
 * title, description, the QORT price and an optional own price for every
 * other coin the shop takes, type, category and (when editing) status. It is
 * controlled: NewProduct.tsx holds the values and turns them into a draft.
 */
import { lazy, Suspense, useId, useState, type Dispatch, type SetStateAction } from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import ImageUploader from "../../../components/common/ImageUploader";

// Quill and the media dialogs: loaded with the form, never for buyers.
const DescriptionEditor = lazy(() => import("../../../richtext/DescriptionEditor"));
import { CoinIcon } from "../../../components/money/CoinIcon";
import { CategoryField } from "../../../seller/CategoryField";
import { CategoryIcon } from "../../../components/CategoryIcon";
import { suggestCategory } from "../../../utils/categoryMatch";
import {
  coinPriceFromFiat,
  formatFiat,
  priceDecimals,
  rateToText,
  sanitizeFiatInput,
  staleFiatPriceOf,
  type FiatPricing,
} from "../../../money/fiatPricing";
import { COINS, assetIdOf, coinLabel, isCoinTicker, type ShopCoinSettings } from "../../../money/coins";
import {
  MAX_PRODUCT_IMAGES,
  MAX_TITLE_LENGTH,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  STATUS_LABEL,
  TYPE_LABEL,
  sanitizeAmountInput,
  typedFiat,
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
  /** The shop prices in a currency at the seller's rates (money/fiatPricing.ts): a price in it comes first. */
  pricing?: FiatPricing | null;
  /** The product as saved, to say when its price in the currency was changed elsewhere. */
  saved?: Record<string, unknown> | null;
  /** Assets that can't be split (`ASSET:<id>`): their prices are whole units. */
  wholeOnly?: string[];
  /** Editing a published product: the status can change. */
  editing: boolean;
  onImageError: (message: string) => void;
  /**
   * The product's pictures past the third are still being read from QDN, or
   * couldn't be (qdn/productPictures.ts): its pictures can't change until
   * they are in.
   */
  picturesLoad?: { status: "loading" | "failed"; count: number; onRetry: () => void } | null;
  /** The name the shop publishes under: videos and PDFs added in the description are published by it. */
  publisher?: string | null;
  shopTitle?: string;
}

const SectionTitle = ({ children }: { children: string }) => (
  <Typography component="h3" sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
    {children}
  </Typography>
);

function coinName(coin: string, shop: ShopCoinSettings | null | undefined): string {
  return isCoinTicker(coin) ? COINS[coin].label : coinLabel(coin, shop);
}

export const ProductForm = ({
  values,
  onChange,
  coins,
  shop,
  oldCategory,
  pricing,
  saved,
  wholeOnly = [],
  editing,
  onImageError,
  picturesLoad = null,
  publisher = null,
  shopTitle,
}: ProductFormProps) => {
  const picturesLocked = !!picturesLoad;
  const descriptionLabel = useId();
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    onChange((prev) => ({ ...prev, [key]: value }));
  // The category the title suggests (utils/categoryMatch.ts). While the seller hasn't picked one,
  // it follows the title as they type it; once they pick, it stays theirs.
  const [autoFill, setAutoFill] = useState(!values.category);
  const [autoCategory, setAutoCategory] = useState<string | null>(null);
  // What is typed in the category field to search it; null: it shows the category.
  const [categoryText, setCategoryText] = useState<string | null>(null);
  const suggested = suggestCategory(values.title);
  const setTitle = (title: string) => {
    const follow = autoFill && (!values.category || values.category === autoCategory);
    const next = follow ? suggestCategory(title) : null;
    if (next) {
      setAutoCategory(next);
      setCategoryText(null);
    }
    onChange((prev) => ({ ...prev, title, ...(next && { category: next }) }));
  };
  const pickCategory = (category: string) => {
    setAutoFill(false);
    setCategoryText(null);
    set("category", category);
  };
  const categoryHelp =
    oldCategory && values.category === oldCategory
      ? `“${oldCategory}” isn't one of the categories every shop uses. Pick one, so buyers find this product with others like it.`
      : autoFill && values.category && values.category === autoCategory
        ? "Suggested from the title. Pick another if it doesn't fit."
        : "Type what it is (e.g. glasses, ghee, hoodie) or pick one. The same categories in every shop.";
  const setPrice = (coin: string, text: string) =>
    onChange((prev) => ({
      ...prev,
      // An asset that can't be split takes whole units only.
      prices: { ...prev.prices, [coin]: wholeOnly.includes(coin) ? text.replace(/\D/g, "") : sanitizeAmountInput(text) },
    }));
  const title = values.title.trim() || "Product";
  const fiat = typedFiat(values, pricing);
  // A price in the shop's currency gives the QORT and ARRR prices; only asset prices are typed then.
  const otherCoins = coins.filter((c) => c !== "QORT" && !(fiat !== null && c === "ARRR"));
  const stale = pricing && !(values.fiat ?? "").trim() ? staleFiatPriceOf(saved, pricing.currency) : null;

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
          <Box
            component="ul"
            aria-label={`Pictures (${values.images.length} of ${MAX_PRODUCT_IMAGES})`}
            sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(30%, 108px), 1fr))", gap: 1 }}
          >
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
                      <span>
                        <IconButton
                          aria-label={`Make image ${index + 1} the main image`}
                          onClick={() => makeMain(index)}
                          disabled={picturesLocked}
                          sx={{ width: 44, height: 44 }}
                        >
                          <StarOutlineOutlinedIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  <Tooltip title="Remove image">
                    <span>
                      <IconButton aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(index)} disabled={picturesLocked} sx={{ width: 44, height: 44 }}>
                        <DeleteOutlineOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            ))}
            {picturesLoad?.status === "loading" &&
              Array.from({ length: picturesLoad.count }, (_, i) => (
                <Box component="li" key={`more-${i}`} aria-hidden>
                  <Skeleton variant="rounded" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
                </Box>
              ))}
          </Box>
        )}
        {picturesLoad?.status === "loading" && (
          <Typography variant="body2" color="text.secondary" role="status">
            Loading {picturesLoad.count === 1 ? "1 more picture" : `${picturesLoad.count} more pictures`}…
          </Typography>
        )}
        {picturesLoad?.status === "failed" && (
          <Box role="alert" sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" sx={{ flex: "1 1 220px" }}>
              {picturesLoad.count === 1 ? "1 more picture" : `${picturesLoad.count} more pictures`} of this product couldn't be read from
              your node. The pictures can change once they are in, so none get lost.
            </Typography>
            <Button variant="outlined" color="inherit" onClick={picturesLoad.onRetry} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          </Box>
        )}
        {!picturesLocked && values.images.length < MAX_PRODUCT_IMAGES && (
          <ImageUploader
            label={values.images.length === 0 ? "Add images" : "Add another image"}
            max={MAX_PRODUCT_IMAGES - values.images.length}
            onPick={(img) => onChange((prev) => ({ ...prev, images: [...prev.images, img].slice(0, MAX_PRODUCT_IMAGES) }))}
            onError={onImageError}
          />
        )}
        <Typography variant="body2" color="text.secondary">
          Up to {MAX_PRODUCT_IMAGES} images. The first is the one buyers see in lists; Q-Shop, the original app, shows the first 3.
        </Typography>
      </Box>

      <Box component="section" aria-label="Details" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionTitle>Details</SectionTitle>
        <TextField
          label="Title"
          value={values.title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_TITLE_LENGTH } }}
          helperText={`${values.title.length}/${MAX_TITLE_LENGTH}`}
        />
        <Box>
          <Typography id={descriptionLabel} variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
            Description
          </Typography>
          <Suspense fallback={<Skeleton variant="rounded" height={208} aria-label="Loading the editor" />}>
            <DescriptionEditor
              value={values.description}
              onChange={(html) => set("description", html)}
              name={publisher}
              productTitle={values.title.trim()}
              shopTitle={shopTitle}
              labelId={descriptionLabel}
              placeholder="What it is, what's included, sizes, care…"
            />
          </Suspense>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Format it with the toolbar, or paste formatted text. To link to Qortal, select text and use the link button with a qortal:// address. The last two
            buttons add a video or a PDF; a Q-Tube or Q-Share link on a line of its own shows its video or files too.
          </Typography>
        </Box>
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
        <CategoryField
          value={values.category}
          inputValue={categoryText ?? values.category}
          onInputChange={(text) => setCategoryText(text === values.category ? null : text)}
          onPick={pickCategory}
          oldCategory={oldCategory}
          helperText={categoryHelp}
        />
        {oldCategory && values.category === oldCategory && suggested && (
          <Box>
            <Button
              variant="outlined"
              onClick={() => pickCategory(suggested)}
              startIcon={<CategoryIcon category={suggested} size={24} />}
              sx={{ minHeight: 44, textTransform: "none" }}
            >
              {`Use ${suggested} (suggested from the title)`}
            </Button>
          </Box>
        )}
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
        {pricing && (
          <TextField
            label={`Price in ${pricing.currency}`}
            value={values.fiat ?? ""}
            onChange={(e) => onChange((prev) => ({ ...prev, fiat: sanitizeFiatInput(e.target.value, priceDecimals(pricing.currency)) }))}
            fullWidth
            helperText={
              fiat !== null
                ? `= ${coinPriceFromFiat(fiat, pricing.rates.QORT)} QORT${
                    !coins.includes("ARRR")
                      ? ""
                      : pricing.rates.ARRR
                        ? ` · ${coinPriceFromFiat(fiat, pricing.rates.ARRR)} ARRR`
                        : " (ARRR at your node's rate)"
                  } at your rates (1 QORT = ${rateToText(pricing.rates.QORT)} ${pricing.currency}). They follow when you change a rate in Shop → Prices.`
                : stale
                  ? `Its QORT price was changed elsewhere since it was ${formatFiat(stale, pricing.currency)}. Type a price in ${pricing.currency} to follow your rates again.`
                  : `Its QORT and ARRR prices then follow from your rates. Leave it empty to set them yourself.`
            }
            slotProps={{
              htmlInput: { inputMode: "decimal", autoComplete: "off" },
              input: { endAdornment: <InputAdornment position="end">{pricing.currency}</InputAdornment> },
            }}
          />
        )}
        {fiat === null && (
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
        )}
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
                      ? `Buyers can pay in ${label} only when you set a price here.${wholeOnly.includes(coin) ? ` ${label} can't be split: whole units only.` : ""}`
                      : "Optional. Empty: converted from the QORT price."
                  }
                  slotProps={{
                    htmlInput: { inputMode: wholeOnly.includes(coin) ? "numeric" : "decimal", autoComplete: "off" },
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
