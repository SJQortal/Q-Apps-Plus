import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Skeleton } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMyCollections } from "../../components/common/SaveToCollection/useMyCollections";
import { allCollectionItems, folderCount } from "../../utils/collectionFolders";
import { collectionKey } from "../../utils/collections";
import { formatDate } from "../../utils/time";
import { CollectionCover } from "./CollectionCover";
import { CardButton, CardDescription, CardItem, CardMeta, CardTitle } from "./Collections-styles";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * "My collections" at the top of Explore collections: up to three covers,
 * how many collections, shares and folders the signed-in name has, and the
 * newest one; it opens your collections. The list is the one the bookmark
 * buttons share (useMyCollections), so it costs no search of its own once
 * loaded, and it is asked for at once rather than after the usual pause.
 */
export function MyCollectionsSummary({ onOpen }: { onOpen: () => void }) {
  const navigate = useNavigate();
  const { mine, byKey, error, ensure } = useMyCollections(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void ensure().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [ensure]);

  const summary = useMemo(() => {
    const bodies = (mine ?? []).map((row) => byKey[collectionKey(row.name, row.identifier)]).filter(Boolean);
    const shares = new Set(bodies.flatMap((c) => allCollectionItems(c).map((item) => `${item.name}/${item.identifier}`)));
    const newest = [...(mine ?? [])].sort((a, b) => (b.updated ?? b.created ?? 0) - (a.updated ?? a.created ?? 0))[0];
    const covers = bodies.filter((c) => c.cover).slice(0, 3);
    return {
      count: mine?.length ?? 0,
      shares: shares.size,
      folders: bodies.reduce((sum, c) => sum + folderCount(c), 0),
      newest,
      covers,
    };
  }, [mine, byKey]);

  const loading = !ready && !mine;
  const parts = [
    plural(summary.count, "collection"),
    ...(summary.count > 0 ? [plural(summary.shares, "share")] : []),
    ...(summary.folders > 0 ? [plural(summary.folders, "folder")] : []),
  ];
  const label = loading
    ? "My collections"
    : `My collections: ${summary.count === 0 ? "none yet" : parts.join(", ")}`;

  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }} aria-label="Your collections">
      <CardItem sx={{ borderColor: "primary.main" }}>
        <CardButton
          onClick={() => {
            onOpen();
            navigate("/collections");
          }}
          aria-label={label}
          sx={{ flexDirection: "row", alignItems: "center", gap: 1.5, minHeight: 64 }}
        >
          {/* Up to three covers, fanned; the collection icon when there are none. */}
          <Box aria-hidden sx={{ position: "relative", width: 72, height: 56, flexShrink: 0 }}>
            {summary.covers.length === 0 ? (
              <CollectionCover size={56} />
            ) : (
              summary.covers.map((c, i) => (
                <CollectionCover
                  key={collectionKey(c.name, c.identifier)}
                  cover={c.cover}
                  size={48}
                  sx={{
                    position: "absolute",
                    top: 4,
                    left: i * 10,
                    zIndex: 3 - i,
                    boxShadow: 2,
                    border: 2,
                    borderColor: "background.paper",
                  }}
                />
              ))
            )}
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0, flex: 1 }}>
            <CardTitle>My collections</CardTitle>
            {loading ? (
              <Skeleton variant="text" width={180} />
            ) : error && !mine ? (
              <CardDescription>Couldn't load them. Open to try again.</CardDescription>
            ) : summary.count === 0 ? (
              <CardDescription>None yet. Save a share with its bookmark, or make one here.</CardDescription>
            ) : (
              <>
                <CardMeta>
                  {parts.map((part, i) => (
                    <span key={part}>
                      {i > 0 ? "· " : ""}
                      {part}
                    </span>
                  ))}
                </CardMeta>
                {summary.newest ? (
                  <CardDescription>
                    Newest: {summary.newest.title || "Untitled collection"}
                    {summary.newest.updated ? `, ${formatDate(summary.newest.updated)}` : ""}
                  </CardDescription>
                ) : null}
              </>
            )}
          </Box>
          <ChevronRightIcon aria-hidden sx={{ color: "text.secondary", flexShrink: 0 }} />
        </CardButton>
      </CardItem>
    </Box>
  );
}
