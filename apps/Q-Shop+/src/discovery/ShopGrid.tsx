/**
 * The home page's grid of shop cards: one column on phones, then 2, 3 and 4
 * as the window widens (docs/DESIGN.md → Layout: grids widen on desktop), and
 * placeholder cards of the same shape while the first shops load.
 */
import { Box, Skeleton } from "@mui/material";
import { styled } from "@mui/material/styles";
import { LANDSCAPE_PHONE_MEDIA } from "../hooks/usePhoneLayout";

/** The logo panel's height; shorter on a phone held sideways (the frame is ~266 px tall in Hub). */
export const CARD_ART_HEIGHT = { phone: 148, wide: 164, landscape: 104 } as const;

export const ShopGridList = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(0, 1fr)",
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 },
  [theme.breakpoints.up("md")]: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20 },
}));

export function ShopGridSkeleton({ count, label = "Loading shops" }: { count: number; label?: string }) {
  return (
    <ShopGridList aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          component="li"
          key={i}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: "background.paper",
          }}
        >
          <Skeleton
            variant="rectangular"
            sx={{
              height: { xs: CARD_ART_HEIGHT.phone, sm: CARD_ART_HEIGHT.wide },
              [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { height: CARD_ART_HEIGHT.landscape },
            }}
          />
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Skeleton variant="text" sx={{ fontSize: 18, width: "70%" }} />
            <Skeleton variant="text" sx={{ fontSize: 14 }} />
            <Skeleton variant="text" sx={{ fontSize: 14, width: "85%" }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Skeleton variant="circular" width={22} height={22} />
              <Skeleton variant="text" sx={{ fontSize: 14, width: "40%" }} />
            </Box>
          </Box>
        </Box>
      ))}
    </ShopGridList>
  );
}
