import { useRef, useState, type PointerEvent } from 'react';

const SWATCHES = [
  ['Navy', '#1B365D'],
  ['Midnight', '#111827'],
  ['Charcoal', '#343434'],
  ['Slate', '#526477'],
  ['Warm Gray', '#78716C'],
  ['White', '#FFFFFF'],
  ['Garnet', '#7A1C1C'],
  ['Crimson', '#991B1B'],
  ['Terracotta', '#B45309'],
  ['Gold', '#B58A25'],
  ['Amber', '#D97706'],
  ['Forest', '#166534'],
  ['Olive', '#526044'],
  ['Teal', '#0F766E'],
  ['Cerulean', '#0369A1'],
  ['Royal Blue', '#1D4ED8'],
  ['Indigo', '#4338CA'],
  ['Plum', '#6B21A8'],
] as const;

type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToHsv(hex: string): Hsv {
  const clean = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : '1B365D';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: Math.round(h) % 360, s, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toByte = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`.toUpperCase();
}

interface ColorPickerProps {
  value: string;
  disabled: boolean;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, disabled, onChange }: ColorPickerProps) {
  const safeHex = /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : '#1B365D';
  const derivedHsv = hexToHsv(safeHex);
  const [hueOverride, setHueOverride] = useState<number | null>(null);
  const [draftHex, setDraftHex] = useState<string | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const activeHue = derivedHsv.s === 0 && hueOverride !== null ? hueOverride : derivedHsv.h;
  const displayedHex = draftHex ?? safeHex;

  function applyHsv(next: Hsv) {
    setHueOverride(next.h);
    setDraftHex(null);
    onChange(hsvToHex(next));
  }

  function pickFromPanel(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    applyHsv({ h: activeHue, s, v });
  }

  function handleHexChange(raw: string) {
    setDraftHex(raw);
    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[\da-f]{6}$/i.test(normalized)) {
      const upper = normalized.toUpperCase();
      setHueOverride(null);
      onChange(upper);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-body-sm-medium text-body-sm-medium text-on-surface">Text color</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowSpectrum((open) => !open)}
          className="font-caption text-caption text-primary hover:underline disabled:opacity-40"
        >
          {showSpectrum ? 'Hide spectrum' : 'Color spectrum'}
        </button>
      </div>

      {/* Curated 18-color swatch grid */}
      <div className="grid grid-cols-6 gap-1.5">
        {SWATCHES.map(([label, swatchHex]) => {
          const active = safeHex === swatchHex;
          return (
            <button
              key={swatchHex}
              type="button"
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => {
                setHueOverride(null);
                setDraftHex(null);
                onChange(swatchHex);
              }}
              className={`h-6 w-full rounded-md border transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${
                active ? 'border-primary ring-2 ring-primary/30' : 'border-outline-variant'
              }`}
              style={{ backgroundColor: swatchHex }}
            />
          );
        })}
      </div>

      {/* Interactive 2D Saturation/Value spectrum + 360° Hue bar */}
      {showSpectrum && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-container-low p-2.5">
          <div
            ref={panelRef}
            role="presentation"
            onPointerDown={(event) => {
              if (disabled) return;
              draggingRef.current = true;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                /* Pointer capture optional */
              }
              pickFromPanel(event);
            }}
            onPointerMove={(event) => {
              if (draggingRef.current) pickFromPanel(event);
            }}
            onPointerUp={(event) => {
              draggingRef.current = false;
              try {
                event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                /* Pointer capture optional */
              }
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
            className="relative h-32 w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md border border-border-subtle"
            style={{
              backgroundColor: `hsl(${activeHue}, 100%, 50%)`,
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
          >
            <span
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-black/40"
              style={{
                left: `${derivedHsv.s * 100}%`,
                top: `${(1 - derivedHsv.v) * 100}%`,
                backgroundColor: safeHex,
              }}
            />
          </div>

          <label className="flex flex-col gap-1 font-caption text-caption text-text-secondary">
            <span>Hue</span>
            <input
              aria-label="Color hue"
              type="range"
              min={0}
              max={359}
              step={1}
              disabled={disabled}
              value={activeHue}
              onChange={(event) =>
                applyHsv({ h: Number(event.target.value), s: derivedHsv.s || 0.7, v: derivedHsv.v || 0.7 })
              }
              className="h-2.5 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            />
          </label>
        </div>
      )}

      {/* Native color picker + Hex value */}
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-end gap-2">
        <label className="flex flex-col gap-1 font-caption text-caption text-text-secondary">
          <span className="sr-only">Choose text color</span>
          <input
            aria-label="Choose text color"
            type="color"
            value={safeHex}
            disabled={disabled}
            onChange={(event) => {
              setHueOverride(null);
              setDraftHex(null);
              onChange(event.target.value.toUpperCase());
            }}
            className="h-9 w-11 cursor-pointer rounded-lg border border-border-subtle bg-surface-card p-0.5 disabled:opacity-50"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary">
          Hex value
          <input
            aria-label="Hex color"
            value={displayedHex}
            maxLength={7}
            disabled={disabled}
            onChange={(event) => handleHexChange(event.target.value)}
            onBlur={() => setDraftHex(null)}
            className="h-9 w-full rounded-lg border border-border-subtle bg-surface-container-low px-2.5 font-mono font-body-sm text-body-sm text-on-surface uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </label>
      </div>
    </div>
  );
}
