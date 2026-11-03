import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent, type KeyboardEvent } from 'react';
import type { CertificateTemplate, NameBox } from '../../../api/orgTypes';
import { CERTIFICATE_CANVAS_HEIGHT, CERTIFICATE_CANVAS_WIDTH } from '../../../api/orgTypes';
import { BrandMark } from '../../../components/shell/BrandMark';
import { Icon } from '../../../components/ui/Icon';

type NameBoxField = keyof NameBox;
type BoxGeometry = Pick<NameBox, 'x' | 'y' | 'width' | 'height'>;
type Direction = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type Gesture = { pointerId: number; mode: 'move' | 'resize'; direction?: Direction; startClientX: number; startClientY: number; start: BoxGeometry };
const BASE_NAME_BOX: NameBox = { x: 360, y: 480, width: 1200, height: 140, fontFamily: 'Outfit', fontSize: 72, fontWeight: 700, align: 'center', color: '#1B365D', lineHeight: 90 };
const SWATCHES = [{ name: 'Gold', color: '#D4AF37' }, { name: 'Navy', color: '#1B365D' }, { name: 'Maroon', color: '#7A1C1C' }, { name: 'Dark slate', color: '#1F2937' }];
const inputClass = 'h-10 w-full rounded-lg border border-border-subtle bg-surface-container-low px-3 font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

interface Props {
  certificate: CertificateTemplate | null;
  title: string;
  speaker: string;
  venue: string;
  startsAt?: string;
  requiredAttendancePercent: number;
  onChangeBackground: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpdateField: (field: NameBoxField, value: string | number) => void;
  onUpdateGeometry: (value: Pick<NameBox, 'x' | 'y' | 'width' | 'height'>) => void;
  onSelectSignature: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveSignature: () => void;
  onUpdateSignatureGeometry: (value: BoxGeometry) => void;
  onReset: () => void;
}

function clampedBox(box: NameBox): NameBox {
  const width = Math.min(CERTIFICATE_CANVAS_WIDTH, Math.max(100, box.width));
  const height = Math.min(CERTIFICATE_CANVAS_HEIGHT, Math.max(40, box.height));
  return { ...box, width, height, x: Math.min(CERTIFICATE_CANVAS_WIDTH - width, Math.max(0, box.x)), y: Math.min(CERTIFICATE_CANVAS_HEIGHT - height, Math.max(0, box.y)) };
}

function clampGeometry(geometry: BoxGeometry): BoxGeometry {
  const width = Math.min(CERTIFICATE_CANVAS_WIDTH, Math.max(100, geometry.width));
  const height = Math.min(CERTIFICATE_CANVAS_HEIGHT, Math.max(40, geometry.height));
  return { width, height, x: Math.min(CERTIFICATE_CANVAS_WIDTH - width, Math.max(0, geometry.x)), y: Math.min(CERTIFICATE_CANVAS_HEIGHT - height, Math.max(0, geometry.y)) };
}

export function CertificateDesigner({ certificate, title, speaker, venue, startsAt, requiredAttendancePercent, onChangeBackground, onUpdateField, onUpdateGeometry, onSelectSignature, onRemoveSignature, onUpdateSignatureGeometry, onReset }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const signatureGestureRef = useRef<Gesture | null>(null);
  const [previewName, setPreviewName] = useState('Ana Cruz');
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const nameBox = certificate?.nameBox ? clampedBox({ ...BASE_NAME_BOX, ...certificate.nameBox }) : null;
  const signatureBox = certificate?.signatureBox ?? null;
  const [hexInput, setHexInput] = useState((nameBox?.color ?? '#1B365D').replace(/^#/, ''));
  const date = startsAt ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(startsAt)) : 'Date to be announced';

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
    const dx = (event.clientX - gesture.startClientX) / bounds.width * CERTIFICATE_CANVAS_WIDTH;
    const dy = (event.clientY - gesture.startClientY) / bounds.height * CERTIFICATE_CANVAS_HEIGHT;
    const next = { ...gesture.start };
    if (gesture.mode === 'move') {
      next.x = gesture.start.x + dx;
      next.y = gesture.start.y + dy;
      if (snapToCenter && Math.abs(next.x + next.width / 2 - CERTIFICATE_CANVAS_WIDTH / 2) < 22) next.x = (CERTIFICATE_CANVAS_WIDTH - next.width) / 2;
      if (snapToCenter && Math.abs(next.y + next.height / 2 - CERTIFICATE_CANVAS_HEIGHT / 2) < 22) next.y = (CERTIFICATE_CANVAS_HEIGHT - next.height) / 2;
    } else {
      const d = gesture.direction ?? 'se';
      if (d.includes('e')) next.width = gesture.start.width + dx;
      if (d.includes('s')) next.height = gesture.start.height + dy;
      if (d.includes('w')) { next.x = gesture.start.x + dx; next.width = gesture.start.width - dx; }
      if (d.includes('n')) { next.y = gesture.start.y + dy; next.height = gesture.start.height - dy; }
    }
    onUpdateGeometry(clampGeometry(next));
  }

  function finishGesture(event: PointerEvent<HTMLElement>) {
    if (gestureRef.current?.pointerId === event.pointerId) gestureRef.current = null;
  }

  function beginSignatureGesture(event: PointerEvent<HTMLElement>, mode: Gesture['mode'], direction?: Direction) {
    if (!signatureBox) return;
    event.preventDefault(); event.stopPropagation();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not available in every embedded browser. */ }
    signatureGestureRef.current = { pointerId: event.pointerId, mode, direction, startClientX: event.clientX, startClientY: event.clientY, start: { ...signatureBox } };
  }

  function moveSignatureGesture(event: PointerEvent<HTMLElement>) {
    const gesture = signatureGestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || event.pointerId !== gesture.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const dx = (event.clientX - gesture.startClientX) / bounds.width * CERTIFICATE_CANVAS_WIDTH;
    const dy = (event.clientY - gesture.startClientY) / bounds.height * CERTIFICATE_CANVAS_HEIGHT;
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
    onUpdateSignatureGeometry(clampGeometry(next));
  }

  function finishSignatureGesture(event: PointerEvent<HTMLElement>) {
    if (signatureGestureRef.current?.pointerId === event.pointerId) signatureGestureRef.current = null;
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
    onUpdateGeometry(clampedBox({ ...nameBox, ...next }));
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

  return <div className="flex flex-col gap-space-md">
    <div className="flex flex-col justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm lg:flex-row lg:items-center"><div className="flex items-center gap-space-sm"><Icon name="verified" size={20} className="text-primary"/><span className="font-body-sm text-body-sm text-on-surface">Dynamic certificate canvas · Visual bounds and attendee name preview</span></div><div className="flex flex-wrap items-center gap-2"><span className="font-caption text-caption text-text-secondary">Preview name:</span><div className="flex max-w-full overflow-x-auto rounded-lg bg-surface-container-highest p-0.5 font-caption text-caption"><button type="button" onClick={()=>setPreviewName('Ana Cruz')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Ana Cruz'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>Ana Cruz</button><button type="button" onClick={()=>setPreviewName('Mary Elizabeth Von Hohenheim')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Mary Elizabeth Von Hohenheim'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>Von Hohenheim</button><button type="button" onClick={()=>setPreviewName('Kristofer Emmanuel San Buenaventura III')} className={`shrink-0 rounded px-2.5 py-1 ${previewName==='Kristofer Emmanuel San Buenaventura III'?'bg-surface-card font-semibold text-on-surface shadow-sm':'text-text-secondary'}`}>San Buenaventura III</button></div></div></div>

    <div className="grid min-w-0 gap-space-lg xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="flex min-w-0 flex-col gap-space-sm"><div className="flex flex-wrap items-center justify-between gap-space-sm px-space-xs"><div className="flex items-center gap-space-sm"><span className="font-label-sm text-label-sm uppercase text-text-secondary">Canvas scale</span><span className="rounded bg-surface-container px-2 py-0.5 font-caption text-caption text-on-surface-variant">Fit to panel · 1920 × 1080</span></div><button type="button" onClick={()=>canvasRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'})} title="Fit canvas in view" className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:bg-surface-container"><Icon name="open_in_full" size={18}/></button><div className="flex flex-wrap items-center gap-space-md font-caption text-caption text-text-secondary"><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={snapToCenter} onChange={(event)=>setSnapToCenter(event.target.checked)} className="accent-primary"/><span>Snap to center</span></label><label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={showGuides} onChange={(event)=>setShowGuides(event.target.checked)} className="accent-primary"/><span>Show safety guidelines</span></label></div></div>
        <div ref={canvasRef} className="relative aspect-[16/9] w-full touch-none select-none overflow-hidden rounded-xl bg-surface-card shadow-lg [container-type:inline-size]" style={certificate?.backgroundUrl ? { backgroundImage: `url("${certificate.backgroundUrl}")`, backgroundSize:'cover', backgroundPosition:'center' } : undefined}>
          <div className="pointer-events-none absolute inset-3 rounded-lg border-[3px] border-primary/40"/><div className="pointer-events-none absolute inset-5 rounded border border-outline/30"/>
          {showGuides&&<><div className="pointer-events-none absolute inset-[8%] border border-dashed border-primary/20"/><div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-primary/15"/><div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-primary/15"/></>}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.045]"><div className="flex h-[34cqw] w-[34cqw] items-center justify-center rounded-full border-4 border-primary"><BrandMark size={192}/></div></div>
          <div className="pointer-events-none absolute inset-x-[5%] top-[7%] z-10 flex flex-col items-center text-center"><div className="flex items-center gap-3"><BrandMark size={36}/><div className="text-left"><span className="block font-label-sm text-label-sm font-bold tracking-wider text-primary">GORDON COLLEGE</span><span className="font-caption text-caption text-text-secondary">{certificate ? 'College of Computer Studies' : 'Seminex seminar certificate'}</span></div></div><h2 className="mt-[1cqw] font-title-md text-[2.5cqw] font-semibold text-primary">Certificate of Participation</h2><p className="mt-0.5 font-caption text-[1cqw] uppercase tracking-widest text-text-secondary">This recognition is presented to</p></div>
          {nameBox&&<div role="group" aria-label="Draggable certificate attendee name box. Use arrow keys to move and Shift plus arrow keys to resize." tabIndex={0} onPointerDown={(event)=>beginGesture(event,'move')} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} onKeyDown={handleBoxKeyDown} className="absolute z-20 flex touch-none cursor-move items-center justify-center rounded border-2 border-dashed border-primary-container bg-primary-container/5 outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{left:`${nameBox.x/CERTIFICATE_CANVAS_WIDTH*100}%`,top:`${nameBox.y/CERTIFICATE_CANVAS_HEIGHT*100}%`,width:`${nameBox.width/CERTIFICATE_CANVAS_WIDTH*100}%`,height:`${nameBox.height/CERTIFICATE_CANVAS_HEIGHT*100}%`,fontFamily:nameBox.fontFamily,fontSize:`clamp(11px, ${nameBox.fontSize/1920*100}cqw, 42px)`,lineHeight:`${(nameBox.lineHeight ?? nameBox.fontSize*1.25)/1920*100}cqw`,fontWeight:nameBox.fontWeight,textAlign:nameBox.align,color:nameBox.color}}><div className="pointer-events-none absolute -top-7 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-0.5 font-caption text-caption text-inverse-on-surface shadow-md"><Icon name="swap_vert" size={14} className="text-inverse-primary"/>X:{Math.round(nameBox.x)} Y:{Math.round(nameBox.y)} W:{Math.round(nameBox.width)} H:{Math.round(nameBox.height)}</div><span className="pointer-events-none w-full truncate px-3 tracking-tight">{previewName}</span>{resizeHandles.map((handle)=><button key={handle.direction} type="button" aria-label={handle.label} onPointerDown={(event)=>beginGesture(event,'resize',handle.direction)} onPointerMove={moveGesture} onPointerUp={finishGesture} onPointerCancel={finishGesture} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary-container bg-surface-card shadow ${handle.className}`}/>)}</div>}
          {signatureBox&&<div role="group" aria-label="Draggable e-signature image box. Use its handles to resize." onPointerDown={(event)=>beginSignatureGesture(event,'move')} onPointerMove={moveSignatureGesture} onPointerUp={finishSignatureGesture} onPointerCancel={finishSignatureGesture} className="absolute z-30 flex touch-none cursor-move items-center justify-center border-2 border-dashed border-primary/70 bg-surface-card/40 p-1" style={{left:`${signatureBox.x/CERTIFICATE_CANVAS_WIDTH*100}%`,top:`${signatureBox.y/CERTIFICATE_CANVAS_HEIGHT*100}%`,width:`${signatureBox.width/CERTIFICATE_CANVAS_WIDTH*100}%`,height:`${signatureBox.height/CERTIFICATE_CANVAS_HEIGHT*100}%`}}><img src={signatureBox.imageUrl} alt="E-signature preview" draggable={false} className="pointer-events-none h-full w-full select-none object-contain"/><div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-inverse-surface px-2.5 py-0.5 font-caption text-caption text-inverse-on-surface shadow-md">X:{Math.round(signatureBox.x)} Y:{Math.round(signatureBox.y)} W:{Math.round(signatureBox.width)} H:{Math.round(signatureBox.height)}</div>{signatureResizeHandles.map((handle)=><button key={handle.direction} type="button" aria-label={handle.label} onPointerDown={(event)=>beginSignatureGesture(event,'resize',handle.direction)} onPointerMove={moveSignatureGesture} onPointerUp={finishSignatureGesture} onPointerCancel={finishSignatureGesture} className={`absolute z-10 h-3.5 w-3.5 rounded-sm border-2 border-primary bg-surface-card shadow ${handle.className}`}/>)}</div>}
          <div className="pointer-events-none absolute inset-x-[7%] bottom-[19%] z-10 flex flex-col items-center px-8 text-center"><p className="font-caption text-[1cqw] text-text-secondary">for successfully attending and completing</p><p className="mt-1 max-w-full truncate font-title-md text-[1.65cqw] font-semibold text-primary">{title || 'Your seminar title'}</p><p className="mt-0.5 font-caption text-[0.9cqw] text-text-secondary">{[date,venue].filter(Boolean).join(' · ')}</p></div>
          <div className="pointer-events-none absolute inset-x-[8%] bottom-[5%] z-10 grid grid-cols-3 items-end gap-4 text-center"><div><div className="mx-auto w-[70%] border-b border-on-surface-variant/40 pb-1 font-body-sm-medium text-[1cqw] text-on-surface">{speaker || 'Lead speaker'}</div><span className="font-caption text-[0.8cqw] text-text-secondary">Seminar speaker</span></div><div className="flex flex-col items-center"><span className="flex h-[4cqw] w-[4cqw] items-center justify-center rounded-full border border-primary/30 text-primary"><Icon name="verified_user" size={20}/></span><span className="mt-0.5 font-caption text-[0.8cqw] text-text-secondary">Verified certificate</span></div><div><div className="mx-auto w-[70%] border-b border-on-surface-variant/40 pb-1 font-body-sm-medium text-[1cqw] text-on-surface">{certificate ? 'Organization officer' : 'Authorized signatory'}</div><span className="font-caption text-[0.8cqw] text-text-secondary">{certificate ? 'Organization' : 'Gordon College'}</span></div></div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-sm-medium text-body-sm-medium text-on-surface"><Icon name="upload_file" size={18}/>{certificate?'Replace certificate background':'Upload certificate background'}<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={onChangeBackground} className="sr-only"/></label>
        <div className="flex items-center gap-space-sm rounded-lg bg-surface-container p-space-sm text-text-secondary"><Icon name="info" size={18} className="shrink-0 text-primary"/><span className="font-caption text-caption">Certificates issue automatically after attendees meet the {requiredAttendancePercent}% attendance requirement and submit the evaluation form.</span></div>
      </div>

      <aside className="flex min-w-0 flex-col gap-space-md rounded-xl bg-surface-card p-space-md shadow-card"><div className="flex items-center justify-between gap-2 pb-space-xs"><div className="flex items-center gap-2"><Icon name="edit" size={20} className="text-primary"/><h3 className="font-title-md text-title-md text-on-surface">Name Typography</h3></div><button type="button" onClick={onReset} disabled={!nameBox} className="shrink-0 font-caption text-caption text-primary hover:underline disabled:opacity-40">Reset Box</button></div>
        <label className="flex flex-col gap-1 font-body-sm-medium text-body-sm-medium text-on-surface">Font family<select disabled={!nameBox} value={nameBox?.fontFamily??'Outfit'} onChange={(event)=>onUpdateField('fontFamily',event.target.value)} className={inputClass}><option value="Outfit">Outfit (Seminex Modern Collegiate)</option><option value="DM Sans">DM Sans (Humanist Clean)</option><option value="Cinzel">Cinzel (Formal Academic Serif)</option><option value="Playfair Display">Playfair Display (Ceremonial)</option></select></label>
        <div className="grid grid-cols-2 gap-space-sm"><NumberField label="Font size" value={nameBox?.fontSize??72} min={18} max={160} disabled={!nameBox} onChange={(value)=>onUpdateField('fontSize',value)}/><NumberField label="Line height" value={nameBox?.lineHeight??Math.round((nameBox?.fontSize??72)*1.25)} min={20} max={200} disabled={!nameBox} onChange={(value)=>onUpdateField('lineHeight',value)}/></div>
        <div className="grid grid-cols-2 gap-space-sm"><div className="flex flex-col gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Font weight</span><div role="group" aria-label="Font weight" className="flex rounded-lg bg-surface-container-low p-0.5"><button type="button" disabled={!nameBox} aria-pressed={nameBox?.fontWeight===400} onClick={()=>onUpdateField('fontWeight',400)} className={`w-1/2 rounded py-1.5 text-center font-body-sm-medium text-body-sm-medium transition-colors ${nameBox?.fontWeight===400?'bg-surface-card text-primary shadow-sm ring-1 ring-border-subtle':'text-text-secondary hover:text-on-surface'}`}>Normal</button><button type="button" disabled={!nameBox} aria-pressed={nameBox?.fontWeight===700} onClick={()=>onUpdateField('fontWeight',700)} className={`w-1/2 rounded py-1.5 text-center font-body-sm-medium text-body-sm-medium transition-colors ${nameBox?.fontWeight===700?'bg-surface-card text-primary shadow-sm ring-1 ring-border-subtle':'text-text-secondary hover:text-on-surface'}`}>Bold</button></div></div><div className="flex flex-col gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Alignment</span><div className="flex justify-around rounded-lg bg-surface-container-low p-0.5">{(['left','center','right'] as const).map((align)=><button key={align} type="button" aria-label={`Align ${align}`} aria-pressed={nameBox?.align===align} disabled={!nameBox} onClick={()=>onUpdateField('align',align)} className={`rounded px-2 py-1 font-body-sm-medium text-body-sm-medium ${nameBox?.align===align?'bg-surface-card text-primary shadow-sm':'text-text-secondary hover:text-on-surface'}`}>{align==='left'?'L':align==='center'?'C':'R'}</button>)}</div></div></div>
        <div className="flex flex-col gap-1.5"><label className="font-body-sm-medium text-body-sm-medium text-on-surface">Text color</label><div className="flex flex-wrap items-center gap-space-sm"><div className="flex items-center gap-1.5">{SWATCHES.map((swatch)=><button key={swatch.color} type="button" aria-label={swatch.name} title={swatch.name} disabled={!nameBox} onClick={()=>onUpdateField('color',swatch.color)} className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${nameBox?.color.toUpperCase()===swatch.color?'ring-2 ring-primary ring-offset-2':''}`} style={{backgroundColor:swatch.color}}/>)}</div><label className="relative min-w-[7rem] flex-1"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-caption text-caption text-text-subtle">#</span><input aria-label="Hex color" disabled={!nameBox} value={hexInput} maxLength={8} placeholder="RRGGBB" onChange={(event)=>updateHexColor(event.target.value)} onBlur={()=>setHexInput((nameBox?.color??'#1B365D').replace(/^#/,''))} className="h-9 w-full rounded-lg bg-surface-container-low pl-6 pr-2 font-body-sm text-body-sm uppercase text-on-surface outline-none focus:ring-2 focus:ring-primary/20"/></label></div><p className="font-caption text-caption text-text-secondary">Enter 3, 4, 6, or 8 digit hex colors (with or without #).</p></div>
        <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3"><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Name box coordinate alignment</span><span className="font-caption text-caption text-text-secondary">Pixels · 1920 × 1080</span></div><div className="grid grid-cols-4 gap-1.5"><NumberField label="X pos" value={Math.round(nameBox?.x??0)} min={0} max={CERTIFICATE_CANVAS_WIDTH} disabled={!nameBox} compact onChange={(value)=>onUpdateField('x',value)}/><NumberField label="Y pos" value={Math.round(nameBox?.y??0)} min={0} max={CERTIFICATE_CANVAS_HEIGHT} disabled={!nameBox} compact onChange={(value)=>onUpdateField('y',value)}/><NumberField label="Width" value={Math.round(nameBox?.width??0)} min={100} max={CERTIFICATE_CANVAS_WIDTH} disabled={!nameBox} compact onChange={(value)=>onUpdateField('width',value)}/><NumberField label="Height" value={Math.round(nameBox?.height??0)} min={40} max={CERTIFICATE_CANVAS_HEIGHT} disabled={!nameBox} compact onChange={(value)=>onUpdateField('height',value)}/></div></div>
        <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">E-signature image</span><div className="flex items-center gap-2"><label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-surface-container-low px-3 font-body-sm-medium text-body-sm-medium text-primary hover:bg-primary/5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"><Icon name="upload_file" size={18}/>{signatureBox?'Replace image':'Insert e-signature'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!certificate} onChange={onSelectSignature} className="sr-only"/></label>{signatureBox&&<button type="button" onClick={onRemoveSignature} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-border-subtle px-2.5 font-caption text-caption text-text-secondary hover:bg-surface-container"><Icon name="delete" size={16}/>Remove</button>}</div></div>{signatureBox&&<><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Coordinate alignment</span><span className="font-caption text-caption text-text-secondary">Pixels · 1920 × 1080</span></div><div className="grid grid-cols-4 gap-1.5"><NumberField label="X pos" value={Math.round(signatureBox.x)} min={0} max={CERTIFICATE_CANVAS_WIDTH} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(clampGeometry({...signatureBox,x:value}))}/><NumberField label="Y pos" value={Math.round(signatureBox.y)} min={0} max={CERTIFICATE_CANVAS_HEIGHT} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(clampGeometry({...signatureBox,y:value}))}/><NumberField label="Width" value={Math.round(signatureBox.width)} min={100} max={CERTIFICATE_CANVAS_WIDTH} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(clampGeometry({...signatureBox,width:value}))}/><NumberField label="Height" value={Math.round(signatureBox.height)} min={40} max={CERTIFICATE_CANVAS_HEIGHT} disabled={!certificate} compact onChange={(value)=>onUpdateSignatureGeometry(clampGeometry({...signatureBox,height:value}))}/></div></>}</div>
      </aside>
    </div>
  </div>;
}

function NumberField({ label, value, min, max, disabled, compact = false, onChange }: { label: string; value: number; min: number; max: number; disabled: boolean; compact?: boolean; onChange: (value: number) => void }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="font-caption text-caption text-text-secondary">{label}</span><input disabled={disabled} type="number" min={min} max={max} value={value} onChange={(event)=>onChange(Number(event.target.value))} className={`${compact?'h-8 px-2 text-center':'h-10 px-3'} w-full rounded-lg border border-border-subtle bg-surface-container-low font-body-sm text-body-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50`}/></label>;
}
