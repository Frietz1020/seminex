import { useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent, type Ref } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { orgActionPrimary, orgActionTonal } from '../orgActionStyles';

const EXPORT_WIDTH = 1200;
const EXPORT_HEIGHT = 675; // 16:9 standard public-post cover ratio
const ASPECT_RATIO = EXPORT_WIDTH / EXPORT_HEIGHT;

export interface CoverImageEditorHandle {
  /** Exports the current 16:9 framed crop as a data URL, or null if not yet ready. */
  exportCrop: () => string | null;
}

interface CoverImageEditorProps {
  ref?: Ref<CoverImageEditorHandle>;
  sourceUrl: string;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

interface ImageDims {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Interactive 16:9 cover image adjuster (pan, zoom, reset).
 * Exports a crisp 1200x675 WebP/JPEG data URL that fits the existing Supabase cover upload pipeline.
 */
export function CoverImageEditor({ ref, sourceUrl, onApply, onCancel }: CoverImageEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [dims, setDims] = useState<ImageDims | null>(null);
  const [frameSize, setFrameSize] = useState<ImageDims>({ width: 576, height: 324 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setFrameSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const getMaxOffset = useCallback(
    (nextZoom: number, imageDims: ImageDims | null): { x: number; y: number } => {
      if (!imageDims) return { x: 0, y: 0 };
      const imageRatio = imageDims.width / imageDims.height;
      let baseWidth: number;
      let baseHeight: number;
      if (imageRatio > ASPECT_RATIO) {
        baseHeight = frameSize.height;
        baseWidth = baseHeight * imageRatio;
      } else {
        baseWidth = frameSize.width;
        baseHeight = baseWidth / imageRatio;
      }
      const scaledWidth = baseWidth * nextZoom;
      const scaledHeight = baseHeight * nextZoom;
      return {
        x: Math.max(0, (scaledWidth - frameSize.width) / 2),
        y: Math.max(0, (scaledHeight - frameSize.height) / 2),
      };
    },
    [frameSize.height, frameSize.width],
  );

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nextZoom: number, imageDims: ImageDims | null) => {
      const max = getMaxOffset(nextZoom, imageDims);
      return {
        x: clamp(next.x, -max.x, max.x),
        y: clamp(next.y, -max.y, max.y),
      };
    },
    [getMaxOffset],
  );

  function handleZoomChange(nextZoom: number) {
    const clampedZoom = clamp(Number(nextZoom.toFixed(2)), 1, 3);
    setZoom(clampedZoom);
    setOffset((current) => clampOffset(current, clampedZoom, dims));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!dims) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset(clampOffset({ x: drag.originX + dx, y: drag.originY + dy }, zoom, dims));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }

  function resetFraming() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setExportError(null);
  }

  const exportCrop = useCallback((): string | null => {
    const img = imgRef.current;
    if (!img || !dims) return null;
    setExportError(null);

    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_WIDTH;
    canvas.height = EXPORT_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setExportError('Your browser could not process this image. Try another file.');
      return null;
    }

    const imageRatio = dims.width / dims.height;
    let baseWidth: number;
    let baseHeight: number;
    if (imageRatio > ASPECT_RATIO) {
      baseHeight = frameSize.height;
      baseWidth = baseHeight * imageRatio;
    } else {
      baseWidth = frameSize.width;
      baseHeight = baseWidth / imageRatio;
    }

    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;
    const scaleToExportX = EXPORT_WIDTH / frameSize.width;
    const scaleToExportY = EXPORT_HEIGHT / frameSize.height;

    const drawWidth = scaledWidth * scaleToExportX;
    const drawHeight = scaledHeight * scaleToExportY;
    const drawX = (EXPORT_WIDTH - drawWidth) / 2 + offset.x * scaleToExportX;
    const drawY = (EXPORT_HEIGHT - drawHeight) / 2 + offset.y * scaleToExportY;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    try {
      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      const webp = canvas.toDataURL('image/webp', 0.9);
      return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      setExportError('This existing remote image cannot be re-cropped directly. Choose a local image file to adjust it.');
      return null;
    }
  }, [dims, frameSize.height, frameSize.width, offset.x, offset.y, zoom]);

  useImperativeHandle(ref, () => ({ exportCrop }), [exportCrop]);

  function applyCrop() {
    const output = exportCrop();
    if (output) onApply(output);
  }

  const imageRatio = dims ? dims.width / dims.height : ASPECT_RATIO;
  const displayWidth = dims
    ? (imageRatio > ASPECT_RATIO ? frameSize.height * imageRatio : frameSize.width) * zoom
    : frameSize.width;
  const displayHeight = dims
    ? (imageRatio > ASPECT_RATIO ? frameSize.height : frameSize.width / imageRatio) * zoom
    : frameSize.height;

  return (
    <div className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-container-low p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-body-sm-medium text-body-sm-medium text-on-surface">Adjust cover framing (16:9)</p>
          <p className="font-caption text-caption text-text-secondary">
            Drag to reposition and zoom to fit the standard seminar card cover.
          </p>
        </div>
        <button
          type="button"
          onClick={resetFraming}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-body-sm-medium text-body-sm-medium text-primary transition-colors hover:bg-surface-container"
        >
          <Icon name="refresh" size={16} />
          <span>Reset</span>
        </button>
      </div>

      <div
        ref={frameRef}
        role="application"
        aria-label="Cover image crop frame. Drag to reposition."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        className={`relative aspect-video w-full max-w-2xl touch-none select-none overflow-hidden rounded-xl border border-outline-variant bg-inverse-surface ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <img
          ref={imgRef}
          src={sourceUrl}
          crossOrigin={sourceUrl.startsWith('data:') ? undefined : 'anonymous'}
          alt="Cover framing preview"
          draggable={false}
          onLoad={(event) => {
            const target = event.currentTarget;
            const nextDims = { width: target.naturalWidth, height: target.naturalHeight };
            setDims(nextDims);
            setOffset((current) => clampOffset(current, zoom, nextDims));
          }}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
        />

        {/* Subtle rule-of-thirds crop guides while dragging */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${dragging ? 'opacity-100' : 'opacity-40'}`}
        >
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-space-md max-w-2xl">
        <label className="flex flex-1 items-center gap-3 font-caption text-caption text-text-secondary">
          <span className="shrink-0 font-medium text-on-surface">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            aria-label="Cover zoom"
            onChange={(event) => handleZoomChange(Number(event.target.value))}
            className="h-2 flex-1 cursor-pointer accent-primary-container"
          />
          <span className="w-11 text-right font-body-sm-medium text-body-sm-medium tabular-nums text-on-surface">
            {Math.round(zoom * 100)}%
          </span>
        </label>

        <div className="flex items-center gap-space-sm">
          <button type="button" onClick={onCancel} className={orgActionTonal}>
            Cancel
          </button>
          <button type="button" onClick={applyCrop} disabled={!dims} className={orgActionPrimary}>
            <Icon name="check" size={18} />
            <span>Apply cover</span>
          </button>
        </div>
      </div>

      {exportError && (
        <p role="alert" className="font-caption text-caption text-danger">
          {exportError}
        </p>
      )}
    </div>
  );
}
