import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { CollectionSpaceId } from "../../../utils/collections";
import { SpaceSkeleton } from "./SpaceShell";
import type { SpacePageProps, SpaceProps } from "./types";
import { useSpaceItems } from "./useSpaceItems";

/** One chunk per space: opening a music collection loads no cinema. */
const SPACES: Record<CollectionSpaceId, LazyExoticComponent<ComponentType<SpaceProps>>> = {
  music: lazy(() => import("./MusicSpace")),
  cinema: lazy(() => import("./CinemaSpace")),
  library: lazy(() => import("./LibrarySpace")),
  album: lazy(() => import("./AlbumSpace")),
};

/** Resolves this place's shares and draws them in the collection's space. */
export default function SpaceView({ rows, ...props }: SpacePageProps) {
  const items = useSpaceItems(rows);
  const Space = SPACES[props.space];
  return (
    <Suspense fallback={<SpaceSkeleton />}>
      <Space {...props} items={items} />
    </Suspense>
  );
}
