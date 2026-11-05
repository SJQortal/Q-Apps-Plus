/**
 * An icon for each product category (constants/categories.ts), in a tinted
 * rounded square, used wherever a category shows: the product form, the
 * Products page's filter, shop pages' category chips, the product page and
 * the seller's product list. Colours come from the theme's palette, so every
 * theme gets its own; a category from before the list gets a plain tag.
 */
import type { ComponentType } from "react";
import { Box } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ChildFriendlyOutlinedIcon from "@mui/icons-material/ChildFriendlyOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import FactoryOutlinedIcon from "@mui/icons-material/FactoryOutlined";
import CheckroomOutlinedIcon from "@mui/icons-material/CheckroomOutlined";
import TollOutlinedIcon from "@mui/icons-material/TollOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import SpaOutlinedIcon from "@mui/icons-material/SpaOutlined";
import YardOutlinedIcon from "@mui/icons-material/YardOutlined";
import DiamondOutlinedIcon from "@mui/icons-material/DiamondOutlined";
import PetsOutlinedIcon from "@mui/icons-material/PetsOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import SportsSoccerOutlinedIcon from "@mui/icons-material/SportsSoccerOutlined";
import AirplaneTicketOutlinedIcon from "@mui/icons-material/AirplaneTicketOutlined";
import ToysOutlinedIcon from "@mui/icons-material/ToysOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { listedCategory, type ShopCategory } from "../constants/categories";

type Tone = "primary" | "secondary" | "success" | "warning" | "info" | "error";

export const CATEGORY_ICONS: Record<ShopCategory, { icon: ComponentType<SvgIconProps>; tone: Tone }> = {
  Baby: { icon: ChildFriendlyOutlinedIcon, tone: "info" },
  "Books, Movies & Music": { icon: MenuBookOutlinedIcon, tone: "secondary" },
  "Business & Industrial": { icon: FactoryOutlinedIcon, tone: "info" },
  "Clothing, Shoes & Accessories": { icon: CheckroomOutlinedIcon, tone: "secondary" },
  "Coins & Bullion": { icon: TollOutlinedIcon, tone: "warning" },
  "Collectibles & Art": { icon: PaletteOutlinedIcon, tone: "error" },
  "Digital Goods & Software": { icon: CloudDownloadOutlinedIcon, tone: "primary" },
  "Electronics & Computers": { icon: DevicesOutlinedIcon, tone: "primary" },
  "Food & Drink": { icon: RestaurantOutlinedIcon, tone: "warning" },
  "Gift Cards & Coupons": { icon: CardGiftcardOutlinedIcon, tone: "error" },
  "Health & Beauty": { icon: SpaOutlinedIcon, tone: "success" },
  "Home & Garden": { icon: YardOutlinedIcon, tone: "success" },
  "Jewelry & Watches": { icon: DiamondOutlinedIcon, tone: "secondary" },
  "Pet Supplies": { icon: PetsOutlinedIcon, tone: "warning" },
  Services: { icon: HandymanOutlinedIcon, tone: "info" },
  "Sporting Goods": { icon: SportsSoccerOutlinedIcon, tone: "success" },
  "Tickets & Travel": { icon: AirplaneTicketOutlinedIcon, tone: "primary" },
  "Toys & Hobbies": { icon: ToysOutlinedIcon, tone: "error" },
  "Vehicles & Parts": { icon: DirectionsCarOutlinedIcon, tone: "info" },
  "Everything Else": { icon: CategoryOutlinedIcon, tone: "secondary" },
};

/** The icon for a category (any spelling of a listed one), or a plain tag for one from before the list. */
/**
 * `round` for a chip: a circle sits inside the chip's rounded end. A chip
 * passes its icon class (`className`), which places the icon in it.
 */
export function CategoryIcon({
  category,
  size = 28,
  round = false,
  className,
}: {
  category: string | null | undefined;
  size?: number;
  round?: boolean;
  className?: string;
}) {
  const listed = listedCategory(category);
  const entry = listed ? CATEGORY_ICONS[listed] : null;
  const Icon = entry?.icon ?? LabelOutlinedIcon;
  return (
    <Box
      component="span"
      aria-hidden
      className={className}
      sx={(theme: Theme) => {
        const tone = entry ? theme.palette[entry.tone].main : theme.palette.text.secondary;
        return {
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: round ? "50%" : `${Math.round(size * 0.3)}px`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: tone,
          bgcolor: alpha(tone, theme.palette.mode === "dark" ? 0.2 : 0.12),
        };
      }}
    >
      {/* Its own colour: a chip's icon class sets one on the circle. */}
      <Icon sx={(theme: Theme) => ({ fontSize: Math.round(size * 0.64), color: entry ? theme.palette[entry.tone].main : theme.palette.text.secondary })} />
    </Box>
  );
}
