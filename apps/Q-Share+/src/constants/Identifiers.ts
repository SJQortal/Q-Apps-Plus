const useTestIdentifiers = false;

export const QSHARE_FILE_BASE = useTestIdentifiers
  ? "MYTEST_share_vid_"
  : "qshare_file_";

export const QSHARE_PLAYLIST_BASE = useTestIdentifiers
  ? "MYTEST_share_playlist_"
  : "qshare_playlist_";

export const QSHARE_COMMENT_BASE = useTestIdentifiers
  ? "qcomment_v1_MYTEST_"
  : "qcomment_v1_qshare_";

/** Collections (Q-Share+ only, additive): a DOCUMENT listing shares by name and identifier. */
export const QSHARE_COLLECTION_BASE = "qshare_collection_";
