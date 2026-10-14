import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type SeminarListItem } from '../../api/client';
import { errorText } from '../../components/ui/errorText';
import { useToast } from '../../components/ui/Toast';
import { expireSession } from '../../session/storage';

/**
 * Registration flow shared by Home and Available Seminars: register, show a toast with
 * "Undo registration", and keep the card in sync without reloading the list.
 * Returns the list with the latest registration changes applied.
 */
export function useRegistration(baseItems: SeminarListItem[] | null) {
  const { showToast } = useToast();
  const [overrides, setOverrides] = useState<Record<string, SeminarListItem>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const busy = useRef(false);

  // A fresh list from the server replaces any local changes.
  useEffect(() => {
    setOverrides((current) => (Object.keys(current).length > 0 ? {} : current));
  }, [baseItems]);

  const items = useMemo(
    () => (baseItems ? baseItems.map((item) => overrides[item.seminar.id] ?? item) : null),
    [baseItems, overrides],
  );

  const register = useCallback(
    async (seminarId: string) => {
      if (busy.current) return;
      const current = items?.find((item) => item.seminar.id === seminarId);
      if (!current) return;

      busy.current = true;
      setPendingId(seminarId);
      const result = await api.registerForSeminar(seminarId);
      busy.current = false;
      setPendingId(null);

      if (result.ok) {
        const registered = result.data;
        setOverrides((state) => ({ ...state, [seminarId]: registered }));
        showToast({
          title: 'Registration confirmed',
          message: registered.seminar.title,
          actionLabel: 'Undo registration',
          onAction: () => {
            void undo(registered);
          },
        });
        return;
      }

      if (result.error.code === 'session_expired') {
        expireSession();
        return;
      }
      if (result.error.code === 'seminar_full') {
        setOverrides((state) => ({
          ...state,
          [seminarId]: {
            seminar: { ...current.seminar, registeredCount: current.seminar.capacity },
            registration: null,
          },
        }));
        showToast({
          tone: 'error',
          title: 'Seminar is full',
          message: `${current.seminar.title} has no slots left.`,
        });
        return;
      }
      showToast({ tone: 'error', title: 'Registration failed', message: errorText(result.error.code) });
    },
    // undo is defined below and only uses stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, showToast],
  );

  async function undo(registered: SeminarListItem) {
    const { seminar } = registered;
    const result = await api.cancelRegistration(seminar.id);
    if (result.ok) {
      setOverrides((state) => ({
        ...state,
        [seminar.id]: {
          seminar: { ...seminar, registeredCount: Math.max(0, seminar.registeredCount - 1) },
          registration: null,
        },
      }));
      showToast({ title: 'Registration cancelled', message: seminar.title });
      return;
    }
    if (result.error.code === 'session_expired') {
      expireSession();
      return;
    }
    showToast({ tone: 'error', title: 'Registration not cancelled', message: errorText(result.error.code) });
  }

  return { items, pendingId, register };
}