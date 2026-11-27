import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Link, useParams } from 'react-router-dom';
import { api, type ScannedStudentIdentity } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { PageHeader } from '../../../components/shell/PageHeader';
import { Avatar } from '../../../components/ui/Avatar';
import { Dialog } from '../../../components/ui/Dialog';
import { Icon } from '../../../components/ui/Icon';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { useResource } from '../../../hooks/useResource';
import { parseAttendanceChallengePayload } from '../../seminars/AttendanceQr';
import { orgActionPrimary as actionPrimary, orgActionTonal as actionTonal } from '../orgActionStyles';
import { getOrgLifecycle } from '../seminarStatus';

interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>; }
interface BarcodeDetectorConstructor { new (options: { formats: string[] }): BarcodeDetectorLike; }

interface ScanFeedback {
  kind: 'success' | 'error';
  title: string;
  message: string;
  modeLabel?: string;
  recordedAt?: string;
  student?: ScannedStudentIdentity | null;
}

function scanFailureMessage(code: string, method: 'qr' | 'manual', scanKind: 'time_in' | 'time_out' | null): string {
  if (code === 'attendance_already_recorded' && method === 'qr') {
    return `${scanKind === 'time_out' ? 'Time-Out' : 'Time-In'} is already recorded for this attendee.`;
  }
  if (code === 'not_found') return 'This student is not on the active registration list for this seminar.';
  if (code === 'registration_inactive') return 'This registration is no longer active. Check the seminar roster before scanning again.';
  if (code === 'challenge_expired') return 'QR challenge expired. Ask the attendee to refresh the live QR, then scan the new code.';
  if (code === 'outside_scan_window') return 'Attendance is outside the scan window. Check the seminar time and attendance status.';
  if (code === 'not_available' && method === 'qr') return 'This QR has expired or attendance is outside the scan window. Ask the attendee to refresh the live QR and check the seminar time.';
  if (code === 'wrong_attendance_step' && method === 'qr') return 'The selected mode does not match this attendee’s next attendance step. Check their attendance status, then choose Time-In or Time-Out.';
  if (code === 'attendance_already_complete') return 'This attendee already has both Time-In and Time-Out recorded.';
  if (code === 'challenge_replayed') return 'This QR challenge was already used. Ask the attendee to refresh their live QR before the next scan.';
  if (code === 'idempotency_conflict') return 'This scan request conflicts with an earlier request. Refresh the attendee QR and try again.';
  if (code === 'forbidden') return 'Your organization access does not allow this attendance scan. Ask an organization administrator to check your membership.';
  if (code === 'network') return 'The scan response could not be confirmed because the connection failed. Retry the same scan while the QR is live.';
  if (code === 'server_error') return 'The attendance service could not process this scan. Check the attendance ledger, then try again with a fresh QR.';
  if (code === 'conflict' && method === 'qr') return 'The attendance scan conflicted with the current record. Refresh the attendee QR and check the ledger.';
  return 'The attendance entry could not be saved. Check the seminar status and try again.';
}

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
  const [scanKind, setScanKind] = useState<'time_in' | 'time_out'>('time_in');
  const [reason, setReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [working, setWorking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [lastScannedStudent, setLastScannedStudent] = useState<ScannedStudentIdentity | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastCameraCode = useRef('');
  const lastCameraPayload = useRef('');
  const emptyCameraDetections = useRef(0);
  const suppressedCameraScans = useRef(new Set<string>());
  const cameraProcessing = useRef(false);
  const processCodeRef = useRef<(value: string) => void>(() => undefined);
  const pendingScan = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const feedbackOpen = useRef(false);
  const operationInFlight = useRef(false);

  function showFeedback(next: ScanFeedback) {
    feedbackOpen.current = true;
    setFeedback(next);
  }

  function closeFeedback() {
    feedbackOpen.current = false;
    setFeedback(null);
  }

  const processCode = useCallback(async (raw: string, method: 'qr' | 'manual' = 'qr') => {
    if (working || operationInFlight.current || feedbackOpen.current) return;
    if (!online) { setReason('No connection. Attendance scanning is unavailable offline.'); return; }
    const challenge = method === 'qr' ? parseAttendanceChallengePayload(raw) : null;
    const studentId = method === 'manual' ? readStudentCode(raw) : '';
    if (method === 'qr' && !challenge) { setReason('This is not a live Seminex attendance QR. Ask the student to refresh it.'); return; }
    if (method === 'manual' && !studentId) { setReason('Enter the 9-digit Student ID for a manual attendance entry.'); return; }
    setReason(null);
    const fingerprint = `${id}|${challenge ?? studentId}|${method}|${method === 'qr' ? scanKind : manualReason.trim()}`;
    const idempotencyKey = pendingScan.current?.fingerprint === fingerprint
      ? pendingScan.current.idempotencyKey
      : crypto.randomUUID();
    setWorking(true);
    operationInFlight.current = true;
    const result = challenge
      ? await api.recordOrgChallengeScan({ seminarId: id, challenge, idempotencyKey, kind: scanKind })
      : await api.recordOrgScan({ seminarId: id, studentId, method: 'manual', idempotencyKey, reason: manualReason.trim() || undefined });
    setWorking(false);
    operationInFlight.current = false;
    if (!result.ok) {
      pendingScan.current = result.error.code === 'network' ? { fingerprint, idempotencyKey } : null;
      if (method === 'qr') suppressedCameraScans.current.add(fingerprint);
      showFeedback({
        kind: 'error',
        title: 'Attendance scan needs attention',
        message: scanFailureMessage(result.error.code, method, scanKind),
      });
      return;
    }
    pendingScan.current = null;
    setLastScannedStudent(result.data.student);
    if (method === 'qr') suppressedCameraScans.current.add(fingerprint);
    const modeLabel = result.data.entry.kind === 'time_in' ? 'Time-In' : 'Time-Out';
    showFeedback({
      kind: 'success',
      title: `${modeLabel} recorded`,
      message: `${method === 'manual' ? 'Manual ' : ''}${modeLabel} has been saved to the attendance ledger.`,
      modeLabel,
      recordedAt: result.data.entry.at,
      student: result.data.student,
    });
    setCode('');
    setManualReason('');
    ledger.reload();
  }, [working, ledger, id, online, manualReason, scanKind]);

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
      if (feedbackOpen.current || operationInFlight.current) return;
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
        if (!value) {
          emptyCameraDetections.current += 1;
          lastCameraCode.current = '';
          if (emptyCameraDetections.current >= 3) {
            lastCameraPayload.current = '';
            suppressedCameraScans.current.clear();
          }
          return;
        }

        emptyCameraDetections.current = 0;
        const payloadKey = `${id}|${parseAttendanceChallengePayload(value) ?? value}`;
        if (payloadKey !== lastCameraPayload.current) {
          lastCameraPayload.current = payloadKey;
          lastCameraCode.current = '';
          suppressedCameraScans.current.clear();
        }
        const scanFingerprint = `${payloadKey}|qr|${scanKind}`;
        if (scanFingerprint !== lastCameraCode.current && !suppressedCameraScans.current.has(scanFingerprint)) {
          lastCameraCode.current = scanFingerprint;
          processCodeRef.current(value);
          window.setTimeout(() => { if (lastCameraCode.current === scanFingerprint) lastCameraCode.current = ''; }, 2500);
        }
      }).catch(() => setCameraError('Could not read the QR code. Adjust the camera and try again.')).finally(() => { cameraProcessing.current = false; });
    }, 350);
    return () => { active = false; window.clearInterval(timer); };
  }, [cameraStream, id, scanKind]);

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
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError('Camera access is not available here. Use manual Student ID entry instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { setCameraError('Camera permission was not granted. You can still record attendance using Student ID.'); }
  }

  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }

  if (listing.state.status === 'loading') return <PageContainer><LoadingRegion label="Loading scanner"><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-96 rounded-xl" /></LoadingRegion></PageContainer>;
  if (listing.state.status === 'error') return <PageContainer><StateMessage role="alert" icon="info" title="Scanner could not load seminar details" action={<RetryButton onClick={listing.reload} />}>Try again when connected.</StateMessage></PageContainer>;
  if (!seminar) return <PageContainer><StateMessage role="status" icon="event_busy" title="Seminar not found" action={<Link to="/org/my-seminars" className={actionPrimary}>Back to My Seminars</Link>}>This seminar is not available in your workspace.</StateMessage></PageContainer>;
  if (seminar.seminarType === 'webinar') return <PageContainer><StateMessage icon="fact_check" title="Webinars use attendance proof review" action={<Link to={`/org/my-seminars/${seminar.id}#attendance`} className={actionPrimary}>Open attendance proof review</Link>}>The in-person scanner is unavailable for webinars.</StateMessage></PageContainer>;
  if (now === null) return <PageContainer><p role="status" className="font-body-sm text-body-sm text-text-secondary">Loading current seminar times…</p></PageContainer>;

  const allScans = ledger.state.status === 'success' ? ledger.state.data : [];
  const latestRows = [...allScans].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  const checkedInCount = new Set(allScans.filter((entry) => entry.kind === 'time_in').map((entry) => entry.studentId)).size;
  const checkedOutCount = new Set(allScans.filter((entry) => entry.kind === 'time_out').map((entry) => entry.studentId)).size;
  const activeRegistrationCount = roster.state.status === 'success'
    ? roster.state.data.filter((student) => !student.removal && student.status !== 'released' && student.status !== 'cancelled').length
    : 0;
  const lifecycle = getOrgLifecycle(seminar, now);

  return (
    <PageContainer>
      {!online && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-highest p-space-md font-body-sm text-body-sm text-on-surface">
          <Icon name="cloud_off" size={18} className="shrink-0 text-secondary" />
          No connection. Attendance scanning is unavailable offline.
        </p>
      )}

      <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-caption text-caption text-text-secondary">
        <Link to={`/org/my-seminars/${seminar.id}`} className="hover:text-primary">{seminar.title}</Link>
        <Icon name="chevron_right" size={16} />
        <span>Check-in scanner</span>
      </nav>

      <PageHeader
        title="Check-in scanner"
        subtitle={`${seminar.reference} · ${lifecycle[0]!.toUpperCase() + lifecycle.slice(1)} · Scan live attendance QR codes or enter Student IDs.`}
        meta={
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-sm text-label-sm ${online ? 'bg-status-available-container text-status-available' : 'bg-status-ongoing-container text-status-ongoing'}`}>
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-status-available' : 'bg-status-ongoing'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
        }
        actions={
          <Link to={`/org/my-seminars/${seminar.id}`} className={actionTonal}>
            <Icon name="arrow_back" size={18} />
            Seminar details
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-space-lg xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        {/* Left: Live QR Viewfinder & Scan Mode Console */}
        <section
          className="flex flex-col gap-space-md rounded-2xl border border-border-subtle bg-surface-card p-space-lg shadow-sm"
          aria-labelledby="scan-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="scan-title" className="font-title-md text-title-md text-on-surface">Live QR scanner</h2>
              <p className="mt-0.5 font-caption text-caption text-text-secondary">
                Choose entry or exit mode, then aim at the attendee’s live QR.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                role="radiogroup"
                aria-label="Scan mode"
                className="inline-flex rounded-xl bg-surface-container-high p-1"
              >
                {(
                  [
                    ['time_in', 'Time-In'],
                    ['time_out', 'Time-Out'],
                  ] as const
                ).map(([value, label]) => {
                  const active = scanKind === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={working}
                      onClick={() => setScanKind(value)}
                      className={`min-h-9 rounded-lg px-4 font-body-sm-medium text-body-sm-medium transition-all disabled:opacity-50 ${
                        active
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-text-secondary hover:text-on-surface'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {cameraStream && (
                <button type="button" onClick={stopCamera} className={actionTonal}>
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Crisp proportional viewfinder */}
          <div className="relative isolate aspect-[16/10] max-h-[26rem] w-full overflow-hidden rounded-xl border border-border-subtle bg-inverse-surface">
            {cameraStream ? (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Icon name="qr_code_scanner" size={28} />
                </div>
                <div>
                  <p className="font-title-sm text-title-sm text-white">
                    Ready for {scanKind === 'time_in' ? 'Time-In' : 'Time-Out'}
                  </p>
                  <p className="mt-1 font-caption text-caption text-white/70">
                    Start the camera to scan live Seminex QR codes automatically.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!online || feedback !== null || working}
                  onClick={() => void startCamera()}
                  className={`${actionPrimary} mt-1`}
                >
                  <Icon name="photo_camera" size={18} />
                  Start camera
                </button>
              </div>
            )}
            {cameraStream && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="relative aspect-square w-[min(52%,15rem)] rounded-2xl border-2 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.32)]">
                  <span className="absolute -left-0.5 -top-0.5 h-6 w-6 rounded-tl-xl border-l-4 border-t-4 border-secondary" />
                  <span className="absolute -right-0.5 -top-0.5 h-6 w-6 rounded-tr-xl border-r-4 border-t-4 border-secondary" />
                  <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-xl border-b-4 border-l-4 border-secondary" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-br-xl border-b-4 border-r-4 border-secondary" />
                </div>
              </div>
            )}
          </div>

          {cameraError && (
            <p role="status" className="rounded-lg bg-surface-container-low p-space-sm font-caption text-caption text-text-secondary">
              {cameraError}
            </p>
          )}
          {reason && (
            <p role="status" aria-live="polite" className="rounded-lg border border-border-subtle bg-surface-container-low p-space-md font-body-sm-medium text-body-sm-medium text-on-surface">
              {reason}
            </p>
          )}

          {lastScannedStudent && (
            <article
              className="flex items-center gap-space-md rounded-xl border border-status-available/30 bg-status-available-container/40 p-space-md"
              aria-label="Scanned student record"
            >
              <Avatar
                src={lastScannedStudent.avatarUrl}
                firstName={lastScannedStudent.firstName}
                lastName={lastScannedStudent.lastName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-caption text-caption font-semibold text-status-available">Last verified attendee</p>
                <h3 className="truncate font-title-sm text-title-sm text-on-surface">
                  {lastScannedStudent.firstName}{' '}
                  {lastScannedStudent.middleInitial ? `${lastScannedStudent.middleInitial}. ` : ''}
                  {lastScannedStudent.lastName}
                </h3>
                <p className="truncate font-caption text-caption tabular-nums text-text-secondary">
                  {lastScannedStudent.studentId}
                  {lastScannedStudent.program ? ` · ${lastScannedStudent.program}` : ''}
                  {lastScannedStudent.yearLevel ? ` · Year ${lastScannedStudent.yearLevel}` : ''}
                  {lastScannedStudent.block ? ` · Block ${lastScannedStudent.block}` : ''}
                </p>
              </div>
            </article>
          )}
        </section>

        {/* Right: Live Overview + Manual Entry + Recent Scans */}
        <div className="flex flex-col gap-space-md">
          <section className="flex flex-col gap-space-md rounded-2xl border border-border-subtle bg-surface-card p-space-lg shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-title-md text-title-md text-on-surface">Attendance overview</h2>
              <span className="font-caption text-caption tabular-nums text-text-secondary">
                {activeRegistrationCount > 0 ? Math.round((checkedInCount / activeRegistrationCount) * 100) : 0}% checked in
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-surface-container-low/60 tabular-nums">
              <div className="p-3.5">
                <p className="font-caption text-caption text-text-secondary">Registered</p>
                <p className="mt-0.5 font-headline-md text-headline-md text-on-surface">{activeRegistrationCount}</p>
              </div>
              <div className="p-3.5">
                <p className="font-caption text-caption text-text-secondary">Timed in</p>
                <p className="mt-0.5 font-headline-md text-headline-md text-primary">{checkedInCount}</p>
              </div>
              <div className="p-3.5">
                <p className="font-caption text-caption text-text-secondary">Timed out</p>
                <p className="mt-0.5 font-headline-md text-headline-md text-status-available">{checkedOutCount}</p>
              </div>
            </div>
            <ProgressBar
              value={checkedInCount}
              max={Math.max(1, activeRegistrationCount)}
              label={`${checkedInCount} of ${activeRegistrationCount} registered students checked in`}
            />
          </section>

          <section className="flex flex-col gap-space-sm rounded-2xl border border-border-subtle bg-surface-card p-space-lg shadow-sm">
            <div>
              <h2 className="font-title-sm text-title-sm text-on-surface">Manual entry</h2>
              <p className="mt-0.5 font-caption text-caption text-text-secondary">
                Fallback when an attendee’s QR cannot be scanned.
              </p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void processCode(code, 'manual');
              }}
              className="mt-1 flex flex-col gap-2.5"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="sr-only" htmlFor="attendee-code">
                  Manually enter Student ID
                </label>
                <input
                  id="attendee-code"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCapitalize="off"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="9-digit Student ID (e.g. 202410770)"
                  disabled={!online || feedback !== null || working}
                  className="h-11 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-body-sm text-body-sm tabular-nums text-on-surface outline-none focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!online || working || feedback !== null || !code.trim()}
                  className={actionPrimary}
                >
                  {working ? 'Recording…' : 'Record'}
                </button>
              </div>
              <label className="sr-only" htmlFor="manual-reason">
                Reason (optional)
              </label>
              <input
                id="manual-reason"
                value={manualReason}
                onChange={(event) => setManualReason(event.target.value)}
                maxLength={500}
                disabled={!online || feedback !== null || working}
                placeholder="Optional reason (e.g. damaged QR screen)"
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface-light px-3.5 font-caption text-caption text-on-surface outline-none focus:border-primary focus:bg-surface-card focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
            </form>
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface-card p-space-lg shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-title-sm text-title-sm text-on-surface">Recent scans</h2>
              <span className="font-caption text-caption tabular-nums text-text-secondary">
                {allScans.length} total
              </span>
            </div>
            {latestRows.length ? (
              <ul className="mt-3 divide-y divide-border-subtle">
                {latestRows.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 font-caption text-caption font-medium capitalize ${
                          entry.kind === 'time_out'
                            ? 'bg-status-available-container text-status-available'
                            : 'bg-maroon-container text-primary'
                        }`}
                      >
                        {entry.kind.replace('_', ' ')}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-body-sm-medium text-body-sm-medium tabular-nums text-on-surface">
                          {entry.studentId}
                        </p>
                        <p className="font-caption text-caption tabular-nums text-text-secondary">
                          {new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(entry.at))}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 font-caption text-caption text-status-available">
                      <Icon name="check_circle" size={14} />
                      Recorded
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 font-body-sm text-body-sm text-text-secondary">
                No scans recorded for this seminar yet.
              </p>
            )}
          </section>
        </div>
      </div>

      <Dialog open={feedback !== null} onClose={closeFeedback} title={feedback?.title ?? 'Attendance result'}>
        {feedback && (
          <div className="mt-space-md flex flex-col gap-space-md">
            <div
              role={feedback.kind === 'success' ? 'status' : 'alert'}
              className={`flex items-start gap-3 rounded-xl border p-space-md ${
                feedback.kind === 'success'
                  ? 'border-status-available/30 bg-status-available-container/40 text-on-surface'
                  : 'border-danger/30 bg-danger-surface text-danger-ink'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  feedback.kind === 'success'
                    ? 'bg-status-available text-white'
                    : 'bg-danger text-white'
                }`}
              >
                <Icon name={feedback.kind === 'success' ? 'check_circle' : 'error'} size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body-sm-medium text-body-sm-medium">{feedback.message}</p>
                {(feedback.modeLabel || feedback.recordedAt) && (
                  <p className="mt-1 font-caption text-caption tabular-nums text-text-secondary">
                    {feedback.modeLabel}
                    {feedback.recordedAt
                      ? ` · ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(feedback.recordedAt))}`
                      : ''}
                  </p>
                )}
              </div>
            </div>

            {feedback.student && (
              <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-container-low p-space-md">
                <Avatar
                  src={feedback.student.avatarUrl}
                  firstName={feedback.student.firstName}
                  lastName={feedback.student.lastName}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body-sm-medium text-body-sm-medium text-on-surface">
                    {feedback.student.firstName}{' '}
                    {feedback.student.middleInitial ? `${feedback.student.middleInitial}. ` : ''}
                    {feedback.student.lastName}
                  </p>
                  <p className="truncate font-caption text-caption tabular-nums text-text-secondary">
                    {feedback.student.studentId}
                    {feedback.student.program ? ` · ${feedback.student.program}` : ''}
                    {feedback.student.yearLevel ? ` · Year ${feedback.student.yearLevel}` : ''}
                    {feedback.student.block ? ` · Block ${feedback.student.block}` : ''}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeFeedback}
                className={feedback.kind === 'success' ? actionPrimary : actionTonal}
              >
                {feedback.kind === 'success' ? 'Scan next attendee' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </PageContainer>
  );
}
