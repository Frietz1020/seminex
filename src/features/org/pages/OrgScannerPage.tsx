import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Link, useParams } from 'react-router-dom';
import { api, type ScannedStudentIdentity } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { Icon } from '../../../components/ui/Icon';
import { Avatar } from '../../../components/ui/Avatar';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getOrgLifecycle } from '../seminarStatus';
import { parseAttendanceChallengePayload } from '../../seminars/AttendanceQr';

interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>; }
interface BarcodeDetectorConstructor { new (options: { formats: string[] }): BarcodeDetectorLike; }

function readStudentCode(value: string) {
  const studentId = value.trim();
  return /^20\d{7}$/.test(studentId) ? studentId : '';
}

export default function OrgScannerPage() {
  const { id = '' } = useParams();
  const now = useNow();
  const online = useOnlineStatus();
  const listing = useResource(() => api.listOrgSeminars({ seminars: { pageSize: 999 }, drafts: { pageSize: 1 } }), `scanner-seminar-${id}`);
  const seminar = listing.state.status === 'success' ? listing.state.data.seminars.items.find((item) => item.id === id) : null;
  const roster = useResource(() => api.listOrgRoster(id), `scanner-roster-${id}`, (items) => items.length === 0);
  const ledger = useResource(() => api.listLedger(id), `scanner-ledger-${id}`, (items) => items.length === 0);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [working, setWorking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [lastScannedStudent, setLastScannedStudent] = useState<ScannedStudentIdentity | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCameraCode = useRef('');
  const cameraProcessing = useRef(false);
  const processCodeRef = useRef<(value: string) => void>(() => undefined);
  const pendingScan = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  const processCode = useCallback(async (raw: string, method: 'qr' | 'manual' = 'qr') => {
    if (working) return;
    if (!online) { setReason('No connection. Attendance scanning is unavailable offline.'); return; }
    const challenge = method === 'qr' ? parseAttendanceChallengePayload(raw) : null;
    const studentId = method === 'manual' ? readStudentCode(raw) : '';
    if (method === 'qr' && !challenge) { setReason('This is not a live Seminex attendance QR. Ask the student to refresh it.'); return; }
    if (method === 'manual' && !studentId) { setReason('Enter the 9-digit Student ID for a manual attendance entry.'); return; }
    if (method === 'manual' && manualReason.trim().length < 5) { setReason('Add a short reason before recording a manual attendance entry.'); return; }
    const fingerprint = `${id}|${challenge ?? studentId}|${method}|${method === 'manual' ? manualReason.trim() : ''}`;
    const idempotencyKey = pendingScan.current?.fingerprint === fingerprint
      ? pendingScan.current.idempotencyKey
      : crypto.randomUUID();
    setWorking(true);
    const result = challenge
      ? await api.recordOrgChallengeScan({ seminarId: id, challenge, idempotencyKey })
      : await api.recordOrgScan({ seminarId: id, studentId, method: 'manual', idempotencyKey, reason: manualReason.trim() });
    setWorking(false);
    if (!result.ok) {
      pendingScan.current = result.error.code === 'network' ? { fingerprint, idempotencyKey } : null;
      setReason(result.error.code === 'not_found'
        ? 'This student is not on the active registration list for this seminar.'
        : 'The attendance entry could not be saved. Check the seminar status and try again.');
      return;
    }
    pendingScan.current = null;
    setLastScannedStudent(result.data.student);
    setReason(`${result.data.student.firstName} ${result.data.student.lastName} · ${result.data.entry.kind === 'time_in' ? 'Time-in' : 'Time-out'} recorded.`);
    setCode('');
    setManualReason('');
    ledger.reload();
  }, [working, ledger.reload, id, online, manualReason]);

  useEffect(() => { processCodeRef.current = (value) => { void processCode(value, 'qr'); }; }, [processCode]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    const video = videoRef.current;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
    let active = true;
    const timer = window.setInterval(() => {
      if (!active || cameraProcessing.current || video.readyState < 2) return;
      cameraProcessing.current = true;
      const detect = detector
        ? detector.detect(video).then((codes) => codes[0]?.rawValue)
        : new Promise<string | undefined>((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context || !canvas.width || !canvas.height) { resolve(undefined); return; }
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            resolve(jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data);
          });
      void detect.then((value) => {
        if (value && value !== lastCameraCode.current) {
          lastCameraCode.current = value;
          processCodeRef.current(value);
          window.setTimeout(() => { lastCameraCode.current = ''; }, 2500);
        }
      }).catch(() => setCameraError('Could not read the QR code. Adjust the camera and try again.')).finally(() => { cameraProcessing.current = false; });
    }, 350);
    return () => { active = false; window.clearInterval(timer); };
  }, [cameraStream]);

  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream]);

  useEffect(() => {
    if (!online && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
      setReason('No connection. Attendance scanning is unavailable offline.');
    }
  }, [online, cameraStream]);

  async function startCamera() {
    setCameraError(null);
    if (!online) { setReason('No connection. Attendance scanning is unavailable offline.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Camera access is not available here. Use the scan field below.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setCameraError('Camera permission was not granted. You can still scan by entering a student ID.'); }
  }

  if (listing.state.status === 'loading') return <PageContainer><LoadingRegion label="Loading scanner"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></LoadingRegion></PageContainer>;
  if (listing.state.status === 'error') return <PageContainer><StateMessage role="alert" icon="info" title="Scanner could not load seminar details" action={<RetryButton onClick={listing.reload} />}>Try again when connected.</StateMessage></PageContainer>;
  if (!seminar) return <PageContainer><StateMessage role="status" icon="event_busy" title="Seminar not found" action={<Link to="/org/my-seminars" className={actionPrimary}>Back to My Seminars</Link>}>This seminar is not available in your workspace.</StateMessage></PageContainer>;
  if (seminar.seminarType === 'webinar') return <PageContainer><StateMessage icon="fact_check" title="Webinars use attendance proof review" action={<Link to={`/org/my-seminars/${seminar.id}#attendance`} className={actionPrimary}>Open attendance proof review</Link>}>The in-person scanner is unavailable for webinars.</StateMessage></PageContainer>;
  if (now === null) return <PageContainer><p role="status" className="font-body-sm text-body-sm text-text-secondary">Loading current seminar times…</p></PageContainer>;

  const latestRows = [...(ledger.state.status === 'success' ? ledger.state.data : [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const allScans = ledger.state.status === 'success' ? ledger.state.data : [];
  const checkedInCount = new Set(allScans.filter((entry) => entry.kind === 'time_in').map((entry) => entry.studentId)).size;
  const checkedOutCount = new Set(allScans.filter((entry) => entry.kind === 'time_out').map((entry) => entry.studentId)).size;
  const activeRegistrationCount = roster.state.status === 'success' ? roster.state.data.filter((student) => !student.removal && student.status !== 'released' && student.status !== 'cancelled').length : 0;
  const lifecycle = getOrgLifecycle(seminar, now);

  return (
    <PageContainer>
      {!online && <p role="status" aria-live="polite" className="rounded-lg border border-outline-variant/50 bg-surface-container-highest p-space-md font-body-sm text-body-sm text-on-surface">No connection. Attendance scanning is unavailable offline.</p>}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary"><Link to={`/org/my-seminars/${seminar.id}`} className="hover:text-primary">{seminar.title}</Link><Icon name="chevron_right" size={16} /><span>Attendance scanner</span></nav>
      <header className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-end"><div><p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">{seminar.reference} · {lifecycle}</p><h1 className="mt-space-xs font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Check-in scanner</h1><p className="mt-space-xs font-body-base text-body-base text-text-secondary">Scan a registered student’s QR code to record time-in or time-out.</p></div><Link to={`/org/my-seminars/${seminar.id}`} className={actionTonal}><Icon name="arrow_back" size={18} />Seminar details</Link></header>

      <div className="grid items-start gap-space-lg lg:grid-cols-[1.2fr_0.8fr]">
        <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="scan-title">
          <div className="flex items-center justify-between gap-3"><div><h2 id="scan-title" className="font-title-lg text-title-lg text-on-surface">Scan attendee</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Aim the camera at the student’s Seminex attendance QR.</p></div><span className={`rounded-full px-3 py-1 font-caption text-caption ${online ? 'bg-status-available-container text-status-available' : 'bg-status-ongoing-container text-status-ongoing'}`}>{online ? 'Online' : 'Offline'}</span></div>
          <div className="relative isolate aspect-video overflow-hidden rounded-2xl border border-outline-variant/60 bg-charcoal-900 shadow-inner">
            {cameraStream ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /> : <div className="flex h-full min-h-52 flex-col items-center justify-center gap-space-sm text-on-primary"><Icon name="qr_code_scanner" size={32} /><p className="font-body-sm text-body-sm">Camera preview</p><button type="button" disabled={!online} onClick={() => void startCamera()} className="min-h-11 rounded-lg bg-surface-card px-4 font-body-sm-medium text-body-sm-medium text-primary disabled:opacity-50">Start camera</button></div>}
            {cameraStream && <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center"><div className="relative aspect-square w-[min(58%,18rem)] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]"><span className="absolute -left-0.5 -top-0.5 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-secondary" /><span className="absolute -right-0.5 -top-0.5 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-secondary" /><span className="absolute -bottom-0.5 -left-0.5 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-secondary" /><span className="absolute -bottom-0.5 -right-0.5 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-secondary" /></div></div>}
          </div>
          {cameraStream && <button type="button" onClick={() => { cameraStream.getTracks().forEach((track) => track.stop()); setCameraStream(null); }} className={actionTonal}>Stop camera</button>}
          {cameraError && <p role="status" className="rounded-lg bg-surface-container-low p-space-sm font-caption text-caption text-text-secondary">{cameraError}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void processCode(code, 'manual'); }} className="flex flex-col gap-space-sm">
            <label className="sr-only" htmlFor="attendee-code">Manually enter Student ID</label>
            <div className="flex flex-col gap-space-sm sm:flex-row"><input id="attendee-code" autoComplete="off" autoCapitalize="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter Student ID manually" disabled={!online} className="h-12 min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-base text-body-base outline-none focus:border-primary disabled:opacity-50" /><button type="submit" disabled={!online || working || !code.trim() || manualReason.trim().length < 5} className={actionPrimary}>{working ? 'Recording…' : 'Record manual entry'}</button></div>
            <label htmlFor="manual-reason" className="font-caption text-caption text-text-secondary">Reason for manual entry</label><input id="manual-reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} minLength={5} required disabled={!online} placeholder="For example, attendee QR code was damaged" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm outline-none focus:border-primary disabled:opacity-50" />
          </form>
          <p className="font-caption text-caption text-text-secondary">Camera scans require a live, one-use QR challenge. Manual Student ID entries require a reason and are preserved in the attendance ledger.</p>
          {reason && <p role="status" aria-live="polite" className="rounded-lg border border-border-subtle bg-surface-container-low p-space-md font-body-sm-medium text-body-sm-medium text-on-surface">{reason}</p>}
          {lastScannedStudent && <article className="flex items-center gap-space-md rounded-xl border border-outline-variant/50 bg-surface-card p-space-md" aria-label="Scanned student record"><Avatar src={lastScannedStudent.avatarUrl} firstName={lastScannedStudent.firstName} lastName={lastScannedStudent.lastName} size="xl" className="h-16 w-16 text-title-lg" /><div><h3 className="font-title-md text-title-md text-on-surface">{lastScannedStudent.firstName} {lastScannedStudent.middleInitial ? `${lastScannedStudent.middleInitial}. ` : ''}{lastScannedStudent.lastName}</h3><p className="font-body-sm text-body-sm text-text-secondary">{lastScannedStudent.program ?? 'Program not provided'} · Year {lastScannedStudent.yearLevel ?? 'not provided'} · Block {lastScannedStudent.block ?? 'not provided'}</p><p className="font-caption text-caption text-text-secondary">{lastScannedStudent.studentId}</p></div></article>}
        </section>

        <div className="flex flex-col gap-space-lg">
          <section className="rounded-xl border border-outline-variant/50 bg-surface-card p-space-lg shadow-card"><div className="flex items-center justify-between"><h2 className="font-title-lg text-title-lg text-on-surface">Attendance overview</h2><Icon name="group" size={22} className="text-primary" /></div><p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">Live counts from the seminar’s saved check-in records.</p><div className="mt-space-md grid grid-cols-3 gap-space-sm"><div className="rounded-xl bg-surface-container-low p-space-md"><p className="font-caption text-caption text-text-secondary">Active registrations</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{activeRegistrationCount}</p></div><div className="rounded-xl bg-surface-container-low p-space-md"><p className="font-caption text-caption text-text-secondary">Checked in</p><p className="mt-1 font-headline-md text-headline-md text-primary">{checkedInCount}</p></div><div className="rounded-xl bg-surface-container-low p-space-md"><p className="font-caption text-caption text-text-secondary">Checked out</p><p className="mt-1 font-headline-md text-headline-md text-on-surface">{checkedOutCount}</p></div></div></section>
          <section className="rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card"><h2 className="font-title-lg text-title-lg text-on-surface">Recent scans</h2>{latestRows.length ? <ul className="mt-space-sm divide-y divide-border-subtle">{latestRows.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-space-sm py-space-sm"><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{entry.studentId}</p><p className="font-caption text-caption capitalize text-text-secondary">{entry.kind.replace('_', ' ')} · {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(entry.at))}</p></div><span className="font-caption text-caption text-text-subtle">Recorded</span></li>)}</ul> : <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">No scans recorded for this seminar yet.</p>}</section>
        </div>
      </div>
    </PageContainer>
  );
}
