import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { QrCode } from './QrCode';

const QR_GRACE_PERIOD_MS = 60 * 60 * 1_000;

export function attendanceChallengePayload(challenge: string): string {
  if (!/^[a-f0-9]{64}$/.test(challenge)) throw new Error('Invalid attendance challenge.');
  return `SEMINEX1:${challenge}`;
}

export function parseAttendanceChallengePayload(value: string): string | null {
  const match = /^SEMINEX1:([a-f0-9]{64})$/.exec(value.trim());
  return match?.[1] ?? null;
}

export function AttendanceQr({
  seminarId,
  title,
  size,
  acknowledged,
  endsAt,
  serverNow,
}: {
  seminarId: string;
  title: string;
  size: number;
  acknowledged: boolean;
  endsAt: string;
  serverNow: number | null;
}) {
  const online = useOnlineStatus();
  const [challengeState, setChallengeState] = useState<{ key: string; value: string; expiresAt: number } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [refreshedServerNow, setRefreshedServerNow] = useState<number | null>(null);
  const issuedAttemptRef = useRef<string | null>(null);
  const eligibilityKey = `${seminarId}:${endsAt}`;
  const issueAttemptKey = `${eligibilityKey}:${retry}`;
  const expiresAtFromSeminar = useMemo(() => Date.parse(endsAt) + QR_GRACE_PERIOD_MS, [endsAt]);
  const effectiveServerNow = serverNow === null
    ? refreshedServerNow
    : refreshedServerNow === null
      ? serverNow
      : Math.max(serverNow, refreshedServerNow);
  const challenge = challengeState?.key === eligibilityKey ? challengeState : null;
  const failed = failedKey === eligibilityKey;
  const expired = Number.isFinite(expiresAtFromSeminar)
    && effectiveServerNow !== null
    && Number.isFinite(effectiveServerNow)
    && effectiveServerNow > expiresAtFromSeminar;
  const canIssue = online && acknowledged && effectiveServerNow !== null
    && Number.isFinite(effectiveServerNow) && !expired;

  useEffect(() => {
    if (!canIssue) return;
    if (issuedAttemptRef.current === issueAttemptKey) return;
    issuedAttemptRef.current = issueAttemptKey;

    const issue = async () => {
      const result = await api.issueAttendanceChallenge(seminarId);
      if (issuedAttemptRef.current !== issueAttemptKey) return;
      if (!result.ok) {
        setFailedKey(eligibilityKey);
        return;
      }

      const challengeExpiry = Date.parse(result.data.expiresAt);
      const serverTimeResult = await api.getServerTime();
      if (issuedAttemptRef.current !== issueAttemptKey) return;
      if (!serverTimeResult.ok) {
        setFailedKey(eligibilityKey);
        return;
      }
      const freshServerNow = Date.parse(serverTimeResult.data.now);
      if (!Number.isFinite(challengeExpiry) || !Number.isFinite(freshServerNow) || challengeExpiry <= freshServerNow) {
        setFailedKey(eligibilityKey);
        return;
      }

      setRefreshedServerNow(freshServerNow);
      setFailedKey(null);
      setChallengeState({ key: eligibilityKey, value: result.data.challenge, expiresAt: challengeExpiry });
    };

    void issue();
  }, [canIssue, eligibilityKey, issueAttemptKey, seminarId]);

  useEffect(() => {
    if (!challenge) return;
    let active = true;
    let timer = 0;
    const checkExpiry = async () => {
      const result = await api.getServerTime();
      if (!active) return;
      if (!result.ok) return;
      const currentServerTime = Date.parse(result.data.now);
      setRefreshedServerNow(currentServerTime);
      if (!Number.isFinite(currentServerTime) || currentServerTime > challenge.expiresAt) {
        setChallengeState(null);
      }
    };
    const remainingMs = challenge.expiresAt - (effectiveServerNow ?? challenge.expiresAt);
    timer = window.setTimeout(() => { void checkExpiry(); }, Math.max(1, remainingMs + 1));
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkExpiry();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [challenge, effectiveServerNow]);

  if (!online) return <p role="status">Connect to show your attendance QR.</p>;
  if (effectiveServerNow === null || !Number.isFinite(effectiveServerNow)) return <p role="status">Checking seminar time…</p>;
  if (!acknowledged) return <p role="status">Attendance acknowledgement is required before your QR becomes available.</p>;
  if (expired) return <p role="status">This attendance QR has expired.</p>;
  if (failed) return <div><p role="alert">A live attendance QR could not be loaded.</p><button type="button" onClick={() => { setFailedKey(null); setRetry((value) => value + 1); }}>Try again</button></div>;
  if (!challenge) return <p role="status">Loading a secure attendance QR…</p>;
  return <div aria-label={`Attendance QR for ${title}`}><QrCode value={attendanceChallengePayload(challenge.value)} size={size} label={`Attendance QR for ${title}`} /><p role="status">Use this QR for Time-In and Time-Out until {new Date(challenge.expiresAt).toLocaleTimeString()}.</p></div>;
}
