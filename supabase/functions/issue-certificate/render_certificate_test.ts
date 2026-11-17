import { renderCertificatePdf } from './render_certificate.ts';

const template = {
  backgroundUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==',
  canvasWidth: 400,
  canvasHeight: 200,
  nameBox: {
    x: 20, y: 70, width: 360, height: 60,
    fontFamily: 'Outfit', fontSize: 28, lineHeight: 32,
    fontWeight: 700 as const, align: 'center' as const, color: '#1B365D',
  },
};

Deno.test('renders certificate name and serial into a landscape PDF', async () => {
  const bytes = await renderCertificatePdf({
    template,
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  });

  const header = new TextDecoder().decode(bytes.slice(0, 8));
  if (!header.startsWith('%PDF-')) throw new Error('Expected a PDF document');
});

Deno.test('rejects non-data template image URLs instead of fetching them', async () => {
  await expectRejected(renderCertificatePdf({
    template: { ...template, backgroundUrl: 'https://example.test/background.svg' },
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

Deno.test('rejects malformed or out-of-bounds name geometry', async () => {
  await expectRejected(renderCertificatePdf({
    template: { ...template, nameBox: { ...template.nameBox, x: 500 } },
    studentName: 'Ana Cruz',
    seminarTitle: 'Seminex Test Seminar',
    serial: 'SNX-ABC123',
  }));
});

async function expectRejected(operation: Promise<unknown>): Promise<void> {
  let rejected = false;
  try {
    await operation;
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Expected operation to reject');
}
