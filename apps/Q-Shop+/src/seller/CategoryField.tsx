/**
 * The product form's category: one of the list (constants/categories.ts),
 * each with its icon, found by typing either its name or a thing it holds
 * ("glasses" → Health & Beauty, utils/categoryMatch.ts), with the word that
 * matched beside it. A product's category from before the list stays
 * offered while it is edited, last, marked "its category now".
 */
import { useMemo } from "react";
import { Autocomplete, Box, InputAdornment, TextField, Typography } from "@mui/material";
import { SHOP_CATEGORIES } from "../constants/categories";
import { CategoryIcon } from "../components/CategoryIcon";
import { searchCategories } from "../utils/categoryMatch";

export function CategoryField({
  value,
  inputValue,
  onInputChange,
  onPick,
  oldCategory,
  helperText,
}: {
  value: string;
  inputValue: string;
  onInputChange: (text: string) => void;
  onPick: (category: string) => void;
  /** The product's category from before the list, kept while it is edited. */
  oldCategory?: string | null;
  helperText: string;
}) {
  const options = useMemo(() => [...SHOP_CATEGORIES, ...(oldCategory ? [oldCategory] : [])], [oldCategory]);
  // What the seller typed (not the picked category's own name): search it.
  const typed = inputValue.trim() && inputValue !== value ? inputValue : "";
  const hits = useMemo(() => (typed ? searchCategories(typed) : []), [typed]);
  const via = useMemo(() => new Map(hits.map((h) => [h.category as string, h.via])), [hits]);

  return (
    <Autocomplete<string, false, true, false>
      // The list stays inside the dialog (its landmark).
      disablePortal
      options={options}
      value={value || null!}
      disableClearable
      autoHighlight
      openOnFocus
      inputValue={inputValue}
      onInputChange={(_e, text) => onInputChange(text)}
      onChange={(_e, picked) => picked && onPick(picked)}
      filterOptions={(all) => {
        if (!typed) return all;
        const found = hits.map((h) => h.category as string);
        const old = oldCategory && oldCategory.toLowerCase().includes(typed.trim().toLowerCase()) ? [oldCategory] : [];
        return [...found, ...old];
      }}
      noOptionsText={`No category for “${typed.trim()}”: pick the closest, or Everything Else`}
      renderOption={({ key, ...props }, option) => {
        const word = via.get(option);
        return (
          <li key={key} {...props} style={{ ...props.style, minHeight: 48 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%", minWidth: 0 }}>
              <CategoryIcon category={option} size={30} />
              <Typography sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{option}</Typography>
              {word ? (
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {`“${word}”`}
                </Typography>
              ) : option === oldCategory ? (
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  its category now
                </Typography>
              ) : null}
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Category"
          required
          placeholder="Type what it is, e.g. glasses"
          helperText={helperText}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: value ? (
                <InputAdornment position="start" sx={{ ml: 0.5 }}>
                  <CategoryIcon category={value} size={26} />
                </InputAdornment>
              ) : undefined,
            },
            htmlInput: { ...params.slotProps.htmlInput, autoComplete: "off" },
          }}
          sx={{ "& .MuiInputBase-root": { minHeight: 56 } }}
        />
      )}
    />
  );
}
