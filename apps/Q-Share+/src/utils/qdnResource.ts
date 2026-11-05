import { needsEncodedFetch } from "./fetchVideos";

export interface ResourceRef {
  service: string;
  name: string;
  identifier: string;
}

/** Answers the way q-apps.js does: parsed JSON, and a Core `{ error }` body or an HTTP error rejects. */
export async function getJson(path: string): Promise<any> {
  const response = await fetch(path, { method: "GET" });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: keep the text.
  }
  if (body && typeof body === "object" && "error" in body) throw body;
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  return body;
}

/** A resource's status straight from the node (no Hub hop): for quiet checks such as card art. */
export async function resourceStatusDirect(ref: ResourceRef): Promise<any> {
  return getJson(resourcePath("status", ref));
}

/** Core's service names: capitals and underscores. Anything else (it can come from someone's JSON) is refused. */
const SERVICE = /^[A-Z][A-Z0-9_]{0,31}$/;

function resourcePath(kind: "status" | "properties", ref: ResourceRef): string {
  if (!SERVICE.test(ref.service)) throw new Error(`Not a QDN service: ${ref.service}`);
  return `/arbitrary/resource/${kind}/${ref.service}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`;
}

/**
 * GET_QDN_RESOURCE_STATUS. q-apps.js puts the name into the URL unencoded, so
 * for a name such as "Vallot-/8/" Core answers an error page; those names go
 * to the node directly with the name encoded (same answer shape).
 */
export async function resourceStatus(ref: ResourceRef, options: { build?: boolean } = {}): Promise<any> {
  if (needsEncodedFetch(ref.name)) {
    return getJson(resourcePath("status", ref) + (options.build != null ? `?build=${options.build}` : ""));
  }
  return qortalRequest({
    action: "GET_QDN_RESOURCE_STATUS",
    ...ref,
    ...(options.build != null ? { build: options.build } : {}),
  });
}

/** GET_QDN_RESOURCE_PROPERTIES ({ filename, mimeType, size }), with the same encoding rule. */
export async function resourceProperties(ref: ResourceRef): Promise<any> {
  if (needsEncodedFetch(ref.name)) return getJson(resourcePath("properties", ref));
  return qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", ...ref });
}
