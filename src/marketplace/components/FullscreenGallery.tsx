import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

/**
 * Fullscreen product gallery — swipe between images (touch + drag),
 * pinch-to-zoom / double-tap-to-zoom, keyboard nav, thumbnail strip.
 */
export function FullscreenGallery({ images, alt, open, onClose, initialIndex = 0 }: Props) {
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
      if (e.key === "ArrowRight") setIdx((i) => Math.min(images.length - 1, i + 1));
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, images.length, onClose]);

  if (!open) return null;

  const go = (dir: -1 | 1) => setIdx((i) => Math.max(0, Math.min(images.length - 1, i + dir)));
  const zoomed = zoom > 1;

  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (zoomed) {
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    } else {
      swipeStart.current = e.clientX;
    }
    // Double-tap to zoom on touch
    const now = Date.now();
    if (now - lastTap.current < 280) {
      setZoom((z) => (z > 1 ? 1 : 2.2));
      setOffset({ x: 0, y: 0 });
    }
    lastTap.current = now;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (zoomed && dragStart.current) {
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!zoomed && swipeStart.current !== null) {
      const dx = e.clientX - swipeStart.current;
      if (dx > 60) go(-1);
      else if (dx < -60) go(1);
    }
    dragStart.current = null;
    swipeStart.current = null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          onClick={onClose}
          aria-label="Close gallery"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-[13px] font-medium tabular-nums opacity-80">
          {idx + 1} / {images.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setZoom((z) => Math.max(1, +(z - 0.5).toFixed(2))); setOffset({ x: 0, y: 0 }); }}
            aria-label="Zoom out"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            disabled={zoom <= 1}
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
            aria-label="Zoom in"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
            disabled={zoom >= 4}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* main image */}
      <div className="relative flex-1 select-none overflow-hidden">
        <img
          src={images[idx]}
          alt={alt}
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

        {idx > 0 && (
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {idx < images.length - 1 && (
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* thumbnails */}
      {images.length > 1 && (
        <div className="hide-scrollbar flex justify-center gap-2 overflow-x-auto px-4 py-4 sm:px-6">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              onClick={() => setIdx(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg transition-all ${
                i === idx ? "ring-2 ring-white" : "opacity-50 hover:opacity-80"
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
