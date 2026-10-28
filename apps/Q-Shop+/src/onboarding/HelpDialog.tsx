/**
 * Help: short answers to what buyers and sellers ask first, in plain words,
 * from Settings. Q-Shop+ has no one in the middle (no escrow, no support
 * desk), so the answers say what that means and what to do.
 */
import { useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { ResponsiveDialog } from "../components/common/mobile";

export const HELP: { title: string; items: [string, string][] }[] = [
  {
    title: "Buying",
    items: [
      [
        "How do I pay?",
        "At checkout, in a coin the shop takes: QORT always, and Pirate Chain (ARRR) or Q-Assets when the shop does. Hub asks you to confirm the payment, then to record your order. You pay the seller directly; Q-Shop+ never holds your money.",
      ],
      [
        "What does delivery cost?",
        "Choose your country on a product page (or in your cart) to see it, with each way the shop delivers (by the names it gives them, Express, a pickup point…) and how much more you need for free delivery. Checkout lists them right after your country, and you pick one. Shops without delivery prices include it, or agree it with you.",
      ],
      [
        "I have a discount code",
        "Type it at checkout's last step (Have a discount code?): what it takes off shows before you pay. A discount a shop gives your Qortal name applies by itself.",
      ],
      [
        "Is buying safe?",
        "There's no one in the middle: before buying, look at the shop's reviews and orders, its policies (dispatch time, returns) and how long it has been open, and message the seller if anything is unclear. Start small with a shop you don't know.",
      ],
      [
        "Where is my order?",
        "In My orders: the seller's status (Received, Shipped) and notes, and the tracking number when they add one. When it arrives, mark it delivered; then you can review the shop.",
      ],
      [
        "Something went wrong",
        "Message the seller first (the order has a button): most problems are a mix-up. A refund comes from the seller, as their policies say. Your review tells other buyers how it went.",
      ],
      [
        "What's in the Names tab?",
        "Qortal names for sale. A name is an identity on Qortal: buying one moves it, with everything published under it (its website, videos, Q-App…), to your account. Names sell at a price or by auction; Hub asks you to confirm the purchase.",
      ],
      [
        "What's the amount beside my name?",
        "Your QORT balance; tap it for ARRR (Hub asks first) and the Q-Assets the shops you've opened take. Settings → Balance in the header hides it, say while sharing your screen.",
      ],
      [
        "I paid but the order isn't there",
        "If Hub showed the payment as sent, don't pay again: the cart keeps the paid order under Orders to finish, and finishing it records the order without paying.",
      ],
    ],
  },
  {
    title: "Selling",
    items: [
      [
        "How do I start?",
        "Create Shop (top of the page), then Manage Shop: its Overview has a checkup of what to set up, step by step: your first product, where you ship and delivery prices. Your policies (dispatch time, returns, languages) go in Edit shop.",
      ],
      [
        "Why does Hub ask me to confirm so often?",
        "Everything you publish (products, prices, order updates) is yours on Qortal, under your name, and each publish has a small fee. Changes wait on your device, and the orange Publish changes button sends them together; View changes says what changed first, and Discard drops it all.",
      ],
      [
        "How do I get paid?",
        "Buyers pay you directly: QORT to your Qortal address, ARRR to the address in Edit shop, Q-Assets to your Qortal address. Each order arrives by Q-Mail and in your Orders, with the payment checked against the chain.",
      ],
      [
        "How do buyers pay in a Q-Asset?",
        "Edit shop → Q-Assets. Give a product a price in the asset, or let the asset's other prices convert from QORT: at the Q-Assets trade portal's price (its latest trade, read from your node) or at your own rate (1 asset = so much QORT). Converting lets buyers pay everything in it, delivery included; an asset that can't be split rounds up to whole units.",
      ],
      [
        "How do discount codes work?",
        "Shop Settings → Discount codes: a percentage off, free delivery, or both, for chosen products (by collection, or all), some days, orders over an amount, or some Qortal names (suggested as you type, or a Q-Chat group's members). Codes stay secret on Qortal (only their fingerprints are published), and each order's discount is checked against yours.",
      ],
      [
        "How do delivery prices work?",
        "The Delivery tab. Zones price delivery by country: the first item, each extra one, and free from an amount. Shipping profiles give some products their own zones, under the name buyers choose at checkout (Postbox, DHL Express…); a product can be in several, and buyers get the first that reaches them. Add options like Express, and pickup points where buyers collect for free. A zone can also have its price in each Q-Asset you take, typed or filled from the trade portal.",
      ],
      [
        "My shop is from the original Q-Shop",
        "It works as it is. The checkup on your Overview brings it up to date: categories from the list, countries for Ships to, delivery prices, and products you used to charge delivery.",
      ],
    ],
  },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | false>(false);
  return (
    <ResponsiveDialog open onClose={onClose} title="Help" maxWidth="sm">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {HELP.map((group) => (
          <Box key={group.title} component="section" aria-label={group.title}>
            <Typography component="h2" sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
              {group.title}
            </Typography>
            {group.items.map(([question, answer]) => {
              const id = `${group.title}:${question}`;
              return (
                <Accordion
                  key={id}
                  disableGutters
                  elevation={0}
                  expanded={open === id}
                  onChange={(_, expanded) => setOpen(expanded ? id : false)}
                  sx={{ bgcolor: "transparent", borderTop: 1, borderColor: "divider", "&::before": { display: "none" } }}
                >
                  {/* MUI's Accordion puts the summary in an h3 of its own. */}
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 48 }}>
                    <Typography component="span" sx={{ fontWeight: 600, fontSize: 16 }}>
                      {question}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pt: 0 }}>
                    <Typography sx={{ fontSize: 15, lineHeight: 1.55 }} color="text.secondary">
                      {answer}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        ))}
      </Box>
    </ResponsiveDialog>
  );
}
