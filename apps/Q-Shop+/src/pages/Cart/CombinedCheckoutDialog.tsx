/**
 * Checking out several shops at once: one review, one delivery address, one
 * confirmation, then each shop paid and its order recorded in turn by the
 * same checkout service as a single shop's (money/checkout.ts startCheckout,
 * unchanged): one payment and one order per shop, each confirmed in Hub.
 *
 * Each shop is paid in the coin its cart shows, with its delivery fee for
 * the address when it prices delivery (delivery/checkoutDelivery.ts). A shop
 * that doesn't ship or deliver there is left out (it stays in the cart). Each shop takes its own
 * discount code (discounts/), and a discount for the buyer's name applies by itself. Declining a payment, or one
 * failing, stops there: the shops before it are paid and ordered, the ones
 * after it stay in the cart. Nothing here can pay twice: Pay all runs once,
 * and the results only ever say what happened.
 */
import { PolicyLines } from "../../shop/PolicyLines";
import { AwayNotice } from "../../shop/AwayNotice";
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
import { assetIdOf, coinLabel } from "../../money/coins";
import { coinRate, needsRate, rateKey } from "../../money/coinRate";
import { formatPrice, unitPrice } from "../../money/pricing";
import { paymentRequest, startCheckout, type CheckoutBuyer, type CheckoutStep } from "../../money/checkout";
import { isDigitalOnly, missingDeliveryFields, type CartLine, type DeliveryInput, type OrderDetails } from "../../money/order";
import { errorMessage } from "../../qdn/hubErrors";
import { placeNotShipped } from "../../constants/shipping";
import { LazyDeliveryForm } from "./LazyDeliveryForm";
import { emptyDelivery, focusFirstMissing, saveDelivery, savedDelivery } from "./delivery";
import { RememberAddress } from "./RememberAddress";
import { itemCount, priceLines, type CartShop } from "./cartLines";
import { deliveryCharge, deliveryChoices, loadShopDelivery, withOptionNote, type DeliveryChoice, type DeliveryCharge } from "../../delivery/checkoutDelivery";
import { DeliveryOptionsPicker } from "./DeliveryOptionsPicker";
import type { ShopPricing } from "./useCartPricing";
import { DiscountCodeField } from "./DiscountCodeField";
import { CODE_PATTERN, codeHash, discountTitle, nameHash, normalizeCode, type Discount } from "../../discounts/model";
import { discountForCode, discountForName, discountLine, discountProblem } from "../../discounts/apply";
import { loadShopDiscounts, type ShopDiscounts } from "../../discounts/discountsDoc";
import { assetInfo } from "../../qdn/assets";

type Step = "review" | "delivery" | "confirm" | "running" | "result";

/** A discount the buyer applied at a shop (a code), or their name's own (no code). */
interface AppliedDiscount {
  discount: Discount;
  code?: string;
}

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
  /** The items bought (the delivery fee's line isn't one). */
  items: number;
  /** The delivery fee's line, in `lines` too; free: the shop's prices make it free there. */
  delivery: CartLine | null;
  deliveryFree: boolean;
  /** The cart's lines, without the delivery fee's (to price another delivery option). */
  baseLines: CartLine[];
  /** The shop's delivery options for this order and address, and the one picked. */
  choices: DeliveryChoice[];
  option?: { id: string; name: string };
  /** Its discount's line (in `lines` too) and what it takes off. */
  discount: { applied: AppliedDiscount; amount: number } | null;
  /** Paid in an asset that can't be split: a discount rounds down to whole units. */
  wholeUnits: boolean;
}

/** A shop's part priced again with a delivery line and its discount (discounts/apply.ts); null when it can't be priced. */
function reprice(p: Payment, delivery: CartLine | null, applied: AppliedDiscount | null): Pick<Payment, "lines" | "amount" | "details" | "discount"> | null {
  const off = applied
    ? discountLine({ discount: applied.discount, code: applied.code, lines: p.baseLines, deliveryLine: delivery, coin: p.coin, rate: p.rate, digital: p.digital, wholeUnits: p.wholeUnits })
    : null;
  const lines = [...p.baseLines, ...(delivery ? [delivery] : []), ...(off ? [off.line] : [])];
  const priced = priceLines(lines, p.coin, p.rate, false, p.rate === null && needsRate(p.coin, p.shop));
  if (!priced.ok) return null;
  return { lines, amount: priced.amount, details: priced.details, discount: off && applied ? { applied, amount: off.amount } : null };
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
  // Each shop's delivery option picked at Confirm, by its key (kept through Back and Continue).
  const [optionOf, setOptionOf] = useState<Record<string, string>>({});
  // Each shop's discount codes (discounts/), read at Confirm, and the discount applied there.
  const [discountsOf, setDiscountsOf] = useState<Record<string, ShopDiscounts>>({});
  const [appliedOf, setAppliedOf] = useState<Record<string, AppliedDiscount>>({});
  // Shops where the buyer took their name's own discount off: it isn't applied again.
  const ownRemoved = useRef(new Set<string>());
  const pickOption = (key: string, choice: DeliveryChoice) => {
    setOptionOf((prev) => ({ ...prev, [key]: choice.id }));
    setPayments((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        // The discount follows: a free-delivery code takes the new option's fee off.
        const priced = reprice(p, choice.line, appliedOf[key] ?? null);
        // A price that can't be worked out keeps the option before (the buyer sees nothing change).
        if (!priced) return p;
        return { ...p, ...priced, delivery: choice.line, deliveryFree: choice.free, option: { id: choice.id, name: choice.name } };
      })
    );
  };
  const setDiscount = (key: string, applied: AppliedDiscount | null) => {
    setAppliedOf((prev) => {
      const next = { ...prev };
      if (applied) next[key] = applied;
      else delete next[key];
      return next;
    });
    setPayments((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const priced = reprice(p, p.delivery, applied);
        return priced ? { ...p, ...priced } : p;
      })
    );
  };
  const applyCode = async (p: Payment, typed: string): Promise<string | null> => {
    const code = normalizeCode(typed);
    if (!CODE_PATTERN.test(code)) return "A code is 3 to 24 letters or digits.";
    let found = discountsOf[p.key];
    if (!found) {
      try {
        found = await loadShopDiscounts(p.shop.owner, p.shop.id);
      } catch {
        return "The shop's codes couldn't be read from your node right now. Try again.";
      }
      setDiscountsOf((prev) => ({ ...prev, [p.key]: found }));
    }
    if (!found.doc) return `${p.title} has no discount codes.`;
    const discount = discountForCode(found.doc, await codeHash(p.shop.id, code));
    if (!discount) return `${code} isn't a code at ${p.title}.`;
    const buyerHash = buyer.name ? await nameHash(p.shop.id, buyer.name) : null;
    const problem = discountProblem({ discount, doc: found.doc, lines: p.baseLines, buyerNameHash: buyerHash, now: clock(), pricing: found.pricing, hasDeliveryFee: !!p.delivery });
    if (problem) return problem;
    if (!discountLine({ discount, code, lines: p.baseLines, deliveryLine: p.delivery, coin: p.coin, rate: p.rate, digital: p.digital, wholeUnits: p.wholeUnits })) {
      return `${code} takes less than one whole ${coinLabel(p.coin, p.shop)} off this order.`;
    }
    setDiscount(p.key, { discount, code });
    return null;
  };
  const removeDiscount = (p: Payment) => {
    if (appliedOf[p.key] && !appliedOf[p.key].code) ownRemoved.current.add(p.key);
    setDiscount(p.key, null);
  };
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [gettingRates, setGettingRates] = useState(false);
  // Shops whose price couldn't be worked out at Confirm (no rate for their coin right now): left out.
  const [unpriced, setUnpriced] = useState<string[]>([]);
  // Shops that can't deliver there now (their delivery prices: delivery/checkoutDelivery.ts), and why: left out.
  const [undelivered, setUndelivered] = useState<{ key: string; message: string }[]>([]);
  const running = useRef(false);
  // Bumped by every address change: prices worked out for an address since changed are dropped.
  const addressEdits = useRef(0);
  const stepStart = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stepStart.current?.focus();
  }, [step]);

  const physical = shops.filter((s) => !isDigitalOnly(s.lines));
  const needsAddress = physical.length > 0;
  // Shops that don't ship to the address are left out (constants/shipping.ts).
  const notShipping = needsAddress && delivery.country ? physical.filter((s) => s.shop && placeNotShipped(s.shop, delivery.country, delivery.state)) : [];
  // The place they don't ship to: the country, or the state in it when that is what's out.
  const notShippedPlace = notShipping.length ? placeNotShipped(notShipping[0].shop, delivery.country, delivery.state) : null;
  const included = shops.filter((s) => !notShipping.includes(s));
  const busy = step === "running";

  const close = () => {
    if (!running.current) onClose();
  };

  // Confirm fixes what Pay pays, at rates read now (the cart page may have been open for hours; rates.ts keeps 5 minutes).
  const toConfirm = async () => {
    if (gettingRates) return;
    setGettingRates(true);
    const edits = addressEdits.current;
    const rates = new Map<string, number | null>();
    for (const s of included) {
      const key = rateKey(s.coin, s.shop);
      if (needsRate(s.coin, s.shop) && !rates.has(key)) rates.set(key, await coinRate(s.coin, s.shop, { fresh: true }).then((r) => r.rate, () => null));
    }
    // Each shop that ships prices its delivery for the address, all read at once; every shop's discount codes too.
    const shipped = included.filter((s) => s.shop && !isDigitalOnly(s.lines));
    const withShop = included.filter((s) => s.shop);
    const [prices, codes, wholes] = await Promise.all([
      Promise.all(shipped.map((s) => loadShopDelivery(s.shop!.owner, s.shop!.id).then((d) => d, () => null))),
      // A read that fails isn't "no codes": left out here, so Apply reads again.
      Promise.all(withShop.map((s) => discountsOf[s.view.key] ?? loadShopDiscounts(s.shop!.owner, s.shop!.id).catch(() => null))),
      Promise.all(
        withShop.map((s) => {
          const id = assetIdOf(s.coin);
          return id === null ? false : assetInfo({ id }).then((info) => info?.isDivisible === false, () => false);
        })
      ),
    ]);
    const deliveryOf = new Map(shipped.map((s, i) => [s.view.key, prices[i]]));
    const codesOf: Record<string, ShopDiscounts> = Object.fromEntries(withShop.flatMap((s, i) => (codes[i] ? [[s.view.key, codes[i]]] : [])));
    const wholeOf = new Map(withShop.map((s, i) => [s.view.key, wholes[i]]));
    // A discount for the buyer's own name at a shop, unless they took it off there.
    const ownOf: Record<string, AppliedDiscount> = {};
    if (buyer.name) {
      for (const s of withShop) {
        const doc = codesOf[s.view.key]?.doc;
        if (!doc || appliedOf[s.view.key] || ownRemoved.current.has(s.view.key)) continue;
        const own = discountForName(doc, await nameHash(s.shop!.id, buyer.name), clock());
        if (own) ownOf[s.view.key] = { discount: own };
      }
    }
    setGettingRates(false);
    if (edits !== addressEdits.current) return;
    const next: Payment[] = [];
    const missing: string[] = [];
    const notDelivered: { key: string; message: string }[] = [];
    for (const s of included) {
      if (!s.shop) continue;
      const rate = needsRate(s.coin, s.shop) ? (rates.get(rateKey(s.coin, s.shop)) ?? null) : s.rate;
      const digital = isDigitalOnly(s.lines);
      let charge: DeliveryCharge = { ok: true, line: null, free: false };
      let offered: DeliveryChoice[] = [];
      if (!digital) {
        const read = deliveryOf.get(s.view.key);
        if (!read) charge = { ok: false, message: `${s.title}'s delivery prices couldn't be read from your node right now.` };
        else {
          const options = deliveryChoices({ shop: s.shop, delivery: read, lines: s.lines, address: delivery, coin: s.coin, rate });
          offered = options.ok ? options.choices : [];
          const picked = offered.find((c) => c.id === optionOf[s.view.key]) ?? offered[0];
          charge = !options.ok
            ? options
            : picked
              ? { ok: true, line: picked.line, free: picked.free, option: { id: picked.id, name: picked.name } }
              : deliveryCharge({ shop: s.shop, delivery: read, lines: s.lines, address: delivery, coin: s.coin, rate });
        }
      }
      if (!charge.ok) {
        notDelivered.push({ key: s.view.key, message: charge.message });
        continue;
      }
      const part: Payment = {
        key: s.view.key,
        title: s.title,
        shop: s.shop,
        lines: [],
        coin: s.coin,
        rate,
        amount: "",
        details: { totalPrice: "" } as OrderDetails,
        digital,
        items: itemCount(s.lines),
        delivery: charge.line,
        deliveryFree: charge.free,
        baseLines: s.lines,
        choices: offered,
        ...(charge.option && { option: charge.option }),
        discount: null,
        wholeUnits: wholeOf.get(s.view.key) ?? false,
      };
      // The discount applied before (Back, then Continue), or the buyer's name's own when it applies to this order.
      let applied: AppliedDiscount | null = appliedOf[s.view.key] ?? null;
      const own = ownOf[s.view.key];
      const shopCodes = codesOf[s.view.key];
      if (!applied && own && shopCodes?.doc && buyer.name) {
        const hash = await nameHash(s.shop.id, buyer.name);
        if (!discountProblem({ discount: own.discount, doc: shopCodes.doc, lines: s.lines, buyerNameHash: hash, now: clock(), pricing: shopCodes.pricing, hasDeliveryFee: !!charge.line })) applied = own;
      }
      const priced = reprice(part, charge.line, applied);
      if (!priced) {
        missing.push(s.title);
        continue;
      }
      next.push({ ...part, ...priced });
    }
    setDiscountsOf(codesOf);
    setAppliedOf(Object.fromEntries(next.filter((p) => p.discount).map((p) => [p.key, p.discount!.applied])));
    setPayments(next);
    setUnpriced(missing);
    setUndelivered(notDelivered);
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
    void toConfirm();
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
          // The delivery option picked goes in front of the buyer's note, so the seller sees it in either app.
          delivery: p.digital ? null : withOptionNote(delivery, p.option),
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
          {needsAddress
            ? "Next: the delivery address, once for every shop that ships. Shops that price delivery add it for your address."
            : "Digital orders: nothing is shipped."}
        </Typography>
      </Stack>
    );
    actions = (
      <>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={() => (needsAddress ? setStep("delivery") : void toConfirm())} disabled={gettingRates}>
          {gettingRates ? "Getting rates…" : "Continue"}
        </Button>
      </>
    );
  } else if (step === "delivery") {
    body = (
      <Stack sx={{ gap: 2 }}>
        <LazyDeliveryForm
          value={delivery}
          onChange={(next) => {
            addressEdits.current += 1;
            setDelivery(next);
          }}
          showErrors={showErrors}
          idPrefix={DELIVERY_PREFIX}
        />
        <RememberAddress checked={remember} onChange={setRemember} />
        {notShipping.length > 0 && (
          <Alert severity="warning" role="alert">
            {notShipping.map((s) => s.title).join(", ")} {notShipping.length === 1 ? "doesn't" : "don't"} ship to {notShippedPlace}
            {included.length > 0 ? ", so they're left out of this checkout and stay in your cart." : ". Pick another address, or ask the sellers."}
          </Alert>
        )}
      </Stack>
    );
    actions = (
      <>
        <Button onClick={() => setStep("review")}>Back</Button>
        <Button variant="contained" onClick={fromDelivery} disabled={included.length === 0 || gettingRates}>
          {gettingRates ? "Working out prices…" : "Continue"}
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
                      to {p.shop.owner} · {p.items === 1 ? "1 item" : `${p.items} items`}
                      {p.deliveryFree ? " · free delivery" : ""}
                    </Typography>
                    {p.delivery && (
                      <Typography variant="body2" color="text.secondary" component="div" sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "baseline" }}>
                        With {String(p.delivery.product?.title ?? "delivery")}:
                        <AmountTag value={unitPrice(p.delivery.product, p.coin, p.rate)} coin={p.coin} shop={p.shop} size="small" />
                      </Typography>
                    )}
                    {p.discount && (
                      <Typography variant="body2" color="text.secondary">
                        {`${discountTitle(p.discount.applied.discount, p.discount.applied.code)}: −${formatPrice(p.discount.amount)} ${coinLabel(p.coin, p.shop)}`}
                      </Typography>
                    )}
                  </>
                }
              >
                <AmountTag value={p.amount} coin={p.coin} shop={p.shop} />
              </Row>
              {p.choices.length > 1 && (
                <Box sx={{ pb: 1.5 }}>
                  <DeliveryOptionsPicker
                    choices={p.choices}
                    value={p.option?.id ?? ""}
                    onChange={(choice) => pickOption(p.key, choice)}
                    coin={p.coin}
                    rate={p.rate}
                    shop={p.shop}
                    label={`Delivery from ${p.title}`}
                  />
                </Box>
              )}
              <Box sx={{ pb: 1 }}>
                <DiscountCodeField
                  applied={appliedOf[p.key] ? { label: appliedOf[p.key].code ? `Code ${appliedOf[p.key].code} at ${p.title}` : `Your discount from ${p.title}` } : null}
                  idle={appliedOf[p.key] && !p.discount ? "It takes nothing off this order now." : null}
                  onApply={(code) => applyCode(p, code)}
                  onRemove={() => removeDiscount(p)}
                />
              </Box>
              {/* Its dispatch time and returns, and whether its seller is away (shop/). */}
              <Box sx={{ pb: 1.5, display: "flex", flexDirection: "column", gap: 1, "&:empty": { display: "none" } }}>
                <PolicyLines shop={p.shop} digital={p.lines.every((l) => l.product?.type === "digital")} />
                <AwayNotice shop={p.shop} />
              </Box>
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
            Left out (they don&apos;t ship to {notShippedPlace}): {notShipping.map((s) => s.title).join(", ")}.
          </Typography>
        )}
        {undelivered.map((u) => (
          <Alert key={u.key} severity="warning">
            Left out: {u.message} It stays in your cart.
          </Alert>
        ))}
        {unpriced.length > 0 && (
          <Alert severity="warning">
            Left out, as your node has no rate for their coin right now: {unpriced.join(", ")}. They stay in your cart.
          </Alert>
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
        {step === "result" && payable.some((p) => runs[p.key]?.state === "done") && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            My orders shows each order&apos;s status, and its tracking number when the seller adds one. When one arrives, mark it delivered, then review the shop.
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
