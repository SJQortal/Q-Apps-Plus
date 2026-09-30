import { IconButton, InputAdornment } from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";

interface ClearFieldButtonProps {
  /** Discards the field's text. */
  onClear: () => void;
  /** Accessible name, e.g. "Clear the title search". */
  label?: string;
}

/**
 * The ✕ at the end of a search field, shown while it has text. It keeps the
 * focus in the field (so a phone keeps its keyboard) and is a 44 px target on
 * phones. Use it as `slotProps.input.endAdornment`.
 */
export function ClearFieldButton({ onClear, label = "Clear the search" }: ClearFieldButtonProps) {
  return (
    <InputAdornment position="end">
      <IconButton
        aria-label={label}
        edge="end"
        size="small"
        // Keep focus (and the phone keyboard) in the field.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClear}
        sx={{ [`@media ${PHONE_MEDIA}`]: { minWidth: 44, minHeight: 44 } }}
      >
        <ClearIcon fontSize="small" />
      </IconButton>
    </InputAdornment>
  );
}
