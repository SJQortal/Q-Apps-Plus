/**
 * The seller's status form inside the order dialog: Received / Shipped /
 * Refunded and a note for the buyer. The dialog's main button sends it
 * (ShowOrder); this holds the draft.
 */
import { Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ORDER_STATUSES, normalizeStatus } from "../../../orders/status";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";

export interface StatusDraft {
  status: string;
  note: string;
}

export function StatusEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: StatusDraft;
  onChange: (draft: StatusDraft) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={normalizeStatus(draft.status)}
        onChange={(_, value: string | null) => {
          if (value) onChange({ ...draft, status: value });
        }}
        aria-label="Order status"
        disabled={disabled}
        sx={{
          "& .MuiToggleButton-root": {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 600,
            [`@media ${PHONE_MEDIA}`]: { minHeight: 44 },
          },
        }}
      >
        {ORDER_STATUSES.map((status) => (
          <ToggleButton key={status} value={status}>
            {status}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <TextField
        label="Note for the buyer"
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        disabled={disabled}
        helperText="Tracking number, refund details… Only you and the buyer can read it."
      />
      <Typography variant="body2" color="text.secondary">
        Updating publishes a small encrypted note under your name. Hub asks you to confirm it and its fee.
      </Typography>
    </Box>
  );
}
