import { describe, expect, it } from 'vitest';
import { clampCertificateBox, isCertificateCanvasWithinLimits } from '../../supabase/functions/_shared/certificateConstraints';

describe('certificate rendering constraints', () => {
  it('accepts only canvases inside the renderer side and pixel limits', () => {
    expect(isCertificateCanvasWithinLimits(8192, 1)).toBe(true);
    expect(isCertificateCanvasWithinLimits(6000, 4000)).toBe(true);
    expect(isCertificateCanvasWithinLimits(6000, 4001)).toBe(false);
    expect(isCertificateCanvasWithinLimits(8193, 1)).toBe(false);
    expect(isCertificateCanvasWithinLimits(1.5, 1)).toBe(false);
  });

  it('clamps a box into the canvas without mutating its source', () => {
    const source = { x: 950, y: 450, width: 300, height: 100 };

    expect(clampCertificateBox(source, 1000, 500)).toEqual({ x: 700, y: 400, width: 300, height: 100 });
    expect(source).toEqual({ x: 950, y: 450, width: 300, height: 100 });
  });
});
