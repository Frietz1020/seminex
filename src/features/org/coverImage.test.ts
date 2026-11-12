import { describe, expect, it } from 'vitest';
import { legacyCoverDataUrlToFile } from './coverImage';

describe('legacyCoverDataUrlToFile', () => {
  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
  ])('converts a base64 %s data URL', (mimeType, extension) => {
    const file = legacyCoverDataUrlToFile(`data:${mimeType};base64,AQ==`);

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe(mimeType);
    expect(file.name).toBe(`seminar-cover.${extension}`);
    expect(file.size).toBe(1);
  });

  it.each([
    'not-a-data-url',
    'data:image/png;base64,@@@=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,',
  ])('rejects malformed, unsupported, or empty data URL: %s', (value) => {
    expect(() => legacyCoverDataUrlToFile(value)).toThrow();
  });

  it('rejects data URLs above 5 MiB before creating a File', () => {
    const oversizedBase64 = 'AAAA'.repeat(Math.ceil((5 * 1024 * 1024 + 1) / 3));
    const dataUrl = `data:image/png;base64,${oversizedBase64}`;

    expect(() => legacyCoverDataUrlToFile(dataUrl)).toThrow(/5 MiB/);
  });
});
