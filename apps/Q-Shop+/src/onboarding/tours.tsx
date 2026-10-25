/**
 * What the walkthrough says (Simon, 2026-10-25: "when people open it for the
 * first time to give them a walk through of what is new, how to do things,
 * and especially walk them through how to sell at our new shop with all new
 * features"). Two tours: Welcome, for everyone on their first visit, and the
 * seller guide, from Manage Shop and Settings.
 */
import type { ReactNode } from "react";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SearchIcon from "@mui/icons-material/Search";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";

export type TourId = "welcome" | "seller";

export interface TourStep {
  id: string;
  icon: ReactNode;
  title: string;
  intro: string;
  /** Short points, each with a few words in bold first. */
  points: [string, string][];
}

export const TOURS: Record<TourId, { title: string; steps: TourStep[] }> = {
  welcome: {
    title: "Welcome to Q-Shop+",
    steps: [
      {
        id: "welcome",
        icon: <StorefrontOutlinedIcon />,
        title: "Every Qortal shop in one place",
        intro: "Q-Shop+ is the marketplace of Qortal: buy straight from sellers, with nothing in between.",
        points: [
          ["Pay the seller directly", "in QORT, Pirate Chain (ARRR) or Qortal assets (Q-Assets). Q-Shop+ never holds your money."],
          ["Same shops as Q-Shop", "everything lives on Qortal, so every shop, order and review from Q-Shop is here too."],
          ["New", "delivery prices and options, stock counts, auctions, names for sale, favourites, and a lot more."],
        ],
      },
      {
        id: "find",
        icon: <SearchIcon />,
        title: "Find what you want",
        intro: "Look across every shop at once, or browse one.",
        points: [
          ["Products", "every shop's products together: search, categories, a price range, In stock only and Auctions."],
          ["Shops", "sort by newest, top rated or most loved, and filter by the coin they take."],
          ["Favourites", "tap the heart to keep a shop or a product; they wait for you behind the heart at the top."],
          ["Product pages", "up to 10 pictures, videos and PDFs, and the price in every coin the shop takes."],
        ],
      },
      {
        id: "buy",
        icon: <ShoppingCartOutlinedIcon />,
        title: "Buy with confidence",
        intro: "From cart to doorstep, you see where things stand.",
        points: [
          ["One cart", "for every shop: check out one shop, or all of them at once."],
          ["Delivery", "priced for your address before you pay; pick Standard, Express or a pickup when the shop offers them."],
          ["Your order", "is encrypted to you and the seller; Hub asks you to confirm each payment."],
          ["My orders", "shows the seller's status and notes. Mark it delivered when it arrives, then review the shop."],
        ],
      },
      {
        id: "more",
        icon: <GavelOutlinedIcon />,
        title: "Auctions and names",
        intro: "Some things sell to the highest bidder.",
        points: [
          ["Auctions", "bid on a product's page; a late bid extends the auction, and the winner pays through the usual checkout."],
          ["Names", "buy and sell Qortal names with everything published under them, at a price or by auction."],
        ],
      },
      {
        id: "sell",
        icon: <SellOutlinedIcon />,
        title: "Sell on Q-Shop+",
        intro: "Open a shop in minutes, and reach every Qortal user.",
        points: [
          ["Products", "a category from one shared list, 10 pictures, videos and PDFs, variants with colours, stock counts, or an auction."],
          ["Delivery", "prices by country with options like Express or Local pickup; shipping profiles for heavy items."],
          ["Prices", "in QORT, or in your currency (USD…) with QORT that follows your rates; take ARRR and Q-Assets too."],
          ["Orders", "arrive by Q-Mail and in Manage Shop, where you update their status for the buyer."],
        ],
      },
      {
        id: "existing",
        icon: <AutoFixHighOutlinedIcon />,
        title: "Already have a shop?",
        intro: "It works as before, and a checkup brings it up to date.",
        points: [
          ["Manage Shop", "opens with a checkup of what to update, each in a few taps."],
          ["Categories", "pick them from the shared list: each product's is suggested from its title."],
          ["Shipping", "turn your Ships to text into countries, set delivery prices, and retire products you used to charge delivery."],
        ],
      },
    ],
  },
  seller: {
    title: "How selling works",
    steps: [
      {
        id: "products",
        icon: <AddPhotoAlternateOutlinedIcon />,
        title: "1. Add your products",
        intro: "Manage Shop → Products → Add product.",
        points: [
          ["Title and category", "type what it is and a category is suggested from the shared list."],
          ["Pictures and description", "up to 10 pictures; add a video or a PDF to the description."],
          ["Price", "in QORT, or in your shop's currency (USD…) once you set rates under Shop Settings → Prices."],
          ["Options", "variants (sizes, colours), Count stock so it sells out by itself, or an auction."],
        ],
      },
      {
        id: "publish",
        icon: <PublishOutlinedIcon />,
        title: "2. Publish",
        intro: "What you add or change waits in Ready to publish.",
        points: [
          ["Publish together", "all your changes go out at once; Hub asks you to confirm and shows the small fee."],
          ["Edit any time", "changes wait as drafts until you publish them."],
        ],
      },
      {
        id: "delivery",
        icon: <LocalShippingOutlinedIcon />,
        title: "3. Set up delivery",
        intro: "Buyers see what delivery costs before they pay.",
        points: [
          ["Where you ship", "Shop Settings → Edit shop: tick regions and countries (and US states)."],
          ["Delivery prices", "the Delivery tab: zones by country with a price for the first item, each extra item, and free delivery from an amount."],
          ["Options", "add Express, Local pickup or Tracked, and price each in the zones that offer it."],
          ["Profiles", "give heavy or fragile products their own prices."],
        ],
      },
      {
        id: "paid",
        icon: <AccountBalanceWalletOutlinedIcon />,
        title: "4. Get paid",
        intro: "Buyers pay you directly.",
        points: [
          ["Coins", "QORT always; switch on Pirate Chain (ARRR) with your address, and Q-Assets, in Edit shop."],
          ["The order", "arrives by Q-Mail and in Orders, encrypted so only you and the buyer can read it."],
        ],
      },
      {
        id: "orders",
        icon: <ReceiptLongOutlinedIcon />,
        title: "5. Handle orders",
        intro: "Keep the buyer posted.",
        points: [
          ["Status", "Received, then Shipped (with a note, a tracking number say), or Refunded."],
          ["Delivered", "the buyer marks it when it arrives, and can then review your shop."],
          ["Overview", "orders to handle, and recent activity: reviews, favourites, deliveries."],
        ],
      },
      {
        id: "grow",
        icon: <TrendingUpOutlinedIcon />,
        title: "6. Grow your shop",
        intro: "Help buyers find more.",
        points: [
          ["Collections", "group products (Gifts, Kitchen…); they show first on your shop page."],
          ["Arrange", "set the order buyers see as Featured."],
          ["Share", "copy your shop's or a product's link anywhere on Qortal."],
        ],
      },
    ],
  },
};
