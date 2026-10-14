import { QRCodeSVG } from 'qrcode.react';

// A QR code needs maximum contrast and a quiet zone for scanners, so it is not themed.
const FOREGROUND = '#000000';
const BACKGROUND = '#FFFFFF';

interface QrCodeProps {
  /** The ticket token. It is drawn in the browser, so it also works from the offline cache. */
  value: string;
  /** Pixel size including the built-in quiet zone. */
  size: number;
  label: string;
}

export function QrCode({ value, size, label }: QrCodeProps) {
  return (
    <div role="img" aria-label={label} className="inline-block leading-none">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={4}
        bgColor={BACKGROUND}
        fgColor={FOREGROUND}
        aria-hidden="true"
      />
    </div>
  );
}