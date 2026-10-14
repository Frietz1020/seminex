import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { PageContainer } from '../../../components/shell/PageContainer';
import { actionPrimary, actionTonal } from '../../../components/ui/actionStyles';
import { AcademicYearPill } from '../../../components/ui/AcademicYearPill';
import { errorText } from '../../../components/ui/errorText';
import { Icon } from '../../../components/ui/Icon';
import { LoadingRegion, RetryButton, Skeleton, StateMessage } from '../../../components/ui/StateMessage';
import { useNow } from '../../../hooks/useNow';
import { useResource } from '../../../hooks/useResource';
import { getAcademicPeriod } from '../../seminars/academicPeriod';
import { HistoryMetrics } from '../components/HistoryMetrics';
import { HistoryToolbar } from '../components/HistoryToolbar';
import { PolicyBanner } from '../components/PolicyBanner';
import { RecordCard } from '../components/RecordCard';
import { countByFilter, viewRecords, type HistoryFilter, type HistorySort } from '../historyView';
import { buildHistoryRecords, summarizeHistory } from '../records';

export default function HistoryPage() {
  const now = useNow();
  const period = getAcademicPeriod(now);
  const history = useResource(() => api.listHistory(), 'history');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [sort, setSort] = useState<HistorySort>('recent');

  useEffect(() => {
    document.title = 'History - Seminex';
  }, []);

  const state = history.state;
  const items = state.status === 'success' ? state.data : null;
  const records = useMemo(() => (items ? buildHistoryRecords(items, now) : []), [items, now]);
  const summary = useMemo(() => summarizeHistory(records), [records]);
  const counts = useMemo(() => countByFilter(records), [records]);
  const visible = useMemo(() => viewRecords(records, filter, query, sort), [records, filter, query, sort]);

  const isEmpty = state.status === 'success' && records.length === 0;
  const hasRecords = state.status === 'success' && records.length > 0;

  return (
    <PageContainer>
      <header className="flex flex-col justify-between gap-space-lg lg:flex-row lg:items-end">
        <div className="flex max-w-2xl flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-sm">
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Student portal</p>
            <AcademicYearPill academicYear={period.academicYear} />
          </div>
          <h1 className="font-headline-xl text-headline-xl-mobile tracking-tight text-primary md:text-headline-xl">
            History
          </h1>
          <p className="font-body-base text-body-base text-text-secondary">
            Browse past seminars, check your attendance and evaluation records, and get your certificates.
          </p>
        </div>
        {hasRecords && <HistoryMetrics summary={summary} />}
      </header>

      {state.status === 'loading' && (
        <LoadingRegion label="Loading your history" className="flex flex-col gap-space-md">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </LoadingRegion>
      )}

      {state.status === 'error' && (
        <StateMessage
          role="alert"
          icon="info"
          title="Your history could not be loaded"
          action={<RetryButton onClick={history.reload} />}
        >
          {errorText(state.code)}
        </StateMessage>
      )}

      {isEmpty && (
        <StateMessage
          role="status"
          icon="history"
          title="No finished seminars yet"
          action={
            <Link to="/seminars" className={actionPrimary}>
              Browse available seminars
            </Link>
          }
        >
          Seminars you register for appear here after they finish, with your attendance and certificates.
        </StateMessage>
      )}

      {hasRecords && (
        <>
          {state.status === 'success' && state.fromCache && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg bg-surface-container-low px-space-md py-space-sm font-body-sm text-body-sm text-text-secondary"
            >
              <Icon name="info" size={18} />
              You are offline. Showing the history saved on this device.
            </p>
          )}

          <PolicyBanner />

          <HistoryToolbar
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            counts={counts}
            sort={sort}
            onSortChange={setSort}
          />

          <p role="status" className="sr-only">
            Showing {visible.length} of {records.length} seminars
          </p>

          {visible.length > 0 ? (
            <ul className="flex flex-col gap-space-md">
              {visible.map((record) => (
                <li key={record.seminar.id}>
                  <RecordCard record={record} />
                </li>
              ))}
            </ul>
          ) : (
            <StateMessage
              icon="search_off"
              title={query.trim() ? 'No seminars match your search' : 'No seminars in this view'}
              action={
                query.trim() ? (
                  <button type="button" onClick={() => setQuery('')} className={actionTonal}>
                    Clear search
                  </button>
                ) : (
                  <button type="button" onClick={() => setFilter('all')} className={actionTonal}>
                    Show all completed
                  </button>
                )
              }
            >
              {query.trim()
                ? 'Check the spelling, or search by a different title, speaker, or venue.'
                : 'None of your finished seminars fit this filter.'}
            </StateMessage>
          )}
        </>
      )}
    </PageContainer>
  );
}