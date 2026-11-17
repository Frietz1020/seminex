import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile, Registration, Seminar, Ticket } from './types';
import { createTicketPdf, ticketPdfFilename, type TicketPdfInput } from './ticketPdf';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: string, data: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const type = encoder.encode(name);
  const contents = new Uint8Array(type.length + data.length);
  contents.set(type);
  contents.set(data, type.length);
  const chunk = new Uint8Array(12 + data.length);
  new DataView(chunk.buffer).setUint32(0, data.length);
  chunk.set(contents, 4);
  new DataView(chunk.buffer).setUint32(4 + contents.length, crc32(contents));
  return chunk;
}

function onePixelPngDataUrl(): string {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, 1);
  new DataView(header.buffer).setUint32(4, 1);
  header[8] = 8;
  header[9] = 6;
  const scanline = new Uint8Array([0, 255, 255, 255, 255]);
  const compressed = new Uint8Array(2 + 1 + 4 + scanline.length + 4);
  compressed.set([0x78, 0x01, 0x01, scanline.length, 0, 0xfa, 0xff]);
  compressed.set(scanline, 7);
  let a = 1;
  let b = 0;
  for (const byte of scanline) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(compressed.buffer).setUint32(compressed.length - 4, (b << 16) | a);
  const chunks = [pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array())];
  const png = new Uint8Array(signature.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  png.set(signature, offset);
  offset += signature.length;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  let binary = '';
  png.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:image/png;base64,${btoa(binary)}`;
}

const input: TicketPdfInput = {
  seminar: {
    id: 'seminar-1',
    seminarType: 'seminar',
    reference: 'SEM-2026-01',
    title: 'Secure Systems Workshop',
    description: '',
    speaker: { name: 'Alex Speaker', role: 'Engineer' },
    venue: 'CCS Auditorium',
    department: 'CCS',
    topics: [],
    startsAt: '2026-11-10T09:00:00+08:00',
    endsAt: '2026-11-10T12:00:00+08:00',
    capacity: 100,
    registeredCount: 1,
    requiredAttendancePercent: 60,
  } satisfies Seminar,
  ticket: {
    seminarId: 'seminar-1',
    studentId: '202410770',
    issuedAt: '2026-11-01T10:00:00+08:00',
  } satisfies Ticket,
  profile: {
    firstName: 'Taylor',
    lastName: 'Student',
    middleInitial: 'Q',
    program: 'IT',
    yearLevel: 2,
    block: 'A',
    studentId: '202410770',
    college: 'CCS',
    enrollmentStatus: 'active',
    unreadNotificationCount: 0,
  } satisfies Profile,
  registration: {
    reference: 'SNX-TICKET-0001',
    registeredAt: '2026-11-01T10:00:00+08:00',
    status: 'confirmed',
    confirmedAt: '2026-11-01T10:01:00+08:00',
    attendanceAckAt: null,
    timeIn: null,
    timeOut: null,
    evaluationSubmittedAt: null,
    certificateIssuedAt: null,
  } satisfies Registration,
};

describe('ticket PDF generation', () => {
  const qrSvgBlobs: Blob[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    qrSvgBlobs.length = 0;
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 768;
      naturalHeight = 768;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((blob: Blob) => {
        qrSvgBlobs.push(blob);
        return 'blob:ticket-qr';
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      onePixelPngDataUrl(),
    );
  });

  it('returns a one-page PDF containing the applicant and seminar ticket details', async () => {
    const pdf = await createTicketPdf(input);

    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(0);
    const source = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(source.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    expect(source).toContain('Secure Systems Workshop');
    expect(source).toContain('Taylor Q. Student');
    expect(source).toContain('Student ID: 202410770');
    expect(source).toContain('Registration: SNX-TICKET-0001');
    expect(source).toContain('CCS Auditorium');
    expect(qrSvgBlobs).toHaveLength(0);
    expect(source).toContain('Show the live attendance QR in the Seminex app');
  });

  it('creates a safe filename from the seminar reference', () => {
    expect(ticketPdfFilename('SEM/2026:01')).toBe('seminex-SEM_2026_01-ticket.pdf');
    expect(ticketPdfFilename('..')).toBe('seminex-ticket-ticket.pdf');
  });
});
