import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Avatar, Box, Button, IconButton, Skeleton, Tab, Tabs, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { EmptyState } from "../../components/common/EmptyState";
import LazyLoad from "../../components/common/LazyLoad";
import { setMine } from "../../state/features/collectionsSlice";
import type { RootState } from "../../state/store";
import { collectionKey, collectionPath, type CollectionSummary } from "../../utils/collections";
import { avatarUrl, profilePath } from "../../utils/qortalLinks";
import { formatDate } from "../../utils/time";
import { CollectionDialog } from "./CollectionDialog";
import { useCollectionList } from "./useCollectionList";
import {
  CardButton,
  CardDescription,
  CardItem,
  CardList,
  CardMeta,
  CardTitle,
  HeaderRow,
  Page,
  PhoneHeader,
  PublisherLink,
} from "./Collections-styles";

type TabId = "mine" | "all";

const countLabel = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

export function CollectionCard({ row }: { row: CollectionSummary }) {
  const navigate = useNavigate();
  const collection = useSelector((state: RootState) => state.collections.byKey[collectionKey(row.name, row.identifier)]);
  const title = row.title || collection?.title || "Untitled collection";
  return (
    <CardItem>
      <CardButton onClick={() => navigate(collectionPath(row.name, row.identifier))} aria-label={`Open ${title}`}>
        <CardTitle>{title}</CardTitle>
        {row.description ? <CardDescription>{row.description}</CardDescription> : null}
        <CardMeta>
          {collection ? (
            <span>{collection.items.length === 0 ? "Empty" : countLabel(collection.items.length)}</span>
          ) : (
            <Skeleton variant="text" width={52} sx={{ display: "inline-block" }} />
          )}
          {row.updated ? <span>· updated {formatDate(row.updated)}</span> : null}
        </CardMeta>
      </CardButton>
      <PublisherLink onClick={() => navigate(profilePath(row.name))} aria-label={`Shares by ${row.name}`}>
        <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(row.name)} alt="" slotProps={{ img: { loading: "lazy" } }} />
        <span>{row.name}</span>
      </PublisherLink>
    </CardItem>
  );
}

export function CollectionsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const myName = useSelector((state: RootState) => state.auth.user?.name);
  const mineName = useSelector((state: RootState) => state.collections.mineName);
  const byKey = useSelector((state: RootState) => state.collections.byKey);
  const [chosenTab, setChosenTab] = useState<TabId | null>(null);
  const tab: TabId = myName ? (chosenTab ?? "mine") : "all";
  const listName = tab === "mine" ? myName : undefined;
  const { rows, loading, error, complete, loadMore, reload } = useCollectionList(listName);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Share the first page of my collections with the Save-to-collection buttons.
  useEffect(() => {
    if (tab === "mine" && myName && !loading && !error && mineName !== myName) {
      dispatch(setMine({ name: myName, rows }));
    }
  }, [tab, myName, loading, error, mineName, rows, dispatch]);

  const visible =
    tab === "all"
      ? rows.filter((row) => {
          const known = byKey[collectionKey(row.name, row.identifier)];
          return !known || known.items.length > 0;
        })
      : rows;

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  const newButton = myName ? (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ minHeight: 44 }}>
      New collection
    </Button>
  ) : null;

  let body: React.ReactNode;
  if (loading) {
    body = (
      <CardList aria-busy="true" aria-label="Loading collections">
        {[0, 1, 2, 3].map((n) => (
          <li key={n}>
            <Skeleton variant="rounded" sx={{ width: "100%", height: 84 }} />
          </li>
        ))}
      </CardList>
    );
  } else if (error) {
    body = (
      <EmptyState
        title="Couldn't load collections"
        description="Check that your node is running, then try again."
        actionLabel="Retry"
        onAction={() => {
          reload();
        }}
      />
    );
  } else if (visible.length === 0) {
    body =
      tab === "mine" ? (
        <EmptyState
          icon={<CollectionsBookmarkOutlinedIcon />}
          title="No collections yet"
          description="Group shares you want to keep together, and share the list."
          actionLabel="New collection"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <EmptyState
          icon={<CollectionsBookmarkOutlinedIcon />}
          title="Nobody has made a collection yet"
          description={myName ? "Be the first: a collection is a public list of shares." : "Sign in with a Qortal name to make one."}
          actionLabel={myName ? "New collection" : undefined}
          onAction={myName ? () => setDialogOpen(true) : undefined}
        />
      );
  } else {
    body = (
      <>
        <CardList>
          {visible.map((row) => (
            <CollectionCard key={collectionKey(row.name, row.identifier)} row={row} />
          ))}
        </CardList>
        {complete ? (
          <Typography variant="body2" color="text.secondary" align="center">
            {tab === "mine" ? "That's every collection you've made." : "That's every collection."}
          </Typography>
        ) : (
          <LazyLoad onLoadMore={loadMore} />
        )}
      </>
    );
  }

  return (
    <Page>
      {phone ? (
        <PhoneHeader>
          <IconButton aria-label="Back" onClick={goBack} sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography component="h1" noWrap sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
            Collections
          </Typography>
          {myName ? (
            <IconButton
              aria-label="New collection"
              color="primary"
              onClick={() => setDialogOpen(true)}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <AddIcon />
            </IconButton>
          ) : null}
        </PhoneHeader>
      ) : (
        <HeaderRow>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
            Collections
          </Typography>
          {newButton}
        </HeaderRow>
      )}

      {myName ? (
        <Tabs
          value={tab}
          onChange={(_, value: TabId) => setChosenTab(value)}
          variant={phone ? "fullWidth" : "standard"}
          aria-label="Which collections to show"
        >
          <Tab value="mine" label="Mine" sx={{ minHeight: 48 }} />
          <Tab value="all" label="All" sx={{ minHeight: 48 }} />
        </Tabs>
      ) : null}

      {body}


      <CollectionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(saved) => {
          setDialogOpen(false);
          navigate(collectionPath(saved.name, saved.identifier));
        }}
      />
      <Box sx={{ height: 0 }} aria-hidden />
    </Page>
  );
}
