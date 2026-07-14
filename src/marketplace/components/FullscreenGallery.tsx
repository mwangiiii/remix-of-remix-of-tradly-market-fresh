import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

export interface GalleryItem {
  url: string;
  kind: "image" | "video";
  altText?: string | null;
  posterUrl?: string | null;
  mimeType?: string | null;
}

interface Props {
  /** Preferred mixed image + video list. Overrides `images` when provided. */
  items?: GalleryItem[];
  /** Legacy image-only list — used if `items` is absent. */
  images?: string[];
  alt: string;
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

/**
 * Fullscreen product gallery — swipe/keyboard nav across a mixed image +
 * video list. Images support pinch/double-tap zoom and drag pan; videos
 * render a native `<video controls>` (pan/zoom disabled).
 */
export function FullscreenGallery({ items, images, alt, open, onClose, initialIndex = 0 }: Props) {
  // Normalize incoming shape into a single `resolved` list of items so the
  // rest of the component doesn't care about the two prop styles.
  const resolved: GalleryItem[] = useMemo(() => {
    if (items && items.length > 0) return items;
    return (images ?? []).map((url) => ({ url, kind: "image" as const }));
  }, [items, images]);

  const [idx, setIdx] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipeStart = useRef<number | null>(null);
  const lastTap = useRef<number>(0);

  useEffect(() => { if (open) setIdx(initialIndex); }, [open, initialIndex]);
  useEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); }, [idx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(resolved.length - 1, i + 1));
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, resolved.length, onClose]);

  if (!open || resolved.length === 0) return null;

  const go = (dir: -1 | 1) => setIdx((i) => Math.max(0, Math.min(resolved.length - 1, i + dir)));
  const current = resolved[idx];
  const isImage = current.kind === "image";
  const zoomed = zoom > 1;

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isImage) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (zoomed) {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    } else {
      swipeStart.current = e.clientX;
    }
    const now = Date.now();
    if (now - lastTap.current < 280) {
      setZoom((z) => (z > 1 ? 1 : 2.2));
      setOffset({ x: 0, y: 0 });
    }
    lastTap.current = now;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (isImage && zoomed && dragStart.current) {
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (isImage && !zoomed && swipeStart.current !== null) {
      const dx = e.clientX - swipeStart.current;
      if (dx > 60) go(-1);
      else if (dx < -60) go(1);
    }
    dragStart.current = null;
    swipeStart.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={onClose}
          aria-label="Close gallery"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-[13px] font-medium tabular-nums opacity-80">
          {idx + 1} / {resolved.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2))); setOffset({ x: 0, y: 0 }); }}
            aria-label="Zoom out"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            disabled={!isImage || zoom <= 1}
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
            aria-label="Zoom in"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            disabled={!isImage || zoom >= 4}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 select-none overflow-hidden">
        {isImage ? (
          <img
            src={current.url}
            alt={current.altText ?? alt}
            draggable={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => { setZoom((z) => (z > 1 ? 1 : 2.2)); setOffset({ x: 0, y: 0 }); }}
            className="absolute inset-0 m-auto h-full w-full object-contain transition-transform duration-150 will-change-transform"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              cursor: zoomed ? "grab" : "zoom-in",
            }}
          />
        ) : (
          <video
            key={current.url}
            src={current.url}
            poster={current.posterUrl ?? undefined}
            controls
            playsInline
            className="absolute inset-0 m-auto h-full w-full object-contain"
          />
        )}

        {idx > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {idx < resolved.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {resolved.length > 1 && (
        <div className="hide-scrollbar flex justify-center gap-2 overflow-x-auto px-4 py-4 sm:px-6">
          {resolved.map((it, i) => (
            <button
              key={`${it.url}-${i}`}
              onClick={() => setIdx(i)}
              aria-label={`Show item ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg transition-all ${
                i === idx ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"
              }`}
            >
              {it.kind === "video" ? (
                <>
                  <video
                    src={it.url}
                    poster={it.posterUrl ?? undefined}
                    preload="metadata"
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-black/50 text-[10px] font-bold">
                      ▶
                    </span>
                  </span>
                </>
              ) : (
                <img
                  src={it.posterUrl ?? it.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
