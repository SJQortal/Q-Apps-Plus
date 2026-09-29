/**
 * Hub's app library shows the publisher name's avatar as the app icon, so the
 * launcher does the same. A relative /arbitrary URL reaches the node from
 * inside Hub; outside Hub the request fails and the fallback icon stays.
 */
export function qortalAvatarUrl(name: string): string {
  return `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar?async=true`;
}
