import { certificateFailureEvent, parseIssueCertificateRequest } from './request.ts';

Deno.test('normalizes valid seminar UUIDs to lowercase', () => {
  const result = parseIssueCertificateRequest({ seminarId: '12345678-1234-4234-8234-123456789ABC' });
  if (result?.seminarId !== '12345678-1234-4234-8234-123456789abc') throw new Error('Expected lowercase seminar UUID');
});

Deno.test('rejects malformed request bodies and extra keys', () => {
  for (const value of [null, [], 'text', { seminarId: 'bad' }, { seminarId: '12345678-1234-4234-8234-123456789012', extra: true }]) {
    if (parseIssueCertificateRequest(value) !== null) throw new Error('Expected malformed request to be rejected');
  }
});

Deno.test('builds a closed sanitized diagnostic event', () => {
  const event = certificateFailureEvent('render', 'validation_failed', 'canvas');
  if (JSON.stringify(event) !== JSON.stringify({ stage: 'render', code: 'validation_failed', reason: 'canvas' })) {
    throw new Error('Expected only safe diagnostic fields');
  }
});
