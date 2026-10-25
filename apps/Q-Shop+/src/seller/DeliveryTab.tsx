/**
 * The seller's Delivery tab (delivery/model.ts): what delivery costs where,
 * in shipping profiles. General covers every product not in another
 * profile; each profile has its zones (countries and regions, US states) with
 * a price for the first item, what each extra item adds, and an amount from
 * which it's free, and its own products. Prices are in the shop's currency when it
 * prices in one (USD…), and QORT and ARRR follow from its rates; else in QORT.
 * Changes stay here until Publish sends the one document.
 */
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ShortUniqueId from "short-unique-id";
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Skeleton, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import type { RootState } from "../state/store";
import { setNotification } from "../state/features/notificationsSlice";
import { fiatPricingOf } from "../money/fiatPricing";
import { US, shippingCountriesOf, shippingStatesOf, shippingSummaryWithStates } from "../constants/shipping";
import { publishMedia } from "../richtext/publishMedia";
import { BASE_OPTION_NAME, MAX_OPTIONS, MAX_PROFILES, MAX_ZONES, deliveryMoney as money, type DeliveryDoc, type DeliveryOption, type DeliveryProfile, type DeliveryRate, type DeliveryZone } from "../delivery/model";
import { buildDeliveryPublish, fetchDeliveryDoc, rememberDeliveryDoc } from "../delivery/deliveryDoc";
import { DeliveryZoneDialog } from "./DeliveryZoneDialog";
import { DeliveryProductsDialog } from "./DeliveryProductsDialog";
import { ResponsiveDialog } from "../components/common/mobile";
import type { SellerRow } from "./productList";

const uid = new ShortUniqueId({ length: 8 });
const newId = () => uid();

/** "$5.00 · $1.00 each extra item · free from $100.00" */
export function zonePrice(zone: DeliveryRate, currency: string): string {
  const parts = [zone.first > 0 ? money(zone.first, currency) : "Free"];
  if (zone.extra) parts.push(`${money(zone.extra, currency)} each extra item`);
  if (zone.freeOver) parts.push(`free from ${money(zone.freeOver, currency)}`);
  return parts.join(" · ");
}

/** Ideas for a new option's name, the most asked for first. */
const OPTION_IDEAS = ["Express", "Local pickup", "Tracked", "Economy"];

/**
 * The delivery options buyers pick from at checkout (delivery/model.ts): the
 * zones' own prices are the first (renamed here, "Standard" by default), and
 * up to four others, each priced in the zones that offer it.
 */
function OptionsCard({ doc, onChange, disabled }: { doc: DeliveryDoc; onChange: (doc: DeliveryDoc) => void; disabled: boolean }) {
  const options = doc.options ?? [];
  const setBase = (patch: Partial<{ name: string; note: string }>) => {
    const base = { name: doc.base?.name ?? "", note: doc.base?.note ?? "", ...patch };
    const name = base.name.slice(0, 40);
    const note = base.note.slice(0, 80);
    const rest = { ...doc };
    delete rest.base;
    onChange(name.trim() || note.trim() ? { ...rest, base: { name: name || BASE_OPTION_NAME, ...(note && { note }) } } : rest);
  };
  const setOption = (id: string, patch: Partial<DeliveryOption>) =>
    onChange({ ...doc, options: options.map((o) => (o.id === id ? { ...o, ...patch, name: (patch.name ?? o.name).slice(0, 40), ...(patch.note !== undefined && { note: patch.note.slice(0, 80) }) } : o)) });
  const addOption = (name: string) => onChange({ ...doc, options: [...options, { id: newId(), name }].slice(0, MAX_OPTIONS) });
  const removeOption = (id: string) => {
    // Its prices go from every zone too.
    const strip = (zones: DeliveryZone[]) =>
      zones.map((z) => {
        if (!z.rates?.[id]) return z;
        const rates = { ...z.rates };
        delete rates[id];
        const next: DeliveryZone = { ...z, rates };
        if (Object.keys(rates).length === 0) delete next.rates;
        return next;
      });
    const rest = options.filter((o) => o.id !== id);
    const next: DeliveryDoc = { ...doc, general: { zones: strip(doc.general.zones) }, profiles: doc.profiles.map((p) => ({ ...p, zones: strip(p.zones) })) };
    if (rest.length > 0) next.options = rest;
    else delete next.options;
    onChange(next);
  };
  const ideas = OPTION_IDEAS.filter((idea) => !options.some((o) => o.name.toLowerCase() === idea.toLowerCase()));
  return (
    <Paper component="section" aria-labelledby="delivery-options-title" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box>
        <Typography id="delivery-options-title" component="h3" sx={{ fontWeight: 700, fontSize: 17 }}>
          Delivery options
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Buyers pick one at checkout. Your zones&apos; prices below are the first option; add others, like Express or Local pickup, and price them in
          each zone that offers them.
        </Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1.4fr) 44px" }, alignItems: "start" }}>
        <TextField
          label="First option"
          value={doc.base?.name ?? ""}
          placeholder={BASE_OPTION_NAME}
          onChange={(e) => setBase({ name: e.target.value })}
          disabled={disabled}
          slotProps={{ htmlInput: { maxLength: 40 }, inputLabel: { shrink: true } }}
        />
        <TextField
          label="Note (optional)"
          value={doc.base?.note ?? ""}
          placeholder="5–10 days"
          onChange={(e) => setBase({ note: e.target.value })}
          disabled={disabled}
          slotProps={{ htmlInput: { maxLength: 80 }, inputLabel: { shrink: true } }}
        />
        <Box />
        {options.map((o, i) => (
          <Box key={o.id} sx={{ display: "contents" }}>
            <TextField
              label={`Option ${i + 2}`}
              value={o.name}
              onChange={(e) => setOption(o.id, { name: e.target.value })}
              disabled={disabled}
              error={!o.name.trim()}
              helperText={!o.name.trim() ? "Name it, or remove it" : undefined}
              slotProps={{ htmlInput: { maxLength: 40 }, inputLabel: { shrink: true } }}
            />
            <TextField
              label="Note (optional)"
              value={o.note ?? ""}
              placeholder={o.name.toLowerCase().includes("pickup") ? "Where and when to collect" : "1–3 days"}
              onChange={(e) => setOption(o.id, { note: e.target.value })}
              disabled={disabled}
              slotProps={{ htmlInput: { maxLength: 80 }, inputLabel: { shrink: true } }}
            />
            <IconButton aria-label={`Remove the option ${o.name || i + 2}`} onClick={() => removeOption(o.id)} disabled={disabled} sx={{ width: 44, height: 44, mt: 0.5 }}>
              <DeleteOutlineOutlinedIcon />
            </IconButton>
          </Box>
        ))}
      </Box>
      {options.length < MAX_OPTIONS && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Button startIcon={<AddIcon />} onClick={() => addOption(ideas[0] ?? `Option ${options.length + 2}`)} disabled={disabled} sx={{ minHeight: 44 }}>
            Add an option
          </Button>
          {ideas.slice(0, 3).map((idea) => (
            <Button key={idea} variant="outlined" color="inherit" size="small" onClick={() => addOption(idea)} disabled={disabled} sx={{ minHeight: 36 }}>
              {idea}
            </Button>
          ))}
        </Box>
      )}
      {options.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          Open a zone to price each option there. An option a zone doesn&apos;t price isn&apos;t offered for it.
        </Typography>
      )}
    </Paper>
  );
}

/** The zone being edited (null: a new one), and a new one's starting places. */
type Editing = { profile: string | null; zone: DeliveryZone | null; start?: Pick<DeliveryZone, "name" | "countries" | "states"> } | null;

function ProfileNameDialog({ name: initial, onSave, onClose }: { name: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const clean = name.trim().slice(0, 60);
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Name the shipping profile"
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!clean} onClick={() => onSave(clean)}>
            Save name
          </Button>
        </>
      }
    >
      <TextField
        label="Profile name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && clean) onSave(clean);
        }}
        autoFocus
        fullWidth
        helperText="Heavy items, Fragile, Furniture…"
        slotProps={{ htmlInput: { maxLength: 60 } }}
        sx={{ mt: 1 }}
      />
    </ResponsiveDialog>
  );
}

function ZoneRows({
  zones,
  currency,
  onEdit,
  onRemove,
  disabled,
  options = [],
  baseName,
}: {
  zones: DeliveryZone[];
  currency: string;
  onEdit: (zone: DeliveryZone) => void;
  onRemove: (zone: DeliveryZone) => void;
  disabled: boolean;
  /** The shop's other delivery options: each zone shows its price for those it offers. */
  options?: DeliveryOption[];
  baseName?: string;
}) {
  if (zones.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No zones yet: delivery is free wherever the shop ships. Add a zone to charge for it.
      </Typography>
    );
  }
  return (
    <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
      {zones.map((zone, i) => {
        const where = shippingSummaryWithStates(zone.countries, zone.states ?? null);
        // An unnamed zone is called by where it goes ("The United States: Oregon"); a named one says where under its name.
        const title = zone.name || where.charAt(0).toUpperCase() + where.slice(1);
        return (
          <Box component="li" key={zone.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{title}</Typography>
              {zone.name && (
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {where}
                </Typography>
              )}
              <Typography variant="body2">
                {options.length > 0 ? `${baseName || BASE_OPTION_NAME}: ` : ""}
                {zonePrice(zone, currency)}
              </Typography>
              {options
                .filter((o) => zone.rates?.[o.id])
                .map((o) => (
                  <Typography key={o.id} variant="body2">
                    {o.name}: {zonePrice(zone.rates![o.id], currency)}
                  </Typography>
                ))}
            </Box>
            <IconButton aria-label={`Edit zone: ${title}`} onClick={() => onEdit(zone)} disabled={disabled} sx={{ width: 44, height: 44 }}>
              <EditOutlinedIcon />
            </IconButton>
            <IconButton aria-label={`Remove zone: ${title}`} onClick={() => onRemove(zone)} disabled={disabled} sx={{ width: 44, height: 44 }}>
              <DeleteOutlineOutlinedIcon />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}

export function DeliveryTab({ ready }: { ready: boolean }) {
  const dispatch = useDispatch();
  const store = useSelector((state: RootState) => state.global.currentStore);
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const pricing = useMemo(() => fiatPricingOf(dataContainer as object | null), [dataContainer]);
  const shopCurrency = pricing?.currency ?? "QORT";
  const owner = store?.owner || name || "";
  const storeId = store?.id ?? "";
  const [load, setLoad] = useState<{ key: string; status: "loading" | "ready" | "failed"; doc: DeliveryDoc | null }>({ key: "", status: "loading", doc: null });
  const [draft, setDraft] = useState<{ key: string; doc: DeliveryDoc } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [choosing, setChoosing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${owner}\n${storeId}\n${retry}`;

  useEffect(() => {
    if (!owner || !storeId) return;
    let alive = true;
    fetchDeliveryDoc(owner, storeId, { fresh: true }).then(
      (doc) => alive && setLoad({ key, status: "ready", doc }),
      () => alive && setLoad({ key, status: "failed", doc: null })
    );
    return () => {
      alive = false;
    };
  }, [owner, storeId, key]);

  const current = load.key === key ? load : { key, status: "loading" as const, doc: null };
  const saved = current.doc;
  const empty: DeliveryDoc = { v: 1, storeId, currency: shopCurrency, general: { zones: [] }, profiles: [], updated: 0 };
  const doc = draft && draft.key === key ? draft.doc : (saved ?? empty);
  const changed = !!draft && draft.key === key && JSON.stringify(draft.doc) !== JSON.stringify(saved ?? empty);
  const change = (next: DeliveryDoc) => setDraft({ key, doc: next });
  /** The products in the other profiles than this one, with their profile's name. */
  const elsewhere = (profileId: string) => {
    const map = new Map<string, string>();
    for (const p of doc.profiles) if (p.id !== profileId) for (const id of p.products) if (!map.has(id)) map.set(id, p.name);
    return map;
  };
  const choosingProfile = doc.profiles.find((p) => p.id === choosing);
  // The shop's products: a profile counts those still in it (one deleted since stays listed, harmlessly).
  const known = useMemo(() => new Set(rows.map((r) => r.productId)), [rows]);
  const productCount = (profile: DeliveryProfile) => {
    const n = rows.length ? profile.products.filter((id) => known.has(id)).length : profile.products.length;
    return n === 1 ? "1 product" : `${n} products`;
  };

  const saveZone = (profileId: string | null, zone: DeliveryZone) => {
    const put = (zones: DeliveryZone[]) => (zones.some((z) => z.id === zone.id) ? zones.map((z) => (z.id === zone.id ? zone : z)) : [...zones, zone].slice(0, MAX_ZONES));
    change(
      profileId === null
        ? { ...doc, general: { zones: put(doc.general.zones) } }
        : { ...doc, profiles: doc.profiles.map((p) => (p.id === profileId ? { ...p, zones: put(p.zones) } : p)) }
    );
    setEditing(null);
  };
  const removeZone = (profileId: string | null, zone: DeliveryZone) =>
    change(
      profileId === null
        ? { ...doc, general: { zones: doc.general.zones.filter((z) => z.id !== zone.id) } }
        : { ...doc, profiles: doc.profiles.map((p) => (p.id === profileId ? { ...p, zones: p.zones.filter((z) => z.id !== zone.id) } : p)) }
    );
  const setProducts = (profileId: string, products: string[]) => {
    // A product is in one profile: picking it here takes it out of another.
    const picked = new Set(products);
    change({
      ...doc,
      profiles: doc.profiles.map((p) => (p.id === profileId ? { ...p, products } : { ...p, products: p.products.filter((id) => !picked.has(id)) })),
    });
    setChoosing(null);
  };
  const addProfile = () => {
    const profile: DeliveryProfile = { id: newId(), name: `Profile ${doc.profiles.length + 1}`, products: [], zones: [] };
    change({ ...doc, profiles: [...doc.profiles, profile] });
    setRenaming({ id: profile.id, name: profile.name });
  };

  const publish = async () => {
    if (!name || publishing) return;
    setError(null);
    if (doc.options?.some((o) => !o.name.trim())) return setError("Name each delivery option, or remove it.");
    const next: DeliveryDoc = { ...doc, updated: Date.now() };
    const built = buildDeliveryPublish({ name, doc: next });
    setPublishing(true);
    const outcome = await publishMedia(built.request, { service: "DOCUMENT", name, identifier: built.identifier });
    setPublishing(false);
    if (outcome.kind === "done") {
      rememberDeliveryDoc(name, next);
      setLoad({ key, status: "ready", doc: next });
      setDraft(null);
      dispatch(setNotification({ alertType: "success", msg: "Delivery prices published" }));
    } else if (outcome.kind === "failed") setError(outcome.message);
  };

  if (!ready || current.status === "loading") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }} aria-busy="true" aria-label="Loading delivery prices">
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={120} />
      </Box>
    );
  }
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
        Your delivery prices couldn&apos;t be read from your node right now.
      </Alert>
    );
  }

  const busy = publishing;
  const currencyNote =
    doc.currency === "QORT"
      ? "Prices are in QORT (buyers paying in ARRR pay them at the node's rate)."
      : `Prices are in ${doc.currency}, your shop's currency (QORT and ARRR follow from your rates).`;

  // Where the shop ships (Edit shop), for a first zone in one step.
  const everywhere = shippingCountriesOf(store);
  const everywhereStates = everywhere?.includes(US) ? shippingStatesOf(store) : null;
  const profileCard = (profile: DeliveryProfile | null) => {
    const zones = profile ? profile.zones : doc.general.zones;
    const id = profile?.id ?? null;
    const title = profile ? profile.name : "General";
    return (
      <Paper key={profile?.id ?? "general"} component="section" aria-label={`Shipping profile: ${title}`} variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
          <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 17, overflowWrap: "anywhere" }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {profile ? productCount(profile) : "Every product not in another profile"}
            </Typography>
          </Box>
          {profile && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button variant="outlined" color="inherit" onClick={() => setChoosing(profile.id)} disabled={busy} sx={{ minHeight: 44 }}>
                Choose products
              </Button>
              <Button color="inherit" onClick={() => setRenaming({ id: profile.id, name: profile.name })} disabled={busy} sx={{ minHeight: 44 }}>
                Rename
              </Button>
              <Button color="error" onClick={() => change({ ...doc, profiles: doc.profiles.filter((p) => p.id !== profile.id) })} disabled={busy} sx={{ minHeight: 44 }}>
                Delete
              </Button>
            </Box>
          )}
        </Box>
        <ZoneRows
          zones={zones}
          currency={doc.currency}
          disabled={busy}
          options={doc.options}
          baseName={doc.base?.name}
          onEdit={(zone) => setEditing({ profile: id, zone })}
          onRemove={(zone) => removeZone(id, zone)}
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {/* A first zone in one step: everywhere the shop ships (Edit shop's countries), at one price. */}
          {zones.length === 0 && everywhere && (
            <Button
              variant="contained"
              onClick={() => setEditing({ profile: id, zone: null, start: { name: "Everywhere", countries: everywhere, ...(everywhereStates && { states: everywhereStates }) } })}
              disabled={busy}
              sx={{ minHeight: 44 }}
            >
              One price everywhere you ship
            </Button>
          )}
          <Button startIcon={<AddIcon />} onClick={() => setEditing({ profile: id, zone: null })} disabled={busy || zones.length >= MAX_ZONES} sx={{ minHeight: 44 }}>
            Add a zone
          </Button>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <LocalShippingOutlinedIcon sx={{ mt: 0.25, color: "text.secondary" }} aria-hidden />
        <Box>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
            Delivery
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Buyers pay delivery at checkout, as one more line of their order. {currencyNote} Which countries you ship to at all is set under Shop
            Settings → Edit shop.
          </Typography>
        </Box>
      </Box>
      {doc.currency !== shopCurrency && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" onClick={() => change({ ...doc, currency: shopCurrency })} sx={{ minHeight: 44 }}>
              Use {shopCurrency}
            </Button>
          }
        >
          These prices are in {doc.currency}, but the shop now prices in {shopCurrency}, so buyers can&apos;t be charged for delivery until you check
          them in {shopCurrency} and publish.
        </Alert>
      )}
      <OptionsCard doc={doc} onChange={change} disabled={busy} />
      {profileCard(null)}
      {doc.profiles.map((p) => profileCard(p))}
      <Button variant="outlined" startIcon={<AddIcon />} onClick={addProfile} disabled={busy || doc.profiles.length >= MAX_PROFILES} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
        Add a shipping profile
      </Button>
      <Typography variant="body2" color="text.secondary">
        A shipping profile gives some products their own prices: heavy or fragile ones, say.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {(changed || publishing) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Button variant="contained" onClick={() => void publish()} disabled={busy || !name} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : undefined} sx={{ minHeight: 48 }}>
            {busy ? "Publishing…" : "Publish delivery prices"}
          </Button>
          <Button color="inherit" onClick={() => setDraft(null)} disabled={busy} sx={{ minHeight: 44 }}>
            Discard changes
          </Button>
          <Typography variant="body2" color="text.secondary">
            One small publish: Hub asks you to confirm.
          </Typography>
        </Box>
      )}

      {editing && (
        <DeliveryZoneDialog
          zone={editing.zone}
          start={editing.start}
          options={doc.options ?? []}
          baseName={doc.base?.name}
          currency={doc.currency}
          newId={newId}
          onSave={(zone) => saveZone(editing.profile, zone)}
          onClose={() => setEditing(null)}
        />
      )}
      {choosingProfile && (
        <DeliveryProductsDialog
          profileName={choosingProfile.name}
          picked={choosingProfile.products}
          elsewhere={elsewhere(choosingProfile.id)}
          onSave={(products) => setProducts(choosingProfile.id, products)}
          onClose={() => setChoosing(null)}
        />
      )}
      {renaming && (
        <ProfileNameDialog
          name={renaming.name}
          onSave={(clean) => {
            change({ ...doc, profiles: doc.profiles.map((p) => (p.id === renaming.id ? { ...p, name: clean } : p)) });
            setRenaming(null);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </Box>
  );
}
