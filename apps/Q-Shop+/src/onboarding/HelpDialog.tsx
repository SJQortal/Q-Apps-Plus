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
        "Choose your country on a product page (or in your cart) to see it, with each option the shop offers (Standard, Express, Local pickup…). You pick one at checkout. Shops without delivery prices include it, or agree it with you.",
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
        "Create Shop (top of the page), then Manage Shop: its Overview has a checkup of what to set up, step by step: your first product, where you ship, delivery prices and your policies.",
      ],
      [
        "Why does Hub ask me to confirm so often?",
        "Everything you publish (products, prices, order updates) is yours on Qortal, under your name, and each publish has a small fee. Changes wait in Ready to publish, so you publish many at once.",
      ],
      [
        "How do I get paid?",
        "Buyers pay you directly: QORT to your Qortal address, ARRR to the address in Edit shop, Q-Assets to your Qortal address. Each order arrives by Q-Mail and in your Orders, with the payment checked against the chain.",
      ],
      [
        "My shop is from the original Q-Shop",
        "It works as it is. The checkup on your Overview brings it up to date: categories from the list, countries for Ships to, delivery prices, policies, and products you used to charge delivery.",
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
