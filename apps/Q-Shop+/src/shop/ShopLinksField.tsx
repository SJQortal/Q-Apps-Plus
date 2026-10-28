/**
 * The shop form's links (shop/links.ts): up to four qortal:// addresses,
 * each with an optional name, and a preview of the cards buyers see under
 * the description.
 */
import { Box, Button, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import AddLinkOutlinedIcon from "@mui/icons-material/AddLinkOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { MAX_LINK_LABEL, MAX_SHOP_LINKS, isShopLinkUrl, shopLinksOf } from "./links";
import { ShopLinks } from "./ShopLinks";

type Row = { url: string; label: string };

export function ShopLinksField({ links, onChange }: { links: Row[]; onChange: (links: Row[]) => void }) {
  const setRow = (i: number, patch: Partial<Row>) => onChange(links.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const preview = shopLinksOf({ links: links.map((l) => ({ url: l.url.trim(), label: l.label })) });
  return (
    <Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box component="legend" sx={{ p: 0, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 600 }}>Links</Typography>
        <Typography variant="body2" color="text.secondary">
          Your Q-Apps or websites on Qortal, shown under the description with their avatars. Copy the address from Hub (it starts with qortal://).
        </Typography>
      </Box>
      {links.map((row, i) => {
        const url = row.url.trim();
        const bad = url !== "" && !isShopLinkUrl(url);
        return (
          <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: { xs: "wrap", sm: "nowrap" } }}>
            <TextField
              label="Address"
              value={row.url}
              onChange={(e) => setRow(i, { url: e.target.value.replace(/\s+/g, "") })}
              placeholder="qortal://APP/Your-App"
              error={bad}
              helperText={bad ? "Starts with qortal://" : undefined}
              sx={{ flex: { xs: "1 1 100%", sm: "2 1 0" }, minWidth: 0 }}
            />
            <TextField
              label="Name (optional)"
              value={row.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              slotProps={{ htmlInput: { maxLength: MAX_LINK_LABEL } }}
              sx={{ flex: "1 1 0", minWidth: 0 }}
            />
            <Tooltip title="Remove">
              <IconButton aria-label={`Remove link ${i + 1}`} onClick={() => onChange(links.filter((_, j) => j !== i))} sx={{ width: 44, height: 44, mt: 0.5 }}>
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
      {links.length < MAX_SHOP_LINKS && (
        <Button
          variant="outlined"
          startIcon={<AddLinkOutlinedIcon />}
          onClick={() => onChange([...links, { url: "", label: "" }])}
          sx={{ alignSelf: "flex-start", minHeight: 44 }}
        >
          {links.length === 0 ? "Add a link" : "Add another link"}
        </Button>
      )}
      {preview.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
            On your shop page
          </Typography>
          <ShopLinks links={preview} />
        </Box>
      )}
    </Box>
  );
}
