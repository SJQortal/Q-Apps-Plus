/**
 * A name for sale, opened (full screen on phones): its avatar, who sells it,
 * a link to what its owner published (which goes with it), and Buy at its
 * price or its auction. The name is read again from Core on opening, so a name sold or
 * repriced meanwhile can't be bought at the old price.
 *
 * An auction (names/auctions.ts) follows its bids live (auctions/useAuction:
 * every 30 s, faster near its end), takes bids while it runs, and at its end
 * shows each side the next step: the seller lists the name at the winning
 * bid, the winner buys it.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, Collapse, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { Bidder, BidList } from "../auctions/BidList";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import ShortUniqueId from "short-unique-id";
import { ResponsiveDialog } from "../components/common/mobile";
import { NameAvatar } from "../components/common/NameAvatar";
import { AmountTag } from "../components/money/PriceTag";
import { formatPrice } from "../money/pricing";
import { parseAmount, sanitizeAmountInput } from "../seller/productDraft";
import { errorMessage, isHubDecline } from "../qdn/hubErrors";
import { invalidateQdnSearches } from "../qdn/search";
import { useAuction } from "../auctions/useAuction";
import { placeBid } from "../auctions/placeBid";
import { MAX_BID, timeLeft } from "../auctions/rules";
import { ExplorerButton, SellerLine, useSellerName } from "./parts";
import { fetchNameState, shortAddress, type NameState } from "./market";
import { buildNameAuctionEnd, buildNameBidPublish, fetchNameBids, NAME_AUCTION_ID, type NameAuction } from "./auctions";
import { buyName, cancelNameSale, sellName, type NameTxResult, type PendingName } from "./actions";
import type { MarketItem } from "./useNamesMarket";

const bidUid = new ShortUniqueId({ length: 6 });
const EPSILON = 1e-9;
const qort = (value: number) => `${formatPrice(value)} QORT`;

export interface NameViewer {
  /** The viewer's address (null: signed out). */
  address: string | null;
  /** The name they act as (bids are published under it). */
  name: string | null;
  /** Every name they own. */
  names: ReadonlySet<string>;
  signIn: () => void;
}

type Notice = { severity: "success" | "info" | "warning" | "error"; text: string };

function noticeOf(result: NameTxResult, sent: string): Notice | null {
  if (result.kind === "sent") return { severity: "success", text: sent };
  if (result.kind === "declined") return { severity: "info", text: "You declined in Hub. Nothing was sent." };
  return { severity: "error", text: result.message };
}

function dateOf(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function NameDialog({
  item,
  viewer,
  pending,
  onClose,
  onChanged,
}: {
  item: MarketItem;
  viewer: NameViewer;
  pending: PendingName | undefined;
  onClose: () => void;
  /** Something was sent: the page's list reads again. */
  onChanged: () => void;
}) {
  // The name as Core has it now; read again after something was sent.
  const [nonce, setNonce] = useState(0);
  const [read, setRead] = useState<{ key: string; value: NameState | null } | null>(null);
  const readKey = `${item.name}\n${nonce}`;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const mine = !!viewer.address && item.owner === viewer.address;
  const sellerName = useSellerName(item.owner);

  useEffect(() => {
    let alive = true;
    void fetchNameState(item.name).then((value) => alive && setRead({ key: readKey, value }));
    return () => {
      alive = false;
    };
  }, [item.name, readKey]);
  const state: NameState | null | "loading" = read?.key === readKey ? read.value : "loading";
  const readState = () => setNonce((n) => n + 1);
  // Its price now, as Core has it (the list may be a minute old).
  const live = state !== "loading" && state !== null ? state : null;
  const stillYours = live ? live.owner === item.owner : true;
  const price = live ? (live.forSale ? live.price : null) : item.price;

  const act = async (run: () => Promise<NameTxResult>, sent: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await run();
    setBusy(false);
    setConfirming(false);
    setNotice(noticeOf(result, sent));
    if (result.kind === "sent") onChanged();
  };

  const buy = () => {
    if (!viewer.address) return viewer.signIn();
    if (price === null) return;
    void act(() => buyName(item.name, viewer.address as string), `Sent. ${item.name} is yours once the next block confirms it (about a minute).`);
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={item.name}
      maxWidth="sm"
      busy={busy}
      actions={
        <Button color="inherit" onClick={onClose} disabled={busy}>
          Close
        </Button>
      }
    >
      <Stack spacing={2.5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
          <NameAvatar name={item.name} size={88} eager />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 24, lineHeight: 1.25, overflowWrap: "anywhere" }}>
              {item.name}
            </Typography>
            {mine ? (
              <Typography variant="body2" color="text.secondary">
                Yours
              </Typography>
            ) : (
              <SellerLine owner={item.owner} />
            )}
            {item.registered && (
              <Typography variant="body2" color="text.secondary">
                Registered {dateOf(item.registered)}
              </Typography>
            )}
          </Box>
        </Box>

        <Box component="section" aria-label="What comes with it" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>What comes with it</Typography>
          <Typography variant="body2" color="text.secondary">
            Everything published under {item.name} goes to its buyer with it; private items stay encrypted to the people they were sent to.
          </Typography>
          <ExplorerButton address={item.owner} name={item.name} />
        </Box>

        {!stillYours ? (
          <Alert severity="info">It has changed hands since this list was read: it&apos;s no longer for sale here.</Alert>
        ) : item.auction ? (
          <NameAuctionBox auction={item.auction} nameState={live} mine={mine} viewer={viewer} sellerName={sellerName} onChanged={() => {
            onChanged();
            readState();
          }} />
        ) : (
          <Box component="section" aria-label="Price" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {price === null ? (
              <Alert severity="info">{state === "loading" ? "Checking it's still for sale…" : "It's no longer for sale."}</Alert>
            ) : (
              <>
                <AmountTag value={price} coin="QORT" size="large" />
                {mine ? (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Button variant="outlined" color="inherit" disabled={busy || !!pending} onClick={() => void act(() => cancelNameSale(item.name), "Sent. It comes off sale once the next block confirms it.")} sx={{ minHeight: 44 }}>
                      {pending ? "Waiting for the next block…" : "Take it off sale"}
                    </Button>
                  </Box>
                ) : confirming ? (
                  <Alert
                    severity="warning"
                    action={
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button color="inherit" onClick={() => setConfirming(false)} disabled={busy} sx={{ minHeight: 44 }}>
                          Cancel
                        </Button>
                        <Button variant="contained" onClick={buy} disabled={busy} sx={{ minHeight: 44 }}>
                          {busy ? "Buying…" : "Buy"}
                        </Button>
                      </Box>
                    }
                  >
                    {`Buy ${item.name} for ${qort(price)}? It moves to your account with everything above. Hub shows the fee and asks you to confirm; a purchase can't be undone.`}
                  </Alert>
                ) : (
                  <Button variant="contained" size="large" disabled={busy || !!pending} onClick={() => (viewer.address ? setConfirming(true) : viewer.signIn())} sx={{ minHeight: 48, alignSelf: "flex-start" }}>
                    {pending ? "Waiting for the next block…" : viewer.address ? `Buy for ${qort(price)}` : "Sign in to buy"}
                  </Button>
                )}
              </>
            )}
          </Box>
        )}
        {notice && (
          <Alert severity={notice.severity} role="status">
            {notice.text}
          </Alert>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}

/** The auction as it stands, live: bids while it runs, then each side's next step. */
function NameAuctionBox({
  auction,
  nameState,
  mine,
  viewer,
  sellerName,
  onChanged,
}: {
  auction: NameAuction;
  nameState: NameState | null;
  mine: boolean;
  viewer: NameViewer;
  sellerName: string | null;
  onChanged: () => void;
}) {
  const reader = useCallback((options: { fresh?: boolean }) => fetchNameBids(auction, options), [auction]);
  const a = useAuction(`nameauc:${auction.uid}`, auction.terms, auction.name, reader);
  const { state, now } = a;
  // What shows: the viewer's own bids on their way already in; the result goes by `state`.
  const shown = a.shown;
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showBids, setShowBids] = useState(false);
  const high = shown.high;
  const winner = a.settling || a.confirming ? null : state.winner;
  const iWon = !!winner && viewer.names.has(winner.bidder);
  const iLead = !!high && viewer.names.has(high.bidder);
  const listedForWinner = !!winner && !!nameState?.forSale && nameState.price !== null && Math.abs(nameState.price - winner.amount) < 1e-8;
  const typed = amountText.trim() ? parseAmount(amountText) : shown.minNext;
  const seller = sellerName ?? shortAddress(auction.owner);

  const bid = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setNotice(null);
    if (!viewer.address) return viewer.signIn();
    if (!viewer.name) return setNotice({ severity: "info", text: "Bids are published under your Qortal name: register one in Hub to bid." });
    if (!Number.isFinite(typed) || typed + EPSILON < shown.minNext) return setNotice({ severity: "error", text: `Bid at least ${qort(shown.minNext)}.` });
    if (typed > MAX_BID) return setNotice({ severity: "error", text: `A bid can be at most ${qort(MAX_BID)}.` });
    setBusy(true);
    const uid = bidUid();
    const outcome = await placeBid({
      name: viewer.name,
      productId: `nameauc:${auction.uid}`,
      storeId: "",
      seller: auction.name,
      amount: typed,
      uid,
      latest: a.refresh,
      build: (at) => buildNameBidPublish({ bidder: viewer.name as string, auction, amount: typed, uid, now: at }),
    });
    setBusy(false);
    if (outcome.kind === "placed") {
      a.notePlaced(outcome.bid);
      setAmountText("");
      setNotice({ severity: "success", text: `Bid placed: ${qort(outcome.bid.amount)}.` });
    } else if (outcome.kind === "declined") setNotice({ severity: "info", text: "You declined in Hub. No bid was placed." });
    else if (outcome.kind === "outbid") setNotice({ severity: "warning", text: `Someone bid meanwhile: the least you can bid now is ${qort(outcome.state.minNext)}.` });
    else if (outcome.kind === "closed") setNotice({ severity: "info", text: outcome.state.phase === "ended" ? "Bidding has closed." : "Bidding hasn't opened yet." });
    else setNotice({ severity: "error", text: outcome.message });
  };

  const send = async (run: () => Promise<NameTxResult>, sent: string) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await run();
    setBusy(false);
    setNotice(noticeOf(result, sent));
    if (result.kind === "sent") onChanged();
  };

  const endAuction = () =>
    send(async () => {
      try {
        await qortalRequest(buildNameAuctionEnd(auction.name) as never);
        invalidateQdnSearches((url) => url.includes(NAME_AUCTION_ID));
        return { kind: "sent" };
      } catch (error) {
        if (isHubDecline(error)) return { kind: "declined" };
        return { kind: "failed", message: errorMessage(error, "Couldn't end the auction. Try again.") };
      }
    }, "Sent. The auction ends once QDN has it.");

  return (
    <Box component="section" aria-label="Auction" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Chip icon={<GavelOutlinedIcon />} label="Auction" variant="outlined" />
        <Typography variant="body2" color="text.secondary">
          {state.phase === "upcoming"
            ? `Bidding opens in ${timeLeft(auction.terms.start - now)}`
            : state.phase === "live"
              ? `Ends in ${timeLeft(state.end - now)}${state.end > auction.terms.end ? " (extended by a late bid)" : ""}`
              : `Ended ${dateOf(state.end)}`}
        </Typography>
      </Box>
      <Box>
        <Typography variant="body2" color="text.secondary">
          {high ? `Leading bid, ${shown.accepted.length} bid${shown.accepted.length === 1 ? "" : "s"}` : "Starting bid"}
        </Typography>
        <AmountTag value={high?.amount ?? auction.terms.startingBid} coin="QORT" size="large" />
        {auction.terms.reserve !== undefined && high && (
          <Typography variant="body2" color="text.secondary">
            {state.reserveMet ? "Reserve met." : "Reserve not met yet."}
          </Typography>
        )}
        {high && state.phase === "live" && (
          <Typography variant="body2" component="div" sx={{ fontWeight: iLead ? 600 : 400, mt: 0.5 }}>
            {iLead ? (
              a.pendingIds.has(high.id) ? "You lead (your bid is on its way to your node)." : "You lead."
            ) : (
              <>
                Leading: <Bidder name={high.bidder} size={20} />
              </>
            )}
          </Typography>
        )}
      </Box>
      {shown.accepted.length > 0 && (
        <Box>
          <Button size="small" onClick={() => setShowBids((v) => !v)} aria-expanded={showBids} aria-controls="name-auction-bids" sx={{ minHeight: 44, ml: -1 }}>
            {showBids ? "Hide bids" : `Show bids (${shown.accepted.length})`}
          </Button>
          <Collapse in={showBids} unmountOnExit>
            <BidList id="name-auction-bids" bids={shown.accepted} now={now} mine={viewer.names} pending={a.pendingIds} />
          </Collapse>
        </Box>
      )}
      {nameState?.forSale && nameState.price !== null && !winner && state.phase !== "ended" && (
        <Typography variant="body2" color="text.secondary">
          Also for sale on chain at {qort(nameState.price)}: anyone can buy it at that price at any time.
        </Typography>
      )}

      {state.phase === "live" && !mine && (
        <Box component="form" onSubmit={bid} noValidate sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label="Your bid"
            value={amountText}
            onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
            placeholder={formatPrice(shown.minNext)}
            helperText={`At least ${qort(shown.minNext)}`}
            slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> }, inputLabel: { shrink: true } }}
            sx={{ flex: "1 1 180px" }}
          />
          <Button type="submit" variant="contained" disabled={busy} sx={{ minHeight: 56 }}>
            {busy ? "Placing…" : viewer.address ? "Place bid" : "Sign in to bid"}
          </Button>
        </Box>
      )}
      {state.phase === "live" && !mine && (
        <Typography variant="body2" color="text.secondary">
          A bid is published under your name, so everyone can see it. If you win, the seller lists the name at your bid and you buy it here.
        </Typography>
      )}

      {mine && state.phase !== "ended" && state.accepted.length === 0 && (
        <Button variant="outlined" color="inherit" onClick={() => void endAuction()} disabled={busy} sx={{ minHeight: 44, alignSelf: "flex-start" }}>
          End auction
        </Button>
      )}
      {mine && state.phase !== "ended" && state.accepted.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          It has bids, so it runs to its end.
        </Typography>
      )}

      {state.phase === "ended" && (a.settling || a.confirming) && (
        <Alert severity="info">Checking the last bids before the result is final…</Alert>
      )}
      {state.phase === "ended" && !a.settling && !a.confirming && !state.winner && (
        <Alert
          severity="info"
          action={
            mine ? (
              <Button color="inherit" onClick={() => void endAuction()} disabled={busy} sx={{ minHeight: 44 }}>
                Close it
              </Button>
            ) : undefined
          }
        >
          {state.high ? "It ended below the reserve: no winner." : "It ended without bids."}
        </Alert>
      )}
      {winner && mine && !listedForWinner && (
        <Alert
          severity="success"
          action={
            <Button color="inherit" variant="outlined" disabled={busy} onClick={() => void send(() => sellName(auction.name, winner.amount), `Sent. Once the next block confirms it, ${winner.bidder} can buy it.`)} sx={{ minHeight: 44 }}>
              {`List for ${qort(winner.amount)}`}
            </Button>
          }
        >
          {`${winner.bidder} won at ${qort(winner.amount)}. List the name at that price so they can buy it (Hub asks you to confirm).`}
        </Alert>
      )}
      {winner && mine && listedForWinner && (
        <Alert severity="info">{`Listed at ${qort(winner.amount)} for ${winner.bidder}. You're paid when they buy it.`}</Alert>
      )}
      {winner && !mine && iWon && (
        listedForWinner ? (
          <Alert
            severity="success"
            action={
              <Button variant="contained" disabled={busy} onClick={() => viewer.address && void send(() => buyName(auction.name, viewer.address as string), `Sent. ${auction.name} is yours once the next block confirms it.`)} sx={{ minHeight: 44 }}>
                {`Buy for ${qort(winner.amount)}`}
              </Button>
            }
          >
            {`You won. ${seller} has listed it at your bid: buy it now (anyone could buy it at this price meanwhile).`}
          </Alert>
        ) : (
          <Alert severity="success">{`You won at ${qort(winner.amount)}. Waiting for ${seller} to list it at your bid; then buy it here.`}</Alert>
        )
      )}
      {winner && !mine && !iWon && <Alert severity="info">{`Won by ${winner.bidder} at ${qort(winner.amount)}.`}</Alert>}
      {notice && (
        <Alert severity={notice.severity} role="status">
          {notice.text}
        </Alert>
      )}
    </Box>
  );
}
