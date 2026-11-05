/**
 * Publishing a video or a PDF from the description editor. Hub asks the
 * seller to confirm (and shows the fee and its own progress), and may take up
 * to 30 minutes for a big file (docs/QORTAL.md, pitfall 10). A decline is
 * quiet; after a timeout QDN is asked whether it landed before anything is
 * offered again, so Try again never publishes (and charges) twice.
 */
import { errorMessage, isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { resourceExists } from "../qdn/search";

export const PUBLISH_MEDIA_TIMEOUT_MS = 30 * 60_000;

export type PublishOutcome = { kind: "done" } | { kind: "declined" } | { kind: "failed"; message: string };

export async function publishMedia(
  request: Record<string, unknown>,
  landed: { service: string; name: string; identifier: string },
  send: (request: Record<string, unknown>, timeout: number) => Promise<unknown> = (r, t) => qortalRequestWithTimeout(r as never, t)
): Promise<PublishOutcome> {
  try {
    await send(request, PUBLISH_MEDIA_TIMEOUT_MS);
    return { kind: "done" };
  } catch (error) {
    if (isHubDecline(error)) return { kind: "declined" };
    if (isHubTimeout(error)) {
      const there = await resourceExists(landed.service, landed.name, landed.identifier, { fresh: true }).catch(() => false);
      if (there) return { kind: "done" };
      return { kind: "failed", message: "Hub didn't finish publishing in time, and it isn't on QDN. Try again." };
    }
    return { kind: "failed", message: errorMessage(error, "Couldn't publish it. Try again.") };
  }
}
