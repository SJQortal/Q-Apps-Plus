/**
 * Names (`/names`): Qortal names for sale, bought and sold on chain as in
 * the Names app (names/market.ts), and name auctions (names/auctions.ts).
 * "For sale" lists them as cards (avatar, who sells it, what it comes with,
 * price or auction) with a search, Buy now / Auctions and five sorts; "My
 * names" lists the viewer's own with what each is doing and Sell, Take off
 * sale or Open. Hidden from the app (tab and page) by Settings → Names for
 * sale.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { visuallyHiddenSx } from "../pages/Store/a11y";
import { Alert, Box, Button, Chip, InputAdornment, MenuItem, Paper, Skeleton, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { useInView } from "react-intersection-observer";
import type { RootState } from "../state/store";
import { Page, PageHeader } from "../components/layout/Page";
import { EmptyState } from "../components/common/EmptyState";
import { NameAvatar } from "../components/common/NameAvatar";
import { AmountTag } from "../components/money/PriceTag";
import { selectMenuProps } from "../components/common/menuStyle";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { useNow } from "../hooks/useNow";
import { useShellActions } from "../components/layout/shellState";
import { useShowNames } from "../utils/namesSetting";
import { NameCard } from "./NameCard";
import { NameDialog, type NameViewer } from "./NameDialog";
import { SellNameDialog, type NameSaleStatus } from "./SellNameDialog";
import { cancelNameSale, usePendingNames, type PendingName } from "./actions";
import { useNamesMarket, type MarketItem } from "./useNamesMarket";
import { fetchAccountNames, primaryNameOf } from "./market";

export const NAMES_PAGE_SIZE = 24;

export type NameSort = "newest" | "price-asc" | "price-desc" | "name" | "short";
const SORTS: { value: NameSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
  { value: "short", label: "Shortest first" },
];
export type NameKind = "all" | "price" | "auction";

/** An item's price for sorting: its price, or its auction's starting bid. */
function sortPrice(item: MarketItem): number {
  return item.auction ? item.auction.terms.startingBid : (item.price ?? Number.POSITIVE_INFINITY);
}

export function filterAndSortNames(items: MarketItem[], query: { text: string; kind: NameKind; sort: NameSort }): MarketItem[] {
  const text = query.text.trim().toLowerCase();
  const list = items.filter(
    (item) =>
      (!text || item.name.toLowerCase().includes(text)) &&
      (query.kind === "all" || (query.kind === "auction" ? !!item.auction : !item.auction && item.price !== null))
  );
  const byName = (a: MarketItem, b: MarketItem) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  switch (query.sort) {
    case "price-asc":
      return list.sort((a, b) => sortPrice(a) - sortPrice(b) || byName(a, b));
    case "price-desc":
      return list.sort((a, b) => sortPrice(b) - sortPrice(a) || byName(a, b));
    case "name":
      return list.sort(byName);
    case "short":
      return list.sort((a, b) => a.name.length - b.name.length || byName(a, b));
    default:
      return list.sort((a, b) => b.listedAt - a.listedAt || byName(a, b));
  }
}

/** On phones, where the bar at the bottom holds five items: Products and Names side by side at the top. */
export function ProductsNamesSwitch({ current }: { current: "products" | "names" }) {
  const phone = usePhoneLayout();
  const show = useShowNames();
  const navigate = useNavigate();
  if (!phone || !show) return null;
  return (
    <ToggleButtonGroup
      exclusive
      value={current}
      onChange={(_, next: "products" | "names" | null) => next && next !== current && navigate(`/${next}`)}
      aria-label="Products or names"
      fullWidth
      sx={{ mb: 2, "& .MuiToggleButton-root": { minHeight: 44, textTransform: "none", fontWeight: 600 } }}
    >
      <ToggleButton value="products">Products</ToggleButton>
      <ToggleButton value="names">Names</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function NamesPage() {
  const show = useShowNames();
  const navigate = useNavigate();
  if (!show) {
    return (
      <Page width="grid">
        <PageHeader title="Names" />
        <EmptyState
          icon={<BadgeOutlinedIcon />}
          title="Names for sale are hidden"
          description="Turn on Names for sale in Settings to buy and sell Qortal names here."
          actionLabel="Open Settings"
          onAction={() => navigate("/settings")}
        />
      </Page>
    );
  }
  return <NamesMarketPage />;
}

function NamesMarketPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const { signIn } = useShellActions();
  const now = useNow(30_000);
  const market = useNamesMarket();
  const { reload } = market;
  const onSettled = useCallback(() => reload(true), [reload]);
  const pending = usePendingNames(onSettled);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "mine" ? "mine" : "sale";
  const [text, setText] = useState("");
  const [kind, setKind] = useState<NameKind>("all");
  const [sort, setSort] = useState<NameSort>("newest");
  const [pages, setPages] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [selling, setSelling] = useState<{ initial: string | null } | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const myNames = useMemo(() => new Set((user?.names ?? []).map((n) => n.name).concat(user?.name ? [user.name] : [])), [user]);
  const viewer: NameViewer = { address: user?.address ?? null, name: user?.name ?? null, names: myNames, signIn };
  const listed = useMemo(() => filterAndSortNames(market.items, { text, kind, sort }), [market.items, text, kind, sort]);
  const shown = listed.slice(0, pages * NAMES_PAGE_SIZE);
  const { ref: more } = useInView({ rootMargin: "400px 0px", skip: shown.length >= listed.length, onChange: (inView) => inView && setPages((p) => p + 1) });
  const openItem = open ? market.items.find((i) => i.name === open) ?? null : null;
  const auctions = market.items.filter((i) => i.auction).length;

  const setTab = (next: "sale" | "mine") => {
    const p = new URLSearchParams(params);
    if (next === "mine") p.set("tab", "mine");
    else p.delete("tab");
    setParams(p, { replace: true });
  };

  let body: ReactNode;
  if (market.status === "loading") {
    body = (
      <Box aria-hidden sx={gridSx}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={190} />
        ))}
      </Box>
    );
  } else if (market.status === "error") {
    body = <EmptyState title="Couldn't read the names for sale" description="Your node didn't answer. Try again in a moment." actionLabel="Retry" onAction={() => reload(true)} />;
  } else if (market.items.length === 0) {
    body = (
      <EmptyState
        icon={<BadgeOutlinedIcon />}
        title="No names for sale right now"
        description="Names listed here or in the Names app show up here."
        actionLabel={user?.address ? "Sell a name" : undefined}
        onAction={user?.address ? () => setSelling({ initial: null }) : undefined}
      />
    );
  } else if (listed.length === 0) {
    body = <EmptyState icon={<SearchIcon />} title="No names match" actionLabel="Show all" onAction={() => { setText(""); setKind("all"); }} />;
  } else {
    body = (
      <>
        {/* The cards' names are h3: a heading of the list's own comes first. */}
        <Typography component="h2" sx={visuallyHiddenSx}>
          Names for sale
        </Typography>
        <Box component="ul" aria-label="Names for sale" sx={{ ...gridSx, listStyle: "none", m: 0, p: 0 }}>
          {shown.map((item) => (
            <Box component="li" key={item.name} sx={{ minWidth: 0 }}>
              <NameCard item={item} now={now} mine={!!user?.address && item.owner === user.address} pending={pending.get(item.name)} onOpen={(i) => setOpen(i.name)} />
            </Box>
          ))}
        </Box>
        {shown.length < listed.length && (
          <Box ref={more} sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button variant="outlined" color="inherit" onClick={() => setPages((p) => p + 1)} sx={{ minHeight: 44, minWidth: 160 }}>
              Show more
            </Button>
          </Box>
        )}
        {!market.complete && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Showing the first 2,000 names for sale.
          </Typography>
        )}
      </>
    );
  }

  return (
    <Page width="grid">
      <ProductsNamesSwitch current="names" />
      <PageHeader
        title="Names"
        subtitle="Qortal names for sale, with everything published under them."
        actions={
          user?.address ? (
            <Button variant="contained" startIcon={<SellOutlinedIcon />} onClick={() => setSelling({ initial: null })} sx={{ minHeight: 44 }}>
              Sell a name
            </Button>
          ) : undefined
        }
      />
      <ToggleButtonGroup
        exclusive
        value={tab}
        onChange={(_, next: "sale" | "mine" | null) => next && setTab(next)}
        aria-label="Names"
        sx={{ mb: 2, "& .MuiToggleButton-root": { minHeight: 44, px: 2.5, textTransform: "none", fontWeight: 600 } }}
      >
        <ToggleButton value="sale">For sale</ToggleButton>
        <ToggleButton value="mine">My names</ToggleButton>
      </ToggleButtonGroup>
      {sent && (
        <Alert severity="success" onClose={() => setSent(null)} sx={{ mb: 2 }} role="status">
          {sent}
        </Alert>
      )}
      {tab === "sale" ? (
        <>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
            <TextField
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setPages(1);
              }}
              placeholder="Search names"
              size="small"
              slotProps={{
                htmlInput: { "aria-label": "Search names", enterKeyHint: "search" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: "1 1 220px", "& .MuiInputBase-root": { minHeight: 44 } }}
            />
            <TextField
              select
              size="small"
              label="Sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as NameSort);
                setPages(1);
              }}
              slotProps={{ select: { MenuProps: selectMenuProps } }}
              sx={{ minWidth: 190, flex: { xs: "1 1 150px", sm: "0 0 auto" }, "& .MuiInputBase-root": { minHeight: 44 } }}
            >
              {SORTS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box role="group" aria-label="Show" sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2, alignItems: "center" }}>
            {(["all", "price", "auction"] as const).map((k) => (
              <Chip
                key={k}
                label={k === "all" ? "All" : k === "price" ? "Buy now" : `Auctions${auctions ? ` (${auctions})` : ""}`}
                color={kind === k ? "primary" : "default"}
                variant={kind === k ? "filled" : "outlined"}
                onClick={() => {
                  setKind(k);
                  setPages(1);
                }}
                aria-pressed={kind === k}
                sx={{ height: 36 }}
              />
            ))}
            {market.status === "ready" && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
                {`${listed.length.toLocaleString("en-US")} name${listed.length === 1 ? "" : "s"}`}
              </Typography>
            )}
          </Box>
          {body}
        </>
      ) : (
        <MyNames
          address={user?.address ?? null}
          knownNames={(user?.names ?? []).map((n) => n.name)}
          items={market.items}
          pending={pending}
          onSignIn={signIn}
          onSell={(name) => setSelling({ initial: name })}
          onOpen={(name) => setOpen(name)}
          onSent={(message) => {
            setSent(message);
            reload(true);
          }}
        />
      )}
      {openItem && <NameDialog item={openItem} viewer={viewer} pending={pending.get(openItem.name)} onClose={() => setOpen(null)} onChanged={() => reload(true)} />}
      {selling && user?.address && (
        <SellDialogLoader
          address={user.address}
          knownNames={(user.names ?? []).map((n) => n.name)}
          items={market.items}
          pending={pending}
          initial={selling.initial}
          onClose={() => setSelling(null)}
          onSent={(message) => {
            setSelling(null);
            setSent(message);
            reload(true);
          }}
        />
      )}
    </Page>
  );
}

const gridSx = {
  display: "grid",
  gap: 2,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
} as const;

/** The viewer's names (read afresh from Hub) and their primary name. */
function useMyNames(address: string | null, known: string[]): { names: string[]; primary: string | null; loading: boolean } {
  const [read, setRead] = useState<{ address: string; names: string[]; primary: string | null } | null>(null);
  useEffect(() => {
    if (!address) return;
    let alive = true;
    Promise.all([fetchAccountNames(address).catch(() => null), primaryNameOf(address)]).then(([names, primary]) => {
      if (alive) setRead({ address, names: names ?? [], primary });
    });
    return () => {
      alive = false;
    };
  }, [address]);
  const current = read?.address === address ? read : null;
  return { names: current && current.names.length > 0 ? current.names : known, primary: current?.primary ?? null, loading: !!address && !current };
}

function statusOf(name: string, items: MarketItem[], pending: ReadonlyMap<string, PendingName>): NameSaleStatus {
  if (pending.has(name)) return "pending";
  const item = items.find((i) => i.name === name);
  if (item?.auction) return "auction";
  if (item && item.price !== null) return "forSale";
  return "free";
}

function SellDialogLoader(props: {
  address: string;
  knownNames: string[];
  items: MarketItem[];
  pending: ReadonlyMap<string, PendingName>;
  initial: string | null;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const mine = useMyNames(props.address, props.knownNames);
  // The primary name decides what can be sold: wait for it.
  if (mine.loading) return null;
  return (
    <SellNameDialog
      names={mine.names}
      primary={mine.primary}
      statusOf={(name) => statusOf(name, props.items, props.pending)}
      address={props.address}
      initial={props.initial}
      onClose={props.onClose}
      onSent={props.onSent}
    />
  );
}

/** More names than this get a search box. */
const SEARCH_FROM = 20;

function MyNames({
  address,
  knownNames,
  items,
  pending,
  onSignIn,
  onSell,
  onOpen,
  onSent,
}: {
  address: string | null;
  knownNames: string[];
  items: MarketItem[];
  pending: ReadonlyMap<string, PendingName>;
  onSignIn: () => void;
  onSell: (name: string) => void;
  onOpen: (name: string) => void;
  onSent: (message: string) => void;
}) {
  const mine = useMyNames(address, knownNames);
  // Over 20 names, a search finds one (Simon, 2026-10-25).
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const searchable = mine.names.length > SEARCH_FROM;
  const shown = searchable && needle ? mine.names.filter((n) => n.toLowerCase().includes(needle)) : mine.names;
  if (!address) return <EmptyState icon={<BadgeOutlinedIcon />} title="Sign in to see your names" actionLabel="Sign in" onAction={onSignIn} />;
  if (mine.loading && mine.names.length === 0) return <Skeleton variant="rounded" height={160} />;
  if (mine.names.length === 0) return <EmptyState icon={<BadgeOutlinedIcon />} title="Your account has no names yet" description="Register a name in Hub (or the Names app), or buy one here." />;
  return (
    <>
      <Typography component="h2" sx={visuallyHiddenSx}>
        My names
      </Typography>
      {searchable && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
          <TextField
            type="search"
            size="small"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search your ${mine.names.length} names`}
            slotProps={{
              htmlInput: { "aria-label": "Search your names" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: "1 1 260px", maxWidth: 480, "& .MuiInputBase-root": { minHeight: 44 } }}
          />
          {needle && (
            <Typography variant="body2" color="text.secondary" role="status">
              {shown.length === 1 ? "1 name matches" : `${shown.length} names match`}
            </Typography>
          )}
        </Box>
      )}
      {shown.length === 0 && <Typography color="text.secondary">None of your names has &ldquo;{query.trim()}&rdquo; in it.</Typography>}
      {/* Compact cards, several a row where there's room (Simon: "can be more nicely compressed"). */}
      <Box
        component="ul"
        aria-label="My names"
        sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 1 }}
      >
        {shown.map((name) => (
          <MyNameRow key={name} name={name} primary={name === mine.primary} others={mine.names.length > 1} item={items.find((i) => i.name === name) ?? null} pending={pending.get(name)} onSell={onSell} onOpen={onOpen} onSent={onSent} />
        ))}
      </Box>
    </>
  );
}

function MyNameRow({
  name,
  primary,
  others,
  item,
  pending,
  onSell,
  onOpen,
  onSent,
}: {
  name: string;
  primary: boolean;
  /** The account has other names (its primary one then can't be sold). */
  others: boolean;
  item: MarketItem | null;
  pending: PendingName | undefined;
  onSell: (name: string) => void;
  onOpen: (name: string) => void;
  onSent: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancel = async () => {
    setBusy(true);
    setProblem(null);
    const result = await cancelNameSale(name);
    setBusy(false);
    if (result.kind === "sent") onSent(`Sent. ${name} comes off sale once the next block confirms it.`);
    else if (result.kind === "failed") setProblem(result.message);
  };
  return (
    <Paper component="li" variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5 }}>
      <NameAvatar name={name} size={36} />
      <Box sx={{ flex: "1 1 0", minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>
            {name}
          </Typography>
          {primary && <Chip size="small" variant="outlined" label="Primary" sx={{ height: 20, fontSize: 11, flexShrink: 0 }} />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", fontSize: 13 }}>
          {pending ? (
            "Waiting for the next block…"
          ) : item?.auction ? (
            "In an auction"
          ) : item && item.price !== null ? (
            <>
              For sale at <AmountTag value={item.price} coin="QORT" size="small" />
            </>
          ) : primary && others ? (
            // Why it can't be sold, in the card's own line.
            <span title="Your primary name is your identity in Qortal apps: it can't be sold while you have other names.">Sell your other names first</span>
          ) : (
            "Not for sale"
          )}
        </Typography>
        {problem && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {problem}
          </Alert>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
        {item?.auction || (item && item.price !== null && pending) ? (
          <Button variant="outlined" color="inherit" onClick={() => onOpen(name)} sx={{ minHeight: 44 }}>
            Open
          </Button>
        ) : item && item.price !== null ? (
          <Button variant="outlined" color="inherit" onClick={() => void cancel()} disabled={busy || !!pending} sx={{ minHeight: 44 }}>
            {busy ? "Sending…" : "Take off sale"}
          </Button>
        ) : (
          // The primary name can't be sold while there are others: no button, its line says why.
          !(primary && others) && (
            <Button variant="outlined" onClick={() => onSell(name)} disabled={!!pending} sx={{ minHeight: 44, minWidth: 64 }} aria-label={`Sell ${name}`}>
              Sell
            </Button>
          )
        )}
      </Box>
    </Paper>
  );
}
