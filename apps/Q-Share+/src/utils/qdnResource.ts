import { needsEncodedFetch } from "./fetchVideos";

export interface ResourceRef {
  service: string;
  name: string;
  identifier: string;
}

/** Answers the way q-apps.js does: parsed JSON, and a Core `{ error }` body or an HTTP error rejects. */
async function getJson(path: string): Promise<any> {
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

const resourcePath = (kind: "status" | "properties", ref: ResourceRef) =>
  `/arbitrary/resource/${kind}/${ref.service}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`;

/**
 * GET_QDN_RESOURCE_STATUS. q-apps.js puts the name into the URL unencoded, so
 * for a name such as "Vallot-/8/" Core answers an error page; those names go
 * to the node directly with the name encoded (same answer shape).
 */
export function resourceStatus(ref: ResourceRef, options: { build?: boolean } = {}): Promise<any> {
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
export function resourceProperties(ref: ResourceRef): Promise<any> {
  if (needsEncodedFetch(ref.name)) return getJson(resourcePath("properties", ref));
  return qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", ...ref });
}
