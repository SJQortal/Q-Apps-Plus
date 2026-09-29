import type { SvgIconComponent } from "@mui/icons-material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

export interface NavItem {
  label: string;
  path: string;
  Icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Buy", path: "/", Icon: ShoppingCartOutlinedIcon },
  { label: "Sell", path: "/sell", Icon: SellOutlinedIcon },
  { label: "History", path: "/history", Icon: HistoryOutlinedIcon },
  { label: "Settings", path: "/settings", Icon: SettingsOutlinedIcon },
];

export function isNavActive(pathname: string, path: string): boolean {
  if (path === "/") return pathname === "/" || pathname === "";
  return pathname === path || pathname.startsWith(`${path}/`);
}
