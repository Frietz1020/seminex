import { Buffer } from 'node:buffer';
import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { renderCertificatePdf, renderCertificatePng } from './render_certificate.ts';

type PngData = { width: number; height: number; data: Uint8Array };
type PngConstructor = new (options: { width: number; height: number }) => PngData;
const Png = PNG as unknown as PngConstructor;
const PngSync = (PNG as unknown as { sync: { read(bytes: Uint8Array): PngData; write(image: PngData): Uint8Array } }).sync;

const width = 400;
const height = 200;
const template = {
  backgroundUrl: '',
  canvasWidth: width,
  canvasHeight: height,
  nameBox: {
    x: 20, y: 60, width: 360, height: 70,
    fontFamily: 'Outfit', fontSize: 28, lineHeight: 32,
    fontWeight: 700 as const, align: 'center' as const, color: '#1B365D',
  },
};

function solidPngDataUrl(): string {
  const png = new Png({ width, height });
  const pngData = png.data;
  for (let offset = 0; offset < pngData.length; offset += 4) {
    pngData[offset] = 240;
    pngData[offset + 1] = 230;
    pngData[offset + 2] = 220;
    pngData[offset + 3] = 255;
  }
  return `data:image/png;base64,${encodeBase64(PngSync.write(png))}`;
}

function solidJpegDataUrl(): string {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = 240;
    data[offset + 1] = 230;
    data[offset + 2] = 220;
    data[offset + 3] = 255;
  }
  const jpegBytes = jpeg.encode({ data, width, height }, 90).data;
  return `data:image/jpeg;base64,${encodeBase64(jpegBytes)}`;
}

function withBackground(backgroundUrl: string) {
  return { ...template, backgroundUrl };
}

Deno.test('composes a visible background and attendee name into the PDF image', async () => {
  const png = await renderCertificatePng({
    template: withBackground(solidPngDataUrl()),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  });
  const image = PngSync.read(Buffer.from(png));

  if (image.width !== width || image.height !== height) throw new Error('Expected the configured canvas size');
  const backgroundPixel = pixelAt(image, 0, 0);
  if (!near(backgroundPixel, [240, 230, 220])) throw new Error('Expected the source background color in the output');
  let namePixels = 0;
  for (let y = template.nameBox.y; y < template.nameBox.y + template.nameBox.height; y++) {
    for (let x = template.nameBox.x; x < template.nameBox.x + template.nameBox.width; x++) {
      if (!near(pixelAt(image, x, y), [240, 230, 220])) namePixels++;
    }
  }
  if (namePixels < 50) throw new Error(`Expected attendee name glyphs in the configured name box; found ${namePixels} changed pixels`);

  const pdf = await renderCertificatePdf({
    template: withBackground(solidPngDataUrl()),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  });
  if (!new TextDecoder().decode(pdf.slice(0, 8)).startsWith('%PDF-')) throw new Error('Expected a PDF document');
});

Deno.test('accepts and renders a valid JPEG background', async () => {
  const png = await renderCertificatePng({
    template: withBackground(solidJpegDataUrl()),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  });
  const image = PngSync.read(Buffer.from(png));
  if (!near(pixelAt(image, 0, 0), [240, 230, 220], 12)) throw new Error('Expected JPEG background pixels in output');
});

Deno.test('accepts and renders an SVG background', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#f0e6dc"/></svg>';
  const png = await renderCertificatePng({
    template: withBackground(`data:image/svg+xml;base64,${encodeBase64(new TextEncoder().encode(svg))}`),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  });
  const image = PngSync.read(Buffer.from(png));
  if (!near(pixelAt(image, 0, 0), [240, 230, 220])) throw new Error('Expected SVG background pixels in output');
});

Deno.test('rejects WebP bytes declared as JPEG', async () => {
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  await expectRejected(renderCertificatePng({
    template: withBackground(`data:image/jpeg;base64,${encodeBase64(webpHeader)}`),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

Deno.test('rejects PNG bytes declared as JPEG', async () => {
  const pngBytes = PngSync.write(new Png({ width: 1, height: 1 }));
  await expectRejected(renderCertificatePng({
    template: withBackground(`data:image/jpeg;base64,${encodeBase64(pngBytes)}`),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

Deno.test('rejects non-data template image URLs instead of fetching them', async () => {
  await expectRejected(renderCertificatePdf({
    template: withBackground('https://example.test/background.svg'),
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

Deno.test('rejects malformed or out-of-bounds name geometry', async () => {
  await expectRejected(renderCertificatePdf({
    template: { ...withBackground(solidPngDataUrl()), nameBox: { ...template.nameBox, x: 500 } },
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

function pixelAt(image: PngData, x: number, y: number): [number, number, number, number] {
  const offset = (image.width * y + x) * 4;
  return [image.data[offset]!, image.data[offset + 1]!, image.data[offset + 2]!, image.data[offset + 3]!];
}

function near(actual: number[], expected: number[], tolerance = 0): boolean {
  return expected.every((channel, index) => Math.abs(actual[index]! - channel) <= tolerance);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function expectRejected(operation: Promise<unknown>): Promise<void> {
  try {
    await operation;
  } catch {
    return;
  }
  throw new Error('Expected operation to reject');
}
