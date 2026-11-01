import { Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { CollectionFolder } from "../../../utils/collections";
import { CollectionCover } from "../CollectionCover";
import { folderCountLabel } from "../FolderGrid";

const Grid = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(1),
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

const Stack = styled("span")(({ theme }) => {
  const print = {
    content: '""',
    position: "absolute",
    inset: 0,
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: Number(theme.shape.borderRadius) / 2,
    boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, 0.18)}`,
    transition: "transform 220ms ease",
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  };
  return {
    position: "relative",
    display: "block",
    "&::before": { ...print, transform: "rotate(-3.5deg)" },
    "&::after": { ...print, transform: "rotate(2.5deg)" },
    "button:hover &::before, button:focus-visible &::before": { transform: "rotate(-6deg) translateX(-3px)" },
    "button:hover &::after, button:focus-visible &::after": { transform: "rotate(5deg) translateX(3px)" },
  };
});

const Tile = styled("button")(({ theme }) => ({
  appearance: "none",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  // Room for the prints under the top one to lean out, inside the tile.
  padding: theme.spacing(1.25),
  border: 0,
  background: "transparent",
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  borderRadius: theme.shape.borderRadius,
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

/** Folders as little stacks of prints, each with its cover on top. */
export function AlbumFolders({ folders, openFolder }: { folders: CollectionFolder[]; openFolder: (id: string) => void }) {
  return (
    <Grid aria-label="Folders">
      {folders.map((folder) => {
        const title = folder.title || "Untitled folder";
        return (
          <li key={folder.id}>
            <Tile type="button" onClick={() => openFolder(folder.id)} aria-label={`Open folder ${title}`}>
              <Stack>
                <CollectionCover
                  cover={folder.cover}
                  kind="folder"
                  sx={(theme) => ({
                    zIndex: 1,
                    aspectRatio: "4 / 3",
                    borderRadius: 0.5,
                    bgcolor: "background.paper",
                    border: `4px solid ${theme.palette.background.paper}`,
                    outline: `1px solid ${theme.palette.divider}`,
                  })}
                />
              </Stack>
              <Typography
                component="span"
                sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3, overflow: "hidden", wordBreak: "break-word", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
              >
                {title}
              </Typography>
              <Typography component="span" variant="body2" color="text.secondary">
                {folderCountLabel(folder)}
              </Typography>
            </Tile>
          </li>
        );
      })}
    </Grid>
  );
}
