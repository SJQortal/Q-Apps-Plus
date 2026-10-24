/**
 * The Q-Assets a shop accepts: the list with Remove, a field that suggests
 * the best matching assets as the seller types (name or #id, any case: the
 * node's list, read once a session, qdn/assets.ts), Add for an exact id or
 * name, and Browse for every asset on the node. Buyers pay an asset with
 * TRANSFER_ASSET to the seller's Qortal address, and only for products with
 * a price in it (money/pricing.ts).
 */
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ResponsiveDialog } from "../components/common/mobile";
import { CoinIcon } from "../components/money/CoinIcon";
import { assetCoinId, type ShopAsset } from "../money/coins";
import {
  assetInfo,
  assetProblem,
  listAssets,
  loadAllAssets,
  parseAssetQuery,
  suggestAssets,
  toShopAsset,
  ASSET_PAGE,
  type CoreAsset,
} from "../qdn/assets";
import { autocompletePaperProps } from "../components/common/menuStyle";

/** "Can't be paid", "Already accepted", "Whole units only", or nothing: shown beside a suggestion. */
function assetNote(asset: CoreAsset, accepted: ShopAsset[]): string | null {
  if (accepted.some((a) => a.id === asset.assetId)) return "Already accepted";
  if (asset.isUnspendable) return "Can't be transferred";
  if (asset.isDivisible === false) return "Whole units only";
  return null;
}

interface AssetPickerProps {
  assets: ShopAsset[];
  onChange: Dispatch<SetStateAction<ShopAsset[]>>;
}

export function AssetPicker({ assets, onChange }: AssetPickerProps) {
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  // The node's asset list, read once the seller starts typing (once a session).
  const [all, setAll] = useState<CoreAsset[] | null>(null);
  const [listState, setListState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const wantList = () => {
    if (listState !== "idle" && listState !== "failed") return;
    setListState("loading");
    loadAllAssets().then(
      (list) => {
        setAll(list);
        setListState("ready");
      },
      () => setListState("failed")
    );
  };
  const suggestions = useMemo(() => (all ? suggestAssets(all, query) : []), [all, query]);

  const add = (asset: CoreAsset): string | null => {
    const problem = assetProblem(asset, assets);
    if (problem) return problem;
    onChange((prev) => (prev.some((a) => a.id === asset.assetId) ? prev : [...prev, toShopAsset(asset)]));
    return null;
  };

  const lookUp = async () => {
    setMessage(null);
    const parsed = parseAssetQuery(query);
    if (!parsed) return setMessage("Type an asset's name or its id number.");
    setLooking(true);
    try {
      // A name typed in another case: the list knows it ("bhc coin" is "BHC Coin"); Core matches exactly.
      const lower = "name" in parsed ? parsed.name.toLowerCase() : null;
      const listed = lower !== null ? all?.filter((a) => a.assetId !== 0 && a.assetName.toLowerCase() === lower) : undefined;
      const asset = listed?.length === 1 ? listed[0] : await assetInfo(parsed);
      if (!asset) {
        setMessage(
          "id" in parsed
            ? `No asset #${parsed.id} on your node.`
            : listed && listed.length > 1
              ? `Several assets are named "${parsed.name}": pick one from the suggestions.`
              : `No asset named "${parsed.name}" on your node. Pick one from the suggestions as you type, or Browse.`
        );
        return;
      }
      const problem = add(asset);
      if (problem) setMessage(problem);
      else setQuery("");
    } catch {
      setMessage("Your node didn't answer. Try again.");
    } finally {
      setLooking(false);
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {assets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No assets yet. Buyers can pay in an asset only for products you give a price in it.
        </Typography>
      ) : (
        <List dense disablePadding aria-label="Accepted assets">
          {assets.map((asset) => (
            <ListItem
              key={asset.id}
              divider
              sx={{ px: 0, minHeight: 48 }}
              secondaryAction={
                <Tooltip title="Stop accepting">
                  <IconButton
                    edge="end"
                    aria-label={`Stop accepting ${asset.name}`}
                    onClick={() => onChange((prev) => prev.filter((a) => a.id !== asset.id))}
                    sx={{ width: 44, height: 44 }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <Box sx={{ mr: 1.5, display: "flex" }}>
                <CoinIcon coin={assetCoinId(asset.id)} size={22} />
              </Box>
              <ListItemText primary={asset.name || `Asset #${asset.id}`} secondary={`Asset #${asset.id}`} />
            </ListItem>
          ))}
        </List>
      )}
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Autocomplete<CoreAsset, false, false, true>
          freeSolo
          // The suggestions stay inside the dialog (its landmark), not at the end of the page.
          disablePortal
          slotProps={{ paper: autocompletePaperProps }}
          sx={{ flex: "1 1 200px", minWidth: 0 }}
          options={suggestions}
          // The suggestions are already ranked (qdn/assets.ts suggestAssets).
          filterOptions={(options) => options}
          inputValue={query}
          onInputChange={(_e, value, reason) => {
            if (reason !== "reset") setQuery(value);
            setMessage(null);
            if (value.trim()) wantList();
          }}
          onOpen={wantList}
          value={null}
          blurOnSelect
          onChange={(_e, value) => {
            if (!value || typeof value === "string") return;
            const problem = add(value);
            setMessage(problem);
            if (!problem) setQuery("");
          }}
          getOptionLabel={(option) => (typeof option === "string" ? option : option.assetName)}
          getOptionDisabled={(option) => typeof option !== "string" && (option.isUnspendable === true || assets.some((a) => a.id === option.assetId))}
          isOptionEqualToValue={(a, b) => typeof b !== "string" && a.assetId === b.assetId}
          loading={listState === "loading"}
          loadingText="Loading the node's assets…"
          noOptionsText={listState === "failed" ? "Couldn't load the node's assets: type an exact name or id and Add" : `No asset matches “${query.trim()}”`}
          renderOption={({ key, ...props }, option) => {
            const note = assetNote(option, assets);
            return (
              <li key={key} {...props} style={{ ...props.style, minHeight: 48 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, width: "100%" }}>
                  <CoinIcon coin={assetCoinId(option.assetId)} size={22} label={option.assetName} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{option.assetName}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {`#${option.assetId}${option.description ? ` · ${option.description}` : ""}`}
                    </Typography>
                  </Box>
                  {note && (
                    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {note}
                    </Typography>
                  )}
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Asset name or id"
              helperText="Start typing: the best matches show as you type."
              onKeyDown={(e) => {
                // Enter with no suggestion highlighted: look the typed id or name up.
                if (e.key === "Enter" && !(e.target as HTMLInputElement).getAttribute("aria-activedescendant")) {
                  e.preventDefault();
                  void lookUp();
                }
              }}
              slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, autoComplete: "off", enterKeyHint: "done" } }}
            />
          )}
        />
        <Button
          variant="outlined"
          onClick={() => void lookUp()}
          disabled={looking}
          startIcon={looking ? <CircularProgress size={18} /> : undefined}
          sx={{ minHeight: 56 }}
        >
          Add
        </Button>
        <Button color="inherit" onClick={() => setBrowseOpen(true)} sx={{ minHeight: 56 }}>
          Browse
        </Button>
      </Box>
      {message && (
        <Alert severity="info" role="status">
          {message}
        </Alert>
      )}
      {browseOpen && (
        <BrowseAssets
          accepted={assets}
          onClose={() => setBrowseOpen(false)}
          onPick={(asset) => {
            const problem = add(asset);
            setMessage(problem);
            if (!problem) setBrowseOpen(false);
          }}
        />
      )}
    </Box>
  );
}

function BrowseAssets({ accepted, onClose, onPick }: { accepted: ShopAsset[]; onClose: () => void; onPick: (asset: CoreAsset) => void }) {
  const [pages, setPages] = useState<CoreAsset[][]>([]);
  // The first page loads as the dialog opens.
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let active = true;
    listAssets(0).then(
      (page) => {
        if (!active) return;
        setPages([page]);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setFailed(true);
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const loadNext = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await listAssets(pages.length);
      setPages((prev) => [...prev, page]);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const all = pages.flat().filter((a) => a.assetId !== 0);
  const f = filter.trim().toLowerCase();
  const shown = f ? all.filter((a) => a.assetName.toLowerCase().includes(f) || String(a.assetId) === f.replace(/^#/, "")) : all;
  const more = pages.length === 0 || pages[pages.length - 1].length === ASSET_PAGE;

  return (
    <ResponsiveDialog open onClose={onClose} title="Browse assets" maxWidth="sm">
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          type="search"
          label="Filter the loaded assets"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          slotProps={{ htmlInput: { autoComplete: "off" } }}
        />
        <List dense disablePadding aria-label="Assets">
          {shown.map((asset) => {
            const taken = accepted.some((a) => a.id === asset.assetId);
            return (
              <ListItem
                key={asset.assetId}
                divider
                sx={{ px: 0, minHeight: 52 }}
                secondaryAction={
                  <Button
                    size="small"
                    variant={taken ? "text" : "outlined"}
                    disabled={taken || asset.isUnspendable}
                    onClick={() => onPick(asset)}
                    aria-label={taken ? `${asset.assetName} is accepted` : `Accept ${asset.assetName}`}
                    sx={{ minHeight: 44 }}
                  >
                    {taken ? "Accepted" : asset.isUnspendable ? "Can't be paid" : "Accept"}
                  </Button>
                }
              >
                <ListItemText
                  primary={asset.assetName}
                  secondary={`Asset #${asset.assetId}`}
                  slotProps={{ primary: { noWrap: true } }}
                  sx={{ pr: 12 }}
                />
              </ListItem>
            );
          })}
        </List>
        {!loading && shown.length === 0 && !failed && (
          <Typography color="text.secondary">{f ? "None of the loaded assets match." : "No assets on your node."}</Typography>
        )}
        {failed && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" onClick={() => void loadNext()}>
                Retry
              </Button>
            }
          >
            Couldn&apos;t load assets from your node.
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={24} aria-label="Loading assets" />
          </Box>
        ) : (
          more &&
          !failed && (
            <Button variant="outlined" onClick={() => void loadNext()} sx={{ alignSelf: "center", minHeight: 44 }}>
              Load more
            </Button>
          )
        )}
      </Box>
    </ResponsiveDialog>
  );
}
