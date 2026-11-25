import { isCertificateWebpWithinLimits, normalizeCertificateRasterMimeType } from './certificateImage.ts';

Deno.test('normalizes PNG-labelled WebP bytes to their actual image MIME type', () => {
  const webp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x1e, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  if (normalizeCertificateRasterMimeType('image/png', webp) !== 'image/webp') {
    throw new Error('Expected PNG-labelled WebP bytes to be identified as WebP');
  }
});

Deno.test('preserves matching PNG and JPEG MIME types', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff]);

  if (normalizeCertificateRasterMimeType('image/png', png) !== 'image/png'
    || normalizeCertificateRasterMimeType('image/jpeg', jpeg) !== 'image/jpeg') {
    throw new Error('Expected correctly labelled raster images to keep their MIME type');
  }
});

Deno.test('rejects unrelated declared and detected raster MIME types', () => {
  const webp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x1e, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]);

  if (normalizeCertificateRasterMimeType('image/jpeg', webp) !== null) {
    throw new Error('Expected unrelated MIME mismatches to remain rejected');
  }
});

Deno.test('checks WebP dimensions before decoding', () => {
  const webp = Uint8Array.from(atob('UklGRh4AAABXRUJQVlA4TBEAAAAvAUAAAAdQ88KXu/+BiOh/AAA='), (char) => char.charCodeAt(0));

  if (!isCertificateWebpWithinLimits(webp)) {
    throw new Error('Expected the valid 2x2 WebP fixture to fit the image limits');
  }

  const oversizedWebp = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x1e, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4c, 0x0a, 0, 0, 0, 0x2f, 0xff, 0xff, 0xff, 0x0f, 0,
  ]);
  if (isCertificateWebpWithinLimits(oversizedWebp)) {
    throw new Error('Expected oversized WebP dimensions to be rejected before decoding');
  }
});
