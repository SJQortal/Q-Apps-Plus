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
import { AwayNotice } from "../../shop/AwayNotice";
import { NextSteps } from "./NextSteps";
import { UpcomingOptions } from "./UpcomingOptions";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, IconButton, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { ResponsiveDialog } from "../../components/common/mobile";
import { AmountTag, PriceTag } from "../../components/money/PriceTag";
import { useShopCoin } from "../../money/useShopCoin";
import { assetIdOf, coinLabel, isForeignTicker } from "../../money/coins";
import { noRateText } from "../../money/coinRate";
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
import { deliveryFieldId, emptyDelivery, focusFirstMissing, missingPickupFields, pickupDelivery, saveDelivery, savedDelivery } from "./delivery";
import { RememberAddress } from "./RememberAddress";
import { PendingOrderCard } from "./PendingOrders";
import { usePendingOrders, useRecordingOrder } from "./usePendingOrders";
import { itemCount, priceLines, shortAddress, type CartShop } from "./cartLines";
import { placeNotShipped } from "../../constants/shipping";
import { deliveryCharge, deliveryChoices, loadShopDelivery, pickupChoices, withOptionNote, type DeliveryChoice, type ShopDelivery } from "../../delivery/checkoutDelivery";
import { DeliveryOptionsPicker } from "./DeliveryOptionsPicker";
import { DiscountCodeField } from "./DiscountCodeField";
import { CODE_PATTERN, codeHash, discountTitle, nameHash, normalizeCode, type Discount } from "../../discounts/model";
import { discountForCode, discountForName, discountLine, discountProblem } from "../../discounts/apply";
import { loadShopDiscounts, type ShopDiscounts } from "../../discounts/discountsDoc";
import { assetInfo } from "../../qdn/assets";
import { deliveryMoney } from "../../delivery/model";
import { FreeDeliveryBar } from "../../delivery/FreeDeliveryBar";

type Step = "review" | "delivery" | "confirm" | "running" | "result";

/** A discount the buyer applied (a code), or their name's own (no code). */
interface AppliedDiscount {
  discount: Discount;
  code?: string;
}

/** What Confirm shows and Pay pays: fixed when the buyer reaches Confirm. */
interface Snapshot {
  coin: string;
  rate: number | null;
  amount: string;
  details: OrderDetails;
  /** The lines Pay pays: the cart's, and the delivery fee's when there is one. */
  lines: CartLine[];
  delivery: { line: CartLine | null; free: boolean; option?: { id: string; name: string }; collect?: boolean };
  /** The discount's line in `lines` and what it takes off; null without one (or when it takes nothing off now). */
  discount: { applied: AppliedDiscount; amount: number } | null;
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
  const [prices, setPrices] = useState<ShopDelivery | null>(null);
  // Collecting it (a pickup option, delivery/model.ts): who, the place and how to reach them, no address.
  const [collect, setCollect] = useState(false);
  const [contact, setContact] = useState(() => (buyer.name ? `Q-Mail: ${buyer.name}` : ""));
  // Discount codes (discounts/): the shop's codes, read at Confirm, and the one applied.
  const [discounts, setDiscounts] = useState<ShopDiscounts | null>(null);
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  // The buyer took their name's own discount off: it isn't applied again.
  const personalRemoved = useRef(false);
  // Paying in an asset that can't be split: a discount rounds down to whole units.
  const [assetWhole, setAssetWhole] = useState<{ coin: string; whole: boolean } | null>(null);
  // The shop's delivery options for this order and address (delivery/model.ts), and the buyer's pick.
  const [choices, setChoices] = useState<DeliveryChoice[]>([]);
  const [optionId, setOptionId] = useState("");
  const paying = useRef(false);
  // A code being checked (Pay waits for it), and what it was checked against: a Confirm built since, a step left
  // or a payment started drops its answer.
  const [checkingCode, setCheckingCode] = useState(false);
  const confirmRound = useRef(0);
  const stepNow = useRef<Step>(step);
  useEffect(() => {
    stepNow.current = step;
  }, [step]);
  // Bumped by every address change: a delivery read that finishes after one is for the old address, and is dropped.
  const addressEdits = useRef(0);
  const stepStart = useRef<HTMLDivElement>(null);
  const pending = usePendingOrders(buyer.name);

  // Each step starts at its top, for keyboards and screen readers.
  useEffect(() => {
    stepStart.current?.focus();
  }, [step]);

  // A physical order reads the shop's delivery prices as checkout opens, from the node (a seller's latest change
  // counts), so Continue at the address is quick.
  useEffect(() => {
    if (isDigital) return;
    let alive = true;
    loadShopDelivery(shop.owner, shop.id, { maxAgeMs: 0 }).then(
      (d) => {
        if (!alive) return;
        setHasDeliveryPrices(!!d.doc);
        setPrices(d);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [isDigital, shop.owner, shop.id]);

  useEffect(() => {
    const id = assetIdOf(coin);
    if (id === null) return;
    let alive = true;
    assetInfo({ id }).then(
      (info) => alive && setAssetWhole({ coin, whole: info?.isDivisible === false }),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [coin]);
  const wholeUnits = assetWhole?.coin === coin && assetWhole.whole;

  const priced = priceLines(lines, coin, rate, rateLoading, rateError);
  const label = coinLabel(coin, shop);
  const running = step === "running";
  // The result step's card is finishing the order: stay until Hub has answered (no Later, no Back).
  const recordingNow = useRecordingOrder(step === "result" && outcome && "orderUid" in outcome ? outcome.orderUid : null);

  const close = () => {
    if (!paying.current && !recordingNow) onClose();
  };

  const toConfirm = (delivery: Snapshot["delivery"] = { line: null, free: false }, discountNow: AppliedDiscount | null = applied) => {
    const withDelivery = delivery.line ? [...lines, delivery.line] : lines;
    // The discount's line (discounts/apply.ts) after the delivery fee, which a free-delivery code takes off too.
    const off = discountNow
      ? discountLine({ discount: discountNow.discount, code: discountNow.code, lines, deliveryLine: delivery.line, coin, rate, digital: isDigital, wholeUnits })
      : null;
    const paid = off ? [...withDelivery, off.line] : withDelivery;
    const now = priceLines(paid, coin, rate, rateLoading, rateError);
    if (!now.ok) {
      setStep("review");
      return;
    }
    confirmRound.current += 1;
    setSnapshot({ coin, rate, amount: now.amount, details: now.details, lines: paid, delivery, discount: off && discountNow ? { applied: discountNow, amount: off.amount } : null });
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

  // The pickups the shop offers in the buyer's country, worked out before any street is typed.
  const pickups = !isDigital && prices ? pickupChoices({ shop, delivery: prices, lines, address: delivery, coin, rate }) : [];
  // Whether anything delivers to the buyer's place; when only pickups are left there, the buyer collects.
  const delivers = (() => {
    if (isDigital || !prices?.doc || pickups.length === 0) return true;
    const options = deliveryChoices({ shop, delivery: prices, lines, address: delivery, coin, rate });
    if (!options.ok) return false;
    return options.choices.length > 0 ? options.choices.some((c) => !c.pickup) : !prices.doc.base?.pickup;
  })();
  const onlyPickup = pickups.length > 0 && !delivers;
  const collecting = pickups.length > 0 && (collect || onlyPickup);
  // Every way it can come to the buyer's country, priced, to pick from before the address (Simon, 2026-10-25:
  // "if products have more than one delivery option, please list them at checkout"): the shop's delivery
  // options that reach there, then its pickup points there. Picking a pickup asks who collects it instead.
  const sendChoices = (() => {
    if (isDigital || !prices?.doc || !delivery.country || onlyPickup) return [];
    const options = deliveryChoices({ shop, delivery: prices, lines, address: delivery, coin, rate });
    return options.ok ? options.choices.filter((c) => !c.pickup) : [];
  })();
  const ways = [...sendChoices, ...pickups];
  const chosenWay = ways.find((c) => c.id === optionId && !!c.pickup === collecting) ?? (collecting ? pickups[0] : sendChoices[0]);
  // The shop's own list of countries (constants/shipping.ts): a country it doesn't ship to stops here, unless the buyer collects.
  // ... and in the United States, its states when it ships to some only.
  const noShipping = !isDigital && !collecting && delivery.country ? placeNotShipped(shop, delivery.country, delivery.state) : null;

  const fromDelivery = async () => {
    if (quoting) return;
    if (collecting ? missingPickupFields(delivery, contact).length > 0 : missingDeliveryFields(delivery).length > 0) {
      setShowErrors(true);
      focusFirstMissing(DELIVERY_PREFIX, delivery, collecting ? contact : undefined);
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
      // Collecting: the pickups only; delivered: every other option.
      // A pickup doesn't need the zones to deliver there.
      offered = collecting
        ? pickupChoices({ shop, delivery: prices, lines, address: delivery, coin, rate })
        : options.ok
          ? options.choices.filter((c) => !c.pickup)
          : [];
      // The option picked before (Back to the address, then Continue) while it's still offered, else the first.
      const picked = offered.find((c) => c.id === optionId) ?? offered[0];
      charge = collecting
        ? picked
          ? { ok: true, line: picked.line, free: picked.free, option: { id: picked.id, name: picked.name } }
          : { ok: false, message: "That pickup isn't offered for this order there." }
        : !options.ok
          ? options
          : !picked && (options.choices.length > 0 || prices.doc?.base?.pickup)
            ? { ok: false, message: `${shop.title || shop.owner}'s delivery options don't reach this address: collect it, or ask the seller.` }
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
    // A pickup has no address to keep: the one kept before stays as it was.
    if (!collecting) saveDelivery(buyer.name, remember ? delivery : null);
    toConfirm({ line: charge.line, free: charge.free, ...(charge.option && { option: charge.option }), collect: collecting });
  };

  const pickOption = (choice: DeliveryChoice) => {
    setOptionId(choice.id);
    toConfirm({ line: choice.line, free: choice.free, option: { id: choice.id, name: choice.name }, collect: snapshot?.delivery.collect });
  };

  // The shop's codes, read when the buyer reaches Confirm; a discount for the buyer's own name applies by itself.
  const applyOwnDiscount = useEffectEvent((discount: Discount, hash: string, shopDiscounts: ShopDiscounts) => {
    if (step !== "confirm" || paying.current || !snapshot || !shopDiscounts.doc || applied || personalRemoved.current) return;
    const problem = discountProblem({ discount, doc: shopDiscounts.doc, lines, buyerNameHash: hash, now: Date.now(), pricing: shopDiscounts.pricing, hasDeliveryFee: !!snapshot.delivery.line });
    if (problem) return;
    const next = { discount };
    setApplied(next);
    toConfirm(snapshot.delivery, next);
  });
  useEffect(() => {
    if (step !== "confirm" || discounts) return;
    let alive = true;
    loadShopDiscounts(shop.owner, shop.id).then(
      async (d) => {
        // The name's fingerprint first: setting the codes runs this effect again.
        const hash = alive && d.doc && buyer.name ? await nameHash(shop.id, buyer.name) : null;
        if (!alive) return;
        setDiscounts(d);
        const own = d.doc && hash ? discountForName(d.doc, hash, Date.now()) : null;
        if (own && hash) applyOwnDiscount(own, hash, d);
      },
      // A read that failed isn't "no codes": Apply reads again.
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [step, discounts, shop.owner, shop.id, buyer.name]);

  const applyCode = async (typed: string): Promise<string | null> => {
    if (!snapshot || paying.current) return "Try again.";
    const code = normalizeCode(typed);
    if (!CODE_PATTERN.test(code)) return "A code is 3 to 24 letters or digits.";
    setCheckingCode(true);
    const round = confirmRound.current;
    try {
      const problem = await checkCode(code, snapshot);
      // The buyer paid, left Confirm or changed the order meanwhile: this answer is for an order that's gone.
      if (paying.current || stepNow.current !== "confirm" || round !== confirmRound.current) return problem ?? "Your order changed meanwhile: apply the code again.";
      if (problem) return problem;
      const discount = pendingDiscount.current;
      if (!discount) return "Try again.";
      const next = { discount, code };
      setApplied(next);
      toConfirm(snapshot.delivery, next);
      return null;
    } finally {
      setCheckingCode(false);
    }
  };

  // The discount a checked code opens (checkCode leaves it here for applyCode).
  const pendingDiscount = useRef<Discount | null>(null);
  const checkCode = async (code: string, current: Snapshot): Promise<string | null> => {
    pendingDiscount.current = null;
    let found = discounts;
    if (!found) {
      try {
        found = await loadShopDiscounts(shop.owner, shop.id);
      } catch {
        return "The shop's codes couldn't be read from your node right now. Try again.";
      }
      setDiscounts(found);
    }
    const name = shop.title || shop.owner;
    if (!found.doc) return `${name} has no discount codes.`;
    const discount = discountForCode(found.doc, await codeHash(shop.id, code));
    if (!discount) return `${code} isn't a code at ${name}.`;
    const buyerHash = buyer.name ? await nameHash(shop.id, buyer.name) : null;
    const problem = discountProblem({ discount, doc: found.doc, lines, buyerNameHash: buyerHash, now: Date.now(), pricing: found.pricing, hasDeliveryFee: !!current.delivery.line });
    if (problem) return problem;
    if (!discountLine({ discount, code, lines, deliveryLine: current.delivery.line, coin: current.coin, rate: current.rate, digital: isDigital, wholeUnits })) {
      return `${code} takes less than one whole ${coinLabel(current.coin, shop)} off this order.`;
    }
    pendingDiscount.current = discount;
    return null;
  };

  const removeDiscount = () => {
    if (applied && !applied.code) personalRemoved.current = true;
    setApplied(null);
    if (snapshot) toConfirm(snapshot.delivery, null);
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
        // The delivery option picked goes in front of the buyer's note, so the seller sees it in either app;
        // a pickup sends no address, and how to reach the buyer.
        delivery: isDigital ? null : withOptionNote(snapshot.delivery.collect ? pickupDelivery(delivery, contact) : delivery, snapshot.delivery.option),
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
        ? pickups.length > 0
          ? "Delivery or pickup"
          : "Delivery address"
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
        {!isDigital && <FreeDeliveryBar owner={shop.owner} storeId={shop.id} lines={lines} />}
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
            {noRateText(coin, label)}, so {priced.missing.join(", ")} can&apos;t be paid in {label}.{" "}
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
        <LazyDeliveryForm
          value={delivery}
          onChange={changeDelivery}
          showErrors={showErrors}
          idPrefix={DELIVERY_PREFIX}
          collect={collecting}
          contact={contact}
          onContactChange={setContact}
          pickupSlot={
            ways.length > 1 && !onlyPickup ? (
              <DeliveryOptionsPicker
                label="How it comes"
                choices={ways}
                value={chosenWay?.id ?? ""}
                onChange={(choice) => {
                  setOptionId(choice.id);
                  setCollect(!!choice.pickup);
                  setDeliveryProblem(null);
                }}
                coin={coin}
                rate={rate}
                shop={shop}
              />
            ) : pickups.length === 0 ? undefined : onlyPickup ? (
              <Alert severity="info" icon={false}>
                {`${shop.title || shop.owner} doesn't deliver: you collect it (${pickups[0].name}${pickups[0].note ? `: ${pickups[0].note}` : ""}).`}
              </Alert>
            ) : (
              <RadioGroup aria-label="Delivered or collected" value={collecting ? "collect" : "deliver"} onChange={(e) => setCollect(e.target.value === "collect")}>
                <FormControlLabel value="deliver" control={<Radio />} label="Deliver it to me" sx={{ m: 0, minHeight: 44 }} />
                <FormControlLabel
                  value="collect"
                  control={<Radio />}
                  sx={{ m: 0, alignItems: "flex-start", "& .MuiFormControlLabel-label": { py: 1.1, minWidth: 0 } }}
                  label={
                    <Box>
                      <Typography component="span" sx={{ display: "block" }}>
                        {pickups.length === 1 ? `Collect it: ${pickups[0].name}` : `Collect it (${pickups.length} places, picked next)`}
                      </Typography>
                      {pickups.length === 1 && pickups[0].note && (
                        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block", overflowWrap: "anywhere" }}>
                          {pickups[0].note}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </RadioGroup>
            )
          }
        />
        {!collecting && <RememberAddress checked={remember} onChange={setRemember} />}
        {/* Before the country is in, it says the choice is coming; then the choice itself shows. */}
        {ways.length <= 1 && pickups.length === 0 && <UpcomingOptions owner={shop.owner} storeId={shop.id} />}
        {noShipping && (
          <Alert
            severity="warning"
            role="alert"
            action={
              // Another country: the country field, with its list open (Simon, 2026-10-25).
              <Button
                color="inherit"
                size="small"
                onClick={() => {
                  const field = document.getElementById(deliveryFieldId(DELIVERY_PREFIX, "country")) as HTMLInputElement | null;
                  field?.focus();
                  field?.select();
                }}
                sx={{ minHeight: 44, whiteSpace: "nowrap" }}
              >
                Another country
              </Button>
            }
          >
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
        {snapshot.discount && (
          <Row label={<Typography variant="body2">{discountTitle(snapshot.discount.applied.discount, snapshot.discount.applied.code)}</Typography>}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{`−${formatPrice(snapshot.discount.amount)} ${snapshotLabel}`}</Typography>
          </Row>
        )}
        <DiscountCodeField
          applied={applied ? { label: applied.code ? `Code ${applied.code}` : `Your discount from ${shop.title || shop.owner}` } : null}
          idle={applied && !snapshot.discount ? "It takes nothing off this order now." : null}
          onApply={applyCode}
          onRemove={removeDiscount}
        />
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography variant="body2">{isDigital ? "Digital order: nothing is shipped." : snapshot.delivery.collect ? "Collected by" : "Deliver to"}</Typography>
            {!isDigital && (
              <Button size="small" onClick={() => setStep("delivery")} sx={{ minHeight: 44 }}>
                Edit
              </Button>
            )}
          </Box>
          {!isDigital &&
            (snapshot.delivery.collect ? [delivery.customerName, `Contact: ${contact.trim()}`, delivery.country] : deliverySummary(delivery)).map((text, i) => (
              <Typography key={i} variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                {text}
              </Typography>
            ))}
        </Box>
        {/* The shop's dispatch time and returns, and whether its seller is away, before paying (shop/). */}
        <PolicyLines shop={shop} digital={isDigital} />
        <AwayNotice shop={shop} />
        <Alert severity="info">Hub asks you to confirm the payment, then to record your order (2 steps).</Alert>
        {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep(isDigital ? "review" : "delivery")}>Back</Button>
        <Button variant="contained" onClick={pay} disabled={running || checkingCode || !!payout.error}>
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
            {shop.title || shop.owner} has your order and a Q-Mail about it.
          </Typography>
          <NextSteps shop={shop} digital={isDigital} />
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
