import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { QrCode } from './QrCode';

export function attendanceChallengePayload(challenge: string): string {
  if (!/^[a-f0-9]{64}$/.test(challenge)) throw new Error('Invalid attendance challenge.');
  return `SEMINEX1:${challenge}`;
}

export function parseAttendanceChallengePayload(value: string): string | null {
  const match = /^SEMINEX1:([a-f0-9]{64})$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function AttendanceQr({ seminarId, title, size }: { seminarId: string; title: string; size: number }) {
  const online = useOnlineStatus();
  const [challenge, setChallenge] = useState<{ value: string; expiresAt: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let timer = 0;
    setChallenge(null);
    setFailed(false);
    if (!online) return () => { active = false; };

    const issue = async () => {
      const result = await api.issueAttendanceChallenge(seminarId);
      if (!active) return;
      if (!result.ok) { setFailed(true); return; }
      const expiresAt = Date.parse(result.data.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) { setFailed(true); return; }
      setChallenge({ value: result.data.challenge, expiresAt });
      timer = window.setTimeout(() => { setChallenge(null); void issue(); }, Math.max(1_000, expiresAt - Date.now() - 5_000));
    };
    void issue();
    return () => { active = false; window.clearTimeout(timer); };
  }, [seminarId, online, retry]);

  if (!online) return <p role="status">Connect to show your live attendance QR.</p>;
  if (failed) return <div><p role="alert">A live attendance QR could not be loaded.</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>;
  if (!challenge) return <p role="status">Loading a secure attendance QR…</p>;
  return <div aria-label={`Live attendance QR for ${title}`}><QrCode value={attendanceChallengePayload(challenge.value)} size={size} label={`Live attendance QR for ${title}`} /><p role="status">Refreshes automatically; valid until {new Date(challenge.expiresAt).toLocaleTimeString()}.</p></div>;
}
