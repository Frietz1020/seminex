import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ScanLedgerEntry } from '../../../api/client';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useResource } from '../../../hooks/useResource';
import { useUnsyncedScanCount } from '../../../hooks/useUnsyncedScanCount';
import { useOrgIdentity } from '../../../session/OrgIdentityProvider';
import { getOrgLifecycle } from '../seminarStatus';

interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>; }
interface BarcodeDetectorConstructor { new (options: { formats: string[] }): BarcodeDetectorLike; }

function readStudentCode(value: string) {
  return value.trim().match(/20\d{7}/)?.[0] ?? '';
}

export default function OrgScannerPage() {
  const { id = '' } = useParams();
  const { state: identityState } = useOrgIdentity();
  const online = useOnlineStatus();
  const pendingCount = useUnsyncedScanCount();
  const listing = useResource(() => api.listOrgSeminars(), `scanner-seminar-${id}`);
  const seminar = listing.state.status === 'success' ? listing.state.data.seminars.find((item) => item.id === id) : null;
  const roster = useResource(() => api.listOrgRoster(id), `scanner-roster-${id}`, (items) => items.length === 0);
  const ledger = useResource(() => api.listLedger(id), `scanner-ledger-${id}`, (items) => items.length === 0);
  const [code, setCode] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [working, setWorking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState<ScanLedgerEntry[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCameraCode = useRef('');
  const cameraProcessing = useRef(false);
  const processCodeRef = useRef<(value: string) => void>(() => undefined);

  const processCode = useCallback(async (raw: string, method: 'qr' | 'manual' = 'qr') => {
    if (working) return;
    const studentId = readStudentCode(raw);
    if (!studentId) { setReason('Scan a student ID QR code or enter the 9-digit student ID.'); return; }
    if (roster.state.status !== 'success') { setReason('The registered student list is not ready yet.'); return; }
    const student = roster.state.data.find((item) => item.studentId === studentId && !item.removal);
    if (!student) { setReason('This student is not on the active registration list for this seminar.'); return; }
    if (method === 'manual' && manualReason.trim().length < 5) { setReason('Add a short reason before recording a manual attendance entry.'); return; }
    const recorded = [...(ledger.state.status === 'success' ? ledger.state.data : []), ...pending]
      .filter((entry) => entry.studentId === studentId && (entry.kind === 'time_in' || entry.kind === 'time_out'))
      .sort((a, b) => b.at.localeCompare(a.at));
    const kind = recorded[0]?.kind === 'time_in' ? 'time_out' : 'time_in';
    const identity = identityState.status === 'success' ? identityState.data : null;
    const at = new Date().toISOString();
    const entry: ScanLedgerEntry = {
      id: `scan-${crypto.randomUUID()}`,
      seminarId: id,
      studentId,
      kind,
      at,
      method,
      ...(method === 'manual' ? { reason: manualReason.trim() } : {}),
      officerId: identity?.accountId ?? 'officer',
      officerName: identity ? `${identity.firstName} ${identity.lastName}` : 'Organization officer',
      clientTimestamp: at,
      synced: false,
    };
    setWorking(true);
    const result = await api.recordOrgScan(entry);
    setWorking(false);
    if (!result.ok) { setReason('The attendance entry could not be saved. Check the student and try again.'); return; }
    setPending((entries) => [...entries, { ...entry, synced: online }]);
    setReason(`${student.firstName} ${student.lastName} · ${kind === 'time_in' ? 'Time-in' : 'Time-out'} recorded${online ? '.' : ' offline; queued to sync.'}`);
    setCode('');
    setManualReason('');
    if (online) ledger.reload();
  }, [working, roster.state, ledger.state, ledger.reload, pending, identityState, id, online, manualReason]);

  useEffect(() => { processCodeRef.current = (value) => { void processCode(value, 'qr'); }; }, [processCode]);

  useEffect(() => {
    if (!cameraStream || !videoRef.current) return;
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) { setCameraError('Camera QR detection is not supported in this browser. Use the scan field below or connect a keyboard QR scanner.'); return; }
    const detector = new Detector({ formats: ['qr_code'] });
    const video = videoRef.current;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
    let active = true;
    const timer = window.setInterval(() => {
      if (!active || cameraProcessing.current || video.readyState < 2) return;
      cameraProcessing.current = true;
      void detector.detect(video).then((codes) => {
        const value = codes[0]?.rawValue;
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

  async function startCamera() {
    setCameraError(null);
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

  const latestRows = [...(ledger.state.status === 'success' ? ledger.state.data : []), ...pending].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const lifecycle = getOrgLifecycle(seminar, Date.now());

  return (
    <PageContainer>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary"><Link to={`/org/my-seminars/${seminar.id}`} className="hover:text-primary">{seminar.title}</Link><Icon name="chevron_right" size={16} /><span>Attendance scanner</span></nav>
      <header className="flex flex-col justify-between gap-space-md sm:flex-row sm:items-end"><div><p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">{seminar.reference} · {lifecycle}</p><h1 className="mt-space-xs font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">Check-in scanner</h1><p className="mt-space-xs font-body-base text-body-base text-text-secondary">Scan a registered student’s QR code to record time-in or time-out.</p></div><Link to={`/org/my-seminars/${seminar.id}`} className={actionTonal}><Icon name="arrow_back" size={18} />Seminar details</Link></header>

      <div className="grid items-start gap-space-lg lg:grid-cols-[1.2fr_0.8fr]">
        <section className="flex flex-col gap-space-md rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card" aria-labelledby="scan-title">
          <div className="flex items-center justify-between gap-3"><div><h2 id="scan-title" className="font-title-lg text-title-lg text-on-surface">Scan attendee</h2><p className="mt-1 font-body-sm text-body-sm text-text-secondary">Aim the camera at the student’s Seminex attendance QR.</p></div><span className={`rounded-full px-3 py-1 font-caption text-caption ${online ? 'bg-status-available-container text-status-available' : 'bg-status-ongoing-container text-status-ongoing'}`}>{online ? 'Online' : 'Offline'}</span></div>
          <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-charcoal-900 aspect-video">
            {cameraStream ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" /> : <div className="flex h-full min-h-52 flex-col items-center justify-center gap-space-sm text-on-primary"><Icon name="qr_code_scanner" size={32} /><p className="font-body-sm text-body-sm">Camera preview</p><button type="button" onClick={() => void startCamera()} className="rounded-lg bg-surface-card px-4 py-2 font-body-sm-medium text-body-sm-medium text-primary">Start camera</button></div>}
          </div>
          {cameraStream && <button type="button" onClick={() => { cameraStream.getTracks().forEach((track) => track.stop()); setCameraStream(null); }} className={actionTonal}>Stop camera</button>}
          {cameraError && <p role="status" className="rounded-lg bg-surface-container-low p-space-sm font-caption text-caption text-text-secondary">{cameraError}</p>}
          <form onSubmit={(event) => { event.preventDefault(); void processCode(code, 'manual'); }} className="flex flex-col gap-space-sm">
            <label className="sr-only" htmlFor="attendee-code">Manually enter Student ID</label>
            <div className="flex flex-col gap-space-sm sm:flex-row"><input id="attendee-code" autoComplete="off" autoCapitalize="off" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter Student ID manually" className="h-12 min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-light px-4 font-body-base text-body-base outline-none focus:border-primary" /><button type="submit" disabled={working || !code.trim() || manualReason.trim().length < 5} className={actionPrimary}>{working ? 'Recording…' : 'Record manual entry'}</button></div>
            <label htmlFor="manual-reason" className="font-caption text-caption text-text-secondary">Reason for manual entry</label><input id="manual-reason" value={manualReason} onChange={(event) => setManualReason(event.target.value)} minLength={5} required placeholder="For example, attendee QR code was damaged" className="h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm outline-none focus:border-primary" />
          </form>
          <p className="font-caption text-caption text-text-secondary">Camera scans are recorded as QR entries. Manual entries require a reason and are preserved in the attendance ledger.</p>
          {reason && <p role="status" className="rounded-lg border border-border-subtle bg-surface-container-low p-space-md font-body-sm-medium text-body-sm-medium text-on-surface">{reason}</p>}
        </section>

        <div className="flex flex-col gap-space-lg">
          <section className="rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card"><div className="flex items-center justify-between"><h2 className="font-title-lg text-title-lg text-on-surface">Device readiness</h2><Icon name="offline_pin" size={22} className={online ? 'text-status-available' : 'text-status-ongoing'} /></div><p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">Scans save to this device first. Pending entries sync when a connection is available.</p><div className="mt-space-md flex items-center justify-between rounded-lg bg-surface-container-low p-space-md"><span className="font-body-sm-medium text-body-sm-medium text-on-surface">Unsynced scans</span><strong className="font-headline-sm text-headline-sm text-primary">{pendingCount}</strong></div><button type="button" onClick={() => void api.syncQueuedScans()} disabled={!online || pendingCount === 0} className={`${actionTonal} mt-space-md w-full` }><Icon name="sync" size={18} />Sync pending scans</button></section>
          <section className="rounded-xl border border-border-subtle bg-surface-card p-space-lg shadow-card"><h2 className="font-title-lg text-title-lg text-on-surface">Recent scans</h2>{latestRows.length ? <ul className="mt-space-sm divide-y divide-border-subtle">{latestRows.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-space-sm py-space-sm"><div><p className="font-body-sm-medium text-body-sm-medium text-on-surface">{entry.studentId}</p><p className="font-caption text-caption capitalize text-text-secondary">{entry.kind.replace('_', ' ')} · {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(entry.at))}</p></div><span className="font-caption text-caption text-text-subtle">{entry.synced ? 'Synced' : 'Queued'}</span></li>)}</ul> : <p className="mt-space-sm font-body-sm text-body-sm text-text-secondary">No scans recorded for this seminar yet.</p>}</section>
        </div>
      </div>
    </PageContainer>
  );
}
