declare module 'jsqr' {
  interface QrCode {
    data: string;
  }
  export default function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }): QrCode | null;
}
