/**
 * Stable, cacheable image URLs.
 *
 * Signed storage URLs carry a one-time token, so the browser sees a brand new
 * address on every page load and can never reuse an image it already
 * downloaded. That makes avatars, covers and feed media re-download on every
 * navigation.
 *
 * For public-facing imagery we instead point at `/api/public/img/<bucket>/<path>`,
 * which serves the same bytes from a permanent address with a one-year
 * immutable cache header. Same-origin, so no extra DNS/TLS handshake either.
 *
 * Buckets listed here MUST also be allowed in src/routes/api/public/img.$.ts.
 */
export const STABLE_IMAGE_BUCKETS = new Set([
  "avatars",
  "product-covers",
  "profile-covers",
  "blog-covers",
  "course-covers",
  "post-media",
]);

/** True when this bucket can be served from the permanent cached image route. */
export function isStableBucket(bucket: string): boolean {
  return STABLE_IMAGE_BUCKETS.has(bucket);
}

/**
 * Permanent URL for a storage object, or `null` when the bucket is private
 * (caller should fall back to signing).
 */
export function stableImageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!isStableBucket(bucket)) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `/api/public/img/${bucket}/${encoded}`;
}

/** Map a list of storage paths to stable URLs; `null` entries stay `null`. */
export function stableImageUrls(
  bucket: string,
  paths: (string | null | undefined)[],
): (string | null)[] {
  return paths.map((p) => stableImageUrl(bucket, p));
}
