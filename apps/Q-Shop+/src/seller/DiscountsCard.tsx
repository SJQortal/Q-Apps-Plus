/**
 * Shop Settings → Discount codes (discounts/): the shop's codes with what
 * each takes off and its limits, whether it's running, and Edit, Pause and
 * Delete; changes wait until Publish discount codes (one publish, Hub asks
 * to confirm). The codes as typed come from the seller's encrypted list in
 * the document, or this device's copy.
 */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Box, Button, Chip, IconButton, Skeleton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import type { RootState } from "../state/store";
import { setNotification } from "../state/features/notificationsSlice";
import { fiatPricingOf } from "../money/fiatPricing";
import { MAX_DISCOUNTS, discountStatus, type DiscountsDoc } from "../discounts/model";
import { draftLabel, draftSummary, draftsOf, type DiscountDraft } from "../discounts/drafts";
import { decryptDiscountSecret, fetchDiscountsDoc, localDiscountSecret } from "../discounts/discountsDoc";
import { discountDrafts, publishDiscountDrafts } from "./sellerDrafts";
import { draftKey } from "./deviceDrafts";
import { usePublishAsk } from "./usePendingChanges";
import { DiscountDialog } from "./DiscountDialog";

type Load = { key: string; status: "loading" } | { key: string; status: "failed" } | { key: string; status: "ready"; doc: DiscountsDoc | null; published: DiscountDraft[] };

const clock = () => Date.now();

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function StatusChip({ draft, now }: { draft: DiscountDraft; now: number }) {
  const status = discountStatus(draft, now);
  const label = status === "active" ? "Running" : status === "paused" ? "Paused" : status === "ended" ? "Ended" : `Starts ${day(draft.starts ?? now)}`;
  return <Chip size="small" variant="outlined" label={label} sx={{ fontWeight: 600, ...(status === "active" && { borderColor: "success.main" }) }} />;
}

export function DiscountsCard({ publishAsk = 0 }: { publishAsk?: number }) {
  const dispatch = useDispatch();
  const store = useSelector((state: RootState) => state.global.currentStore);
  const user = useSelector((state: RootState) => state.auth.user);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const listReady = !!store && !!dataContainer && dataContainer.storeId === store.id;
  const pricing = listReady ? fiatPricingOf(dataContainer) : null;
  const owner = store?.owner || user?.name || "";
  const storeId = store?.id ?? "";
  const key = `${owner}\n${storeId}`;
  const [load, setLoad] = useState<Load>({ key: "", status: "loading" });
  const [retry, setRetry] = useState(0);
  // The changes are kept on this device until published or undone (seller/sellerDrafts.ts).
  const dKey = draftKey(owner, storeId);
  const drafts = discountDrafts.useDraft(dKey)?.drafts ?? null;
  const [editing, setEditing] = useState<DiscountDraft | "new" | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(clock);

  useEffect(() => {
    if (!owner || !storeId) return;
    let alive = true;
    void (async () => {
      try {
        const doc = await fetchDiscountsDoc(owner, storeId, { fresh: true });
        const read = doc && user?.publicKey ? await decryptDiscountSecret(doc, user.publicKey) : { codes: {}, names: {} };
        const local = localDiscountSecret(storeId);
        // The encrypted list wins; this device's copy fills what it can't say.
        const secret = { codes: { ...local.codes, ...read.codes }, names: { ...local.names, ...read.names } };
        if (alive) setLoad({ key, status: "ready", doc, published: draftsOf(doc, secret) });
      } catch {
        if (alive) setLoad({ key, status: "failed" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, owner, storeId, user?.publicKey, retry]);

  const current: Load = load.key === key ? load : { key, status: "loading" };
  const ready = current.status === "ready";
  const published = ready ? current.published : [];
  const base = ready ? current.doc : null;
  const list = drafts ?? published;
  // A minimum order is in the shop's pricing currency, else QORT; until the product list is in, the published codes'.
  const currency = listReady ? (pricing?.currency ?? "QORT") : (base?.currency ?? "QORT");
  const changed = drafts !== null && JSON.stringify(drafts) !== JSON.stringify(published);
  const change = (next: DiscountDraft[]) => {
    setError(null);
    discountDrafts.set(dKey, JSON.stringify(next) === JSON.stringify(published) ? null : { drafts: next, base });
  };
  const takenCodes = (except?: string) => list.filter((d) => d.id !== except && d.codeText).map((d) => d.codeText as string);

  const publish = async () => {
    if (!owner || publishing || !user?.publicKey || !ready) return;
    setError(null);
    setPublishing(true);
    const outcome = await publishDiscountDrafts({ owner, key: dKey, storeId, currency, publicKey: user.publicKey, draft: { drafts: list, base }, now: clock() });
    setPublishing(false);
    if (outcome.kind === "done" && outcome.doc) {
      setLoad({ key, status: "ready", doc: outcome.doc, published: list });
      discountDrafts.set(dKey, null);
      dispatch(setNotification({ alertType: "success", msg: "Discount codes published" }));
    } else if (outcome.kind === "failed") setError(outcome.message);
  };
  // The page's Publish changes bar asked for it, once the codes are read.
  usePublishAsk(publishAsk, ready && drafts !== null, () => void publish());

  if (!store) return null;
  if (current.status === "loading") return <Skeleton variant="rounded" height={120} aria-label="Loading discount codes" />;
  if (current.status === "failed") {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" onClick={() => setRetry((n) => n + 1)} sx={{ minHeight: 44 }}>
            Try again
          </Button>
        }
      >
        Your discount codes couldn&apos;t be read from your node right now.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Buyers type a code at checkout for a percentage off, free delivery, or both. A code can be for some products, some days, orders over an amount, or
        one Qortal name; a discount for one name needs no code at all.
      </Typography>
      {list.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No discount codes yet.
        </Typography>
      ) : (
        <Box component="ul" aria-label="Discount codes" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {list.map((d) => (
            <Box
              component="li"
              key={d.id}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}
            >
              <LocalOfferOutlinedIcon aria-hidden sx={{ color: "text.secondary" }} />
              <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ fontWeight: 700, fontFamily: d.codeText ? "monospace" : undefined, overflowWrap: "anywhere" }}>{draftLabel(d)}</Typography>
                  <StatusChip draft={d} now={now} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {draftSummary(d, currency)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Button color="inherit" onClick={() => change(list.map((x) => (x.id === d.id ? { ...x, ...(x.paused ? { paused: undefined } : { paused: true as const }) } : x)).map(stripUndefined))} disabled={publishing} sx={{ minHeight: 44 }}>
                  {d.paused ? "Resume" : "Pause"}
                </Button>
                <IconButton aria-label={`Change ${draftLabel(d)}`} onClick={() => setEditing(d)} disabled={publishing} sx={{ width: 44, height: 44 }}>
                  <EditOutlinedIcon />
                </IconButton>
                <IconButton aria-label={`Delete ${draftLabel(d)}`} onClick={() => change(list.filter((x) => x.id !== d.id))} disabled={publishing} sx={{ width: 44, height: 44 }}>
                  <DeleteOutlineOutlinedIcon />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing("new")} disabled={publishing || list.length >= MAX_DISCOUNTS} sx={{ minHeight: 44 }}>
          Add a discount code
        </Button>
        {changed && (
          <Button variant="contained" onClick={() => void publish()} disabled={publishing} sx={{ minHeight: 44 }}>
            {publishing ? "Publishing…" : "Publish discount codes"}
          </Button>
        )}
        {changed && !publishing && (
          <Button color="inherit" onClick={() => discountDrafts.set(dKey, null)} sx={{ minHeight: 44 }}>
            Undo changes
          </Button>
        )}
      </Box>
      {changed && (
        <Typography variant="body2" color="text.secondary">
          Changes go to buyers once you publish them.
        </Typography>
      )}
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
      {editing && (
        <DiscountDialog
          draft={editing === "new" ? null : editing}
          currency={currency}
          takenCodes={takenCodes(editing === "new" ? undefined : editing.id)}
          onSave={(saved) => {
            change(editing === "new" ? [...list, saved] : list.map((x) => (x.id === saved.id ? saved : x)));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Box>
  );
}

/** A draft without keys set to undefined (they'd read as a change). */
function stripUndefined(draft: DiscountDraft): DiscountDraft {
  return Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== undefined)) as DiscountDraft;
}
