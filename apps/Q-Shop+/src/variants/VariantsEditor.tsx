/**
 * The product form's Variants (variants/drafts.ts): variants of the
 * seller's own (Round, Square…), each with its values (Pale, Orange…),
 * a colour for any value and a picture for any variant; how lists show
 * them; and each item's price and picture. Values and variants move by
 * dragging, or with Alt and the arrow keys. Off: one product, as before.
 * An edited group (`group`) is always in variants; each item has its stock,
 * a new one says so, and those taken out are listed.
 */
import { useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Popover,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import FormatColorResetOutlinedIcon from "@mui/icons-material/FormatColorResetOutlined";
import { compressImage } from "../components/common/ImageUploader";
import { sanitizeAmountInput } from "../seller/productDraft";
import { priceDecimals, sanitizeFiatInput } from "../money/fiatPricing";
import { MAX_OPTION_TEXT, MAX_OPTION_VALUES, MAX_VARIANTS, MAX_VARIANT_OPTIONS, itemCount, variantLabel, type VariantDisplay, type VariantValue } from "./model";
import { NO_ROW, formItems, newFormOption, usedOptions, type VariantFormOption, type VariantFormValues } from "./drafts";
import { SWATCHES } from "./swatches";

export const EMPTY_VARIANTS: VariantFormValues = { options: [{ id: "v0", name: "", values: [], picture: null }], display: "bundle", rows: {} };

/** An edited group's product that is no longer one of its items. */
export interface RemovedItem {
  label: string;
  /** Never published: it just leaves the drafts. */
  draft: boolean;
}

/** The list with the item at `from` moved to `to`. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Drag to reorder a list: the dragged item takes the place of the one it is
 * dragged over. `kind` keeps one list's drags out of another's.
 */
function useReorder(kind: string, onMove: (from: number, to: number) => void) {
  const dragging = useRef<number | null>(null);
  return (index: number) => ({
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      dragging.current = index;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", `${kind}:${index}`);
    },
    onDragOver: (e: DragEvent) => {
      if (dragging.current === null) return;
      e.preventDefault();
      e.stopPropagation();
      if (dragging.current !== index) {
        onMove(dragging.current, index);
        dragging.current = index;
      }
    },
    onDragEnd: () => {
      dragging.current = null;
    },
  });
}

/** Alt + ← / → (or ↑ / ↓) moves the focused item; the keyboard's way to drag. */
function moveKeys(index: number, count: number, onMove: (from: number, to: number) => void, vertical = false) {
  return (e: KeyboardEvent) => {
    if (!e.altKey) return;
    const back = vertical ? "ArrowUp" : "ArrowLeft";
    const on = vertical ? "ArrowDown" : "ArrowRight";
    if (e.key === back && index > 0) {
      e.preventDefault();
      onMove(index, index - 1);
    } else if (e.key === on && index < count - 1) {
      e.preventDefault();
      onMove(index, index + 1);
    }
  };
}

/** A picture of its own: its thumbnail (tap to change, × to remove), or a button to add one. */
function PictureButton({ picture, label, onPick, onError }: { picture: string | null | undefined; label: string; onPick: (img: string | null) => void; onError?: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const choose = () => input.current?.click();
  return (
    <Box sx={{ position: "relative", flexShrink: 0 }}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onPick(await compressImage(file));
          } catch {
            onError?.("That image couldn't be read. Try another one.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {picture ? (
        <>
          <ButtonBase onClick={choose} aria-label={`Change the picture of ${label}`} sx={{ width: 44, height: 44, borderRadius: 1, overflow: "hidden", border: 1, borderColor: "primary.main" }}>
            <Box component="img" src={picture} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </ButtonBase>
          <IconButton
            size="small"
            aria-label={`Remove the picture of ${label}`}
            onClick={() => onPick(null)}
            sx={{ position: "absolute", top: -10, right: -10, width: 24, height: 24, bgcolor: "background.paper", border: 1, borderColor: "divider", "&:hover": { bgcolor: "background.paper" } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </>
      ) : (
        <Tooltip title="Add a picture">
          <IconButton aria-label={`Add a picture of ${label}`} onClick={choose} disabled={busy} sx={{ width: 44, height: 44, border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 1 }}>
            <AddPhotoAlternateOutlinedIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

/** A value's colour: the colours most products use, one of the seller's own, or none. */
function ColorPicker({ value, label, onChange }: { value: string | undefined; label: string; onChange: (color: string | undefined) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const custom = useRef<HTMLInputElement>(null);
  return (
    <>
      <IconButton
        size="small"
        aria-label={value ? `Colour of ${label}: change` : `Give ${label} a colour`}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ width: 28, height: 28, p: 0 }}
      >
        {value ? (
          <Box component="span" sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: value, border: 1, borderColor: "divider", display: "block" }} />
        ) : (
          <PaletteOutlinedIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { role: "dialog", "aria-label": `Colour of ${label}` } as never }}
      >
        <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1, maxWidth: 270 }}>
          <Box component="ul" aria-label="Colours" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 0.5 }}>
            {SWATCHES.map((s) => (
              <li key={s.color}>
                <ButtonBase
                  aria-label={s.name}
                  aria-pressed={value === s.color}
                  onClick={() => {
                    onChange(s.color);
                    setAnchor(null);
                  }}
                  sx={{ width: 32, height: 32, borderRadius: "50%", bgcolor: s.color, border: 2, borderColor: value === s.color ? "primary.main" : "divider" }}
                />
              </li>
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <input ref={custom} type="color" hidden aria-hidden tabIndex={-1} value={value ?? "#888888"} onChange={(e) => onChange(e.target.value.toLowerCase())} />
            <Button size="small" startIcon={<PaletteOutlinedIcon />} onClick={() => custom.current?.click()} sx={{ minHeight: 36 }}>
              Custom…
            </Button>
            {value && (
              <Button
                size="small"
                color="inherit"
                startIcon={<FormatColorResetOutlinedIcon />}
                onClick={() => {
                  onChange(undefined);
                  setAnchor(null);
                }}
                sx={{ minHeight: 36 }}
              >
                No colour
              </Button>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

function ValuesField({ label, values, onChange }: { label: string; values: VariantValue[]; onChange: (values: VariantValue[]) => void }) {
  const [text, setText] = useState("");
  const move = (from: number, to: number) => onChange(moved(values, from, to));
  const drag = useReorder(`values-${label}`, move);
  const add = () => {
    const next = [...values];
    for (const part of text
      .split(",")
      .map((v) => v.trim().slice(0, MAX_OPTION_TEXT))
      .filter(Boolean)) {
      if (!next.some((v) => v.name.toLowerCase() === part.toLowerCase()) && next.length < MAX_OPTION_VALUES) next.push({ name: part });
    }
    onChange(next);
    setText("");
  };
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      {values.length > 0 && (
        <Box component="ul" aria-label={`${label}: values`} sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {values.map((v, i) => (
            <Box
              component="li"
              key={v.name}
              draggable
              {...drag(i)}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, pl: 0.5, pr: 0.25, minHeight: 36, borderRadius: 999, border: 1, borderColor: "divider", bgcolor: "action.hover", cursor: "grab" }}
            >
              <ColorPicker value={v.color} label={v.name} onChange={(color) => onChange(values.map((x, j) => (j === i ? (color ? { ...x, color } : { name: x.name }) : x)))} />
              <Typography
                component="span"
                tabIndex={0}
                aria-label={`${v.name}: Alt and the arrow keys move it`}
                onKeyDown={moveKeys(i, values.length, move)}
                sx={{ px: 0.5, fontSize: 14, "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", borderRadius: 1 } }}
              >
                {v.name}
              </Typography>
              <IconButton size="small" aria-label={`Remove ${v.name}`} onClick={() => onChange(values.filter((_, j) => j !== i))} sx={{ width: 28, height: 28 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}
      <TextField
        size="small"
        label={`${label}: add values`}
        placeholder="Type, then Enter (or commas: Pale, Orange)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !text && values.length > 0) onChange(values.slice(0, -1));
        }}
        onBlur={() => text.trim() && add()}
        disabled={values.length >= MAX_OPTION_VALUES}
        slotProps={{
          htmlInput: { maxLength: 200 },
          input: {
            endAdornment: text.trim() ? (
              <InputAdornment position="end">
                <Button size="small" onClick={add}>
                  Add
                </Button>
              </InputAdornment>
            ) : undefined,
          },
        }}
      />
    </Box>
  );
}

function Swatch({ color }: { color?: string }) {
  if (!color) return null;
  return <Box component="span" aria-hidden sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: color, border: 1, borderColor: "divider", display: "inline-block", flexShrink: 0 }} />;
}

export function VariantsEditor({
  value,
  onChange,
  images,
  unit,
  basePrice,
  onImageError,
  group = null,
}: {
  /** null: no variants. */
  value: VariantFormValues | null;
  onChange: (next: VariantFormValues | null) => void;
  /** The product's pictures. */
  images: string[];
  /** The items' price unit: QORT, or the shop's currency. */
  unit: string;
  /** The product's price as typed, each item's when it has none of its own. */
  basePrice: string;
  onImageError?: (message: string) => void;
  /** Editing a published group: the products taken out of it so far. */
  group?: { removed: RemovedItem[] } | null;
}) {
  const on = value !== null;
  const form = value ?? EMPTY_VARIANTS;
  const set = (patch: Partial<VariantFormValues>) => onChange({ ...form, ...patch });
  const setOption = (i: number, patch: Partial<VariantFormOption>) => set({ options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOption = (from: number, to: number) => set({ options: moved(form.options, from, to) });
  const dragOption = useReorder("variants", moveOption);
  const used = usedOptions(form);
  const total = itemCount(used);
  const items = formItems(form);
  const cleanPrice = (text: string) => (unit === "QORT" ? sanitizeAmountInput(text) : sanitizeFiatInput(text, priceDecimals(unit)));
  const setRow = (key: string, patch: Partial<typeof NO_ROW>) => set({ rows: { ...form.rows, [key]: { ...(form.rows[key] ?? NO_ROW), ...patch } } });

  const section = (title: string, id: string, children: ReactNode) => (
    <Box>
      <Typography id={id} variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {group ? (
        <Typography variant="body2" color="text.secondary">
          Every item of this product changes together: its title, description, pictures and price, and the variants below.
        </Typography>
      ) : (
        <FormControlLabel
          control={<Switch checked={on} onChange={(_, next) => onChange(next ? EMPTY_VARIANTS : null)} />}
          label={
            <Box>
              <Typography sx={{ fontWeight: 600 }}>It comes in variants</Typography>
              <Typography variant="body2" color="text.secondary">
                Shapes, sizes, kits… each with its own values (colours, scents…), price, stock and picture.
              </Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", m: 0, gap: 1, "& .MuiSwitch-root": { mt: -0.5 } }}
        />
      )}
      {on && (
        <>
          <Box component="ol" aria-label="Variants and their values" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {form.options.map((option, i) => {
              const name = option.name.trim() || `Variant ${i + 1}`;
              return (
                <Box
                  component="li"
                  key={i}
                  {...dragOption(i)}
                  sx={{ display: "grid", gap: 1.5, alignItems: "start", gridTemplateColumns: { xs: "28px minmax(0, 1fr) 44px 44px", sm: "28px 200px minmax(0, 1fr) 44px 44px" } }}
                >
                  <Box
                    draggable
                    tabIndex={0}
                    role="button"
                    aria-label={`Move ${name}: drag, or Alt and the up or down arrow`}
                    onKeyDown={moveKeys(i, form.options.length, moveOption, true)}
                    sx={{ height: 40, display: "grid", placeItems: "center", color: "text.secondary", cursor: "grab", borderRadius: 1, "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main" } }}
                  >
                    <DragIndicatorIcon />
                  </Box>
                  <TextField
                    size="small"
                    label={`Variant ${i + 1}`}
                    placeholder={["Round", "Square", "Large"][i] ?? "Variant"}
                    value={option.name}
                    onChange={(e) => setOption(i, { name: e.target.value.slice(0, MAX_OPTION_TEXT) })}
                  />
                  <Box sx={{ gridColumn: { xs: "2 / -1", sm: "3" }, gridRow: { xs: "2", sm: "1" }, minWidth: 0 }}>
                    <ValuesField label={name} values={option.values} onChange={(values) => setOption(i, { values })} />
                  </Box>
                  <PictureButton picture={option.picture} label={name} onPick={(picture) => setOption(i, { picture })} onError={onImageError} />
                  <IconButton
                    aria-label={`Remove ${name}`}
                    onClick={() => (form.options.length === 1 ? onChange(null) : set({ options: form.options.filter((_, j) => j !== i) }))}
                    // A group keeps a variant (its last can't go: the product would have none).
                    disabled={!!group && form.options.length === 1}
                    sx={{ width: 44, height: 44 }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
          {form.options.length < MAX_VARIANT_OPTIONS && (
            <Button startIcon={<AddIcon />} onClick={() => set({ options: [...form.options, newFormOption()] })} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
              Add another variant
            </Button>
          )}
          <Typography variant="body2" color="text.secondary">
            A variant without values is one item (a gift box, say). A variant&apos;s picture is its items&apos;, unless an item has its own below. Drag a
            value or a variant to move it.
          </Typography>

          {section(
            "In the shop's lists",
            "variants-display-label",
            <>
              <ToggleButtonGroup
                exclusive
                value={form.display}
                onChange={(_, display: VariantDisplay | null) => display && set({ display })}
                aria-labelledby="variants-display-label"
                sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { minHeight: 44, px: 2, textTransform: "none" } }}
              >
                <ToggleButton value="bundle">One listing, buyers choose</ToggleButton>
                <ToggleButton value="separate">Each item on its own</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {form.display === "bundle"
                  ? "One card for the product, with its lowest price; buyers pick the variant and value on its page."
                  : "A card for each item, with its own picture; its page lets buyers switch to the others."}
              </Typography>
            </>
          )}

          {total > MAX_VARIANTS ? (
            <Typography role="alert" color="error">
              That makes {total} items: {MAX_VARIANTS} at most. Use fewer values.
            </Typography>
          ) : items.length > 0 ? (
            section(
              `Items (${items.length})`,
              "variants-items-label",
              <Box component="ul" aria-label="Items" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                {items.map(({ values: item, key }, i) => {
                  const row = form.rows[key] ?? NO_ROW;
                  const label = variantLabel(item);
                  const color = used.find((o) => o.name === item[0])?.values.find((v) => v.name === item[1])?.color;
                  const own = row.picture && !images.includes(row.picture) ? row.picture : null;
                  return (
                    <Box component="li" key={key} sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", p: 1, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: "1 1 160px", minWidth: 0 }}>
                        <Swatch color={color} />
                        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                          {label}
                          {i === 0 && (
                            <Typography component="span" variant="body2" color="text.secondary">
                              {" "}
                              · shows all the product&apos;s pictures
                            </Typography>
                          )}
                        </Typography>
                        {group && !row.productId && <Chip size="small" color="primary" variant="outlined" label="New" />}
                      </Box>
                      <TextField
                        size="small"
                        label="Price"
                        value={row.price}
                        onChange={(e) => setRow(key, { price: cleanPrice(e.target.value) })}
                        placeholder={basePrice || "Same"}
                        slotProps={{
                          htmlInput: { inputMode: "decimal", autoComplete: "off", "aria-label": `Price of ${label} in ${unit}` },
                          input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
                          inputLabel: { shrink: true },
                        }}
                        sx={{ width: 170 }}
                      />
                      <Box role="group" aria-label={`Picture of ${label}`} sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                        {images.length > 0 && (
                          <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={row.picture && images.includes(row.picture) ? row.picture : null}
                            onChange={(_, picture: string | null) => setRow(key, { picture })}
                            aria-label={`Pick a picture of ${label} from the product's`}
                            sx={{ flexWrap: "wrap", gap: 0.5, "& .MuiToggleButton-root": { p: 0.25, border: 1, borderColor: "divider", borderRadius: "8px !important" }, "& .Mui-selected": { borderColor: "primary.main" } }}
                          >
                            {images.map((img, n) => (
                              <ToggleButton key={n} value={img} aria-label={`The product's picture ${n + 1}`}>
                                <Box component="img" src={img} alt="" sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1, display: "block" }} />
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        )}
                        <PictureButton picture={own} label={label} onPick={(picture) => setRow(key, { picture })} onError={onImageError} />
                      </Box>
                      {group && row.productId && (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={row.status !== "OUT_OF_STOCK"}
                              onChange={(_, inStock) => setRow(key, { status: inStock ? "AVAILABLE" : "OUT_OF_STOCK" })}
                              slotProps={{ input: { "aria-label": `In stock: ${label}` } }}
                            />
                          }
                          label="In stock"
                          sx={{ m: 0, minHeight: 44 }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            )
          ) : (
            <Typography variant="body2" color="text.secondary">
              Name a variant: its items show here.
            </Typography>
          )}
          {group && group.removed.length > 0 && (
            <Box role="status" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "action.hover" }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Taken out: {group.removed.map((r) => r.label).join(", ")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {group.removed.every((r) => r.draft)
                  ? group.removed.length === 1
                    ? "It leaves your drafts when you save."
                    : "They leave your drafts when you save."
                  : group.removed.length === 1
                    ? "Saving retires it: buyers no longer see it, and it stays in Products, where you can delete it."
                    : "Saving retires them: buyers no longer see them, and they stay in Products, where you can delete them."}
              </Typography>
            </Box>
          )}
          {items.length > 0 && total <= MAX_VARIANTS && (
            <Typography variant="body2" color="text.secondary">
              Each item is a product of its own (so Q-Shop lists them too), named for its variant and value. An empty price is the product&apos;s. Its
              picture is its own, else its variant&apos;s, else the product&apos;s first; these come on top of the product&apos;s pictures.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
