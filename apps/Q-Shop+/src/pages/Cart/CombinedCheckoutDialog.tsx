/**
 * Checking out several shops at once: one review, one delivery address, one
 * confirmation, then each shop paid and its order recorded in turn by the
 * same checkout service as a single shop's (money/checkout.ts startCheckout,
 * unchanged): one payment and one order per shop, each confirmed in Hub.
 *
 * Each shop is paid in the coin its cart shows. A shop that doesn't ship to
 * the address is left out (it stays in the cart). Declining a payment, or one
 * failing, stops there: the shops before it are paid and ordered, the ones
 * after it stay in the cart. Nothing here can pay twice: Pay all runs once,
 * and the results only ever say what happened.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutlineOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { ResponsiveDialog } from "../../components/common/mobile";
import { AmountTag } from "../../components/money/PriceTag";
import { coinLabel } from "../../money/coins";
import { paymentRequest, startCheckout, type CheckoutBuyer, type CheckoutStep } from "../../money/checkout";
import { isDigitalOnly, missingDeliveryFields, type CartLine, type DeliveryInput, type OrderDetails } from "../../money/order";
import { errorMessage } from "../../qdn/hubErrors";
import { shipsToCountry } from "../../constants/shipping";
import { LazyDeliveryForm } from "./LazyDeliveryForm";
import { emptyDelivery, focusFirstMissing, saveDelivery, savedDelivery } from "./delivery";
import { RememberAddress } from "./RememberAddress";
import { itemCount, priceLines, type CartShop } from "./cartLines";
import type { ShopPricing } from "./useCartPricing";

type Step = "review" | "delivery" | "confirm" | "running" | "result";

/** One shop's part, fixed when the buyer reaches Confirm. */
interface Payment {
  key: string;
  title: string;
  shop: CartShop;
  lines: CartLine[];
  coin: string;
  rate: number | null;
  amount: string;
  details: OrderDetails;
  digital: boolean;
}

type RunState = "waiting" | CheckoutStep | "done" | "declined" | "failed" | "pending" | "skipped";

interface Run {
  state: RunState;
  message?: string;
}

const DELIVERY_PREFIX = "combined";
const orderUid = new ShortUniqueId({ length: 10 });
const mailUid = new ShortUniqueId();
const clock = () => Date.now();

const RUNNING_LABEL: Partial<Record<RunState, string>> = {
  waiting: "Waiting",
  seller: "Finding the seller's address",
  paying: "Payment: confirm it in Hub",
  recording: "Recording the order: confirm it in Hub",
  checking: "Recording the order: confirm it in Hub",
};

function RunIcon({ state }: { state: RunState }) {
  if (state === "done") return <CheckCircleIcon color="success" aria-hidden />;
  if (state === "pending") return <ScheduleOutlinedIcon color="warning" aria-hidden />;
  if (state === "declined" || state === "skipped") return <RemoveCircleOutlineIcon sx={{ color: "text.secondary" }} aria-hidden />;
  if (state === "failed") return <ErrorOutlineIcon color="error" aria-hidden />;
  if (state === "waiting") return <RadioButtonUncheckedIcon sx={{ color: "text.secondary" }} aria-hidden />;
  return <CircularProgress size={22} aria-hidden />;
}

function resultText(run: Run, title: string): string {
  switch (run.state) {
    case "done":
      return `Order placed. ${title} has it and a Q-Mail about it.`;
    case "pending":
      return run.message ?? "Paid, but the order isn't recorded yet: finish it under Orders to finish in your cart. Don't pay again.";
    case "declined":
      return "You declined the payment. Nothing was paid; it stays in your cart.";
    case "failed":
      return `${run.message ?? "It failed."} Nothing was paid; it stays in your cart.`;
    case "skipped":
      return "Not paid: it stays in your cart.";
    default:
      return RUNNING_LABEL[run.state] ?? "";
  }
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 0.75 }}>
      <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{label}</Box>
      <Box sx={{ flexShrink: 0, textAlign: "right" }}>{children}</Box>
    </Box>
  );
}

export function CombinedCheckoutDialog({
  shops,
  buyer,
  onClose,
  onPaid,
}: {
  /** The shops that can be checked out now, in the cart's order (fixed while the dialog is open). */
  shops: ShopPricing[];
  buyer: CheckoutBuyer;
  onClose: () => void;
  /** A shop's payment went through: take its bought lines out of the cart. */
  onPaid: (pricing: ShopPricing) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("review");
  // The address the buyer kept on this device last time, if they did (delivery.ts).
  const [delivery, setDelivery] = useState<DeliveryInput>(() => savedDelivery(buyer.name) ?? emptyDelivery(buyer.name));
  const [remember, setRemember] = useState(() => savedDelivery(buyer.name) !== null);
  const [showErrors, setShowErrors] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const running = useRef(false);
  const stepStart = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stepStart.current?.focus();
  }, [step]);

  const physical = shops.filter((s) => !isDigitalOnly(s.lines));
  const needsAddress = physical.length > 0;
  // Shops that don't ship to the address are left out (constants/shipping.ts).
  const notShipping = needsAddress && delivery.country ? physical.filter((s) => s.shop && !shipsToCountry(s.shop, delivery.country)) : [];
  const included = shops.filter((s) => !notShipping.includes(s));
  const busy = step === "running";

  const close = () => {
    if (!running.current) onClose();
  };

  const toConfirm = () => {
    const next: Payment[] = [];
    for (const s of included) {
      if (!s.shop) continue;
      const priced = priceLines(s.lines, s.coin, s.rate, false);
      if (!priced.ok) continue;
      next.push({
        key: s.view.key,
        title: s.title,
        shop: s.shop,
        lines: s.lines,
        coin: s.coin,
        rate: s.rate,
        amount: priced.amount,
        details: priced.details,
        digital: isDigitalOnly(s.lines),
      });
    }
    setPayments(next);
    setStep("confirm");
  };

  const fromDelivery = () => {
    if (missingDeliveryFields(delivery).length > 0) {
      setShowErrors(true);
      focusFirstMissing(DELIVERY_PREFIX, delivery);
      return;
    }
    if (included.length === 0) return;
    saveDelivery(buyer.name, remember ? delivery : null);
    toConfirm();
  };

  // A foreign coin's payout address comes from the checkout service's own request builder, as Pay will use it.
  const payoutProblem = (p: Payment): string | null => {
    try {
      paymentRequest(p.coin, p.amount, "", p.shop);
      return null;
    } catch (error) {
      return errorMessage(error, `This shop has no address for ${coinLabel(p.coin, p.shop)}`);
    }
  };
  const payable = payments.filter((p) => payoutProblem(p) === null);

  const payAll = async () => {
    if (running.current || payable.length === 0) return;
    running.current = true;
    setRuns(Object.fromEntries(payable.map((p) => [p.key, { state: "waiting" as RunState }])));
    setStep("running");
    const set = (key: string, run: Run) => setRuns((prev) => ({ ...prev, [key]: run }));
    for (let i = 0; i < payable.length; i++) {
      const p = payable[i];
      set(p.key, { state: "seller" });
      let stop = false;
      try {
        const result = await startCheckout({
          buyer,
          shop: {
            id: p.shop.id,
            title: p.shop.title,
            owner: p.shop.owner,
            supportedCoins: p.shop.supportedCoins,
            foreignCoins: p.shop.foreignCoins,
            acceptedAssets: p.shop.acceptedAssets,
          },
          lines: p.lines,
          coin: p.coin,
          rate: p.rate,
          isDigital: p.digital,
          delivery: p.digital ? null : delivery,
          orderUid: orderUid(),
          mailUid: mailUid(),
          now: clock(),
          onPaid: () => {
            const pricing = shops.find((s) => s.view.key === p.key);
            if (pricing) onPaid(pricing);
          },
          onStep: (s) => set(p.key, { state: s }),
        });
        if (result.kind === "done") set(p.key, { state: "done" });
        else if (result.kind === "declined") {
          set(p.key, { state: "declined" });
          stop = true;
        } else if (result.kind === "failed") {
          set(p.key, { state: "failed", message: result.message });
          stop = true;
        } else {
          set(p.key, {
            state: "pending",
            message:
              result.kind === "not-recorded"
                ? `Paid, but ${result.message.replace(/\.$/, "")}. Finish it under Orders to finish in your cart. Don't pay again.`
                : undefined,
          });
        }
      } catch (error) {
        set(p.key, {
          state: "failed",
          message: `${errorMessage(error, "Something went wrong")}. If Hub showed the payment as sent, don't pay again: look under Orders to finish in your cart.`,
        });
        stop = true;
      }
      if (stop) {
        for (const rest of payable.slice(i + 1)) set(rest.key, { state: "skipped" });
        break;
      }
    }
    running.current = false;
    setStep("result");
  };

  const title =
    step === "review"
      ? `Check out ${shops.length} shops`
      : step === "delivery"
        ? "Delivery address"
        : step === "confirm"
          ? "Confirm and pay"
          : step === "running"
            ? "Placing your orders"
            : "Your orders";

  let body: ReactNode = null;
  let actions: ReactNode = null;

  if (step === "review") {
    body = (
      <Stack sx={{ gap: 1.5 }}>
        <Box component="ul" aria-label="Shops" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {shops.map((s, i) => (
            <Box component="li" key={s.view.key} sx={{ borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
              <Row
                label={
                  <>
                    <Typography sx={{ fontWeight: 700 }}>{s.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {itemCount(s.lines) === 1 ? "1 item" : `${itemCount(s.lines)} items`} · {isDigitalOnly(s.lines) ? "digital" : "shipped"}
                      {s.leftOut > 0 ? ` · ${s.leftOut} left out` : ""}
                    </Typography>
                  </>
                }
              >
                {s.priced.ok ? <AmountTag value={s.priced.amount} coin={s.coin} shop={s.shop} /> : <Typography>—</Typography>}
              </Row>
            </Box>
          ))}
        </Box>
        <Alert severity="info">
          Each shop is paid on its own, in the coin its cart shows, and gets its own order: Hub asks you to confirm {shops.length * 2} times (a payment and an order for each shop).
        </Alert>
        <Typography variant="body2" color="text.secondary">
          {needsAddress ? "Next: the delivery address, once for every shop that ships." : "Digital orders: nothing is shipped."}
        </Typography>
      </Stack>
    );
    actions = (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={() => (needsAddress ? setStep("delivery") : toConfirm())}>
          Continue
        </Button>
      </>
    );
  } else if (step === "delivery") {
    body = (
      <Stack sx={{ gap: 2 }}>
        <LazyDeliveryForm value={delivery} onChange={setDelivery} showErrors={showErrors} idPrefix={DELIVERY_PREFIX} />
        <RememberAddress checked={remember} onChange={setRemember} />
        {notShipping.length > 0 && (
          <Alert severity="warning" role="alert">
            {notShipping.map((s) => s.title).join(", ")} {notShipping.length === 1 ? "doesn't" : "don't"} ship to {delivery.country}
            {included.length > 0 ? ", so they're left out of this checkout and stay in your cart." : ". Pick another address, or ask the sellers."}
          </Alert>
        )}
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep("review")}>Back</Button>
        <Button variant="contained" onClick={fromDelivery} disabled={included.length === 0}>
          Continue
        </Button>
      </>
    );
  } else if (step === "confirm") {
    const problems = payments.filter((p) => payoutProblem(p) !== null);
    body = (
      <Stack sx={{ gap: 1.5 }}>
        <Typography color="text.secondary">
          {payable.length === 1 ? "You make 1 payment:" : `You make ${payable.length} payments, one after another:`}
        </Typography>
        <Box component="ol" aria-label="Payments" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {payable.map((p, i) => (
            <Box component="li" key={p.key} sx={{ borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
              <Row
                label={
                  <>
                    <Typography sx={{ fontWeight: 700 }}>
                      {i + 1}. {p.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      to {p.shop.owner} · {itemCount(p.lines) === 1 ? "1 item" : `${itemCount(p.lines)} items`}
                    </Typography>
                  </>
                }
              >
                <AmountTag value={p.amount} coin={p.coin} shop={p.shop} />
              </Row>
            </Box>
          ))}
        </Box>
        {problems.map((p) => (
          <Alert key={p.key} severity="warning">
            {p.title}: {payoutProblem(p)}. It stays in your cart.
          </Alert>
        ))}
        {notShipping.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Left out (they don&apos;t ship to {delivery.country}): {notShipping.map((s) => s.title).join(", ")}.
          </Typography>
        )}
        {needsAddress && (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            Deliver to {[delivery.customerName, delivery.streetAddress, delivery.city, delivery.country].filter(Boolean).join(", ")}
          </Typography>
        )}
        <Divider />
        <Alert severity="info">
          For each shop, Hub asks you to confirm the payment, then to record the order. If you decline one, the shops after it aren&apos;t paid and stay in your cart.
        </Alert>
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep(needsAddress ? "delivery" : "review")}>Back</Button>
        <Button variant="contained" onClick={() => void payAll()} disabled={payable.length === 0}>
          {payable.length === 1 ? "Pay" : `Pay ${payable.length} shops`}
        </Button>
      </>
    );
  } else {
    body = (
      <Stack sx={{ gap: 1 }} aria-live="polite">
        <Box component="ol" aria-label="Orders" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 1.5 }}>
          {payable.map((p) => {
            const run = runs[p.key] ?? { state: "waiting" };
            return (
              <Box component="li" key={p.key} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                <Box sx={{ pt: 0.25 }}>
                  <RunIcon state={run.state} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{p.title}</Typography>
                    <AmountTag value={p.amount} coin={p.coin} shop={p.shop} size="small" />
                  </Box>
                  <Typography variant="body2" color={run.state === "failed" ? "error" : "text.secondary"}>
                    {resultText(run, p.title)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
        {step === "running" && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Keep this window open until Hub has finished.
          </Typography>
        )}
      </Stack>
    );
    actions =
      step === "running" ? null : (
        <>
          <Button onClick={onClose}>Close</Button>
          {payable.some((p) => runs[p.key]?.state === "done" || runs[p.key]?.state === "pending") && (
            <Button variant="contained" onClick={() => navigate("/my-orders")}>
              View my orders
            </Button>
          )}
        </>
      );
  }

  return (
    <ResponsiveDialog open onClose={close} title={title} actions={actions} dismissible={!busy} busy={busy} maxWidth="sm">
      <Box ref={stepStart} tabIndex={-1} role="group" aria-label={title} sx={{ "&:focus": { outline: "none" } }}>
        {body}
      </Box>
    </ResponsiveDialog>
  );
}
