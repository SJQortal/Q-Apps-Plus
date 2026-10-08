/**
 * Order of work for loading the published mailbox state document
 * (`DOCUMENT_PRIVATE` / `qmail_state_v1`, brief → Data contract).
 *
 * The search (limit 1) runs first, so an account that never published a
 * state document costs one cheap indexed search instead of a
 * `FETCH_QDN_RESOURCE` that 404s on every load. When the document exists the
 * download starts straight away, before the prompt is answered, so the
 * auto-apply path and a quick "Load state" stay as fast as before.
 */
export type PublishedStateLoadResult =
  | { status: "none" }
  | { status: "declined" }
  | { status: "loaded"; encoded: string | null | undefined };

export type PublishedStateLoadDeps = {
  /** Settings → Sync → "Always fetch and apply published mail state". */
  autoApply: boolean;
  /** Searches QDN with the given params (session-cached search). */
  search: (params: URLSearchParams) => Promise<unknown[]>;
  /** Fetches the document (base64). */
  fetchDocument: () => Promise<string | null | undefined>;
  /** Asks the user; resolves true to load. Only called when not auto-applying. */
  confirm: () => Promise<boolean>;
};

export function publishedStateSearchParams(
  name: string,
  service: string,
  identifier: string
): URLSearchParams {
  return new URLSearchParams({
    mode: "ALL",
    service,
    identifier,
    name,
    exactmatchnames: "true",
    limit: "1",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });
}

export async function loadPublishedStateDocument(
  deps: PublishedStateLoadDeps,
  params: URLSearchParams
): Promise<PublishedStateLoadResult> {
  let exists: boolean;
  try {
    const rows = await deps.search(params);
    exists = rows.length > 0;
  } catch (error) {
    // The search itself failed (node busy, proxy error). With auto-apply on
    // the user asked for the state, so try the fetch as before; without it
    // there is nothing to ask about.
    if (!deps.autoApply) throw error;
    exists = true;
  }
  if (!exists) return { status: "none" };

  const fetchPromise = deps.fetchDocument();
  // The prompt may be declined: never leave a rejected promise unhandled.
  void fetchPromise.catch(() => undefined);

  if (!deps.autoApply) {
    const shouldLoad = await deps.confirm();
    if (!shouldLoad) return { status: "declined" };
  }

  return { status: "loaded", encoded: await fetchPromise };
}

/** What the user decided about one name's published state this session. */
export type PublishedStateDecision = "loaded" | "declined" | "none";

/**
 * On each sign-in or name switch: "skip" when the user already said "Not now"
 * for this name this session, or it had no document; "load" (without asking)
 * when they already chose "Load state" for it, or auto-apply is on; "ask"
 * the first time. So switching names away and back asks at most once per
 * name, as Settings → Sync says.
 */
export function publishedStatePlan(
  decision: PublishedStateDecision | undefined,
  autoApply: boolean
): "skip" | "load" | "ask" {
  if (decision === "declined" || decision === "none") return "skip";
  if (decision === "loaded" || autoApply) return "load";
  return "ask";
}

/** The decision a load result records (a failed load records nothing: it is asked again). */
export function decisionOf(result: PublishedStateLoadResult): PublishedStateDecision {
  return result.status;
}
