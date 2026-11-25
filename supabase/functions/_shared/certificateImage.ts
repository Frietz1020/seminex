import { isCertificateCanvasWithinLimits } from './certificateConstraints.ts';

export type CertificateRasterMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

export function normalizeCertificateRasterMimeType(
  declaredMimeType: CertificateRasterMimeType,
  bytes: Uint8Array,
): CertificateRasterMimeType | null {
  const detectedMimeType = detectCertificateRasterMimeType(bytes);
  if (detectedMimeType === declaredMimeType) return detectedMimeType;

  // Older certificate snapshots may contain WebP bytes under the PNG label.
  if (declaredMimeType === 'image/png' && detectedMimeType === 'image/webp') return detectedMimeType;

  return null;
}

export function isCertificateWebpWithinLimits(bytes: Uint8Array): boolean {
  if (!hasWebpSignature(bytes)) return false;

  const chunkType = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!);
  let width: number;
  let height: number;

  if (chunkType === 'VP8X' && bytes.length >= 30) {
    width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
  } else if (chunkType === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    width = 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8);
    height = 1 + ((bytes[22]! & 0xc0) >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10);
  } else if (chunkType === 'VP8 ' && bytes.length >= 30
    && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    width = (bytes[26]! | (bytes[27]! << 8)) & 0x3fff;
    height = (bytes[28]! | (bytes[29]! << 8)) & 0x3fff;
  } else {
    return false;
  }

  return isCertificateCanvasWithinLimits(width, height);
}

function detectCertificateRasterMimeType(bytes: Uint8Array): CertificateRasterMimeType | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (hasWebpSignature(bytes)) return 'image/webp';
  return null;
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}
