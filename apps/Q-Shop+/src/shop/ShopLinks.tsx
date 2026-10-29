/**
 * The shop's links (shop/links.ts) as cards: the app's or website's avatar,
 * the seller's name for it (or its own) and what it is; a press opens it in
 * a new Hub tab (qdn/openQortalLink.ts).
 */
import { Box, ButtonBase, Typography } from "@mui/material";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { NameAvatar } from "../components/common/NameAvatar";
import { accentWash } from "../hub-theme";
import { useOpenQortalLink } from "../richtext/QortalText";
import { shopLinkTarget, type ShopLink } from "./links";

export function ShopLinks({ links }: { links: readonly ShopLink[] }) {
  const open = useOpenQortalLink();
  if (links.length === 0) return null;
  return (
    <Box
      component="ul"
      aria-label="Links"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(260px, 1fr))" } }}
    >
      {links.map((link) => {
        const target = shopLinkTarget(link.url);
        const title = link.label || target.name;
        return (
          <li key={link.url}>
            <ButtonBase
              component="a"
              href={link.url}
              onClick={(event) => open(event, link.url)}
              title="Opens in a new tab"
              sx={(theme) => ({
                width: "100%",
                minHeight: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 1.5,
                px: 1.5,
                py: 1,
                textAlign: "left",
                borderRadius: 2,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                color: "text.primary",
                transition: theme.transitions.create(["background-color", "border-color"]),
                "&:hover": { bgcolor: accentWash(theme, 0.08), borderColor: "primary.main" },
                "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineOffset: 2 },
              })}
            >
              <NameAvatar name={target.name} size={40} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {link.label && link.label !== target.name ? `${target.kind} · ${target.name}` : target.kind}
                </Typography>
              </Box>
              <OpenInNewOutlinedIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
            </ButtonBase>
          </li>
        );
      })}
    </Box>
  );
}
