/**
 * A shop's policies (policies.ts) where buyers decide: its dispatch time and
 * returns as short lines, and its own words on returns and its terms behind
 * "Policies". `full` shows the words too (the shop's details).
 */
import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { dispatchText, policiesOf, returnsText, type ShopPolicies } from "./policies";
import { languagesOf, languagesText } from "./languages";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";

const lineSx = { display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 } as const;

function Words({ policies }: { policies: ShopPolicies }) {
  return (
    <>
      {policies.returns && (
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Returns and refunds</Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{policies.returns}</Typography>
        </Box>
      )}
      {policies.terms && (
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Other terms</Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{policies.terms}</Typography>
        </Box>
      )}
    </>
  );
}

export function PolicyLines({
  shop,
  digital = false,
  full = false,
  hideLanguages = false,
}: {
  shop: { policies?: unknown; languages?: unknown; title?: string } | null | undefined;
  /** Nothing is dispatched: dispatch time doesn't apply. */
  digital?: boolean;
  full?: boolean;
  /** The languages are shown elsewhere (the shop page's header shows them under its logo). */
  hideLanguages?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const policies = policiesOf(shop) ?? {};
  const dispatch = digital ? null : dispatchText(policies);
  const returns = returnsText(policies);
  const words = !!(policies.returns || policies.terms);
  // The languages its seller answers in (shop/languages.ts), with the rest of how the shop works.
  const languages = hideLanguages ? [] : languagesOf(shop);
  if (!dispatch && !returns && !words && languages.length === 0) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
      {languages.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={lineSx}>
          <TranslateOutlinedIcon fontSize="small" aria-hidden />
          <span>Answers in {languagesText(languages)}</span>
        </Typography>
      )}
      {dispatch && (
        <Typography variant="body2" color="text.secondary" sx={lineSx}>
          <ScheduleOutlinedIcon fontSize="small" aria-hidden />
          <span>{dispatch}</span>
        </Typography>
      )}
      {returns && (
        <Typography variant="body2" color="text.secondary" sx={lineSx}>
          <AssignmentReturnOutlinedIcon fontSize="small" aria-hidden />
          <span>{returns}</span>
        </Typography>
      )}
      {words &&
        (full ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
            <Words policies={policies} />
          </Box>
        ) : (
          <>
            <Box sx={lineSx}>
              <GavelOutlinedIcon fontSize="small" aria-hidden sx={{ color: "text.secondary", mt: 0.75 }} />
              <Button size="small" onClick={() => setOpen(true)} aria-haspopup="dialog" sx={{ minHeight: 32, px: 0.75, ml: -0.75, textTransform: "none", fontWeight: 600 }}>
                {policies.returns && policies.terms ? "Returns and terms" : policies.returns ? "Returns and refunds" : "Terms"}
              </Button>
            </Box>
            <ResponsiveDialog open={open} onClose={() => setOpen(false)} title={`${shop?.title || "The shop"}'s policies`} maxWidth="sm">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {(languages.length > 0 || dispatch || returns) && (
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {languages.length > 0 && <li>Answers in {languagesText(languages)}</li>}
                    {dispatch && <li>{dispatch}</li>}
                    {returns && <li>{returns}</li>}
                  </Box>
                )}
                <Words policies={policies} />
              </Box>
            </ResponsiveDialog>
          </>
        ))}
    </Box>
  );
}
