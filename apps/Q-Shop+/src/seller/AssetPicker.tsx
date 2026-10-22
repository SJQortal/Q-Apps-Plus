/**
 * The Q-Assets a shop accepts: the list with Remove, a field to add one by
 * id or exact name, and a paged list of every asset on the node to pick from.
 * Buyers pay an asset with TRANSFER_ASSET to the seller's Qortal address, and
 * only for products with a price in it (money/pricing.ts).
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
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
import { assetInfo, assetProblem, listAssets, parseAssetQuery, toShopAsset, ASSET_PAGE, type CoreAsset } from "./assets";

interface AssetPickerProps {
  assets: ShopAsset[];
  onChange: Dispatch<SetStateAction<ShopAsset[]>>;
}

export function AssetPicker({ assets, onChange }: AssetPickerProps) {
  const [query, setQuery] = useState("");
  const [looking, setLooking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

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
      const asset = await assetInfo(parsed);
      if (!asset) {
        setMessage("id" in parsed ? `No asset #${parsed.id} on your node.` : `No asset named "${parsed.name}". Names must match exactly; try Browse.`);
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
        <TextField
          label="Asset name or id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lookUp();
            }
          }}
          sx={{ flex: "1 1 200px" }}
          slotProps={{ htmlInput: { autoComplete: "off", enterKeyHint: "done" } }}
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
