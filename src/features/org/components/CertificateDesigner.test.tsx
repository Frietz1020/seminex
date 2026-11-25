import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CertificateDesigner } from './CertificateDesigner';
import type { CertificateTemplate } from '../../../api/orgTypes';

const certificate: CertificateTemplate = {
  backgroundUrl: 'https://example.test/certificate.png',
  canvasWidth: 1920,
  canvasHeight: 1080,
  updatedAt: '2026-11-13T00:00:00.000Z',
  nameBox: { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700, align: 'center', color: '#1B365D' },
};

function renderDesigner(value: CertificateTemplate | null = certificate) {
  return render(<CertificateDesigner
    certificate={value} qrValue="certificate preview"
    onChangeBackground={vi.fn()} onUpdateCanvasSize={vi.fn()} onUpdateField={vi.fn()}
    onUpdateGeometry={vi.fn()} onUpdateQrCodeGeometry={vi.fn()} onReset={vi.fn()}
  />);
}

describe('certificate designer', () => {
  it('limits custom dimensions to the renderer contract and reports the pair atomically', () => {
    const updateCanvasSize = vi.fn();
    render(<CertificateDesigner certificate={certificate} qrValue="preview" onChangeBackground={vi.fn()} onUpdateCanvasSize={updateCanvasSize} onUpdateField={vi.fn()} onUpdateGeometry={vi.fn()} onUpdateQrCodeGeometry={vi.fn()} onReset={vi.fn()} />);

    const width = screen.getByRole('spinbutton', { name: 'Canvas width (px)' });
    fireEvent.change(width, { target: { value: '20000' } });
    fireEvent.blur(width);

    expect(updateCanvasSize).toHaveBeenCalledWith(8192, 1080);
  });

  it('reports a preset width and height together', () => {
    const updateCanvasSize = vi.fn();
    render(<CertificateDesigner certificate={certificate} qrValue="preview" onChangeBackground={vi.fn()} onUpdateCanvasSize={updateCanvasSize} onUpdateField={vi.fn()} onUpdateGeometry={vi.fn()} onUpdateQrCodeGeometry={vi.fn()} onReset={vi.fn()} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Canvas preset' }), { target: { value: '3' } });

    expect(updateCanvasSize).toHaveBeenCalledTimes(1);
    expect(updateCanvasSize).toHaveBeenCalledWith(3508, 2480);
  });

  it('keeps the canvas useful without obsolete help, coordinates, or signature paths', () => {
    renderDesigner({ ...certificate, signatureBox: { x: 1, y: 1, width: 10, height: 10, imageUrl: 'data:image/png;base64,AA==' } } as unknown as CertificateTemplate);

    expect(screen.queryByText(/Dynamic certificate canvas/)).toBeNull();
    expect(screen.queryByText(/issue automatically/)).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /snap to center/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /safety guidelines/i })).toBeNull();
    expect(screen.queryByLabelText('X pos')).toBeNull();
    expect(screen.queryByText(/e-signature/i)).toBeNull();
    expect(screen.getByRole('group', { name: /attendee name box/i })).not.toBeNull();
    expect(screen.getByRole('group', { name: /certificate QR code/i })).not.toBeNull();
  });

  it('offers name styling, alignment, case, color, and opacity controls for old templates', () => {
    renderDesigner();

    expect(screen.getByRole('button', { name: 'Italic' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Underline' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Align left' })).not.toBeNull();
    expect(screen.getByRole('combobox', { name: /name case/i })).not.toBeNull();
    expect(screen.getByLabelText(/choose text color/i)).not.toBeNull();
    expect((screen.getByLabelText(/text opacity/i) as HTMLInputElement).value).toBe('100');
  });

  it('persists name styling choices from accessible controls', async () => {
    const user = userEvent.setup();
    const updateField = vi.fn();
    render(<CertificateDesigner certificate={certificate} qrValue="preview" onChangeBackground={vi.fn()} onUpdateCanvasSize={vi.fn()} onUpdateField={updateField} onUpdateGeometry={vi.fn()} onUpdateQrCodeGeometry={vi.fn()} onReset={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Italic' }));
    await user.click(screen.getByRole('button', { name: 'Align right' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Name case' }), 'uppercase');
    fireEvent.change(screen.getByRole('slider', { name: 'Text opacity' }), { target: { value: '35' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Hex color' }), { target: { value: '#326B9A' } });

    expect(updateField).toHaveBeenNthCalledWith(1, 'italic', true);
    expect(updateField).toHaveBeenNthCalledWith(2, 'align', 'right');
    expect(updateField).toHaveBeenNthCalledWith(3, 'textTransform', 'uppercase');
    expect(updateField).toHaveBeenNthCalledWith(4, 'opacity', 35);
    expect(updateField).toHaveBeenNthCalledWith(5, 'color', '#326B9A');
  });

  it('supports keyboard movement and resizing of the QR placement', () => {
    const updateQr = vi.fn();
    render(<CertificateDesigner certificate={certificate} qrValue="preview" onChangeBackground={vi.fn()} onUpdateCanvasSize={vi.fn()} onUpdateField={vi.fn()} onUpdateGeometry={vi.fn()} onUpdateQrCodeGeometry={updateQr} onReset={vi.fn()} />);
    const qr = screen.getByRole('group', { name: /certificate qr code/i });

    fireEvent.keyDown(qr, { key: 'ArrowLeft' });
    expect(updateQr).toHaveBeenLastCalledWith({ x: 1639, y: 800, width: 180, height: 180 });
    fireEvent.keyDown(qr, { key: 'ArrowRight', shiftKey: true });
    expect(updateQr).toHaveBeenLastCalledWith({ x: 1640, y: 800, width: 190, height: 180 });
  });
});
