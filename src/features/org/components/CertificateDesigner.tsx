import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent, type KeyboardEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { CertificateTemplate, NameBox } from '../../../api/orgTypes';
import { CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH } from '../../../api/orgTypes';
import { Icon } from '../../../components/ui/Icon';

type NameBoxField = keyof NameBox;
type BoxGeometry = Pick<NameBox, 'x' | 'y' | 'width' | 'height'>;
type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Gesture = { pointerId: number; mode: 'move' | 'resize'; direction?: Direction; key?: string; startClientX: number; startClientY: number; start: BoxGeometry };
type SignatureBox = BoxGeometry & { id: string; imageUrl: string; imageName: string };
const BASE_NAME_BOX: NameBox = { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700, align: 'center', color: '#1B365D', lineHeight: 90 };
const SWATCHES = [{ name: 'Gold', color: '#D4AF37' }, { name: 'Navy', color: '#1B365D' }, { name: 'Maroon', color: '#7A1C1C' }, { name: 'Dark slate', color: '#1F2937' }];
const inputClass = 'h-10 w-full rounded-lg border border-border-subtle bg-surface-container-low px-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

interface Props {
  certificate: CertificateTemplate | null;
  qrValue: string;
  onUpdateCanvasSize: (field: 'canvasWidth' | 'canvasHeight', value: number) => void;
  requiredAttendancePercent: number;
  onChangeBackground: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateField: (field: NameBoxField, value: string | number) => void;
  onUpdateGeometry: (value: Pick<NameBox, 'x' | 'y' | 'width' | 'height'>) => void;
  onUpdateQrCodeGeometry: (value: BoxGeometry) => void;
  onSelectSignature: (event: ChangeEvent<HTMLInputElement>, signatureId?: string) => void;
  onRemoveSignature: (signatureId: string) => void;
  onUpdateSignatureGeometry: (signatureId: string, value: BoxGeometry) => void;
  onReset: () => void;
}

function clampedBox(box: NameBox, canvasWidth: number, canvasHeight: number): NameBox {
  const width = Math.min(canvasWidth, Math.max(100, box.width));
  const height = Math.min(canvasHeight, Math.max(40, box.height));
  return { ...box, width, height, x: Math.min(canvasWidth - width, Math.max(0, box.x)), y: Math.min(canvasHeight - height, Math.max(0, box.y)) };
}

function clampGeometry(geometry: BoxGeometry, canvasWidth: number, canvasHeight: number): BoxGeometry {
  const width = Math.min(canvasWidth, Math.max(100, geometry.width));
  const height = Math.min(canvasHeight, Math.max(40, geometry.height));
  return { width, height, x: Math.min(canvasWidth - width, Math.max(0, geometry.x)), y: Math.min(canvasHeight - height, Math.max(0, geometry.y)) };
}

export function CertificateDesigner({ certificate, qrValue, requiredAttendancePercent, onChangeBackground, onUpdateField, onUpdateGeometry, onUpdateQrCodeGeometry, onSelectSignature, onRemoveSignature, onUpdateSignatureGeometry, onUpdateCanvasSize, onReset }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const signatureGestureRef = useRef<Gesture | null>(null);
  const qrGestureRef = useRef<Gesture | null>(null);
  const [previewName, setPreviewName] = useState('Ana Cruz');
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const canvasWidth = certificate?.canvasWidth ?? CERTIFICATE_CANVAS_WIDTH;
  const canvasHeight = certificate?.canvasHeight ?? CERTIFICATE_CANVAS_HEIGHT;
  const nameBox = certificate?.nameBox ? clampedBox({ ...BASE_NAME_BOX, ...certificate.nameBox }, canvasWidth, canvasHeight) : null;
  const signatureBoxes: SignatureBox[] = certificate?.signatureBoxes ?? (certificate?.signatureBox ? [{ id: 'legacy-signature', imageName: 'Signature', ...certificate.signatureBox }] : []);
  const qrCodeBox = certificate?.backgroundUrl ? clampGeometry(certificate.qrCodeBox ?? { x: canvasWidth - 280, y: canvasHeight - 280, width: 180, height: 180 }, canvasWidth, canvasHeight) : null;
  const [hexInput, setHexInput] = useState((nameBox?.color ?? '#1B365D').replace(/^#/, ''));

  useEffect(() => {
    setHexInput((nameBox?.color ?? '#1B365D').replace(/^#/, ''));
  }, [nameBox?.color]);

  function updateHexColor(rawValue: string) {
    const value = rawValue.replace(/^#/, '').replace(/\s/g, '');
    setHexInput(value.slice(0, 8));
    if (/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
      onUpdateField('color', `#${value.toUpperCase()}`);
    }
  }

  function beginGesture(event: PointerEvent<HTMLElement>, mode: Gesture['mode'], direction?: Direction) {
    if (!nameBox) return;
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not available in every embedded browser. */ }
    gestureRef.current = { pointerId: event.pointerId, mode, direction, startClientX: event.clientX, startClientY: event.clientY, start: { ...nameBox } };
  }

  function moveGesture(event: PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || event.pointerId !== gesture.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = (event.clientX - gesture.startClientX) / bounds.width * canvasWidth;
    const dy = (event.clientY - gesture.startClientY) / bounds.height * canvasHeight;
    const next = { ...gesture.start };
    if (gesture.mode === 'move') {
      next.x = gesture.start.x + dx;
      next.y = gesture.start.y + dy;
      if (snapToCenter && Math.abs(next.x + next.width / 2 - canvasWidth / 2) < 22) next.x = (canvasWidth - next.width) / 2;
      if (snapToCenter && Math.abs(next.y + next.height / 2 - canvasHeight / 2) < 22) next.y = (canvasHeight - next.height) / 2;
    } else {
      const d = gesture.direction ?? 'se';
      if (d.includes('e')) next.width = gesture.start.width + dx;
      if (d.includes('s')) next.height = gesture.start.height + dy;
      if (d.includes('w')) { next.x = gesture.start.x + dx; next.width = gesture.start.width - dx; }
      if (d.includes('n')) { next.y = gesture.start.y + dy; next.height = gesture.start.height - dy; }
    }
    onUpdateGeometry(clampGeometry(next, canvasWidth, canvasHeight));
  }

  function finishGesture(event: PointerEvent<HTMLElement>) {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
  }

  function beginSignatureGesture(event: PointerEvent<HTMLElement>, box: SignatureBox, mode: Gesture['mode'], direction?: Direction) {
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not available in every embedded browser. */ }
    signatureGestureRef.current = { pointerId: event.pointerId, mode, direction, key: box.id, startClientX: event.clientX, startClientY: event.clientY, start: { x: box.x, y: box.y, width: box.width, height: box.height } };
  }

  function moveSignatureGesture(event: PointerEvent<HTMLElement>) {
    const gesture = signatureGestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || event.pointerId !== gesture.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = (event.clientX - gesture.startClientX) / bounds.width * canvasWidth;
    const dy = (event.clientY - gesture.startClientY) / bounds.height * canvasHeight;
    const next = { ...gesture.start };
    if (gesture.mode === 'move') {
      next.x += dx;
      next.y += dy;
    } else {
      const direction = gesture.direction ?? 'se';
      if (direction.includes('e')) next.width += dx;
      if (direction.includes('s')) next.height += dy;
      if (direction.includes('w')) { next.x += dx; next.width -= dx; }
      if (direction.includes('n')) { next.y += dy; next.height -= dy; }
    }
    if (gesture.key) onUpdateSignatureGeometry(gesture.key, clampGeometry(next, canvasWidth, canvasHeight));
  }

  function finishSignatureGesture(event: PointerEvent<HTMLElement>) {
    if (signatureGestureRef.current?.pointerId === event.pointerId) signatureGestureRef.current = null;
  }

  function beginQrGesture(event: PointerEvent<HTMLElement>, mode: Gesture['mode'], direction?: Direction) {
    if (!qrCodeBox) return;
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not available in every embedded browser. */ }
    qrGestureRef.current = { pointerId: event.pointerId, mode, direction, startClientX: event.clientX, startClientY: event.clientY, start: { ...qrCodeBox } };
  }

  function moveQrGesture(event: PointerEvent<HTMLElement>) {
    const gesture = qrGestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || event.pointerId !== gesture.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = (event.clientX - gesture.startClientX) / bounds.width * canvasWidth;
    const dy = (event.clientY - gesture.startClientY) / bounds.height * canvasHeight;
    const next = { ...gesture.start };
    if (gesture.mode === 'move') { next.x += dx; next.y += dy; }
    else {
      const direction = gesture.direction ?? 'se';
      if (direction.includes('e')) next.width += dx;
      if (direction.includes('s')) next.height += dy;
      if (direction.includes('w')) { next.x += dx; next.width -= dx; }
      if (direction.includes('n')) { next.y += dy; next.height -= dy; }
    }
    onUpdateQrCodeGeometry(clampGeometry(next, canvasWidth, canvasHeight));
  }

  function finishQrGesture(event: PointerEvent<HTMLElement>) {
    if (qrGestureRef.current?.pointerId === event.pointerId) qrGestureRef.current = null;
  }

  function handleBoxKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!nameBox || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
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
    onUpdateGeometry(clampedBox({ ...nameBox, ...next }, canvasWidth, canvasHeight));
  }

  const resizeHandles: Array<{ direction: Direction; className: string; label: string }> = [
    { direction: 'nw', className: '-left-1.5 -top-1.5 cursor-nwse-resize', label: 'Resize name box from top left' },
    { direction: 'n', className: 'left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize', label: 'Resize name box from top' },
    { direction: 'ne', className: '-right-1.5 -top-1.5 cursor-nesw-resize', label: 'Resize name box from top right' },
    { direction: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize', label: 'Resize name box from right' },
    { direction: 'se', className: '-bottom-1.5 -right-1.5 cursor-nwse-resize', label: 'Resize name box from bottom right' },
    { direction: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize', label: 'Resize name box from bottom' },
    { direction: 'sw', className: '-bottom-1.5 -left-1.5 cursor-nesw-resize', label: 'Resize name box from bottom left' },
    { direction: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize', label: 'Resize name box from left' },
  ];

  const signatureResizeHandles: Array<{ direction: Direction; className: string; label: string }> = resizeHandles.map((handle) => ({ ...handle, label: handle.label.replace('name box', 'e-signature box') }));
  const qrResizeHandles: Array<{ direction: Direction; className: string; label: string }> = resizeHandles.map((handle) => ({ ...handle, label: handle.label.replace('name box', 'QR code') }));

  return <div className="flex flex-col gap-space-md">
    <div className="flex flex-col justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm lg:flex-row lg:items-center"><div className="flex items-center gap-space-sm"><Icon name="verified" size={20} className="text-primary"/><span className="font-body-sm text-body-sm text-on-surface">Dynamic certificate canvas · Visual bounds and attendee name preview</span></div><div className="flex flex-wrap items-center gap-2"><span className="font-caption text-caption text-text-secondary">Preview name:</span><div className="flex max-w-full overflow-x-auto rounded-lg bg-surface-container-highest p-0.5 font-caption text-caption"><button type="button" onClick={()=>setPreviewName('Ana Cruz')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Ana Cruz'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>Ana Cruz</button><button type="button" onClick={()=>setPreviewName('Mary Elizabeth Von Hohenheim')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Mary Elizabeth Von Hohenheim'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>Von Hohenheim</button><button type="button" onClick={()=>setPreviewName('Kristofer Emmanuel San Buenaventura III')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Kristofer Emmanuel San Buenaventura III'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>San Buenaventura III</button></div></div></div>

    <div className="grid min-w-0 gap-space-lg xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="flex min-w-0 flex-col gap-space-sm"><div className="flex flex-wrap items-center justify-between gap-space-sm px-space-xs"><div className="flex items-center gap-space-sm"><span className="font-label-sm text-label-sm uppercase text-text-secondary">Canvas size</span><span className="rounded bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">{canvasWidth} × {canvasHeight} px</span></div><button type="button" onClick={()=>canvasRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'})} title="Fit canvas in view" className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-surface-container"><Icon name="open_in_full" size={18}/></button><div className="flex flex-wrap items-center gap-space-md font-caption text-caption text-text-secondary"><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={snapToCenter} onChange={(event)=>setSnapToCenter(event.target.checked)} className="accent-primary"/><span>Snap to center</span></label><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={showGuides} onChange={(event)=>setShowGuides(event.target.checked)} className="accent-primary"/><span>Show safety guidelines</span></label></div></div>
        <div ref={canvasRef} className="relative w-full touch-none select-none overflow-hidden rounded-xl bg-surface-card shadow-lg [container-type:inline-size]" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}`, ...(certificate?.backgroundUrl ? { backgroundImage: `url("${certificate.backgroundUrl}")`, backgroundSize:'100% 100%', backgroundPosition:'center' } : {}) }}>
          {showGuides&&<><div className="pointer-events-none absolute inset-[8%] border border-dashed border-primary/20"/><div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-primary/15"/><div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-primary/15"/></>}
          {nameBox&&<div role="group" aria-label="Draggable certificate attendee name box. Use arrow keys to move and Shift plus arrow keys to resize." tabIndex={0} onPointerDown={(event)=>beginGesture(event,'move')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} onKeyDown={handleBoxKeyDown} className="absolute z-20 flex touch-none cursor-move items-center justify-center rounded border-2 border-dashed border-primary-container bg-primary-container/5 outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{left:`${nameBox.x/canvasWidth*100}%`,top:`${nameBox.y/canvasHeight*100}%`,width:`${nameBox.width/canvasWidth*100}%`,height:`${nameBox.height/canvasHeight*100}%`,fontFamily:nameBox.fontFamily,fontSize:`clamp(11px, ${nameBox.fontSize/canvasWidth*100}cqw, 42px)`,lineHeight:`${(nameBox.lineHeight ?? nameBox.fontSize*1.25)/canvasWidth*100}cqw`,fontWeight:nameBox.fontWeight,textAlign:nameBox.align,color:nameBox.color}}><div className="pointer-events-none absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-0.5 font-caption text-caption text-inverse-on-surface shadow-md"><Icon name="swap_vert" size={14} className="text-inverse-primary"/>X:{Math.round(nameBox.x)} Y:{Math.round(nameBox.y)} W:{Math.round(nameBox.width)} H:{Math.round(nameBox.height)}</div><span className="pointer-events-none w-full truncate px-3 tracking-tight">{previewName}</span>{resizeHandles.map((handle)=><button key={handle.direction} type="button" aria-label={handle.label} onPointerDown={(event)=>beginGesture(event,'resize',handle.direction)} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary-container bg-surface-card shadow ${handle.className}`}/>)}</div>}
          {qrCodeBox&&<div role="group" aria-label="Draggable certificate QR code. Drag to move and use handles to resize." onPointerDown={(event)=>beginQrGesture(event,'move')} onPointerMove={moveQrGesture} onPointerUp={finishQrGesture} onPointerCancel={finishQrGesture} className="absolute z-30 flex touch-none cursor-move items-center justify-center border-2 border-dashed border-secondary bg-white p-1" style={{left:`${qrCodeBox.x/canvasWidth*100}%`,top:`${qrCodeBox.y/canvasHeight*100}%`,width:`${qrCodeBox.width/canvasWidth*100}%`,height:`${qrCodeBox.height/canvasHeight*100}%`}}><QRCodeSVG value={qrValue} size={Math.max(32,Math.round(Math.min(qrCodeBox.width,qrCodeBox.height)))} level="M" marginSize={4} className="pointer-events-none h-full w-full"/><div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-0.5 font-caption text-caption text-inverse-on-surface shadow-md">QR · X:{Math.round(qrCodeBox.x)} Y:{Math.round(qrCodeBox.y)} W:{Math.round(qrCodeBox.width)} H:{Math.round(qrCodeBox.height)}</div>{qrResizeHandles.map((handle)=><button key={handle.direction} type="button" aria-label={handle.label} onPointerDown={(event)=>beginQrGesture(event,'resize',handle.direction)} onPointerMove={moveQrGesture} onPointerUp={finishQrGesture} onPointerCancel={finishQrGesture} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-secondary bg-white shadow ${handle.className}`}/>)}</div>}
          {signatureBoxes.map((signatureBox)=><div key={signatureBox.id} role="group" aria-label={`Draggable e-signature image ${signatureBox.imageName}. Use its handles to resize.`} onPointerDown={(event)=>beginSignatureGesture(event,signatureBox,'move')} onPointerMove={moveSignatureGesture} onPointerUp={finishSignatureGesture} onPointerCancel={finishSignatureGesture} className="absolute z-30 flex touch-none cursor-move items-center justify-center border-2 border-dashed border-primary/70 bg-surface-card/40 p-1" style={{left:`${signatureBox.x/canvasWidth*100}%`,top:`${signatureBox.y/canvasHeight*100}%`,width:`${signatureBox.width/canvasWidth*100}%`,height:`${signatureBox.height/canvasHeight*100}%`}}><img src={signatureBox.imageUrl} alt={`${signatureBox.imageName} preview`} draggable={false} className="pointer-events-none h-full w-full select-none object-contain"/><div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-0.5 font-caption text-caption text-inverse-on-surface shadow-md">{signatureBox.imageName} · X:{Math.round(signatureBox.x)} Y:{Math.round(signatureBox.y)} W:{Math.round(signatureBox.width)} H:{Math.round(signatureBox.height)}</div>{signatureResizeHandles.map((handle)=><button key={handle.direction} type="button" aria-label={`${handle.label} ${signatureBox.imageName}`} onPointerDown={(event)=>beginSignatureGesture(event,signatureBox,'resize',handle.direction)} onPointerMove={moveSignatureGesture} onPointerUp={finishSignatureGesture} onPointerCancel={finishSignatureGesture} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary bg-surface-card shadow ${handle.className}`}/>)}</div>)}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="upload_file" size={18}/>{certificate?'Replace certificate background':'Upload certificate background'}<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onChangeBackground} className="sr-only"/></label>
        <CanvasSizeControls width={canvasWidth} height={canvasHeight} disabled={!certificate} onChange={onUpdateCanvasSize}/>
        <div className="flex items-center gap-space-sm rounded-lg bg-surface-container p-space-sm text-text-secondary"><Icon name="info" size={18} className="shrink-0 text-primary"/><span className="font-caption text-caption">Certificates issue automatically after attendees meet the {requiredAttendancePercent}% attendance requirement and submit the evaluation form.</span></div>
      </div>

      <aside className="flex min-w-0 flex-col gap-space-md rounded-xl bg-surface-card p-space-md shadow-card"><div className="flex items-center justify-between gap-2 pb-space-xs"><div className="flex items-center gap-2"><Icon name="edit" size={20} className="text-primary"/><h3 className="font-title-md text-title-md text-on-surface">Name Typography</h3></div><button type="button" onClick={onReset} disabled={!nameBox} className="shrink-0 font-caption text-caption text-primary hover:underline disabled:opacity-40">Reset Box</button></div>
        <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Font family<select disabled={!nameBox} value={nameBox?.fontFamily??'Outfit'} onChange={(event)=>onUpdateField('fontFamily',event.target.value)} className={inputClass}><option value="Outfit">Outfit (Seminex Modern Collegiate)</option><option value="DM Sans">DM Sans (Humanist Clean)</option><option value="Cinzel">Cinzel (Formal Academic Serif)</option><option value="Playfair Display">Playfair Display (Ceremonial)</option></select></label>
        <div className="grid grid-cols-2 gap-space-sm"><NumberField label="Font size" value={nameBox?.fontSize??72} min={18} max={160} disabled={!nameBox} onChange={(value)=>onUpdateField('fontSize',value)}/><NumberField label="Line height" value={nameBox?.lineHeight??Math.round((nameBox?.fontSize??72)*1.25)} min={20} max={200} disabled={!nameBox} onChange={(value)=>onUpdateField('lineHeight',value)}/></div>
        <div className="grid grid-cols-2 gap-space-sm"><div className="flex flex-col gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Font weight</span><div role="group" aria-label="Font weight" className="flex rounded-lg bg-surface-container-low p-0.5"><button type="button" disabled={!nameBox} aria-pressed={nameBox?.fontWeight===400} onClick={()=>onUpdateField('fontWeight',400)} className={`w-1/2 rounded py-1.5 text-center font-body-sm-medium text-body-sm-medium transition-colors ${nameBox?.fontWeight===400?'bg-surface-card text-primary shadow-sm ring-1 ring-border-subtle':'text-text-secondary hover:text-on-surface'}`}>Normal</button><button type="button" disabled={!nameBox} aria-pressed={nameBox?.fontWeight===700} onClick={()=>onUpdateField('fontWeight',700)} className={`w-1/2 rounded py-1.5 text-center font-body-sm-medium text-body-sm-medium transition-colors ${nameBox?.fontWeight===700?'bg-surface-card text-primary shadow-sm ring-1 ring-border-subtle':'text-text-secondary hover:text-on-surface'}`}>Bold</button></div></div><div className="flex flex-col gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Alignment</span><div className="flex justify-around rounded-lg bg-surface-container-low p-0.5">{(['left','center','right'] as const).map((align)=><button key={align} type="button" aria-label={`Align ${align}`} aria-pressed={nameBox?.align===align} disabled={!nameBox} onClick={()=>onUpdateField('align',align)} className={`rounded px-2 py-1 font-body-sm-medium text-body-sm-medium ${nameBox?.align===align?'bg-surface-card text-primary shadow-sm':'text-text-secondary hover:text-on-surface'}`}>{align==='left'?'L':align==='center'?'C':'R'}</button>)}</div></div></div>
        <div className="flex flex-col gap-1.5"><label className="font-body-sm-medium text-body-sm-medium text-on-surface">Text color</label><div className="flex flex-wrap items-center gap-space-sm"><div className="flex items-center gap-1.5">{SWATCHES.map((swatch)=><button key={swatch.color} type="button" aria-label={swatch.name} title={swatch.name} disabled={!nameBox} onClick={()=>onUpdateField('color',swatch.color)} className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${nameBox?.color.toUpperCase()===swatch.color?'ring-2 ring-primary ring-offset-2':''}`} style={{backgroundColor:swatch.color}}/>)}</div><label className="relative min-w-[7rem] flex-1"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-caption text-caption text-text-subtle">#</span><input aria-label="Hex color" disabled={!nameBox} value={hexInput} maxLength={8} placeholder="RRGGBB" onChange={(event)=>updateHexColor(event.target.value)} onBlur={()=>setHexInput((nameBox?.color??'#1B365D').replace(/^#/,''))} className="h-9 w-full rounded-lg bg-surface-container-low pl-6 pr-2 font-body-sm text-body-sm uppercase text-on-surface outline-none focus:ring-2 focus:ring-primary/20"/></label></div><p className="font-caption text-caption text-text-secondary">Enter 3, 4, 6, or 8 digit hex colors (with or without #).</p></div>
        <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3"><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Name box coordinate alignment</span><span className="font-caption text-caption text-text-secondary">Pixels · {canvasWidth} × {canvasHeight}</span></div><div className="grid grid-cols-4 gap-1.5"><NumberField label="X pos" value={Math.round(nameBox?.x??0)} min={0} max={canvasWidth} disabled={!nameBox} compact onChange={(value)=>onUpdateField('x',value)}/><NumberField label="Y pos" value={Math.round(nameBox?.y??0)} min={0} max={canvasHeight} disabled={!nameBox} compact onChange={(value)=>onUpdateField('y',value)}/><NumberField label="Width" value={Math.round(nameBox?.width??0)} min={100} max={canvasWidth} disabled={!nameBox} compact onChange={(value)=>onUpdateField('width',value)}/><NumberField label="Height" value={Math.round(nameBox?.height??0)} min={40} max={canvasHeight} disabled={!nameBox} compact onChange={(value)=>onUpdateField('height',value)}/></div></div>
        {qrCodeBox&&<div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3"><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">QR code placement</span><span className="font-caption text-caption text-text-secondary">Drag or resize on canvas</span></div><div className="grid grid-cols-4 gap-1.5"><NumberField label="X pos" value={Math.round(qrCodeBox.x)} min={0} max={canvasWidth} disabled={!certificate} compact onChange={(value)=>onUpdateQrCodeGeometry(clampGeometry({...qrCodeBox,x:value}, canvasWidth, canvasHeight))}/><NumberField label="Y pos" value={Math.round(qrCodeBox.y)} min={0} max={canvasHeight} disabled={!certificate} compact onChange={(value)=>onUpdateQrCodeGeometry(clampGeometry({...qrCodeBox,y:value}, canvasWidth, canvasHeight))}/><NumberField label="Width" value={Math.round(qrCodeBox.width)} min={40} max={canvasWidth} disabled={!certificate} compact onChange={(value)=>onUpdateQrCodeGeometry(clampGeometry({...qrCodeBox,width:value}, canvasWidth, canvasHeight))}/><NumberField label="Height" value={Math.round(qrCodeBox.height)} min={40} max={canvasHeight} disabled={!certificate} compact onChange={(value)=>onUpdateQrCodeGeometry(clampGeometry({...qrCodeBox,height:value}, canvasWidth, canvasHeight))}/></div></div>}
        <section className="flex flex-col gap-space-sm border-t border-border-subtle pt-3"><div className="flex items-center justify-between gap-2"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">E-signature image</span><label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-surface-container-low px-3 font-body-sm-medium text-body-sm-medium text-primary hover:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><Icon name="upload_file" size={18}/>Add signature<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!certificate} onChange={(event)=>onSelectSignature(event)} className="sr-only"/></label></div>
          {signatureBoxes.map((signatureBox)=><div key={signatureBox.id} className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface-light p-space-sm"><div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate font-body-sm-medium text-body-sm-medium text-on-surface" title={signatureBox.imageName}>{signatureBox.imageName}</p><div className="flex shrink-0 items-center gap-1.5"><label className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-primary/30 px-2 font-caption text-caption text-primary hover:bg-primary/5"><Icon name="upload_file" size={16}/>Replace<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!certificate} onChange={(event)=>onSelectSignature(event,signatureBox.id)} className="sr-only"/></label><button type="button" onClick={()=>onRemoveSignature(signatureBox.id)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border-subtle px-2 font-caption text-caption text-text-secondary hover:bg-surface-container"><Icon name="delete" size={16}/>Remove</button></div></div><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-caption text-caption text-text-secondary">Coordinate alignment</span><span className="font-caption text-caption text-text-secondary">Pixels · {canvasWidth} × {canvasHeight}</span></div><div className="grid grid-cols-4 gap-1.5"><NumberField label="X pos" value={Math.round(signatureBox.x)} min={0} max={canvasWidth} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(signatureBox.id,clampGeometry({...signatureBox,x:value},canvasWidth,canvasHeight))}/><NumberField label="Y pos" value={Math.round(signatureBox.y)} min={0} max={canvasHeight} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(signatureBox.id,clampGeometry({...signatureBox,y:value},canvasWidth,canvasHeight))}/><NumberField label="Width" value={Math.round(signatureBox.width)} min={100} max={canvasWidth} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(signatureBox.id,clampGeometry({...signatureBox,width:value},canvasWidth,canvasHeight))}/><NumberField label="Height" value={Math.round(signatureBox.height)} min={40} max={canvasHeight} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(signatureBox.id,clampGeometry({...signatureBox,height:value},canvasWidth,canvasHeight))}/></div></div>)}
        </section>
      </aside>
    </div>
  </div>;
}

const CANVAS_PRESETS = [
  { label: 'Landscape HD · 1920 × 1080', width: 1920, height: 1080 },
  { label: 'Landscape · 1600 × 900', width: 1600, height: 900 },
  { label: 'Landscape · 1280 × 720', width: 1280, height: 720 },
  { label: 'A4 landscape · 3508 × 2480', width: 3508, height: 2480 },
  { label: 'A4 portrait · 2480 × 3508', width: 2480, height: 3508 },
];

function CanvasSizeControls({ width, height, disabled, onChange }: { width: number; height: number; disabled: boolean; onChange: (field: 'canvasWidth' | 'canvasHeight', value: number) => void }) {
  const [widthInput, setWidthInput] = useState(String(width));
  const [heightInput, setHeightInput] = useState(String(height));
  useEffect(() => { setWidthInput(String(width)); }, [width]);
  useEffect(() => { setHeightInput(String(height)); }, [height]);
  function commit(field: 'canvasWidth' | 'canvasHeight', raw: string) {
    const value = Number(raw);
    const fallback = field === 'canvasWidth' ? width : height;
    const resolved = Number.isFinite(value) && value > 0 ? Math.min(20000, Math.max(1, Math.round(value))) : fallback;
    if (field === 'canvasWidth') setWidthInput(String(resolved)); else setHeightInput(String(resolved));
    onChange(field, resolved);
  }
  function applyPreset(value: string) {
    if (value === 'custom') return;
    const preset = CANVAS_PRESETS[Number(value)];
    if (!preset) return;
    setWidthInput(String(preset.width)); setHeightInput(String(preset.height));
    onChange('canvasWidth', preset.width); onChange('canvasHeight', preset.height);
  }
  function reset() {
    setWidthInput(String(CERTIFICATE_CANVAS_WIDTH)); setHeightInput(String(CERTIFICATE_CANVAS_HEIGHT));
    onChange('canvasWidth', CERTIFICATE_CANVAS_WIDTH); onChange('canvasHeight', CERTIFICATE_CANVAS_HEIGHT);
  }
  const presetIndex = CANVAS_PRESETS.findIndex((preset) => preset.width === width && preset.height === height);
  return <div className="flex flex-col gap-space-sm rounded-lg border border-border-subtle bg-surface-light p-space-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-w-[14rem] flex-1 flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Canvas preset<select disabled={disabled} value={presetIndex < 0 ? 'custom' : String(presetIndex)} onChange={(event) => applyPreset(event.target.value)} className={inputClass}><option value="custom">Custom size</option>{CANVAS_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}</select></label><button type="button" disabled={disabled} onClick={reset} className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg border border-border-subtle px-3 font-body-sm-medium text-body-sm-medium text-primary hover:bg-surface-container disabled:opacity-50"><Icon name="refresh" size={18}/>Reset to 1920 × 1080</button></div>
    <div className="grid grid-cols-2 gap-space-sm">{([['Canvas width (px)', widthInput, setWidthInput, 'canvasWidth'], ['Canvas height (px)', heightInput, setHeightInput, 'canvasHeight']] as const).map(([label, value, setValue, field]) => <label key={field} className="flex min-w-0 flex-col gap-1"><span className="font-caption text-caption text-text-secondary">{label}</span><input type="number" min={1} max={20000} step={1} disabled={disabled} value={value} onChange={(event) => setValue(event.target.value)} onBlur={(event) => commit(field, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="h-10 w-full rounded-lg border border-border-subtle bg-surface-container-low px-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"/></label>)}</div>
    <p className="font-caption text-caption text-text-secondary">Custom dimensions: 1–20,000 px per side.</p>
  </div>;
}

function NumberField({ label, value, min, max, disabled, compact = false, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; compact?: boolean; onChange: (value: number) => void }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="font-caption text-caption text-text-secondary">{label}</span><input disabled={disabled} type="number" min={min} max={max} value={value} onChange={(event)=>onChange(Number(event.target.value))} className={`${compact?'h-8 px-2 text-center':'h-10 px-3'} w-full rounded-lg border border-border-subtle bg-surface-container-low font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50`}/></label>;
}




