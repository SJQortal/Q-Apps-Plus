import { Skeleton, Typography } from "@mui/material";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import { EmptyState } from "../../components/common/EmptyState";
import LazyLoad from "../../components/common/LazyLoad";
import { collectionKey } from "../../utils/collections";
import { CardList } from "../Collections/Collections-styles";
import { CollectionCard } from "../Collections/CollectionsPage";
import { useCollectionList } from "../Collections/useCollectionList";

/**
 * A name's collections, on the profile page's Collections tab. Mounted only
 * when the tab is opened, so a profile visit costs nothing extra until then:
 * one paged search, then each collection's body through the request queue.
 */
export function ProfileCollections({ name }: { name: string }) {
  const { rows, loading, error, complete, loadMore, reload } = useCollectionList(name);
  if (loading) {
    return (
      <CardList aria-busy="true" aria-label="Loading collections">
        {[0, 1, 2].map((n) => (
          <li key={n}>
            <Skeleton variant="rounded" sx={{ width: "100%", height: 84 }} />
          </li>
        ))}
      </CardList>
    );
  }
  if (error) {
    return (
      <EmptyState
        title="Couldn't load collections"
        description="Check that your node is running, then try again."
        actionLabel="Retry"
        onAction={() => {
          reload();
        }}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CollectionsBookmarkOutlinedIcon />}
        title={`${name} has no collections`}
        description="Collections are public lists of shares that a name puts together."
      />
    );
  }
  return (
    <>
      <CardList aria-label={`Collections by ${name}`}>
        {rows.map((row) => (
          <CollectionCard key={collectionKey(row.name, row.identifier)} row={row} />
        ))}
      </CardList>
      {complete ? (
        <Typography variant="body2" color="text.secondary" align="center">
          That's every collection by {name}.
        </Typography>
      ) : (
        <LazyLoad onLoadMore={loadMore} />
      )}
    </>
  );
}
