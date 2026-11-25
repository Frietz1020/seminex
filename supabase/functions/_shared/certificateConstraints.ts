export const CERTIFICATE_RENDER_LIMITS = {
  maxSide: 8192,
  maxPixels: 24_000_000,
  maxImageBytes: 5 * 1024 * 1024,
} as const;

export type CertificateBox = { x: number; y: number; width: number; height: number };

export function isCertificateCanvasWithinLimits(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height)
    && width >= 1 && height >= 1
    && width <= CERTIFICATE_RENDER_LIMITS.maxSide
    && height <= CERTIFICATE_RENDER_LIMITS.maxSide
    && width * height <= CERTIFICATE_RENDER_LIMITS.maxPixels;
}

export function clampCertificateBox<T extends CertificateBox>(box: T, width: number, height: number): T {
  const finiteOr = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
  const boxWidth = Math.min(width, Math.max(1, finiteOr(box.width, 1)));
  const boxHeight = Math.min(height, Math.max(1, finiteOr(box.height, 1)));
  return {
    ...box,
    width: boxWidth,
    height: boxHeight,
    x: Math.min(width - boxWidth, Math.max(0, finiteOr(box.x, 0))),
    y: Math.min(height - boxHeight, Math.max(0, finiteOr(box.y, 0))),
  } as T;
}
