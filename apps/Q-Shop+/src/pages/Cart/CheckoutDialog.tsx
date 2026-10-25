/**
 * Checkout for one shop's cart, full-screen on phones: Review → Delivery
 * (physical orders only; the shop's delivery prices, when it has some, add
 * the fee for the address as one more line: delivery/checkoutDelivery.ts) →
 * Confirm → progress → result. Every amount and
 * every call comes from the money layer: the total is priceCheckout's, and
 * Pay runs startCheckout (money/checkout.ts), which pays once and records
 * the order, keeping a paid order to finish later if recording doesn't
 * happen. Nothing here can pay twice: Pay runs once per press and is gone
 * while it runs, and the results only ever finish an order already paid.
 */
import { PolicyLines } from "../../shop/PolicyLines";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Stack, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { ResponsiveDialog } from "../../components/common/mobile";
import { AmountTag, PriceTag } from "../../components/money/PriceTag";
import { useShopCoin } from "../../money/useShopCoin";
import { assetIdOf, coinLabel, isForeignTicker } from "../../money/coins";
import { formatPrice, unitPrice } from "../../money/pricing";
import {
  paymentRequest,
  startCheckout,
  type CheckoutBuyer,
  type CheckoutResult,
  type CheckoutStep,
} from "../../money/checkout";
import { isDigitalOnly, missingDeliveryFields, US, type CartLine, type DeliveryInput, type OrderDetails } from "../../money/order";
import { errorMessage } from "../../qdn/hubErrors";
import { copyText } from "../../utils/clipboard";
import { CoinPicker } from "./CoinPicker";
import { LazyDeliveryForm } from "./LazyDeliveryForm";
import { emptyDelivery, focusFirstMissing, saveDelivery, savedDelivery } from "./delivery";
import { RememberAddress } from "./RememberAddress";
import { PendingOrderCard } from "./PendingOrders";
import { usePendingOrders, useRecordingOrder } from "./usePendingOrders";
import { itemCount, priceLines, shortAddress, type CartShop } from "./cartLines";
import { placeNotShipped } from "../../constants/shipping";
import { deliveryCharge, deliveryChoices, loadShopDelivery, withOptionNote, type DeliveryChoice } from "../../delivery/checkoutDelivery";
import { DeliveryOptionsPicker } from "./DeliveryOptionsPicker";
import { deliveryMoney } from "../../delivery/model";

type Step = "review" | "delivery" | "confirm" | "running" | "result";

/** What Confirm shows and Pay pays: fixed when the buyer reaches Confirm. */
interface Snapshot {
  coin: string;
  rate: number | null;
  amount: string;
  details: OrderDetails;
  /** The lines Pay pays: the cart's, and the delivery fee's when there is one. */
  lines: CartLine[];
  delivery: { line: CartLine | null; free: boolean; option?: { id: string; name: string } };
}

type Outcome = CheckoutResult & { unexpected?: boolean };

const DELIVERY_PREFIX = "checkout";

const PROGRESS: { step: CheckoutStep; label: string }[] = [
  { step: "seller", label: "Finding the seller's address" },
  { step: "paying", label: "Payment: confirm it in Hub" },
  { step: "recording", label: "Recording your order: confirm it in Hub" },
];

function progressIndex(step: CheckoutStep | null): number {
  if (step === "checking") return 2;
  return Math.max(0, PROGRESS.findIndex((p) => p.step === step));
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 0.75 }}>
      <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{label}</Box>
      <Box sx={{ flexShrink: 0, textAlign: "right" }}>{children}</Box>
    </Box>
  );
}

/** "5.00 USD" for a fee set in a currency, beside what it costs in the coin. */
function deliveryInCurrency(line: CartLine): string | null {
  const fee = (line.product as { delivery?: { currency?: unknown; value?: unknown } } | null)?.delivery;
  return fee && typeof fee.currency === "string" && fee.currency !== "QORT" && typeof fee.value === "number" ? deliveryMoney(fee.value, fee.currency) : null;
}

function deliverySummary(delivery: DeliveryInput): string[] {
  const place = delivery.country === US ? delivery.state : delivery.region;
  return [
    delivery.customerName,
    delivery.streetAddress,
    [delivery.city, place, delivery.zipCode].filter(Boolean).join(", "),
    delivery.country,
  ].filter(Boolean);
}

export function CheckoutDialog({
  shop,
  lines,
  leftOut,
  buyer,
  onClose,
  onPaid,
}: {
  shop: CartShop;
  /** The lines that can be bought, in the cart's order (fixed while the dialog is open). */
  lines: CartLine[];
  /** How many of the cart's lines can't be bought now and aren't in `lines`. */
  leftOut: number;
  buyer: CheckoutBuyer;
  onClose: () => void;
  /** The payment went through: take the bought lines out of the cart. */
  onPaid: () => void;
}) {
  const navigate = useNavigate();
  const { coins, coin, rate, rateLoading, rateError, setCoin } = useShopCoin(shop);
  const isDigital = isDigitalOnly(lines);
  const [step, setStep] = useState<Step>("review");
  // The address the buyer kept on this device last time, if they did (delivery.ts).
  const [delivery, setDelivery] = useState<DeliveryInput>(() => savedDelivery(buyer.name) ?? emptyDelivery(buyer.name));
  const [remember, setRemember] = useState(() => savedDelivery(buyer.name) !== null);
  const [showErrors, setShowErrors] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [progress, setProgress] = useState<CheckoutStep | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<{ severity: "info" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Reading the shop's delivery prices on the way to Confirm, and why the address can't be delivered to.
  const [quoting, setQuoting] = useState(false);
  const [deliveryProblem, setDeliveryProblem] = useState<string | null>(null);
  const [hasDeliveryPrices, setHasDeliveryPrices] = useState(false);
  // The shop's delivery options for this order and address (delivery/model.ts), and the buyer's pick.
  const [choices, setChoices] = useState<DeliveryChoice[]>([]);
  const [optionId, setOptionId] = useState("");
  const paying = useRef(false);
  // Bumped by every address change: a delivery read that finishes after one is for the old address, and is dropped.
  const addressEdits = useRef(0);
  const stepStart = useRef<HTMLDivElement>(null);
  const pending = usePendingOrders(buyer.name);

  // Each step starts at its top, for keyboards and screen readers.
  useEffect(() => {
    stepStart.current?.focus();
  }, [step]);

  // A physical order reads the shop's delivery prices early (cached), so Continue at the address is quick.
  useEffect(() => {
    if (isDigital) return;
    let alive = true;
    loadShopDelivery(shop.owner, shop.id).then(
      (d) => alive && setHasDeliveryPrices(!!d.doc),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [isDigital, shop.owner, shop.id]);

  const priced = priceLines(lines, coin, rate, rateLoading, rateError);
  const label = coinLabel(coin, shop);
  const running = step === "running";
  // The result step's card is finishing the order: stay until Hub has answered (no Later, no Back).
  const recordingNow = useRecordingOrder(step === "result" && outcome && "orderUid" in outcome ? outcome.orderUid : null);

  const close = () => {
    if (!paying.current && !recordingNow) onClose();
  };

  const toConfirm = (delivery: Snapshot["delivery"] = { line: null, free: false }) => {
    const paid = delivery.line ? [...lines, delivery.line] : lines;
    const now = priceLines(paid, coin, rate, rateLoading, rateError);
    if (!now.ok) {
      setStep("review");
      return;
    }
    setSnapshot({ coin, rate, amount: now.amount, details: now.details, lines: paid, delivery });
    setNotice(null);
    setStep("confirm");
  };

  const fromReview = () => {
    if (isDigital) toConfirm();
    else setStep("delivery");
  };

  const changeDelivery = (next: DeliveryInput) => {
    addressEdits.current += 1;
    setDelivery(next);
    setDeliveryProblem(null);
  };

  // The shop's own list of countries (constants/shipping.ts): a country it doesn't ship to stops here.
  // ... and in the United States, its states when it ships to some only.
  const noShipping = !isDigital && delivery.country ? placeNotShipped(shop, delivery.country, delivery.state) : null;

  const fromDelivery = async () => {
    if (quoting) return;
    if (missingDeliveryFields(delivery).length > 0) {
      setShowErrors(true);
      focusFirstMissing(DELIVERY_PREFIX, delivery);
      return;
    }
    if (noShipping) return;
    setDeliveryProblem(null);
    setQuoting(true);
    const edits = addressEdits.current;
    let charge: ReturnType<typeof deliveryCharge>;
    let offered: DeliveryChoice[] = [];
    try {
      const prices = await loadShopDelivery(shop.owner, shop.id);
      const options = deliveryChoices({ shop, delivery: prices, lines, address: delivery, coin, rate });
      offered = options.ok ? options.choices : [];
      // The option picked before (Back to the address, then Continue) while it's still offered, else the first.
      const picked = offered.find((c) => c.id === optionId) ?? offered[0];
      charge = !options.ok
        ? options
        : picked
          ? { ok: true, line: picked.line, free: picked.free, option: { id: picked.id, name: picked.name } }
          : deliveryCharge({ shop, delivery: prices, lines, address: delivery, coin, rate });
    } catch {
      charge = { ok: false, message: `${shop.title || shop.owner}'s delivery prices couldn't be read from your node right now. Try again.` };
    }
    setQuoting(false);
    if (edits !== addressEdits.current) return;
    if (!charge.ok) {
      setDeliveryProblem(charge.message);
      return;
    }
    setChoices(offered);
    if (charge.option) setOptionId(charge.option.id);
    saveDelivery(buyer.name, remember ? delivery : null);
    toConfirm({ line: charge.line, free: charge.free, ...(charge.option && { option: charge.option }) });
  };

  const pickOption = (choice: DeliveryChoice) => {
    setOptionId(choice.id);
    toConfirm({ line: choice.line, free: choice.free, option: { id: choice.id, name: choice.name } });
  };

  const pay = async () => {
    if (paying.current || !snapshot) return;
    paying.current = true;
    setNotice(null);
    setProgress("seller");
    setStep("running");
    let result: Outcome;
    try {
      result = await startCheckout({
        buyer,
        shop: {
          id: shop.id,
          title: shop.title,
          owner: shop.owner,
          supportedCoins: shop.supportedCoins,
          foreignCoins: shop.foreignCoins,
          acceptedAssets: shop.acceptedAssets,
        },
        lines: snapshot.lines,
        coin: snapshot.coin,
        rate: snapshot.rate,
        isDigital,
        // The delivery option picked goes in front of the buyer's note, so the seller sees it in either app.
        delivery: isDigital ? null : withOptionNote(delivery, snapshot.delivery.option),
        orderUid: new ShortUniqueId({ length: 10 })(),
        mailUid: new ShortUniqueId()(),
        now: Date.now(),
        onPaid: () => onPaid(),
        onStep: setProgress,
      });
    } catch (error) {
      result = { kind: "failed", message: errorMessage(error, "unknown error"), unexpected: true };
    }
    paying.current = false;
    if (result.kind === "declined") {
      setStep("confirm");
      setNotice({ severity: "info", text: "You declined the payment in Hub. Nothing was paid." });
      return;
    }
    setOutcome(result);
    setStep("result");
  };

  // Payout details for Confirm. A foreign coin's address comes from the
  // checkout service's own request builder, so it's the one Pay will use.
  let payout: { address?: string; error?: string } = {};
  if (snapshot && isForeignTicker(snapshot.coin)) {
    try {
      payout = { address: paymentRequest(snapshot.coin, snapshot.amount, "", shop).recipient };
    } catch (error) {
      payout = { error: errorMessage(error, "This shop has no address for this coin") };
    }
  }
  const snapshotAsset = snapshot ? assetIdOf(snapshot.coin) : null;
  const pendingOrder =
    outcome && (outcome.kind === "not-recorded" || outcome.kind === "unconfirmed")
      ? pending.find((o) => o.orderUid === outcome.orderUid)
      : undefined;

  const title =
    step === "review"
      ? "Review your order"
      : step === "delivery"
        ? "Delivery address"
        : step === "confirm"
          ? "Confirm and pay"
          : step === "running"
            ? "Placing your order"
            : outcome?.kind === "done"
              ? "Order placed"
              : outcome?.kind === "failed"
                ? "Order not placed"
                : "Finish your order";

  let body: ReactNode = null;
  let actions: ReactNode = null;

  if (step === "review") {
    body = (
      <Stack sx={{ gap: 2 }}>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }} aria-label="Items">
          {lines.map((line) => (
            <Box component="li" key={line.productId}>
              <Row
                label={
                  <Typography variant="body2">
                    <Box component="span" sx={{ fontWeight: 600 }}>
                      {line.product?.title}
                    </Box>{" "}
                    × {line.quantity}
                  </Typography>
                }
              >
                <PriceTag product={line.product} coin={coin} rate={rate} quantity={line.quantity} shop={shop} size="small" />
              </Row>
            </Box>
          ))}
        </Box>
        {leftOut > 0 && (
          <Alert severity="info">
            {leftOut === 1 ? "1 item in your cart can't be bought right now and is" : `${leftOut} items in your cart can't be bought right now and are`}{" "}
            left out.
          </Alert>
        )}
        <CoinPicker coins={coins} value={coin} onChange={setCoin} shop={shop} />
        <Divider />
        <Row label={<Typography sx={{ fontWeight: 700, fontSize: 16 }}>{hasDeliveryPrices ? "Subtotal" : "Total"}</Typography>}>
          {priced.ok ? <AmountTag value={priced.amount} coin={coin} shop={shop} size="large" sx={{ fontSize: 20 }} /> : <Typography>—</Typography>}
        </Row>
        {!priced.ok && priced.reason === "rate" && (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2">Getting the {label} rate from your node…</Typography>
          </Box>
        )}
        {!priced.ok && priced.reason === "no-rate" && (
          <Alert severity="warning">
            Your node has no {label} exchange rate right now, so {priced.missing.join(", ")} can't be paid in {label}.{" "}
            {coins.length > 1 ? "Pick another coin, or remove it from your cart." : "Remove it from your cart to check out."}
          </Alert>
        )}
        {!priced.ok && priced.reason === "price" && (
          <Alert severity="warning">
            {priced.missing.length > 0 ? `${priced.missing.join(", ")} ${priced.missing.length === 1 ? "has" : "have"}` : "An item has"} no
            price in {label}.{" "}
            {coins.length > 1 ? "Pick another coin, or remove it from your cart." : "Remove it from your cart to check out."}
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary">
          {isDigital
            ? "Digital order: nothing is shipped."
            : hasDeliveryPrices
              ? "Next: where to deliver it. Delivery is added for your address."
              : "Next: where to deliver it."}
        </Typography>
      </Stack>
    );
    actions = (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={fromReview} disabled={!priced.ok}>
          Continue
        </Button>
      </>
    );
  } else if (step === "delivery") {
    body = (
      <Stack sx={{ gap: 2 }}>
        <LazyDeliveryForm value={delivery} onChange={changeDelivery} showErrors={showErrors} idPrefix={DELIVERY_PREFIX} />
        <RememberAddress checked={remember} onChange={setRemember} />
        {noShipping && (
          <Alert severity="warning" role="alert">
            {shop.title || shop.owner} doesn&apos;t ship to {noShipping}
            {shop.shipsTo ? `: it ships to ${shop.shipsTo}` : ""}. Pick another address, or ask the seller.
          </Alert>
        )}
        {deliveryProblem && !noShipping && (
          <Alert severity="warning" role="alert">
            {deliveryProblem}
          </Alert>
        )}
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep("review")} disabled={quoting}>
          Back
        </Button>
        <Button
          variant="contained"
          onClick={() => void fromDelivery()}
          disabled={!!noShipping || quoting}
          startIcon={quoting ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {quoting ? "Working out delivery…" : "Continue"}
        </Button>
      </>
    );
  } else if (step === "confirm" && snapshot) {
    const snapshotLabel = coinLabel(snapshot.coin, shop);
    body = (
      <Stack sx={{ gap: 2 }}>
        <Box sx={{ textAlign: "center", py: 1 }}>
          <Typography color="text.secondary">You pay</Typography>
          <AmountTag value={snapshot.amount} coin={snapshot.coin} shop={shop} size="large" sx={{ fontSize: 28 }} />
          <Typography sx={{ mt: 0.5 }}>
            to <strong>{shop.owner}</strong>
            {snapshotAsset !== null && (
              <>
                {" "}
                in the Qortal asset {snapshotLabel} (#{snapshotAsset})
              </>
            )}
          </Typography>
          {payout.address && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {snapshot.coin} address
              </Typography>
              <Typography variant="body2" component="code" sx={{ fontFamily: "monospace" }}>
                {shortAddress(payout.address)}
              </Typography>
              <IconButton
                aria-label={copied ? "Address copied" : `Copy the ${snapshot.coin} address`}
                onClick={async () => setCopied(await copyText(payout.address ?? ""))}
                sx={{ width: 44, height: 44 }}
              >
                {copied ? <CheckCircleIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Box>
          )}
        </Box>
        {payout.error && <Alert severity="error">{payout.error}</Alert>}
        <Divider />
        <Row label={<Typography variant="body2">Items</Typography>}>
          <Typography variant="body2">
            {itemCount(lines)} from {shop.title || shop.owner}
          </Typography>
        </Row>
        {choices.length > 1 && (
          <DeliveryOptionsPicker choices={choices} value={snapshot.delivery.option?.id ?? ""} onChange={pickOption} coin={snapshot.coin} rate={snapshot.rate} shop={shop} />
        )}
        {snapshot.delivery.line ? (
          <Row label={<Typography variant="body2">{String(snapshot.delivery.line.product?.title ?? "Delivery")}</Typography>}>
            <AmountTag value={unitPrice(snapshot.delivery.line.product, snapshot.coin, snapshot.rate)} coin={snapshot.coin} shop={shop} size="small" />
            {deliveryInCurrency(snapshot.delivery.line) && (
              <Typography variant="body2" color="text.secondary">
                {deliveryInCurrency(snapshot.delivery.line)}
              </Typography>
            )}
          </Row>
        ) : (
          snapshot.delivery.free && (
            <Row label={<Typography variant="body2">{snapshot.delivery.option ? `Delivery, ${snapshot.delivery.option.name}` : "Delivery"}</Typography>}>
              <Typography variant="body2">Free</Typography>
            </Row>
          )
        )}
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="body2">{isDigital ? "Digital order: nothing is shipped." : "Deliver to"}</Typography>
            {!isDigital && (
              <Button size="small" onClick={() => setStep("delivery")} sx={{ minHeight: 44 }}>
                Edit
              </Button>
            )}
          </Box>
          {!isDigital &&
            deliverySummary(delivery).map((text, i) => (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {text}
              </Typography>
            ))}
        </Box>
        {/* The shop's dispatch time and returns, before paying (shop/policies.ts). */}
        <PolicyLines shop={shop} digital={isDigital} />
        <Alert severity="info">Hub asks you to confirm the payment, then to record your order (2 steps).</Alert>
        {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep(isDigital ? "review" : "delivery")}>Back</Button>
        <Button variant="contained" onClick={pay} disabled={running || !!payout.error}>
          Pay {formatPrice(Number(snapshot.amount))} {snapshotLabel}
        </Button>
      </>
    );
  } else if (step === "running") {
    const at = progressIndex(progress);
    body = (
      <Stack sx={{ gap: 1.5 }} aria-live="polite">
        {PROGRESS.map((p, i) => (
          <Box key={p.step} sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 32 }}>
            {i < at ? (
              <CheckCircleIcon color="success" aria-hidden />
            ) : i === at ? (
              <CircularProgress size={22} aria-hidden />
            ) : (
              <RadioButtonUncheckedIcon sx={{ color: "text.secondary" }} aria-hidden />
            )}
            <Typography sx={{ fontWeight: i === at ? 700 : 400 }} aria-current={i === at ? "step" : undefined}>
              {p.label}
            </Typography>
          </Box>
        ))}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Keep this window open until Hub has finished.
        </Typography>
      </Stack>
    );
  } else if (step === "result" && outcome) {
    if (outcome.kind === "done") {
      body = (
        <Box sx={{ textAlign: "center", py: 2 }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} aria-hidden />
          <Typography sx={{ fontWeight: 700, mt: 1 }}>Order placed</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {shop.title || shop.owner} has your order and a Q-Mail about it. Follow it in My orders.
          </Typography>
        </Box>
      );
      actions = (
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={() => navigate("/my-orders")}>
            View my orders
          </Button>
        </>
      );
    } else if (outcome.kind === "failed") {
      body = (
        <Alert severity="error">
          {outcome.message}
          {outcome.unexpected
            ? " If Hub showed the payment as sent, don't pay again: look under Orders to finish in your cart, and in My orders."
            : " Nothing was paid."}
        </Alert>
      );
      actions = (
        <>
          <Button onClick={onClose}>Close</Button>
          {!outcome.unexpected && (
            <Button variant="contained" onClick={() => setStep("confirm")}>
              Back
            </Button>
          )}
        </>
      );
    } else {
      body = pendingOrder ? (
        <PendingOrderCard order={pendingOrder} onRecorded={() => setOutcome({ kind: "done", orderUid: pendingOrder.orderUid })} />
      ) : (
        <Alert severity="warning">
          {outcome.kind === "not-recorded" ? outcome.message : "Hub didn't confirm the payment."} You'll find this order under
          Orders to finish in your cart. Don't pay again.
        </Alert>
      );
      actions = (
        <Button onClick={close} disabled={recordingNow}>
          Later
        </Button>
      );
    }
  }

  return (
    <ResponsiveDialog
      open
      onClose={close}
      title={title}
      actions={actions}
      dismissible={!running && !recordingNow}
      busy={running || recordingNow}
      maxWidth="sm"
    >
      <Box ref={stepStart} tabIndex={-1} role="group" aria-label={title} sx={{ "&:focus": { outline: "none" } }}>
        {step !== "result" && step !== "running" && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {shop.title || shop.owner}
          </Typography>
        )}
        {body}
      </Box>
    </ResponsiveDialog>
  );
}
