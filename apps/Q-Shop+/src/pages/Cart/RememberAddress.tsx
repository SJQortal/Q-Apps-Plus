import { Checkbox, FormControlLabel, FormHelperText, Box } from "@mui/material";

/** "Remember this address on this device" under a checkout's delivery form (delivery.ts saveDelivery). */
export function RememberAddress({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <Box>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />}
        label="Remember this address on this device"
        sx={{ minHeight: 44, mr: 0 }}
      />
      <FormHelperText sx={{ mt: -0.5, ml: 4 }}>Kept only here for your next checkout, never published. Untick it to forget it.</FormHelperText>
    </Box>
  );
}
