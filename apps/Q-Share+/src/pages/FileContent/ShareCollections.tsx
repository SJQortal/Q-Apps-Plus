import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { useMyCollections } from "../../components/common/SaveToCollection/useMyCollections";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { CollectionCover } from "../Collections/CollectionCover";
import { CollectionDialog } from "../Collections/CollectionDialog";
import { allCollectionItems, containsItem, folderCount, folderHolding } from "../../utils/collectionFolders";
import { collectionKey, collectionPath, type Collection } from "../../utils/collections";
import { CardButton } from "../Collections/Collections-styles";
import { Card } from "./FileContent-styles";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The signed-in name's collections holding this share, on its page: each with
 * its cover, and Add cover or Change cover, which opens the collection's Edit
 * (one Hub confirmation, the image in the same request). Uses the list the
 * bookmark button on this page loads, so it costs no call of its own.
 */
export function ShareCollections({ share }: { share: { name: string; identifier: string } }) {
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const { myName, mine, byKey } = useMyCollections(true);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const holding = useMemo(
    () =>
      (mine ?? [])
        .map((row) => byKey[collectionKey(row.name, row.identifier)])
        .filter((collection): collection is Collection => Boolean(collection) && containsItem(collection, share)),
    [mine, byKey, share]
  );

  if (!myName || holding.length === 0) return null;

  return (
    <>
      {holding.map((collection) => {
        const folder = folderHolding(collection, share);
        const shares = allCollectionItems(collection).length;
        const folders = folderCount(collection);
        const title = collection.title || "Untitled collection";
        return (
          <Card key={collectionKey(collection.name, collection.identifier)} aria-label={`In your collection ${title}`}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, minWidth: 0 }}>
              <CardButton
                aria-label={`Open ${title}`}
                onClick={() => navigate(collectionPath(collection.name, collection.identifier, folder?.id))}
                sx={{ flexDirection: "row", alignItems: "center", gap: 1.5, flex: "1 1 240px", minWidth: 0 }}
              >
                <CollectionCover cover={collection.cover} size={phone ? 64 : 88} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary">
                    In your collection
                  </Typography>
                  <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {plural(shares, "share")}
                    {folders > 0 ? ` · ${plural(folders, "folder")}` : ""}
                    {folder ? ` · in ${folder.title || "a folder"}` : ""}
                  </Typography>
                </Box>
              </CardButton>
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternateOutlinedIcon />}
                aria-label={`${collection.cover ? "Change" : "Add"} the cover of ${title}`}
                onClick={() => {
                  setEditing(collection);
                  setDialogOpen(true);
                }}
                sx={{ minHeight: 44, flexShrink: 0, width: { xs: "100%", sm: "auto" } }}
              >
                {collection.cover ? "Change cover" : "Add cover"}
              </Button>
            </Box>
          </Card>
        );
      })}
      <CollectionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} collection={editing} />
    </>
  );
}
