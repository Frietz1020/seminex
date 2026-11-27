import { useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { CertificateTemplate, NameBox } from '../../../api/orgTypes';
import { CERTIFICATE_RENDER_LIMITS } from '../../../../supabase/functions/_shared/certificateConstraints';
import { CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH } from '../../../api/orgTypes';
import { Icon } from '../../../components/ui/Icon';
import type { IconName } from '../../../components/ui/icons';
import { ColorPicker } from './ColorPicker';

type NameBoxField = keyof NameBox;
type Geometry = Pick<NameBox, 'x' | 'y' | 'width' | 'height'>;
type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type CornerDirection = 'nw' | 'ne' | 'se' | 'sw';
type Gesture = { pointerId: number; mode: 'move' | 'resize'; direction?: Direction; startX: number; startY: number; start: Geometry };

const BASE_NAME_BOX: NameBox = {
  x: 360,
  y: 480,
  width: 1200,
  height: 140,
  fontFamily: 'Outfit',
  fontSize: 72,
  fontWeight: 700,
  align: 'center',
  color: '#1B365D',
  lineHeight: 90,
};

const FONT_GROUPS = [
  {
    label: 'Modern Sans-Serif',
    fonts: ['Outfit', 'DM Sans', 'Montserrat', 'Plus Jakarta Sans', 'Raleway'],
  },
  {
    label: 'Classic Serif',
    fonts: ['Playfair Display', 'Cinzel', 'Cormorant Garamond', 'Libre Baskerville', 'Merriweather', 'EB Garamond', 'Lora'],
  },
  {
    label: 'Calligraphy & Script',
    fonts: ['Great Vibes', 'Alex Brush', 'Allura', 'Dancing Script'],
  },
] as const;

const ALL_HANDLES: Array<{ direction: Direction; position: string }> = [
  { direction: 'nw', position: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { direction: 'n', position: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize' },
  { direction: 'ne', position: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { direction: 'e', position: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  { direction: 'se', position: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  { direction: 's', position: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
  { direction: 'sw', position: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
  { direction: 'w', position: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
];

const CORNER_HANDLES: Array<{ direction: CornerDirection; position: string }> = [
  { direction: 'nw', position: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { direction: 'ne', position: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { direction: 'se', position: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  { direction: 'sw', position: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
];

const inputClass =
  'h-9 w-full rounded-lg border border-border-subtle bg-surface-container-low px-2.5 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50';

interface Props {
  certificate: CertificateTemplate | null;
  qrValue: string;
  onUpdateCanvasSize: (width: number, height: number) => void;
  onChangeBackground: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateField: (field: NameBoxField, value: string | number | boolean) => void;
  onUpdateGeometry: (value: Geometry) => void;
  onUpdateQrCodeGeometry: (value: Geometry) => void;
  onReset: () => void;
}

function clampBox(box: Geometry, width: number, height: number): Geometry {
  const boxWidth = Math.min(width, Math.max(100, Math.round(box.width)));
  const boxHeight = Math.min(height, Math.max(40, Math.round(box.height)));
  return {
    width: boxWidth,
    height: boxHeight,
    x: Math.min(width - boxWidth, Math.max(0, Math.round(box.x))),
    y: Math.min(height - boxHeight, Math.max(0, Math.round(box.y))),
  };
}

function clampSquareBox(box: Geometry, width: number, height: number): Geometry {
  const maxSide = Math.min(width, height);
  const rawSide = Math.max(box.width, box.height);
  const side = Math.min(maxSide, Math.max(48, Math.round(rawSide)));
  return {
    width: side,
    height: side,
    x: Math.min(width - side, Math.max(0, Math.round(box.x))),
    y: Math.min(height - side, Math.max(0, Math.round(box.y))),
  };
}

function sentenceCase(value: string): string {
  const text = value.toLocaleLowerCase();
  return text ? text[0]!.toLocaleUpperCase() + text.slice(1) : text;
}

export function CertificateDesigner({
  certificate,
  qrValue,
  onChangeBackground,
  onUpdateField,
  onUpdateGeometry,
  onUpdateQrCodeGeometry,
  onUpdateCanvasSize,
  onReset,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nameGesture = useRef<Gesture | null>(null);
  const qrGesture = useRef<Gesture | null>(null);
  const [previewName, setPreviewName] = useState('Ana Cruz');

  const width = certificate?.canvasWidth ?? CERTIFICATE_CANVAS_WIDTH;
  const height = certificate?.canvasHeight ?? CERTIFICATE_CANVAS_HEIGHT;
  const nameBox = certificate?.nameBox ? { ...BASE_NAME_BOX, ...certificate.nameBox } : null;
  const qrBox = certificate?.backgroundUrl
    ? clampSquareBox(
        certificate.qrCodeBox ?? { x: width - 280, y: height - 280, width: 180, height: 180 },
        width,
        height,
      )
    : null;
  const color = nameBox?.color ?? '#1B365D';

  function begin(event: PointerEvent<HTMLElement>, target: 'name' | 'qr', mode: Gesture['mode'], direction?: Direction) {
    const box = target === 'name' ? nameBox : qrBox;
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer capture is optional. */
    }
    const gesture: Gesture = {
      pointerId: event.pointerId,
      mode,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      start: { ...box },
    };
    if (target === 'name') nameGesture.current = gesture;
    else qrGesture.current = gesture;
  }

  function move(event: PointerEvent<HTMLElement>, target: 'name' | 'qr') {
    const gesture = target === 'name' ? nameGesture.current : qrGesture.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || gesture.pointerId !== event.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = ((event.clientX - gesture.startX) / bounds.width) * width;
    const dy = ((event.clientY - gesture.startY) / bounds.height) * height;

    if (target === 'qr') {
      if (gesture.mode === 'move') {
        onUpdateQrCodeGeometry(
          clampSquareBox(
            { ...gesture.start, x: gesture.start.x + dx, y: gesture.start.y + dy },
            width,
            height,
          ),
        );
        return;
      }

      // Locked 1:1 diagonal scaling anchored at the opposite corner
      const dir = (gesture.direction ?? 'se') as CornerDirection;
      const startSize = Math.max(gesture.start.width, gesture.start.height);
      const signedX = dir.includes('e') ? dx : -dx;
      const signedY = dir.includes('s') ? dy : -dy;
      const delta = Math.abs(signedX) >= Math.abs(signedY) ? signedX : signedY;

      const anchorX = dir.includes('w') ? gesture.start.x + startSize : gesture.start.x;
      const anchorY = dir.includes('n') ? gesture.start.y + startSize : gesture.start.y;
      const maxAvailableX = dir.includes('w') ? anchorX : width - anchorX;
      const maxAvailableY = dir.includes('n') ? anchorY : height - anchorY;
      const maxSide = Math.min(maxAvailableX, maxAvailableY);
      const nextSize = Math.min(maxSide, Math.max(48, Math.round(startSize + delta)));

      const nextX = dir.includes('w') ? anchorX - nextSize : anchorX;
      const nextY = dir.includes('n') ? anchorY - nextSize : anchorY;
      onUpdateQrCodeGeometry(clampSquareBox({ x: nextX, y: nextY, width: nextSize, height: nextSize }, width, height));
      return;
    }

    const next = { ...gesture.start };
    if (gesture.mode === 'move') {
      next.x += dx;
      next.y += dy;
    } else {
      const dir = gesture.direction ?? 'se';
      if (dir.includes('e')) next.width += dx;
      if (dir.includes('s')) next.height += dy;
      if (dir.includes('w')) {
        next.x += dx;
        next.width -= dx;
      }
      if (dir.includes('n')) {
        next.y += dy;
        next.height -= dy;
      }
    }
    onUpdateGeometry(clampBox(next, width, height));
  }

  function finish(event: PointerEvent<HTMLElement>, target: 'name' | 'qr') {
    const ref = target === 'name' ? nameGesture : qrGesture;
    if (ref.current?.pointerId === event.pointerId) ref.current = null;
  }

  function moveByKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!nameBox || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const next = { x: nameBox.x, y: nameBox.y, width: nameBox.width, height: nameBox.height };
    if (event.shiftKey) {
      if (event.key === 'ArrowLeft') next.width -= step;
      if (event.key === 'ArrowRight') next.width += step;
      if (event.key === 'ArrowUp') next.height -= step;
      if (event.key === 'ArrowDown') next.height += step;
    } else {
      if (event.key === 'ArrowLeft') next.x -= step;
      if (event.key === 'ArrowRight') next.x += step;
      if (event.key === 'ArrowUp') next.y -= step;
      if (event.key === 'ArrowDown') next.y += step;
    }
    onUpdateGeometry(clampBox(next, width, height));
  }

  function moveQrByKeys(event: KeyboardEvent<HTMLElement>) {
    if (!qrBox || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const next = { x: qrBox.x, y: qrBox.y, width: qrBox.width, height: qrBox.height };
    if (event.shiftKey) {
      const grow = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? step : -step;
      const side = Math.min(width, height, Math.max(48, qrBox.width + grow));
      next.width = side;
      next.height = side;
    } else {
      if (event.key === 'ArrowLeft') next.x -= step;
      if (event.key === 'ArrowRight') next.x += step;
      if (event.key === 'ArrowUp') next.y -= step;
      if (event.key === 'ArrowDown') next.y += step;
    }
    onUpdateQrCodeGeometry(clampSquareBox(next, width, height));
  }

  const transform = nameBox?.textTransform ?? 'sentence';
  const shownName =
    transform === 'uppercase'
      ? previewName.toLocaleUpperCase()
      : transform === 'lowercase'
        ? previewName.toLocaleLowerCase()
        : transform === 'capitalize'
          ? previewName.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())
          : sentenceCase(previewName);

  const fontSizePx = nameBox?.fontSize ?? 72;
  const lineHeightPx = nameBox?.lineHeight ?? Math.round(fontSizePx * 1.25);

  return (
    <div className="flex flex-col gap-space-md">
      {/* Prominent Upload / Replace Certificate Background banner above the editor */}
      <div className="flex flex-wrap items-center justify-between gap-space-md rounded-xl border border-primary/20 bg-primary/5 p-space-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
            <Icon name="workspace_premium" size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-title-sm text-title-sm text-on-surface">Certificate background</h2>
              {certificate?.backgroundUrl && (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-available-container px-2.5 py-0.5 font-caption text-caption text-status-available">
                  <Icon name="check_circle" size={14} />
                  Uploaded
                </span>
              )}
            </div>
            <p className="mt-0.5 font-body-sm text-body-sm text-text-secondary">
              {certificate?.backgroundUrl
                ? 'Your template image is active. Drag the attendee name and QR code below to position them.'
                : 'Upload your certificate artwork first (PNG, JPG, or SVG up to 5 MB) to unlock layout and typography controls.'}
            </p>
          </div>
        </div>
        <label className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container focus-within:ring-2 focus-within:ring-primary/30">
          <Icon name="upload_file" size={18} />
          <span>{certificate?.backgroundUrl ? 'Replace certificate background' : 'Upload certificate background'}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={onChangeBackground}
            className="sr-only"
          />
        </label>
      </div>

      {/* Preview attendee name switcher */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm">
        <p className="font-body-sm text-body-sm text-on-surface">Preview the attendee name on your certificate.</p>
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-container-highest p-1">
          {[
            ['Ana Cruz', 'Ana Cruz'],
            ['Mary Elizabeth Von Hohenheim', 'Von Hohenheim'],
            ['Kristofer Emmanuel San Buenaventura III', 'San Buenaventura III'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreviewName(value!)}
              className={`min-h-8 rounded px-2.5 font-caption text-caption transition-colors ${
                previewName === value ? 'bg-surface-card text-on-surface shadow-sm' : 'text-text-secondary hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas + Compact 20rem Name Typography Inspector */}
      <div className="grid min-w-0 items-start gap-space-lg xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-space-sm">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="font-label-sm text-label-sm text-text-secondary">Canvas size</span>
              <span className="rounded bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant tabular-nums">
                {width} × {height} px
              </span>
            </div>
            <button
              type="button"
              title="Fit canvas in view"
              aria-label="Fit canvas in view"
              onClick={() => canvasRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
              className="flex h-9 w-9 items-center justify-center rounded text-text-secondary hover:bg-surface-container"
            >
              <Icon name="open_in_full" size={18} />
            </button>
          </div>

          <div
            ref={canvasRef}
            className="relative w-full touch-none select-none overflow-hidden rounded-xl border border-border-subtle bg-surface-card shadow-lg [container-type:inline-size]"
            style={{
              aspectRatio: `${width} / ${height}`,
              ...(certificate?.backgroundUrl
                ? {
                    backgroundImage: `url('${certificate.backgroundUrl}')`,
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                  }
                : {}),
            }}
          >
            {!certificate?.backgroundUrl && (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-text-subtle">
                <Icon name="upload_file" size={32} className="text-primary/50" />
                <p className="font-body-sm-medium text-body-sm-medium text-text-secondary">
                  No certificate background uploaded yet
                </p>
                <p className="font-caption text-caption text-text-subtle">
                  Use the Upload certificate background button above to start editing.
                </p>
              </div>
            )}

            {nameBox && (
              <div
                role="group"
                aria-label="Draggable certificate attendee name box. Use arrow keys to move and Shift plus arrow keys to resize."
                tabIndex={0}
                onPointerDown={(event) => begin(event, 'name', 'move')}
                onPointerMove={(event) => move(event, 'name')}
                onPointerUp={(event) => finish(event, 'name')}
                onPointerCancel={(event) => finish(event, 'name')}
                onKeyDown={moveByKeys}
                className="absolute z-20 flex touch-none cursor-move items-center justify-center rounded border-2 border-dashed border-primary-container bg-primary-container/5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  left: `${(nameBox.x / width) * 100}%`,
                  top: `${(nameBox.y / height) * 100}%`,
                  width: `${(nameBox.width / width) * 100}%`,
                  height: `${(nameBox.height / height) * 100}%`,
                  fontFamily: `"${nameBox.fontFamily}", sans-serif`,
                  fontSize: `max(8px, ${(fontSizePx / width) * 100}cqw)`,
                  lineHeight: `${(lineHeightPx / width) * 100}cqw`,
                  fontWeight: nameBox.fontWeight,
                  fontStyle: nameBox.italic ? 'italic' : 'normal',
                  textDecoration: nameBox.underline ? 'underline' : 'none',
                  textAlign: nameBox.align,
                  color: nameBox.color,
                }}
              >
                <span
                  className="pointer-events-none w-full break-words px-3 tracking-tight"
                  style={{ opacity: (nameBox.opacity ?? 100) / 100 }}
                >
                  {shownName}
                </span>
                {ALL_HANDLES.map(({ direction, position }) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={`Resize name box from ${direction}`}
                    onPointerDown={(event) => begin(event, 'name', 'resize', direction)}
                    onPointerMove={(event) => move(event, 'name')}
                    onPointerUp={(event) => finish(event, 'name')}
                    onPointerCancel={(event) => finish(event, 'name')}
                    className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary-container bg-surface-card shadow ${position}`}
                  />
                ))}
              </div>
            )}

            {qrBox && (
              <div
                role="group"
                tabIndex={0}
                aria-label="Certificate QR code. Use arrow keys to move; Shift plus arrow keys to resize."
                onKeyDown={moveQrByKeys}
                onPointerDown={(event) => begin(event, 'qr', 'move')}
                onPointerMove={(event) => move(event, 'qr')}
                onPointerUp={(event) => finish(event, 'qr')}
                onPointerCancel={(event) => finish(event, 'qr')}
                className="absolute z-30 flex touch-none cursor-move items-center justify-center border-2 border-dashed border-secondary bg-white p-1 focus-visible:outline-2 focus-visible:outline-primary"
                style={{
                  left: `${(qrBox.x / width) * 100}%`,
                  top: `${(qrBox.y / height) * 100}%`,
                  width: `${(qrBox.width / width) * 100}%`,
                  height: `${(qrBox.height / height) * 100}%`,
                }}
              >
                <QRCodeSVG
                  value={qrValue}
                  size={Math.max(32, Math.round(Math.min(qrBox.width, qrBox.height)))}
                  level="M"
                  marginSize={4}
                  className="pointer-events-none h-full w-full"
                />
                {CORNER_HANDLES.map(({ direction, position }) => (
                  <button
                    key={direction}
                    type="button"
                    aria-label={`Resize QR code from ${direction}`}
                    onKeyDown={moveQrByKeys}
                    onPointerDown={(event) => begin(event, 'qr', 'resize', direction)}
                    onPointerMove={(event) => move(event, 'qr')}
                    onPointerUp={(event) => finish(event, 'qr')}
                    onPointerCancel={(event) => finish(event, 'qr')}
                    className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-secondary bg-white shadow focus-visible:outline-2 focus-visible:outline-primary ${position}`}
                  />
                ))}
              </div>
            )}
          </div>

          <CanvasSizeControls width={width} height={height} disabled={!certificate} onChange={onUpdateCanvasSize} />
        </div>

        {/* Compact Name Typography Sidebar */}
        <aside className="flex min-w-0 flex-col gap-4 rounded-xl border border-border-subtle bg-surface-card p-space-md shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3">
            <h3 className="font-title-sm text-title-sm text-on-surface">Name typography</h3>
            <button
              type="button"
              onClick={onReset}
              disabled={!nameBox}
              className="font-caption text-caption text-primary hover:underline disabled:opacity-40"
            >
              Reset name
            </button>
          </div>

          {/* Font family selector with 16 categorized fonts */}
          <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">
            Font
            <select
              disabled={!nameBox}
              value={nameBox?.fontFamily ?? 'Outfit'}
              onChange={(event) => onUpdateField('fontFamily', event.target.value)}
              className={inputClass}
              style={{ fontFamily: `"${nameBox?.fontFamily ?? 'Outfit'}", sans-serif` }}
            >
              {FONT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.fonts.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: `"${font}", sans-serif` }}>
                      {font}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {/* Compact Font size & Line height steppers */}
          <div className="grid grid-cols-2 gap-2.5">
            <NumberField
              label="Font size (px)"
              value={fontSizePx}
              min={6}
              max={400}
              step={2}
              disabled={!nameBox}
              onChange={(value) => onUpdateField('fontSize', value)}
            />
            <NumberField
              label="Line height (px)"
              value={lineHeightPx}
              min={1}
              max={500}
              step={2}
              disabled={!nameBox}
              onChange={(value) => onUpdateField('lineHeight', value)}
            />
          </div>

          {/* Compact Icon-only Style + Alignment controls */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="font-caption text-caption text-text-secondary">Style</span>
              <div
                className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-surface-container-low p-1"
                role="group"
                aria-label="Text style"
              >
                <IconToggle
                  label="Bold"
                  icon="format_bold"
                  pressed={nameBox?.fontWeight === 700}
                  disabled={!nameBox}
                  onClick={() => onUpdateField('fontWeight', nameBox?.fontWeight === 700 ? 400 : 700)}
                />
                <IconToggle
                  label="Italic"
                  icon="format_italic"
                  pressed={Boolean(nameBox?.italic)}
                  disabled={!nameBox}
                  onClick={() => onUpdateField('italic', !nameBox?.italic)}
                />
                <IconToggle
                  label="Underline"
                  icon="format_underlined"
                  pressed={Boolean(nameBox?.underline)}
                  disabled={!nameBox}
                  onClick={() => onUpdateField('underline', !nameBox?.underline)}
                />
              </div>
            </div>

            <div>
              <span className="font-caption text-caption text-text-secondary">Alignment</span>
              <div
                className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-surface-container-low p-1"
                role="group"
                aria-label="Text alignment"
              >
                {(
                  [
                    ['left', 'format_align_left'],
                    ['center', 'format_align_center'],
                    ['right', 'format_align_right'],
                  ] as const
                ).map(([align, icon]) => (
                  <IconToggle
                    key={align}
                    label={`Align ${align}`}
                    icon={icon}
                    pressed={nameBox?.align === align}
                    disabled={!nameBox}
                    onClick={() => onUpdateField('align', align)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Name case */}
          <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">
            Name case
            <select
              aria-label="Name case"
              disabled={!nameBox}
              value={nameBox?.textTransform ?? 'sentence'}
              onChange={(event) => onUpdateField('textTransform', event.target.value)}
              className={inputClass}
            >
              <option value="sentence">Sentence case</option>
              <option value="lowercase">lowercase</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="capitalize">Capitalize Each Word</option>
            </select>
          </label>

          {/* Interactive Color Palette & Spectrum Picker */}
          <ColorPicker
            value={color}
            disabled={!nameBox}
            onChange={(hex) => onUpdateField('color', hex)}
          />

          {/* Opacity */}
          <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">
            <div className="flex items-center justify-between">
              <span>Text opacity</span>
              <span className="font-caption text-caption text-text-secondary tabular-nums">
                {nameBox?.opacity ?? 100}%
              </span>
            </div>
            <input
              aria-label="Text opacity"
              type="range"
              min={0}
              max={100}
              step={1}
              disabled={!nameBox}
              value={nameBox?.opacity ?? 100}
              onChange={(event) => onUpdateField('opacity', Number(event.target.value))}
              className="accent-primary"
            />
          </label>
        </aside>
      </div>
    </div>
  );
}

function IconToggle({
  label,
  icon,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  icon: IconName;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-full items-center justify-center rounded-md text-on-surface transition-colors hover:bg-surface-container aria-pressed:bg-primary aria-pressed:text-on-primary disabled:opacity-40"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

const CANVAS_PRESETS = [
  { label: 'Landscape HD · 1920 × 1080', width: 1920, height: 1080 },
  { label: 'Landscape · 1600 × 900', width: 1600, height: 900 },
  { label: 'Landscape · 1280 × 720', width: 1280, height: 720 },
  { label: 'A4 landscape · 3508 × 2480', width: 3508, height: 2480 },
  { label: 'A4 portrait · 2480 × 3508', width: 2480, height: 3508 },
];

function CanvasSizeControls({
  width,
  height,
  disabled,
  onChange,
}: {
  width: number;
  height: number;
  disabled: boolean;
  onChange: (width: number, height: number) => void;
}) {
  const [draftWidth, setDraftWidth] = useState<string | null>(null);
  const [draftHeight, setDraftHeight] = useState<string | null>(null);
  const widthInput = draftWidth ?? String(width);
  const heightInput = draftHeight ?? String(height);

  function commit(field: 'canvasWidth' | 'canvasHeight', raw: string) {
    const current = field === 'canvasWidth' ? width : height;
    const value = Number(raw);
    const other = field === 'canvasWidth' ? height : width;
    const limit = Math.min(CERTIFICATE_RENDER_LIMITS.maxSide, Math.floor(CERTIFICATE_RENDER_LIMITS.maxPixels / other));
    const safe = Number.isFinite(value) && value > 0 ? Math.min(limit, Math.max(1, Math.round(value))) : current;
    const nextWidth = field === 'canvasWidth' ? safe : width;
    const nextHeight = field === 'canvasHeight' ? safe : height;
    if (field === 'canvasWidth') setDraftWidth(null);
    else setDraftHeight(null);
    onChange(nextWidth, nextHeight);
  }

  function preset(value: string) {
    const item = CANVAS_PRESETS[Number(value)];
    if (!item) return;
    setDraftWidth(null);
    setDraftHeight(null);
    onChange(item.width, item.height);
  }

  const widthMax = Math.min(CERTIFICATE_RENDER_LIMITS.maxSide, Math.floor(CERTIFICATE_RENDER_LIMITS.maxPixels / height));
  const heightMax = Math.min(CERTIFICATE_RENDER_LIMITS.maxSide, Math.floor(CERTIFICATE_RENDER_LIMITS.maxPixels / width));

  return (
    <div className="flex flex-col gap-space-sm rounded-xl border border-border-subtle bg-surface-light p-space-sm">
      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-12 sm:items-end">
        <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary sm:col-span-5">
          Canvas preset
          <select
            disabled={disabled}
            value={CANVAS_PRESETS.findIndex((item) => item.width === width && item.height === height)}
            onChange={(event) => preset(event.target.value)}
            className={inputClass}
          >
            <option value={-1}>Custom size</option>
            {CANVAS_PRESETS.map((item, index) => (
              <option key={item.label} value={index}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary sm:col-span-2">
          Canvas width (px)
          <input
            type="number"
            min={1}
            max={widthMax}
            disabled={disabled}
            value={widthInput}
            onChange={(event) => setDraftWidth(event.target.value)}
            onBlur={(event) => commit('canvasWidth', event.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary sm:col-span-2">
          Canvas height (px)
          <input
            type="number"
            min={1}
            max={heightMax}
            disabled={disabled}
            value={heightInput}
            onChange={(event) => setDraftHeight(event.target.value)}
            onBlur={(event) => commit('canvasHeight', event.target.value)}
            className={`${inputClass} tabular-nums`}
          />
        </label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraftWidth(null);
            setDraftHeight(null);
            onChange(CERTIFICATE_CANVAS_WIDTH, CERTIFICATE_CANVAS_HEIGHT);
          }}
          className="h-9 rounded-lg border border-border-subtle bg-surface-card px-3 font-caption text-caption text-primary hover:bg-surface-container-low disabled:opacity-50 sm:col-span-3"
        >
          Reset to 1920 × 1080
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(value);

  function commit(raw: string) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && raw.trim() !== '') {
      const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
      onChange(clamped);
    }
    setDraft(null);
  }

  function nudge(delta: number) {
    if (disabled) return;
    const next = Math.min(max, Math.max(min, value + delta));
    setDraft(null);
    onChange(next);
  }

  return (
    <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary">
      {label}
      <div className="flex h-9 items-center overflow-hidden rounded-lg border border-border-subtle bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => nudge(-step)}
          className="flex h-full w-7 shrink-0 items-center justify-center text-text-secondary hover:bg-surface-container hover:text-on-surface disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={min}
          max={max}
          disabled={disabled}
          value={displayed}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const parsed = Number(raw);
            if (raw.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
              onChange(Math.round(parsed));
            }
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
          }}
          className="h-full w-full min-w-0 bg-transparent text-center font-body-sm text-body-sm text-on-surface tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => nudge(step)}
          className="flex h-full w-7 shrink-0 items-center justify-center text-text-secondary hover:bg-surface-container hover:text-on-surface disabled:opacity-40"
        >
          +
        </button>
      </div>
    </label>
  );
}
