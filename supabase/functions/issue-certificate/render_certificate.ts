import { createElement } from 'npm:react@19.3.0';
import { renderToStaticMarkup } from 'npm:react-dom@19.3.0/server';
import { QRCodeSVG } from 'npm:qrcode.react@4.2.0';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';

const wasmBytes = await Deno.readFile(new URL('./resvg.wasm', import.meta.url));
await initWasm(wasmBytes);

type Box = { x: number; y: number; width: number; height: number };
type Template = {
  backgroundUrl: string;
  canvasWidth?: number;
  canvasHeight?: number;
  nameBox: Box & {
    fontFamily: string;
    fontSize: number;
    lineHeight?: number;
    fontWeight: 400 | 700;
    italic?: boolean;
    underline?: boolean;
    opacity?: number;
    textTransform?: 'sentence' | 'lowercase' | 'uppercase' | 'capitalize';
    align: 'left' | 'center' | 'right';
    color: string;
  };
  qrCodeBox?: Box;
};

type RenderCertificateInput = {
  template: Template;
  studentName: string;
  seminarTitle: string;
  serial: string;
};

type DataImage = { mimeType: string; bytes: Uint8Array };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CANVAS_WIDTH = 8192;
const MAX_CANVAS_HEIGHT = 8192;
const MAX_CANVAS_PIXELS = 24_000_000;
const PIXELS_TO_POINTS = 0.75;
const FONT_FAMILIES = new Set(['Outfit', 'DM Sans', 'Cinzel', 'Playfair Display']);

export async function renderCertificatePdf(input: RenderCertificateInput): Promise<Uint8Array> {
  const { template, studentName, serial } = input;
  const width = template.canvasWidth ?? 1920;
  const height = template.canvasHeight ?? 1080;
  validateCanvas(width, height);
  validateText(studentName, 'student name', 200);
  validateText(serial, 'certificate serial', 80);
  validateTemplate(template, width, height);

  const background = decodeDataImage(template.backgroundUrl, ['image/svg+xml', 'image/png', 'image/jpeg']);
  const backgroundUrl = background.mimeType === 'image/svg+xml'
    ? await renderSvgDataImage(background.bytes, width, height)
    : template.backgroundUrl;

  const qrSvg = template.qrCodeBox ? qrSvgContents(serial, template.qrCodeBox) : '';
  const nameBox = template.nameBox;
  const centerY = nameBox.y + nameBox.height / 2;
  const textAnchor = nameBox.align === 'left' ? 'start' : nameBox.align === 'right' ? 'end' : 'middle';
  const textX = nameBox.align === 'left' ? nameBox.x : nameBox.align === 'right'
    ? nameBox.x + nameBox.width
    : nameBox.x + nameBox.width / 2;
  const safeFont = FONT_FAMILIES.has(nameBox.fontFamily) ? nameBox.fontFamily : 'Outfit';
  const safeColor = /^#[0-9a-f]{6}$/i.test(nameBox.color) ? nameBox.color : '#1B365D';
  const safeOpacity = nameBox.opacity === undefined ? 100 : nameBox.opacity;
  const safeTransform = nameBox.textTransform ?? 'sentence';
  const renderedName = transformName(studentName, safeTransform);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<image href="${escapeAttribute(backgroundUrl)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>`,
    `<text x="${textX}" y="${centerY}" dominant-baseline="central" text-anchor="${textAnchor}" font-family="${escapeAttribute(safeFont)}" font-size="${nameBox.fontSize}" font-weight="${nameBox.fontWeight}" font-style="${nameBox.italic ? 'italic' : 'normal'}" text-decoration="${nameBox.underline ? 'underline' : 'none'}" fill="${safeColor}" fill-opacity="${safeOpacity / 100}">${escapeXml(renderedName)}</text>`,
    qrSvg,
    '</svg>',
  ].join('');

  const renderer = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { defaultFontFamily: safeFont, loadSystemFonts: true },
  });
  rejectExternalImages(renderer.imagesToResolve());
  const png = renderer.render().asPng();
  if (png.byteLength > 20 * 1024 * 1024) throw new Error('validation_failed');

  const pdf = await PDFDocument.create();
  const pageWidth = width * PIXELS_TO_POINTS;
  const pageHeight = height * PIXELS_TO_POINTS;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  pdf.setTitle('Seminex Certificate');
  pdf.setSubject(input.seminarTitle.slice(0, 200));
  return await pdf.save();
}

function validateCanvas(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height)
    || width < 1 || height < 1 || width > MAX_CANVAS_WIDTH || height > MAX_CANVAS_HEIGHT
    || width * height > MAX_CANVAS_PIXELS) throw new Error('validation_failed');
}

function validateText(value: string, field: string, maxLength: number): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`validation_failed:${field}`);
  }
}

function validateTemplate(template: Template, width: number, height: number): void {
  if (!template || typeof template !== 'object' || !template.nameBox) throw new Error('validation_failed');
  validateBox(template.nameBox, width, height);
  if (!FONT_FAMILIES.has(template.nameBox.fontFamily)
    || !Number.isFinite(template.nameBox.fontSize) || template.nameBox.fontSize < 6 || template.nameBox.fontSize > 400
    || (template.nameBox.lineHeight !== undefined && (!Number.isFinite(template.nameBox.lineHeight) || template.nameBox.lineHeight < 1 || template.nameBox.lineHeight > 500))
    || ![400, 700].includes(template.nameBox.fontWeight)
    || !['left', 'center', 'right'].includes(template.nameBox.align)
    || (template.nameBox.italic !== undefined && typeof template.nameBox.italic !== 'boolean')
    || (template.nameBox.underline !== undefined && typeof template.nameBox.underline !== 'boolean')
    || (template.nameBox.opacity !== undefined && (!Number.isFinite(template.nameBox.opacity) || template.nameBox.opacity < 0 || template.nameBox.opacity > 100))
    || (template.nameBox.textTransform !== undefined && !['sentence', 'lowercase', 'uppercase', 'capitalize'].includes(template.nameBox.textTransform))
    || !/^#[0-9a-f]{6}$/i.test(template.nameBox.color)) throw new Error('validation_failed');
  if (template.qrCodeBox) validateBox(template.qrCodeBox, width, height);
}

function transformName(name: string, transform: NonNullable<Template['nameBox']['textTransform']>): string {
  if (transform === 'uppercase') return name.toLocaleUpperCase();
  if (transform === 'lowercase') return name.toLocaleLowerCase();
  if (transform === 'capitalize') return name.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
  const lower = name.toLocaleLowerCase();
  return lower ? lower[0]!.toLocaleUpperCase() + lower.slice(1) : lower;
}

function validateBox(box: Box, canvasWidth: number, canvasHeight: number): void {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite)
    || box.x < 0 || box.y < 0 || box.width < 1 || box.height < 1
    || box.x + box.width > canvasWidth || box.y + box.height > canvasHeight) {
    throw new Error('validation_failed');
  }
}

function decodeDataImage(value: string, acceptedMimeTypes: string[]): DataImage {
  const match = /^data:(image\/(?:svg\+xml|png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || !acceptedMimeTypes.includes(match[1].toLowerCase())) throw new Error('validation_failed');
  const binary = atob(match[2]);
  if (binary.length < 1 || binary.length > MAX_IMAGE_BYTES) throw new Error('validation_failed');
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (match[1].toLowerCase() === 'image/svg+xml') {
    const svg = new TextDecoder().decode(bytes);
    if (/<script\b|<foreignObject\b|javascript:|<!ENTITY/i.test(svg)) throw new Error('validation_failed');
  }
  return { mimeType: match[1].toLowerCase(), bytes };
}

async function renderSvgDataImage(bytes: Uint8Array, width: number, height: number): Promise<string> {
  const svg = new TextDecoder().decode(bytes);
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { defaultFontFamily: 'Outfit', loadSystemFonts: true },
  });
  rejectExternalImages(renderer.imagesToResolve());
  const png = renderer.render().asPng();
  if (png.byteLength > 20 * 1024 * 1024) throw new Error('validation_failed');
  return `data:image/png;base64,${encodeBase64(png)}`;
}

function rejectExternalImages(references: string[]): void {
  if (references.some((reference) => !reference.startsWith('data:image/'))) throw new Error('validation_failed');
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function qrSvgContents(serial: string, box: Box): string {
  const markup = renderToStaticMarkup(createElement(QRCodeSVG, {
    value: serial,
    size: Math.max(64, Math.round(Math.min(box.width, box.height))),
    level: 'M',
    marginSize: 4,
  }));
  const openTag = /^<svg\b([^>]*)>/i.exec(markup);
  const contents = /<svg\b[^>]*>([\s\S]*)<\/svg>$/i.exec(markup)?.[1];
  const viewBox = openTag?.[1].match(/\bviewBox="([^"]+)"/)?.[1];
  if (!contents || !viewBox) throw new Error('network');
  return `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${contents}</svg>`;
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
