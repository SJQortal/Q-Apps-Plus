import { useState } from "react";
import { Box, IconButton, InputBase } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { MAX_QUANTITY } from "../../state/features/cartSlice";

/**
 * − [n] +, with a field for typing a number (numeric keyboard on phones).
 * Never goes below 1: Remove takes a line out (with Undo).
 */
export function QuantityStepper({
  quantity,
  onChange,
  itemName,
  disabled,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  /** For the buttons' names: "Fewer Mug". */
  itemName: string;
  disabled?: boolean;
}) {
  // What the buyer is typing; null shows the cart's quantity.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const next = Math.floor(Number(draft));
    setDraft(null);
    if (Number.isFinite(next) && next >= 1 && next !== quantity) onChange(Math.min(next, MAX_QUANTITY));
  };

  return (
    <Box
      role="group"
      aria-label={`Quantity of ${itemName}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        border: 1,
        borderColor: "divider",
        borderRadius: 999,
        bgcolor: "background.paper",
      }}
    >
      <IconButton
        aria-label={`Fewer ${itemName}`}
        onClick={() => onChange(quantity - 1)}
        disabled={disabled || quantity <= 1}
        sx={{ width: 44, height: 44 }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <InputBase
        value={draft ?? String(quantity)}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        disabled={disabled}
        inputProps={{
          inputMode: "numeric",
          pattern: "[0-9]*",
          "aria-label": `Quantity of ${itemName}`,
          style: { textAlign: "center", width: 32, padding: 0, fontWeight: 600 },
        }}
      />
      <IconButton
        aria-label={`More ${itemName}`}
        onClick={() => onChange(quantity + 1)}
        disabled={disabled || quantity >= MAX_QUANTITY}
        sx={{ width: 44, height: 44 }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
