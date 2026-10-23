/**
 * The product page's auction (auctions/rules.ts): where it stands and the
 * time left, bidding and buy now, the bids so far, and once it ends, the
 * result. The winner pays the winning bid through the shop's checkout, in
 * QORT; the seller sees who won and can message them.
 */
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, Chip, CircularProgress, Collapse, InputAdornment, Link, Skeleton, TextField, Typography } from "@mui/material";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import type { RootState } from "../state/store";
import { useShellActions } from "../components/layout/shellState";
import { AmountTag } from "../components/money/PriceTag";
import { CoinIcon } from "../components/money/CoinIcon";
import { formatPrice } from "../money/pricing";
import { mailToLink } from "../qdn/links";
import { searchQdn } from "../qdn/search";
import { shopOrdersPrefix, shortStoreIdOf } from "../qdn/identifiers";
import { parseAmount, sanitizeAmountInput } from "../seller/productDraft";
import { usePendingOrders } from "../pages/Cart/usePendingOrders";
import type { CheckoutBuyer } from "../money/checkout";
import { useAuction } from "./useAuction";
import { placeBid, TOO_MANY_BIDS } from "./placeBid";
import { auctionCheckoutShop, wonLine } from "./auctionCheckout";
import { isAuctionPaid, noteAuctionPaid } from "./paid";
import { MAX_BID, timeLeft, type AuctionTerms, type Bid } from "./rules";

const CheckoutDialog = lazy(() => import("../pages/Cart/CheckoutDialog").then((m) => ({ default: m.CheckoutDialog })));
const bidUid = new ShortUniqueId({ length: 6 });
const EPSILON = 1e-9;

const WHEN = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Sun, Oct 25, 8:00 PM", in this device's time. */
export function whenText(ms: number): string {
  return WHEN.format(new Date(ms));
}

function agoText(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return whenText(ms);
}

const qort = (value: number) => `${formatPrice(value)} QORT`;

type Notice = { severity: "success" | "info" | "warning" | "error"; text: string };

export function AuctionPanel({
  terms,
  product,
  productId,
  catalogueId,
  owner,
  storeId,
  shop,
  isOwner,
}: {
  terms: AuctionTerms;
  product: Record<string, unknown>;
  productId: string;
  catalogueId: string;
  /** The shop's owner: the seller, whose own bids never count. */
  owner: string;
  storeId: string;
  shop: unknown;
  isOwner: boolean;
}) {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const { signIn, authenticating } = useShellActions();
  const auction = useAuction(productId, terms, owner);
  const { state, now } = auction;
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showBids, setShowBids] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkout, setCheckout] = useState<Bid | null>(null);
  const [paidNow, setPaidNow] = useState<string | null>(null);
  const pendingOrders = usePendingOrders(user?.name);

  const myNames = useMemo(() => new Set([user?.name, ...(user?.names ?? []).map((n) => n.name)].filter((n): n is string => !!n)), [user]);
  const buyer: CheckoutBuyer | null =
    user?.name && user.address && user.publicKey ? { name: user.name, address: user.address, publicKey: user.publicKey } : null;
  const high = state.high;
  const winner = state.winner;
  const iLead = !!high && myNames.has(high.bidder);
  // Just ended, or its winner being checked against the chain: the result isn't final yet.
  const pending = auction.settling || auction.confirming;
  const iWon = !!winner && !pending && myNames.has(winner.bidder);
  const paid = !!winner && (paidNow === winner.id || isAuctionPaid(productId, winner.id));
  const unfinished = pendingOrders.some((order) => order.details && Object.prototype.hasOwnProperty.call(order.details, productId));
  const extended = state.end > terms.end && !state.boughtNow;
  const orderedSince = useOrderedSince(iWon && !paid && winner ? winner.bidder : null, storeId, state.end);
  const live = state.phase === "live";
  const loading = auction.status === "loading";

  const typed = amountText.trim() ? parseAmount(amountText) : state.minNext;
  // Buy now costs the buy-now price, or the least bid allowed when that is already more (a bid just under it leads).
  const buyNowPrice = terms.buyNow !== undefined ? Math.max(terms.buyNow, state.minNext) : undefined;
  // A bid at the buy-now price or above buys it at that price.
  const amount = buyNowPrice !== undefined && typed + EPSILON >= buyNowPrice ? buyNowPrice : typed;
  const canBuyNow = live && buyNowPrice !== undefined && (!high || high.amount + EPSILON < buyNowPrice);

  const submit = async (value: number) => {
    if (busy) return;
    setNotice(null);
    if (!user) return signIn();
    if (!user.name) {
      setNotice({ severity: "info", text: "Bids are published under your Qortal name: register one in Hub to bid." });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setNotice({ severity: "error", text: "Type your bid in QORT." });
      return;
    }
    if (value + EPSILON < state.minNext) {
      setNotice({ severity: "error", text: `Bid at least ${qort(state.minNext)}.` });
      return;
    }
    if (value > MAX_BID) {
      setNotice({ severity: "error", text: `A bid can be at most ${qort(MAX_BID)}.` });
      return;
    }
    setBusy(true);
    const outcome = await placeBid({ name: user.name, productId, storeId, seller: owner, amount: value, uid: bidUid(), latest: auction.refresh });
    setBusy(false);
    if (outcome.kind === "placed") {
      auction.notePlaced(outcome.bid);
      setAmountText("");
      setNotice({ severity: "success", text: `Bid placed: ${qort(outcome.bid.amount)}.` });
    } else if (outcome.kind === "declined") {
      setNotice({ severity: "info", text: "You declined in Hub. No bid was placed." });
    } else if (outcome.kind === "outbid") {
      setNotice({ severity: "warning", text: `Someone bid meanwhile: the least you can bid now is ${qort(outcome.state.minNext)}.` });
    } else if (outcome.kind === "closed") {
      setNotice({ severity: "info", text: outcome.state.phase === "ended" ? "Bidding has closed." : "Bidding hasn't opened yet." });
    } else {
      setNotice({ severity: "error", text: outcome.message });
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(amount);
  };

  // The winner pays what the latest bids say, never what the page showed earlier.
  const pay = async () => {
    if (checking || !winner) return;
    if (!buyer) {
      if (!user) signIn();
      return;
    }
    setChecking(true);
    setNotice(null);
    const read = await auction.refresh();
    setChecking(false);
    if (!read) return setNotice({ severity: "error", text: "Couldn't confirm the result with your node. Try again in a moment." });
    if (!read.complete) return setNotice({ severity: "error", text: TOO_MANY_BIDS });
    const latest = read.state;
    if (!latest.winner || latest.winner.id !== winner.id) return setNotice({ severity: "warning", text: "The result changed with the latest bids. Check it again." });
    setCheckout(latest.winner);
  };

  let phaseText: string;
  if (state.phase === "upcoming") phaseText = `Starts in ${timeLeft(terms.start - now)}`;
  else if (live) phaseText = `Ends in ${timeLeft(state.end - now)}`;
  else if (pending) phaseText = "Just ended";
  else phaseText = "Ended";

  const whenLine =
    state.phase === "upcoming"
      ? `Bidding opens ${whenText(terms.start)} and closes ${whenText(terms.end)}.`
      : live
        ? `Closes ${whenText(state.end)}${extended ? ", extended by late bids" : ""}.`
        : state.boughtNow
          ? `Bought now ${whenText(state.end)}.`
          : `Closed ${whenText(state.end)}.`;

  const ignored = auction.status === "ready" ? Math.max(0, auction.read - state.accepted.length) : 0;

  let action: ReactNode = null;
  if (isOwner) {
    action =
      state.phase !== "ended" ? (
        <Alert severity="info">This is your auction. Bids show here as they come in; you can&apos;t bid on it yourself.</Alert>
      ) : pending ? (
        <SettlingNote confirming={auction.confirming} />
      ) : winner ? (
        <Alert
          severity="success"
          icon={<EmojiEventsOutlinedIcon />}
          action={
            <Button color="inherit" href={mailToLink(winner.bidder)} startIcon={<MailOutlinedIcon />} sx={{ minHeight: 44 }}>
              Message
            </Button>
          }
        >
          {winner.bidder} won it for {qort(winner.amount)}. They pay through checkout, and the order shows in your shop&apos;s orders.
        </Alert>
      ) : (
        <Alert severity="info">
          It ended without a sale ({high ? "the reserve wasn't reached" : "no bids"}). Edit the product to run it again, or to sell it at a fixed price.
        </Alert>
      );
  } else if (state.phase === "upcoming") {
    action = <Typography color="text.secondary">Bidding opens when the auction starts.</Typography>;
  } else if (live) {
    action = !user ? (
      <Button variant="contained" size="large" onClick={signIn} disabled={authenticating} sx={{ minHeight: 48, alignSelf: "flex-start" }}>
        Sign in to bid
      </Button>
    ) : auction.status === "failed" ? null : (
      <Box component="form" onSubmit={onSubmit} noValidate sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 1.5 }}>
          <TextField
            label="Your bid"
            value={amountText}
            onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
            placeholder={String(state.minNext)}
            helperText={`At least ${qort(state.minNext)}`}
            disabled={busy || loading}
            sx={{ flex: "1 1 180px" }}
            slotProps={{
              htmlInput: { inputMode: "decimal", autoComplete: "off" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <CoinIcon coin="QORT" size={20} />
                  </InputAdornment>
                ),
                endAdornment: <InputAdornment position="end">QORT</InputAdornment>,
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={busy || loading}
            startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <GavelOutlinedIcon />}
            sx={{ minHeight: 56, flex: "1 1 160px" }}
          >
            {busy ? "Placing bid…" : Number.isFinite(amount) && amount > 0 ? `Bid ${qort(amount)}` : "Place bid"}
          </Button>
        </Box>
        {canBuyNow && (
          <Button variant="outlined" size="large" disabled={busy || loading} onClick={() => void submit(buyNowPrice!)} sx={{ minHeight: 48, alignSelf: "flex-start" }}>
            Buy now for {qort(buyNowPrice!)}
          </Button>
        )}
        <Typography variant="body2" color="text.secondary">
          A bid is a promise to buy: if you win, you pay it through checkout. Hub asks you to confirm each bid (a small publish under your name).
        </Typography>
      </Box>
    );
  } else if (pending) {
    action = <SettlingNote confirming={auction.confirming} />;
  } else if (winner && iWon) {
    action = paid ? (
      <Alert
        severity="success"
        action={
          <Button color="inherit" onClick={() => navigate("/my-orders")} sx={{ minHeight: 44 }}>
            My orders
          </Button>
        }
      >
        You won this auction and paid for it. Follow the order in My orders.
      </Alert>
    ) : unfinished ? (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" onClick={() => navigate("/cart")} sx={{ minHeight: 44 }}>
            Cart
          </Button>
        }
      >
        Your payment for this went out, and the order is waiting to be finished in your cart. Don&apos;t pay again.
      </Alert>
    ) : (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Alert severity="success" icon={<EmojiEventsOutlinedIcon />}>
          You won! Pay {qort(winner.amount)} to {owner} through checkout to get it.
          {user?.name !== winner.bidder && ` You bid as ${winner.bidder}: switch to that name in the name menu to pay.`}
        </Alert>
        <Button
          variant="contained"
          size="large"
          onClick={() => void pay()}
          disabled={checking || user?.name !== winner.bidder || !buyer}
          startIcon={checking ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{ minHeight: 48, alignSelf: "flex-start" }}
        >
          {checking ? "Checking the result…" : `Pay ${qort(winner.amount)}`}
        </Button>
        {orderedSince ? (
          <Alert severity="warning">
            You placed an order at this shop after the auction ended. If it was for this, don&apos;t pay again: check My orders.
          </Alert>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Paid already on another device? Check My orders before you pay.
          </Typography>
        )}
      </Box>
    );
  } else if (winner) {
    action = <Typography sx={{ fontWeight: 600 }}>Won by {winner.bidder} for {qort(winner.amount)}.</Typography>;
  } else {
    action = <Typography color="text.secondary">It ended without a sale{high ? ": the reserve wasn't reached" : ": there were no bids"}.</Typography>;
  }

  const newestFirst = [...state.accepted].reverse();

  return (
    <Box
      component="section"
      aria-labelledby="auction-heading"
      sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Typography id="auction-heading" component="h2" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontSize: 18, fontWeight: 700 }}>
          <GavelOutlinedIcon fontSize="small" aria-hidden />
          Auction
        </Typography>
        <Chip
          size="small"
          label={phaseText}
          color={live ? "success" : state.phase === "upcoming" ? "info" : "default"}
          variant={live ? "filled" : "outlined"}
          sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        {whenLine}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {high ? (state.phase === "ended" ? "Winning bid" : "Current bid") : "Starting bid"}
          </Typography>
          {loading ? (
            <Skeleton width={160} height={40} aria-label="Loading bids" />
          ) : (
            <AmountTag value={high ? high.amount : terms.startingBid} coin="QORT" size="large" sx={{ fontSize: 26 }} />
          )}
        </Box>
        {!loading && auction.status === "ready" && (
          <Typography variant="body2" color="text.secondary" sx={{ pb: 0.5 }}>
            {state.accepted.length === 0 ? "No bids yet" : state.accepted.length === 1 ? "1 bid" : `${state.accepted.length} bids`}
          </Typography>
        )}
      </Box>

      {(high || terms.reserve !== undefined || terms.buyNow !== undefined) && !loading && (
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.25 }}>
          {high && state.phase !== "ended" && (
            <Typography component="li" variant="body2" sx={{ fontWeight: iLead ? 700 : 400 }}>
              {iLead ? "You're the highest bidder." : `Highest bidder: ${high.bidder}.`}
            </Typography>
          )}
          {terms.reserve !== undefined && (
            <Typography component="li" variant="body2">
              {state.reserveMet ? "The reserve price is met." : state.phase === "ended" ? "The reserve price wasn't met." : "The reserve price isn't met yet."}
            </Typography>
          )}
          {terms.buyNow !== undefined && state.phase !== "ended" && (
            <Typography component="li" variant="body2">
              Buy now: {qort(terms.buyNow)} ends it at once.
            </Typography>
          )}
        </Box>
      )}

      {auction.status === "failed" && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" onClick={() => void auction.refresh()} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          }
        >
          The bids couldn&apos;t be loaded from your node{live ? ", so bidding waits until they are" : ""}.
        </Alert>
      )}
      {auction.stale && <Typography variant="body2" color="text.secondary">Couldn&apos;t check for new bids just now; trying again.</Typography>}
      {auction.incomplete && <Alert severity="warning">{TOO_MANY_BIDS}</Alert>}
      {auction.late > 0 && (
        <Typography variant="body2" color="text.secondary">
          {auction.late === 1 ? "1 bid doesn't count" : `${auction.late} bids don't count`}: the chain confirmed {auction.late === 1 ? "it" : "them"} later than
          {auction.late === 1 ? " it claims" : " they claim"}.
        </Typography>
      )}

      {action}

      {auction.placed.map((bid) => (
        <Typography key={bid.id} role="status" variant="body2" color="text.secondary">
          Your bid of {qort(bid.amount)} is on its way: it counts once your node lists it, usually within a minute or two.
        </Typography>
      ))}
      {notice && (
        <Alert severity={notice.severity} role={notice.severity === "error" ? "alert" : "status"} onClose={() => setNotice(null)}>
          {notice.text}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {auction.status === "ready" && state.accepted.length > 0 && (
          <Button
            color="inherit"
            variant="text"
            startIcon={<HistoryOutlinedIcon />}
            onClick={() => setShowBids((v) => !v)}
            aria-expanded={showBids}
            aria-controls="auction-bids"
            sx={{ minHeight: 44, textTransform: "none" }}
          >
            {showBids ? "Hide bids" : `Show bids (${state.accepted.length})`}
          </Button>
        )}
        <Button
          color="inherit"
          variant="text"
          onClick={() => setShowRules((v) => !v)}
          aria-expanded={showRules}
          aria-controls="auction-rules"
          sx={{ minHeight: 44, textTransform: "none" }}
        >
          {showRules ? "Hide how it works" : "How it works"}
        </Button>
      </Box>
      <Collapse in={showBids} unmountOnExit>
        <Box id="auction-bids" component="ol" aria-label="Bids, newest first" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
          {newestFirst.map((bid, i) => (
            <Box
              component="li"
              key={bid.id}
              sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5, py: 0.75, borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}
            >
              <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere", fontWeight: myNames.has(bid.bidder) ? 700 : 400 }}>
                {bid.bidder}
                {myNames.has(bid.bidder) && " (you)"}
              </Typography>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {qort(bid.amount)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {agoText(bid.created, now)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
        {ignored > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {ignored === 1 ? "1 more bid doesn't count" : `${ignored} more bids don't count`}: too low when placed, outside the auction&apos;s times, the seller&apos;s
            own, changed after it was placed, or voided by the seller.
          </Typography>
        )}
      </Collapse>
      <Collapse in={showRules} unmountOnExit>
        <Box id="auction-rules" component="ul" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography component="li" variant="body2">
            Each bid is a small publish on QDN under the bidder&apos;s name, so everyone sees the same bids and the same result.
          </Typography>
          <Typography component="li" variant="body2">
            Bids count in the order they were placed, and each must beat the one before by a small step.
          </Typography>
          {terms.extendMinutes > 0 && (
            <Typography component="li" variant="body2">
              A bid in the last {terms.extendMinutes} minutes moves the end {terms.extendMinutes} minutes past it, so no one wins by bidding at the last second.
            </Typography>
          )}
          <Typography component="li" variant="body2">
            When it ends, the highest bid wins{terms.reserve !== undefined ? " if it reaches the seller's reserve price" : ""}. The winner pays it through
            checkout, in QORT, and the seller sends it as with any order.
          </Typography>
          <Typography component="li" variant="body2">
            A bid changed or deleted after it was placed no longer counts, nor one the seller voids (an absurd bid, or a winner who didn&apos;t pay; the next bid can
            then win).{" "}
            <Link component="button" type="button" variant="body2" onClick={() => void auction.refresh()} sx={{ verticalAlign: "baseline" }}>
              Check for new bids
            </Link>
          </Typography>
        </Box>
      </Collapse>

      {checkout && buyer && (
        <Suspense fallback={null}>
          <CheckoutDialog
            shop={auctionCheckoutShop(storeId, owner, shop)}
            lines={[wonLine(product, productId, catalogueId, checkout)]}
            leftOut={0}
            buyer={buyer}
            onClose={() => setCheckout(null)}
            onPaid={() => {
              noteAuctionPaid(productId, checkout.id);
              setPaidNow(checkout.id);
            }}
          />
        </Suspense>
      )}
    </Box>
  );
}

function SettlingNote({ confirming }: { confirming: boolean }) {
  return (
    <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <CircularProgress size={16} aria-hidden />
      <Typography variant="body2">
        {confirming
          ? "Confirming the result: checking the winning bid's time against the chain."
          : "Confirming the result: bids from the last seconds can take a minute or two to show."}
      </Typography>
    </Box>
  );
}

/**
 * Whether the winner has an order at this shop placed after the auction
 * ended: likely this one, paid from another device (this device remembers
 * only its own payments). One search of their orders there.
 */
function useOrderedSince(buyer: string | null, storeId: string, since: number): boolean {
  const key = buyer ? `${buyer}\n${storeId}\n${since}` : "";
  const [found, setFound] = useState<{ key: string; value: boolean }>({ key: "", value: false });
  useEffect(() => {
    if (!buyer) return;
    let alive = true;
    searchQdn({ service: "DOCUMENT_PRIVATE", identifier: shopOrdersPrefix(shortStoreIdOf(storeId)), prefix: true, name: buyer, exactmatchnames: true, limit: 20, reverse: true }).then(
      (rows) => alive && setFound({ key, value: rows.some((row) => row.name === buyer && Number(row.created) >= since) }),
      () => alive && setFound({ key, value: false })
    );
    return () => {
      alive = false;
    };
  }, [buyer, storeId, since, key]);
  return found.key === key && found.value;
}
