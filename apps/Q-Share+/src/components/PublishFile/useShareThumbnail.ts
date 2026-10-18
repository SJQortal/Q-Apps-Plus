import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShareThumbnail, ThumbnailInput } from "../../utils/publishPayload";
import { fileKind } from "../../utils/fileKind";
import { makeImageThumbnail, makeThumbnail, thumbnailSource } from "../../utils/thumbnailImage";
import type { DraftFile } from "./shareDraft";

/**
 * - "auto": made from the first image (or video) among the new files; a new share starts here.
 * - "file": an image made from a picked picture or one of the share's files.
 * - "existing": the one already on QDN (an update, or a publish that stopped after it landed).
 * - "none": the share shows its category icon.
 */
export type ThumbnailChoice =
  | { kind: "auto" }
  | { kind: "none" }
  | { kind: "file"; file: File; url: string; from: string }
  | { kind: "existing"; ref: ShareThumbnail };

export interface ShareThumbnailState {
  choice: ThumbnailChoice;
  /** What the preview shows and says. */
  previewUrl: string | null;
  label: string;
  /** A new thumbnail goes out with the publish (one more publish). */
  publishesNew: boolean;
  /** A share file to make one from, offered when the choice doesn't come from it already. */
  suggestion: DraftFile | null;
  busy: boolean;
  problem: string | null;
  choose: (picked: File) => Promise<void>;
  fromFile: (file: DraftFile) => Promise<void>;
  remove: () => void;
  set: (choice: ThumbnailChoice) => void;
  /**
   * The thumbnail for buildSharePublish. An automatic one still being made
   * is waited for (not made twice); one that couldn't be made is left out,
   * as the form says.
   */
  resolve: () => Promise<ThumbnailInput | null>;
  /**
   * After a publish that stopped before the thumbnail landed: the automatic
   * one that went out becomes the choice, so it stays the same picture once
   * its source file is on QDN (and out of the files it is made from).
   */
  keepSent: () => void;
}

const thumbUrl = (ref: ShareThumbnail) =>
  `/arbitrary/THUMBNAIL/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`;

/** An image file a share already has on QDN, read from the node (it must be there). */
async function readFromNode(file: DraftFile): Promise<Blob> {
  const ref = file.existing;
  if (!ref) throw new Error("Not on QDN");
  const response = await fetch(`/arbitrary/FILE/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`);
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  return response.blob();
}

/**
 * The thumbnail of the share being published or updated. The automatic one
 * is made on the device as soon as the files allow (utils/thumbnailImage.ts),
 * so the form can show it; nothing is published before Publish.
 */
export function useShareThumbnail(files: DraftFile[], initial: ThumbnailChoice): ShareThumbnailState {
  const [choice, setChoice] = useState<ThumbnailChoice>(initial);
  const [auto, setAuto] = useState<{ key: string; file: File; url: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Every preview URL made here, freed when replaced or on unmount.
  const urls = useRef(new Set<string>());
  const autoUrl = useRef<string | undefined>(undefined);
  // The automatic thumbnail being made, and the last one resolve() handed out.
  const pending = useRef<{ key: string; promise: Promise<File> } | null>(null);
  const sent = useRef<{ file: File; from: string } | null>(null);
  const keep = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return url;
  }, []);
  const free = useCallback((url: string | undefined) => {
    if (url && urls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const all = urls.current;
    return () => {
      for (const url of all) URL.revokeObjectURL(url);
      all.clear();
    };
  }, []);

  const newFiles = useMemo(() => files.filter((f) => f.file), [files]);
  const source = useMemo(() => thumbnailSource(newFiles), [newFiles]);
  const sourceKey = choice.kind === "auto" && source ? source.file.key : null;

  // Make the automatic thumbnail once per source file.
  useEffect(() => {
    if (!sourceKey || !source?.file.file || auto?.key === sourceKey) return;
    let active = true;
    const { kind } = source;
    const promise = makeThumbnail(source.file.file, kind);
    pending.current = { key: sourceKey, promise };
    promise.then(
      (file) => {
        if (!active) return;
        free(autoUrl.current);
        const url = keep(file);
        autoUrl.current = url;
        setAuto({ key: sourceKey, file, url });
      },
      () => {
        if (active) setFailedKey(sourceKey);
      }
    );
    return () => {
      active = false;
    };
  }, [sourceKey, source, auto?.key, keep, free]);

  const set = useCallback(
    (next: ThumbnailChoice) => {
      if (choice.kind === "file" && (next.kind !== "file" || next.url !== choice.url)) free(choice.url);
      setChoice(next);
      setProblem(null);
    },
    [choice, free]
  );

  const make = useCallback(
    async (from: string, blob: () => Promise<Blob>, kind: "image" | "video") => {
      setBusy(true);
      setProblem(null);
      try {
        const source = await blob();
        const file = kind === "image" ? await makeImageThumbnail(source) : await makeThumbnail(source, kind);
        set({ kind: "file", file, url: keep(file), from });
      } catch {
        setProblem("Couldn't make a thumbnail from that. Try a JPEG, PNG or WebP image.");
      } finally {
        setBusy(false);
      }
    },
    [keep, set]
  );

  const choose = useCallback((picked: File) => make("your image", async () => picked, "image"), [make]);
  const fromFile = useCallback(
    (file: DraftFile) => {
      const kind = fileKind(file.mimetype, file.name) === "video" ? "video" : "image";
      return make(file.name, file.file ? async () => file.file as File : () => readFromNode(file), kind);
    },
    [make]
  );
  const remove = useCallback(() => set({ kind: "none" }), [set]);

  const autoReady = choice.kind === "auto" && auto && auto.key === sourceKey ? auto : null;
  const autoFailed = choice.kind === "auto" && sourceKey !== null && failedKey === sourceKey;

  const resolve = useCallback(async (): Promise<ThumbnailInput | null> => {
    sent.current = null;
    if (choice.kind === "existing") return { existing: choice.ref };
    if (choice.kind === "file") return { file: choice.file };
    if (choice.kind === "none" || !source?.file.file || autoFailed) return null;
    const from = source.file.name;
    try {
      const file =
        autoReady?.file ??
        (await (pending.current?.key === source.file.key
          ? pending.current.promise
          : makeThumbnail(source.file.file, source.kind)));
      sent.current = { file, from };
      return { file };
    } catch {
      return null;
    }
  }, [choice, source, autoReady, autoFailed]);

  const keepSent = useCallback(() => {
    if (choice.kind !== "auto" || !sent.current) return;
    const { file, from } = sent.current;
    set({ kind: "file", file, url: keep(file), from });
  }, [choice, keep, set]);

  // Offer a share image (or video) the choice doesn't already come from.
  const candidates = files.filter((f) => {
    const kind = fileKind(f.mimetype, f.name);
    return kind === "image" || (kind === "video" && f.file);
  });
  const suggestion =
    candidates.find(
      (f) => !(choice.kind === "file" && choice.from === f.name) && !(choice.kind === "auto" && source?.file.key === f.key)
    ) ?? null;

  let previewUrl: string | null = null;
  let label: string;
  if (choice.kind === "existing") {
    previewUrl = thumbUrl(choice.ref);
    label = "The share's thumbnail.";
  } else if (choice.kind === "file") {
    previewUrl = choice.url;
    label = choice.from === "your image" ? "Your image." : `Made from ${choice.from}.`;
  } else if (choice.kind === "auto" && source && !autoFailed) {
    previewUrl = autoReady?.url ?? null;
    label = autoReady ? `Made from ${source.file.name}.` : `Making one from ${source.file.name}…`;
  } else {
    label = "None: the category icon shows.";
  }

  return {
    choice,
    previewUrl,
    label,
    publishesNew: choice.kind === "file" || (choice.kind === "auto" && Boolean(source) && !autoFailed),
    suggestion: suggestion && candidates.length > 0 ? suggestion : null,
    busy,
    problem,
    choose,
    fromFile,
    remove,
    set,
    resolve,
    keepSent,
  };
}
