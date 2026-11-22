import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { CertificateTemplate, NameBox } from '../../../api/orgTypes';
import { CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH } from '../../../api/orgTypes';
import { Icon } from '../../../components/ui/Icon';

type NameBoxField = keyof NameBox;
type Geometry = Pick<NameBox, 'x' | 'y' | 'width' | 'height'>;
type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Gesture = { pointerId: number; mode: 'move' | 'resize'; direction?: Direction; startX: number; startY: number; start: Geometry };
const BASE_NAME_BOX: NameBox = { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700, align: 'center', color: '#1B365D', lineHeight: 90 };
const PALETTE = [
  ['Navy', '#1B365D'], ['Ink', '#202833'], ['Slate', '#526477'], ['White', '#FFFFFF'],
  ['Garnet', '#7A1C1C'], ['Brick', '#A54032'], ['Gold', '#B58A25'], ['Olive', '#526044'],
  ['Teal', '#236A70'], ['Blue', '#326B9A'], ['Plum', '#68466C'], ['Charcoal', '#343434'],
] as const;
const inputClass = 'h-10 w-full rounded-lg border border-border-subtle bg-surface-container-low px-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

interface Props {
  certificate: CertificateTemplate | null;
  qrValue: string;
  onUpdateCanvasSize: (field: 'canvasWidth' | 'canvasHeight', value: number) => void;
  onChangeBackground: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateField: (field: NameBoxField, value: string | number | boolean) => void;
  onUpdateGeometry: (value: Geometry) => void;
  onUpdateQrCodeGeometry: (value: Geometry) => void;
  onReset: () => void;
}

function clampBox(box: Geometry, width: number, height: number): Geometry {
  const boxWidth = Math.min(width, Math.max(100, box.width));
  const boxHeight = Math.min(height, Math.max(40, box.height));
  return { width: boxWidth, height: boxHeight, x: Math.min(width - boxWidth, Math.max(0, box.x)), y: Math.min(height - boxHeight, Math.max(0, box.y)) };
}

function sentenceCase(value: string): string {
  const text = value.toLocaleLowerCase();
  return text ? text[0]!.toLocaleUpperCase() + text.slice(1) : text;
}

export function CertificateDesigner({ certificate, qrValue, onChangeBackground, onUpdateField, onUpdateGeometry, onUpdateQrCodeGeometry, onUpdateCanvasSize, onReset }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nameGesture = useRef<Gesture | null>(null);
  const qrGesture = useRef<Gesture | null>(null);
  const [previewName, setPreviewName] = useState('Ana Cruz');
  const [hexInput, setHexInput] = useState('#1B365D');
  const width = certificate?.canvasWidth ?? CERTIFICATE_CANVAS_WIDTH;
  const height = certificate?.canvasHeight ?? CERTIFICATE_CANVAS_HEIGHT;
  const nameBox = certificate?.nameBox ? { ...BASE_NAME_BOX, ...certificate.nameBox } : null;
  const qrBox = certificate?.backgroundUrl ? clampBox(certificate.qrCodeBox ?? { x: width - 280, y: height - 280, width: 180, height: 180 }, width, height) : null;
  const color = nameBox?.color ?? '#1B365D';

  useEffect(() => setHexInput(color), [color]);

  function updateColor(raw: string) {
    setHexInput(raw);
    if (/^#[\da-f]{6}$/i.test(raw)) onUpdateField('color', raw.toUpperCase());
  }

  function begin(event: PointerEvent<HTMLElement>, target: 'name' | 'qr', mode: Gesture['mode'], direction?: Direction) {
    const box = target === 'name' ? nameBox : qrBox;
    if (!box) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    const gesture: Gesture = { pointerId: event.pointerId, mode, direction, startX: event.clientX, startY: event.clientY, start: { ...box } };
    if (target === 'name') nameGesture.current = gesture;
    else qrGesture.current = gesture;
  }

  function move(event: PointerEvent<HTMLElement>, target: 'name' | 'qr') {
    const gesture = target === 'name' ? nameGesture.current : qrGesture.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || gesture.pointerId !== event.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = (event.clientX - gesture.startX) / bounds.width * width;
    const dy = (event.clientY - gesture.startY) / bounds.height * height;
    const next = { ...gesture.start };
    if (gesture.mode === 'move') { next.x += dx; next.y += dy; }
    else {
      const dir = gesture.direction ?? 'se';
      if (dir.includes('e')) next.width += dx;
      if (dir.includes('s')) next.height += dy;
      if (dir.includes('w')) { next.x += dx; next.width -= dx; }
      if (dir.includes('n')) { next.y += dy; next.height -= dy; }
    }
    const clean = clampBox(next, width, height);
    if (target === 'name') onUpdateGeometry(clean);
    else onUpdateQrCodeGeometry(clean);
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
    onUpdateQrCodeGeometry(clampBox(next, width, height));
  }

  const handles: Array<{ direction: Direction; position: string }> = [
    { direction: 'nw', position: '-left-1.5 -top-1.5 cursor-nwse-resize' }, { direction: 'n', position: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize' },
    { direction: 'ne', position: '-right-1.5 -top-1.5 cursor-nesw-resize' }, { direction: 'e', position: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
    { direction: 'se', position: '-bottom-1.5 -right-1.5 cursor-nwse-resize' }, { direction: 's', position: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
    { direction: 'sw', position: '-bottom-1.5 -left-1.5 cursor-nesw-resize' }, { direction: 'w', position: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  ];
  const text = previewName;
  const transform = nameBox?.textTransform ?? 'sentence';
  const shownName = transform === 'uppercase' ? text.toLocaleUpperCase() : transform === 'lowercase' ? text.toLocaleLowerCase() : transform === 'capitalize' ? text.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase()) : sentenceCase(text);

  return <div className="flex flex-col gap-space-md">
    <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm"><p className="font-body-sm text-body-sm text-on-surface">Preview the attendee name on your certificate.</p><div className="flex flex-wrap gap-1 rounded-lg bg-surface-container-highest p-1">{[['Ana Cruz', 'Ana Cruz'], ['Mary Elizabeth Von Hohenheim', 'Von Hohenheim'], ['Kristofer Emmanuel San Buenaventura III', 'San Buenaventura III']].map(([value, label]) => <button key={value} type="button" onClick={() => setPreviewName(value!)} className={`min-h-9 rounded px-2.5 font-caption text-caption ${previewName === value ? 'bg-surface-card text-on-surface shadow-sm' : 'text-text-secondary'}`}>{label}</button>)}</div></div>
    <div className="grid min-w-0 gap-space-lg xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="flex min-w-0 flex-col gap-space-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-sm"><div className="flex items-center gap-space-sm"><span className="font-label-sm text-label-sm text-text-secondary">Canvas size</span><span className="rounded bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{width} × {height} px</span></div><button type="button" title="Fit canvas in view" aria-label="Fit canvas in view" onClick={() => canvasRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })} className="flex h-9 w-9 items-center justify-center rounded text-text-secondary hover:bg-surface-container"><Icon name="open_in_full" size={18}/></button></div>
        <div ref={canvasRef} className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-surface-card shadow-lg [container-type:inline-size]" style={{ aspectRatio: `${width} / ${height}`, ...(certificate?.backgroundUrl ? { backgroundImage: `url('${certificate.backgroundUrl}')`, backgroundSize: '100% 100%', backgroundPosition: 'center' } : {}) }}>
          {nameBox && <div role="group" aria-label="Draggable certificate attendee name box. Use arrow keys to move and Shift plus arrow keys to resize." tabIndex={0} onPointerDown={(event) => begin(event, 'name', 'move')} onPointerMove={(event) => move(event, 'name')} onPointerUp={(event) => finish(event, 'name')} onPointerCancel={(event) => finish(event, 'name')} onKeyDown={moveByKeys} className="absolute z-20 flex touch-none cursor-move items-center justify-center rounded border-2 border-dashed border-primary-container bg-primary-container/5 outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ left: `${nameBox.x / width * 100}%`, top: `${nameBox.y / height * 100}%`, width: `${nameBox.width / width * 100}%`, height: `${nameBox.height / height * 100}%`, fontFamily: nameBox.fontFamily, fontSize: `clamp(11px, ${nameBox.fontSize / width * 100}cqw, 42px)`, lineHeight: `${(nameBox.lineHeight ?? nameBox.fontSize * 1.25) / width * 100}cqw`, fontWeight: nameBox.fontWeight, fontStyle: nameBox.italic ? 'italic' : 'normal', textDecoration: nameBox.underline ? 'underline' : 'none', textAlign: nameBox.align, color: nameBox.color }}><span className="pointer-events-none w-full truncate px-3 tracking-tight" style={{ opacity: (nameBox.opacity ?? 100) / 100 }}>{shownName}</span>{handles.map(({ direction, position }) => <button key={direction} type="button" aria-label={`Resize name box from ${direction}`} onPointerDown={(event) => begin(event, 'name', 'resize', direction)} onPointerMove={(event) => move(event, 'name')} onPointerUp={(event) => finish(event, 'name')} onPointerCancel={(event) => finish(event, 'name')} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary-container bg-surface-card shadow ${position}`}/>)}</div>}
          {qrBox && <div role="group" tabIndex={0} aria-label="Certificate QR code. Use arrow keys to move; Shift plus arrow keys to resize." onKeyDown={moveQrByKeys} onPointerDown={(event) => begin(event, 'qr', 'move')} onPointerMove={(event) => move(event, 'qr')} onPointerUp={(event) => finish(event, 'qr')} onPointerCancel={(event) => finish(event, 'qr')} className="absolute z-30 flex touch-none cursor-move items-center justify-center border-2 border-dashed border-secondary bg-white p-1 focus-visible:outline-2 focus-visible:outline-primary" style={{ left: `${qrBox.x / width * 100}%`, top: `${qrBox.y / height * 100}%`, width: `${qrBox.width / width * 100}%`, height: `${qrBox.height / height * 100}%` }}><QRCodeSVG value={qrValue} size={Math.max(32, Math.round(Math.min(qrBox.width, qrBox.height)))} level="M" marginSize={4} className="pointer-events-none h-full w-full"/>{handles.map(({ direction, position }) => <button key={direction} type="button" aria-label={`Resize QR code from ${direction}`} onKeyDown={moveQrByKeys} onPointerDown={(event) => begin(event, 'qr', 'resize', direction)} onPointerMove={(event) => move(event, 'qr')} onPointerUp={(event) => finish(event, 'qr')} onPointerCancel={(event) => finish(event, 'qr')} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-secondary bg-white shadow focus-visible:outline-2 focus-visible:outline-primary ${position}`}/>)}</div>}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="upload_file" size={18}/>{certificate ? 'Replace certificate background' : 'Upload certificate background'}<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onChangeBackground} className="sr-only"/></label>
        <CanvasSizeControls width={width} height={height} disabled={!certificate} onChange={onUpdateCanvasSize}/>
      </div>
      <aside className="flex min-w-0 flex-col gap-space-md rounded-xl bg-surface-card p-space-md shadow-card">
        <div className="flex items-center justify-between gap-2"><h3 className="font-title-md text-title-md text-on-surface">Name typography</h3><button type="button" onClick={onReset} disabled={!nameBox} className="font-caption text-caption text-primary hover:underline disabled:opacity-40">Reset name</button></div>
        <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Font family<select disabled={!nameBox} value={nameBox?.fontFamily ?? 'Outfit'} onChange={(event) => onUpdateField('fontFamily', event.target.value)} className={inputClass}><option value="Outfit">Outfit</option><option value="DM Sans">DM Sans</option><option value="Cinzel">Cinzel</option><option value="Playfair Display">Playfair Display</option></select></label>
        <div className="grid grid-cols-2 gap-space-sm"><NumberField label="Font size" value={nameBox?.fontSize ?? 72} min={6} max={400} disabled={!nameBox} onChange={(value) => onUpdateField('fontSize', value)}/><NumberField label="Line height" value={nameBox?.lineHeight ?? 90} min={1} max={500} disabled={!nameBox} onChange={(value) => onUpdateField('lineHeight', value)}/></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Text style"><Toggle label="Bold" pressed={nameBox?.fontWeight === 700} disabled={!nameBox} onClick={() => onUpdateField('fontWeight', nameBox?.fontWeight === 700 ? 400 : 700)}/><Toggle label="Italic" pressed={Boolean(nameBox?.italic)} disabled={!nameBox} onClick={() => onUpdateField('italic', !nameBox?.italic)}/><Toggle label="Underline" pressed={Boolean(nameBox?.underline)} disabled={!nameBox} onClick={() => onUpdateField('underline', !nameBox?.underline)}/></div>
        <div><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Alignment</span><div className="mt-1 flex gap-1" role="group" aria-label="Text alignment">{(['left', 'center', 'right'] as const).map((align) => <button key={align} type="button" aria-label={`Align ${align}`} aria-pressed={nameBox?.align === align} disabled={!nameBox} onClick={() => onUpdateField('align', align)} className="min-h-10 flex-1 rounded-lg bg-surface-container-low px-2 font-body-sm-medium text-body-sm-medium text-on-surface aria-pressed:bg-primary-container aria-pressed:text-on-primary-container disabled:opacity-50">{align[0]!.toUpperCase() + align.slice(1)}</button>)}</div></div>
        <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Name case<select aria-label="Name case" disabled={!nameBox} value={nameBox?.textTransform ?? 'sentence'} onChange={(event) => onUpdateField('textTransform', event.target.value)} className={inputClass}><option value="sentence">Sentence case</option><option value="lowercase">lowercase</option><option value="uppercase">UPPERCASE</option><option value="capitalize">Capitalize Each Word</option></select></label>
        <div className="flex flex-col gap-2"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Text color</span><div className="grid grid-cols-6 gap-2">{PALETTE.map(([label, value]) => <button key={value} type="button" aria-label={label} title={label} disabled={!nameBox} onClick={() => onUpdateField('color', value)} className="h-8 rounded-full border border-outline-variant focus-visible:outline-2 focus-visible:outline-primary" style={{ backgroundColor: value }}/>)}</div><div className="flex items-center gap-2"><label className="flex min-w-0 flex-1 flex-col gap-1 font-caption text-caption text-text-secondary">Choose text color<input aria-label="Choose text color" type="color" value={/^#[\da-f]{6}$/i.test(color) ? color : '#1B365D'} disabled={!nameBox} onChange={(event) => onUpdateField('color', event.target.value.toUpperCase())} className="h-10 w-full cursor-pointer rounded-lg border border-border-subtle bg-surface-card p-1"/></label><label className="flex min-w-0 flex-1 flex-col gap-1 font-caption text-caption text-text-secondary">Hex value<input aria-label="Hex color" value={hexInput} maxLength={7} disabled={!nameBox} onChange={(event) => updateColor(event.target.value)} onBlur={() => setHexInput(color)} className={inputClass}/></label></div></div>
        <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Text opacity<input aria-label="Text opacity" type="range" min={0} max={100} step={1} disabled={!nameBox} value={nameBox?.opacity ?? 100} onChange={(event) => onUpdateField('opacity', Number(event.target.value))} className="accent-primary"/><span className="font-caption text-caption text-text-secondary">{nameBox?.opacity ?? 100}%</span></label>
      </aside>
    </div>
  </div>;
}

function Toggle({ label, pressed, disabled, onClick }: { label: string; pressed: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} className="min-h-10 min-w-16 rounded-lg bg-surface-container-low px-3 font-body-sm-medium text-body-sm-medium text-on-surface aria-pressed:bg-primary-container aria-pressed:text-on-primary-container disabled:opacity-50">{label}</button>;
}

const CANVAS_PRESETS = [
  { label: 'Landscape HD · 1920 × 1080', width: 1920, height: 1080 }, { label: 'Landscape · 1600 × 900', width: 1600, height: 900 },
  { label: 'Landscape · 1280 × 720', width: 1280, height: 720 }, { label: 'A4 landscape · 3508 × 2480', width: 3508, height: 2480 },
  { label: 'A4 portrait · 2480 × 3508', width: 2480, height: 3508 },
];

function CanvasSizeControls({ width, height, disabled, onChange }: { width: number; height: number; disabled: boolean; onChange: (field: 'canvasWidth' | 'canvasHeight', value: number) => void }) {
  const [widthInput, setWidthInput] = useState(String(width));
  const [heightInput, setHeightInput] = useState(String(height));
  useEffect(() => setWidthInput(String(width)), [width]);
  useEffect(() => setHeightInput(String(height)), [height]);
  function commit(field: 'canvasWidth' | 'canvasHeight', raw: string) {
    const current = field === 'canvasWidth' ? width : height;
    const value = Number(raw);
    const safe = Number.isFinite(value) && value > 0 ? Math.min(20000, Math.max(1, Math.round(value))) : current;
    if (field === 'canvasWidth') setWidthInput(String(safe)); else setHeightInput(String(safe));
    onChange(field, safe);
  }
  function preset(value: string) {
    const item = CANVAS_PRESETS[Number(value)];
    if (!item) return;
    setWidthInput(String(item.width)); setHeightInput(String(item.height));
    onChange('canvasWidth', item.width); onChange('canvasHeight', item.height);
  }
  return <div className="flex flex-col gap-space-sm rounded-lg border border-border-subtle bg-surface-light p-space-sm"><label className="flex flex-col gap-1 font-caption text-caption text-text-secondary">Canvas preset<select disabled={disabled} value={CANVAS_PRESETS.findIndex((item) => item.width === width && item.height === height)} onChange={(event) => preset(event.target.value)} className={inputClass}><option value={-1}>Custom size</option>{CANVAS_PRESETS.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></label><div className="grid grid-cols-2 gap-space-sm">{([['Canvas width (px)', widthInput, setWidthInput, 'canvasWidth'], ['Canvas height (px)', heightInput, setHeightInput, 'canvasHeight']] as const).map(([label, value, setter, field]) => <label key={field} className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary">{label}<input type="number" min={1} max={20000} disabled={disabled} value={value} onChange={(event) => setter(event.target.value)} onBlur={(event) => commit(field, event.target.value)} className={inputClass}/></label>)}</div><button type="button" disabled={disabled} onClick={() => { onChange('canvasWidth', CERTIFICATE_CANVAS_WIDTH); onChange('canvasHeight', CERTIFICATE_CANVAS_HEIGHT); }} className="min-h-10 rounded-lg border border-border-subtle px-3 font-body-sm-medium text-body-sm-medium text-primary disabled:opacity-50">Reset to 1920 × 1080</button></div>;
}

function NumberField({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="flex min-w-0 flex-col gap-1 font-caption text-caption text-text-secondary">{label}<input type="number" min={min} max={max} disabled={disabled} value={value} onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= min && value <= max) onChange(value); }} className={inputClass}/></label>;
}
