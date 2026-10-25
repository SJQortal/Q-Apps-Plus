/**
 * Adding or changing a discount code (discounts/): the code (or Random), a
 * percentage off and/or free delivery, and its limits: chosen products, the
 * days it runs, a minimum order in the shop's currency, the Qortal names it's
 * for (seller/DiscountNames.tsx). A discount for names needs no code: those
 * buyers' checkouts apply it.
 */
import { useState } from "react";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, Checkbox, FormControlLabel, InputAdornment, Radio, RadioGroup, TextField, Typography } from "@mui/material";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { CODE_PATTERN, MAX_PERCENT, discountNames, normalizeCode } from "../discounts/model";
import { DiscountNamesField } from "./DiscountNames";
import { mapWithConcurrency } from "../qdn/search";
import { dayToTime, draftNames, hiddenNames, randomCode, timeToDay, type DiscountDraft } from "../discounts/drafts";
import { nameOwner } from "../orders/reads";
import { parseAmount, sanitizeAmountInput } from "./productDraft";
import { DeliveryProductsDialog } from "./DeliveryProductsDialog";
import { DateField } from "../components/common/DateTimeFields";

const newId = new ShortUniqueId({ length: 8 });

export function DiscountDialog({
  draft,
  currency,
  takenCodes,
  onSave,
  onClose,
}: {
  /** The discount to change; null for a new one. */
  draft: DiscountDraft | null;
  /** What a minimum order is in: "QORT" or the shop's pricing currency. */
  currency: string;
  /** The other discounts' codes (a code is used once). */
  takenCodes: readonly string[];
  onSave: (draft: DiscountDraft) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(draft?.codeText ?? "");
  const [names, setNames] = useState<string[]>(() => (draft ? draftNames(draft) : []));
  // Names known to exist (saved before, suggested by the node, or a group's): only typed ones are checked.
  const [known, setKnown] = useState<Set<string>>(() => new Set((draft ? draftNames(draft) : []).map((n) => n.toLowerCase())));
  const [percent, setPercent] = useState(draft ? String(draft.percent) : "10");
  const [freeDelivery, setFreeDelivery] = useState(!!draft?.freeDelivery);
  const [some, setSome] = useState(!!draft?.products);
  const [products, setProducts] = useState<string[]>(draft?.products ?? []);
  const [picking, setPicking] = useState(false);
  const [starts, setStarts] = useState(timeToDay(draft?.starts));
  const [ends, setEnds] = useState(timeToDay(draft?.ends));
  const [minTotal, setMinTotal] = useState(draft?.minTotal !== undefined ? String(draft.minTotal) : "");
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // A code set on another device whose list couldn't be read here: kept unless a new one is typed.
  const hiddenCode = !!draft?.code && !draft.codeText;
  // The same for names set elsewhere: they stay unless names are added here.
  const hiddenName = !!draft && hiddenNames(draft);

  const save = async () => {
    setProblem(null);
    const typed = normalizeCode(code);
    const percentValue = Number(percent);
    if (!Number.isInteger(percentValue) || percentValue < 0 || percentValue > MAX_PERCENT) return setProblem(`The percentage is a whole number from 0 to ${MAX_PERCENT}.`);
    if (percentValue === 0 && !freeDelivery) return setProblem("Take something off: a percentage, free delivery, or both.");
    if (typed && !CODE_PATTERN.test(typed)) return setProblem("A code is 3 to 24 letters or digits (and - or _).");
    if (typed && takenCodes.includes(typed)) return setProblem("You have this code already.");
    if (!typed && !hiddenCode && names.length === 0 && !hiddenName) return setProblem("Give it a code, or the Qortal names it's for.");
    if (some && products.length === 0) return setProblem("Choose the products, or pick Every product.");
    const startTime = starts ? dayToTime(starts, false) : undefined;
    const endTime = ends ? dayToTime(ends, true) : undefined;
    if (startTime !== undefined && endTime !== undefined && endTime < startTime) return setProblem("It ends before it starts.");
    const least = minTotal.trim() ? parseAmount(minTotal) : undefined;
    if (least !== undefined && !(least > 0)) return setProblem("A minimum order is an amount over nothing, or leave it empty.");
    const unchecked = names.filter((n) => !known.has(n.toLowerCase()));
    if (unchecked.length > 0) {
      setChecking(true);
      const found = await mapWithConcurrency(unchecked, 4, (n) =>
        nameOwner(n).then(
          () => true,
          () => false
        )
      );
      setChecking(false);
      const missing = unchecked.filter((_, i) => !found[i]);
      if (missing.length > 0) return setProblem(missing.length === 1 ? `There's no Qortal name ${missing[0]}.` : `These aren't Qortal names: ${missing.join(", ")}.`);
    }
    const next: DiscountDraft = {
      id: draft?.id ?? newId(),
      percent: percentValue,
      ...(freeDelivery && { freeDelivery: true as const }),
      ...(startTime !== undefined && { starts: startTime }),
      ...(endTime !== undefined && { ends: endTime }),
      ...(least !== undefined && { minTotal: least }),
      ...(some && { products }),
      ...(draft?.paused && { paused: true as const }),
      // A new code replaces the old; none typed keeps a code set elsewhere.
      ...(typed ? { codeText: typed } : hiddenCode && draft?.code ? { code: draft.code } : {}),
      ...(names.length > 0
        ? { nameTexts: names }
        : hiddenName && draft
          ? { ...(draft.forName && { forName: draft.forName }), ...(draft.forNames && { forNames: draft.forNames }) }
          : {}),
    };
    onSave(next);
  };

  return (
    <>
      <ResponsiveDialog
        open
        onClose={onClose}
        title={draft ? "Change discount" : "Add a discount code"}
        maxWidth="sm"
        actions={
          <>
            <Button color="inherit" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void save()} disabled={checking}>
              {checking ? "Checking the names…" : draft ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField
              label="Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={hiddenCode ? "Kept as it is" : "SPRING10"}
              helperText={
                hiddenCode
                  ? "Set on another device: type a new one to change it, or leave it empty to keep it."
                  : "Anyone who knows it can use it. A word like SALE10 can be guessed: Random makes a private one."
              }
              slotProps={{ htmlInput: { maxLength: 24, autoCapitalize: "characters", autoComplete: "off", spellCheck: false }, inputLabel: { shrink: true } }}
              sx={{ flex: "1 1 220px" }}
            />
            <Button variant="outlined" color="inherit" startIcon={<CasinoOutlinedIcon />} onClick={() => setCode(randomCode())} sx={{ minHeight: 56 }}>
              Random
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField
              label="Percent off"
              value={percent}
              onChange={(e) => setPercent(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              slotProps={{ htmlInput: { inputMode: "numeric" }, input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
              helperText={`0 to ${MAX_PERCENT}`}
              sx={{ flex: "0 1 160px" }}
            />
            <FormControlLabel control={<Checkbox checked={freeDelivery} onChange={(e) => setFreeDelivery(e.target.checked)} />} label="Free delivery too" sx={{ minHeight: 56, m: 0 }} />
          </Box>

          <Box component="fieldset" sx={{ border: 0, m: 0, p: 0 }}>
            <Typography component="legend" variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Products
            </Typography>
            <RadioGroup value={some ? "some" : "all"} onChange={(e) => setSome(e.target.value === "some")}>
              <FormControlLabel value="all" control={<Radio />} label="Every product" sx={{ m: 0, minHeight: 44 }} />
              <FormControlLabel value="some" control={<Radio />} label="Only some products" sx={{ m: 0, minHeight: 44 }} />
            </RadioGroup>
            {some && (
              <Button variant="outlined" color="inherit" onClick={() => setPicking(true)} sx={{ minHeight: 44, mt: 0.5 }}>
                {products.length === 0 ? "Choose products" : products.length === 1 ? "1 product: change" : `${products.length} products: change`}
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <DateField label="Starts (optional)" value={starts} onChange={setStarts} sx={{ flex: "1 1 180px" }} />
            <DateField label="Ends (optional)" value={ends} onChange={setEnds} min={starts || undefined} sx={{ flex: "1 1 180px" }} />
          </Box>
          <TextField
            label="Minimum order (optional)"
            value={minTotal}
            onChange={(e) => setMinTotal(sanitizeAmountInput(e.target.value))}
            helperText="What the products must come to before it applies."
            slotProps={{ htmlInput: { inputMode: "decimal" }, input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> } }}
          />
          <DiscountNamesField
            names={names}
            onChange={setNames}
            onKnown={(more) => setKnown((prev) => new Set([...prev, ...more.map((n) => n.toLowerCase())]))}
            hidden={hiddenName && draft ? discountNames(draft).length : 0}
          />
          {problem && (
            <Alert severity="error" role="alert">
              {problem}
            </Alert>
          )}
        </Box>
      </ResponsiveDialog>
      {picking && (
        <DeliveryProductsDialog
          profileName=""
          title="Products for this code"
          intro="The code takes its percentage off these products only; free delivery still covers the whole delivery."
          picked={products}
          onSave={(picked) => {
            setProducts(picked);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
