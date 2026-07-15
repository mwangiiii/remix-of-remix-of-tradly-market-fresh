// Supabase Storage image helper.
//
// Rewrites public storage URLs from the raw object endpoint:
//   /storage/v1/object/public/<bucket>/<path>
// to the on-the-fly transformation endpoint:
//   /storage/v1/render/image/public/<bucket>/<path>?width=…&quality=…&resize=cover
//
// The transform endpoint negotiates WebP automatically via the browser's
// Accept header, so a single URL serves modern formats to modern browsers
// and falls back to the source encoding elsewhere.
//
// Non-Supabase URLs (external, data:, blob:) pass through unchanged so we
// don't accidentally break mock/CDN images.

const RENDER_MARKER = "/storage/v1/render/image/public/";
const OBJECT_MARKER = "/storage/v1/object/public/";

function isSupabaseStorage(url: string): boolean {
  return url.includes(OBJECT_MARKER) || url.includes(RENDER_MARKER);
}

export interface ImgOptions {
  /** Target rendered width in CSS px. The transform endpoint fetches ~2x for DPR. */
  width: number;
  /** JPEG/WebP quality 20-100. Default 75 balances filesize and perceived quality. */
  quality?: number;
  /** How to fit inside the box. Default "cover" — matches CSS object-cover. */
  resize?: "cover" | "contain" | "fill";
}

/**
 * Return a URL that asks Supabase to resize the image at the CDN edge.
 * Pass the *display* width in CSS px; the browser adds DPR scaling via srcset.
 */
export function imgUrl(src: string | undefined | null, opts: ImgOptions): string {
  if (!src) return "";
  if (!isSupabaseStorage(src)) return src;

  const rewritten = src.includes(RENDER_MARKER)
    ? src
    : src.replace(OBJECT_MARKER, RENDER_MARKER);

  // Strip any existing query so options are authoritative.
  const [base] = rewritten.split("?");
  const params = new URLSearchParams({
    width: String(Math.round(opts.width)),
    quality: String(opts.quality ?? 75),
    resize: opts.resize ?? "cover",
  });
  return `${base}?${params.toString()}`;
}

/**
 * Build a `srcset` string covering common widths, so browsers pick the
 * smallest variant that still fills the layout slot at the current DPR.
 */
export function imgSrcSet(
  src: string | undefined | null,
  widths: number[] = [320, 480, 640, 800, 1200],
  opts?: Omit<ImgOptions, "width">,
): string {
  if (!src || !isSupabaseStorage(src)) return "";
  return widths
    .map((w) => `${imgUrl(src, { width: w, ...opts })} ${w}w`)
    .join(", ");
}
