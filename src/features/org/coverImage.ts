const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_COVER_BYTES / 3) * 4;

const COVER_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

/** Convert supported legacy cover data URLs into bounded Files for Supabase Storage. */
export function legacyCoverDataUrlToFile(dataUrl: string): File {
  const comma = dataUrl.indexOf(',');
  if (comma >= 0) {
    const encodedLength = dataUrl.length - comma - 1;
    if (encodedLength > MAX_BASE64_LENGTH) throw new Error('Cover image must be 5 MiB or smaller.');
    const paddingBytes = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
    if (encodedLength % 4 === 0 && (encodedLength / 4) * 3 - paddingBytes > MAX_COVER_BYTES) {
      throw new Error('Cover image must be 5 MiB or smaller.');
    }
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) throw new Error('Cover image data is invalid.');
  const mimeType = match[1] as keyof typeof COVER_TYPES;
  const encoded = match[2] ?? '';
  if (encoded.length > MAX_BASE64_LENGTH) throw new Error('Cover image must be 5 MiB or smaller.');
  if (encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('Cover image data is invalid.');
  }
  const paddingBytes = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  if ((encoded.length / 4) * 3 - paddingBytes > MAX_COVER_BYTES) throw new Error('Cover image must be 5 MiB or smaller.');

  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new Error('Cover image data is invalid.');
  }
  if (decoded.length < 1) throw new Error('Cover image must not be empty.');
  if (decoded.length > MAX_COVER_BYTES) throw new Error('Cover image must be 5 MiB or smaller.');

  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  return new File([bytes], `seminar-cover.${COVER_TYPES[mimeType]}`, { type: mimeType });
}
