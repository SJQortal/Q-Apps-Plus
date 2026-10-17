import { useNavigate } from "react-router-dom";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { collectionPath, type CollectionFolder } from "../../utils/collections";
import { contentsCount } from "../../utils/collectionFolders";
import { CollectionCover } from "./CollectionCover";

const Grid = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: theme.spacing(1.5),
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(1),
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

const Tile = styled("button")(({ theme }) => ({
  appearance: "none",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
  padding: theme.spacing(1),
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease, border-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

export function folderCountLabel(folder: CollectionFolder): string {
  const { shares, folders } = contentsCount(folder);
  const parts = [`${shares} ${shares === 1 ? "share" : "shares"}`];
  if (folders > 0) parts.push(`${folders} ${folders === 1 ? "folder" : "folders"}`);
  return shares === 0 && folders === 0 ? "Empty" : parts.join(" · ");
}

/** A collection's (or folder's) folders as tiles with their covers; each opens the folder's page. */
export function FolderGrid({ name, identifier, folders }: { name: string; identifier: string; folders: CollectionFolder[] }) {
  const navigate = useNavigate();
  return (
    <Grid aria-label="Folders">
      {folders.map((folder) => (
        <li key={folder.id}>
          <Tile type="button" onClick={() => navigate(collectionPath(name, identifier, folder.id))} aria-label={`Open folder ${folder.title || "Untitled folder"}`}>
            <CollectionCover cover={folder.cover} kind="folder" />
            <Typography
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: 15,
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                wordBreak: "break-word",
              }}
            >
              {folder.title || "Untitled folder"}
            </Typography>
            <Typography component="span" variant="body2" color="text.secondary">
              {folderCountLabel(folder)}
            </Typography>
          </Tile>
        </li>
      ))}
    </Grid>
  );
}
